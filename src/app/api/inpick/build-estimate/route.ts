/**
 * POST /api/inpick/build-estimate
 *
 * 입력: { rooms: [{ roomName, dim, renderImageUrl? }] }
 *
 * 정책 변경 (2026-05-10): 자재 컨택은 선택사항.
 *   - 이미지 + vision 추출 성공 → 추출된 자재로 견적
 *   - 이미지 없거나 vision 실패 → 방 타입별 표준 자재 (KPA 단가 기반)로 fallback
 *   - 절대 방을 skip하지 않음 (사용자가 "전체 일괄 생성" 안 했어도 견적 가능)
 *
 * 출력: { estimates: RoomEstimate[], grandTotal, fallbackRooms }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildRoomEstimate,
  extractMaterialsFromRender,
  type MaterialItem,
  type RoomEstimate,
} from "@/lib/inpick/estimate";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { lookupMaterialProduct } from "@/lib/inpick/material-product-lookup";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 방 타입별 표준 자재 (KPA 단가 매핑 자동 — 이미지/vision 실패 시 fallback).
 * 사용자가 "부위별 자재 컨택"을 안 했어도 표준 견적 산출 가능.
 */
function defaultSurfacesForRoom(roomName: string): MaterialItem[] {
  const r = roomName.toLowerCase();
  const isBath = r.includes("욕실") || r.includes("화장실") || r.includes("bath");
  const isKitchen = r.includes("부엌") || r.includes("주방") || r.includes("kitchen");
  const isEntry = r.includes("현관") || r.includes("entrance");
  const isBalcony = r.includes("베란다") || r.includes("발코니") || r.includes("balcony");
  const isUtility = r.includes("다용도실") || r.includes("팬트리");
  const isDressroom = r.includes("드레스룸") || r.includes("walk");

  if (isBath) {
    return [
      { surface: "바닥", materialName: "포세린 타일 600x600", unit: "m²", unitPriceWon: 78000, priceSource: "standard" },
      { surface: "벽", materialName: "벽 타일 (실크)", unit: "m²", unitPriceWon: 55000, priceSource: "standard" },
      { surface: "천장", materialName: "방수 도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "욕실세트 (변기+세면대+샤워)", unit: "set", unitPriceWon: 1900000, priceSource: "standard" },
    ];
  }
  if (isKitchen) {
    return [
      { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
      { surface: "벽", materialName: "실크벽지", unit: "m²", unitPriceWon: 12000, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "싱크대 (상·하부장)", unit: "set", unitPriceWon: 8900000, priceSource: "standard" },
    ];
  }
  if (isEntry) {
    return [
      { surface: "바닥", materialName: "포세린 타일", unit: "m²", unitPriceWon: 78000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "도어", materialName: "현관문 (방화)", unit: "EA", unitPriceWon: 320000, priceSource: "standard" },
    ];
  }
  if (isBalcony) {
    return [
      { surface: "바닥", materialName: "데크 타일", unit: "m²", unitPriceWon: 75000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    ];
  }
  if (isUtility) {
    return [
      { surface: "바닥", materialName: "타일", unit: "m²", unitPriceWon: 75000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    ];
  }
  if (isDressroom) {
    return [
      { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "붙박이장 (양벽)", unit: "set", unitPriceWon: 1800000, priceSource: "standard" },
    ];
  }
  // 거실/안방/침실 등 일반 거주 공간
  return [
    { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
    { surface: "벽", materialName: "실크벽지", unit: "m²", unitPriceWon: 12000, priceSource: "standard" },
    { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    { surface: "도어", materialName: "방문", unit: "EA", unitPriceWon: 180000, priceSource: "standard" },
  ];
}

/**
 * 자재 lookup으로 brand/sku/spec 채움 (대표 지목 핵심 기능 — "우리의 킥").
 *
 * material_products 테이블에서 surface 카테고리별 top product 매칭.
 * 매칭 성공 시:
 *   - materialName을 "{brand} {productName}" 형태로 교체
 *   - brand / sku (model_number) / spec (specification) 채움
 *   - contractor_price 있으면 unitPriceWon 갱신 + priceSource="korea_price_assoc" → "vision_estimate" 변경
 * 매칭 실패 시 입력 그대로 (호환).
 */
async function enrichWithBrandSku(
  surfaces: MaterialItem[],
  roomName: string,
): Promise<MaterialItem[]> {
  const out: MaterialItem[] = [];
  for (const m of surfaces) {
    // 이미 brand/sku 있으면 skip (vision/사용자 입력 우선)
    if (m.brand || m.sku) {
      out.push(m);
      continue;
    }
    try {
      const match = await lookupMaterialProduct({
        surface: m.surface,
        roomName,
        materialName: m.materialName,
        preferredGrade: "standard",
      });
      if (!match) {
        out.push(m);
        continue;
      }
      // contractor_price 우선, 없으면 retail_price, 없으면 기존 unitPriceWon 유지
      const matchedPrice =
        match.contractorPrice ??
        match.retailPrice ??
        m.unitPriceWon;
      out.push({
        ...m,
        materialName: `${match.brand} ${match.productName}`,
        brand: match.brand,
        sku: match.sku,
        spec: match.specification,
        unitPriceWon: matchedPrice,
        priceSource: match.contractorPrice ? "vision_estimate" : "standard",
      });
    } catch (e) {
      // lookup 실패 — 원본 그대로
      console.warn(
        `[build-estimate] enrich fail for ${m.surface}/${m.materialName}: ${e instanceof Error ? e.message : String(e)}`,
      );
      out.push(m);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rooms } = body;
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "rooms 배열 필수" }, { status: 400 });
    }
    // 정책 변경: OpenAI 키 없어도 표준 자재로 견적 생성 가능 (vision 자재 추출만 실패)
    const visionAvailable = hasOpenAIKey();

    const estimates: RoomEstimate[] = [];
    const fallbackRooms: Array<{ roomName: string; reason: string }> = [];
    const errors: Array<{ roomName: string; error: string }> = [];

    for (const r of rooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];
      let usedFallback = false;

      // 이미지 + vision 가능 → 자재 추출 시도
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl && visionAvailable) {
        try {
          surfaces = await extractMaterialsFromRender({
            renderImageUrl: r.renderImageUrl,
            roomName: r.roomName,
            dim: r.dim,
          });
        } catch (e) {
          errors.push({
            roomName: r.roomName,
            error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          });
          // 에러 발생 → 표준 자재로 fallback (방 skip 안 함)
        }
      }

      // ─── Fallback: 표준 자재 (사용자 자재 컨택 X / vision 실패 / 이미지 없음) ───
      if (!surfaces || surfaces.length === 0) {
        surfaces = defaultSurfacesForRoom(r.roomName);
        usedFallback = true;
        fallbackRooms.push({
          roomName: r.roomName,
          reason: !r.renderImageUrl
            ? "이미지 없음 — 표준 자재로 산출"
            : !visionAvailable
              ? "Vision 미사용 — 표준 자재로 산출"
              : "Vision 실패 — 표준 자재로 산출",
        });
      }

      // ─── 대표 지목 핵심: brand/sku/spec 자동 매칭 (material_products 253K rows) ───
      // vision 추출 결과 + fallback 모두에 적용. brand/sku 이미 있으면 skip.
      surfaces = await enrichWithBrandSku(surfaces, r.roomName);

      estimates.push(
        buildRoomEstimate({
          roomName: r.roomName,
          dim: r.dim,
          surfaces,
        }),
      );
    }

    const grand = estimates.reduce(
      (acc, e) => ({
        mainTotal: acc.mainTotal + e.mainTotalWon,
        auxTotal: acc.auxTotal + e.auxTotalWon,
        laborTotal: acc.laborTotal + e.laborTotalWon,
        totalWon: acc.totalWon + e.totalWon,
      }),
      { mainTotal: 0, auxTotal: 0, laborTotal: 0, totalWon: 0 },
    );

    return NextResponse.json({
      estimates,
      grandTotal: grand,
      fallbackRooms,            // 표준 자재 적용된 방 (사용자 안내용)
      skippedRooms: [],         // 호환 — 더 이상 skip 안 함
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
