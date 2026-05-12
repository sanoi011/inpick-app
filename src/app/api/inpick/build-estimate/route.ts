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
import type {
  AnalyzedSurface,
  EstimateLineMaterialMeta,
  SurfaceType,
} from "@/lib/vision-materials/types";

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

/**
 * Phase 6 후속 — vision-materials 분석 결과(AnalyzedSurface[])를
 * MaterialItem[]으로 변환해 견적에 우선 적용 (대표 지시 vision-material-estimate-dev-plan).
 *
 * 정책:
 *   - confirmed/recommended만 적용 (fallback은 무시 → defaultSurfaces로 보강)
 *   - SKU hallucination 금지 — top1.materialProductId 있는 것만
 *   - 매칭된 surface는 unit/unitPrice/brand/sku/spec 채움
 */
function visionAnalysisToSurfaces(
  analyzed: AnalyzedSurface[] | undefined,
): MaterialItem[] {
  if (!analyzed || analyzed.length === 0) return [];
  const out: MaterialItem[] = [];
  for (const a of analyzed) {
    const top = a.candidates[0];
    if (!top || !top.materialProductId) continue;
    if (a.recommendation.status === "fallback" || a.recommendation.status === "rejected") {
      continue;
    }
    out.push({
      surface: surfaceTypeToKorean(a.observation.surfaceType),
      materialName: `${top.brand ? top.brand + " " : ""}${top.productName}`,
      brand: top.brand,
      sku: top.sku,
      spec: top.spec,
      unit: ((top.unit as MaterialItem["unit"]) || "EA"),
      unitPriceWon: top.unitPrice || 0,
      priceSource:
        a.recommendation.status === "confirmed" ? "vision_estimate" : "standard",
      confidence: top.confidence,
    });
  }
  return out;
}

function surfaceTypeToKorean(t: SurfaceType): string {
  const m: Record<SurfaceType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    tile: "타일",
    cabinet: "fixture",
    countertop: "fixture",
    baseboard: "걸레받이",
    door: "도어",
    window: "창호",
    fixture: "fixture",
    lighting: "조명",
    sanitary: "fixture",
    unknown: "기타",
  };
  return m[t] || "기타";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // ─── projectMode 분기 (MD §10) ────────────────────────────
    // photo_only / commercial은 17공종 정밀 견적 대신 가견적(면적×등급, zone×업종 단가)을 반환.
    if (body.projectMode === "photo_only") {
      return buildPhotoOnlyEstimate(body);
    }
    if (body.projectMode === "commercial") {
      return buildCommercialEstimate(body);
    }

    const { rooms, visionAnalysisByRoom } = body as {
      rooms: Array<{
        roomName: string;
        // RoomDim — 호출자가 전달하는 dim (estimate.ts 타입)
        dim: { name?: string; widthMm: number; depthMm: number; heightMm?: number };
        renderImageUrl?: string;
        surfaces?: MaterialItem[];
      }>;
      /** Phase 6 후속: vision-materials 분석 결과 (선택) — roomName → AnalyzedSurface[] */
      visionAnalysisByRoom?: Record<string, AnalyzedSurface[]>;
    };
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "rooms 배열 필수" }, { status: 400 });
    }
    // 정책 변경: OpenAI 키 없어도 표준 자재로 견적 생성 가능 (vision 자재 추출만 실패)
    const visionAvailable = hasOpenAIKey();

    const estimates: RoomEstimate[] = [];
    const fallbackRooms: Array<{ roomName: string; reason: string }> = [];
    const errors: Array<{ roomName: string; error: string }> = [];
    const matchMetaByRoom: Record<string, EstimateLineMaterialMeta[]> = {};

    for (const r of rooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];
      const usedSources: string[] = [];

      // ─── 1순위: visionAnalysisByRoom (Phase 6 후속 통합) ───
      const visionRoomResult = visionAnalysisByRoom?.[r.roomName];
      if (visionRoomResult && visionRoomResult.length > 0 && (!surfaces || surfaces.length === 0)) {
        const visionSurfaces = visionAnalysisToSurfaces(visionRoomResult);
        if (visionSurfaces.length > 0) {
          surfaces = visionSurfaces;
          usedSources.push("vision-materials");
        }
      }

      // ─── 2순위: extractMaterialsFromRender (legacy vision 추출) ───
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl && visionAvailable) {
        try {
          surfaces = await extractMaterialsFromRender({
            renderImageUrl: r.renderImageUrl,
            roomName: r.roomName,
            dim: {
            name: r.dim.name || r.roomName,
            widthMm: r.dim.widthMm,
            depthMm: r.dim.depthMm,
            heightMm: r.dim.heightMm ?? 2400,
          },
          });
          if (surfaces.length > 0) usedSources.push("legacy-vision");
        } catch (e) {
          errors.push({
            roomName: r.roomName,
            error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          });
          // 에러 발생 → 표준 자재로 fallback (방 skip 안 함)
        }
      }

      // ─── 3순위 Fallback: 표준 자재 ───
      if (!surfaces || surfaces.length === 0) {
        surfaces = defaultSurfacesForRoom(r.roomName);
        usedSources.push("standard-default");
        fallbackRooms.push({
          roomName: r.roomName,
          reason: !r.renderImageUrl
            ? "이미지 없음 — 표준 자재로 산출"
            : !visionAvailable
              ? "Vision 미사용 — 표준 자재로 산출"
              : "Vision 실패 — 표준 자재로 산출",
        });
      }

      // ─── brand/SKU 매칭 (material_products 253K rows) ───
      // vision-materials 결과 + legacy + fallback 모두에 적용. brand/sku 이미 있으면 skip.
      surfaces = await enrichWithBrandSku(surfaces, r.roomName);

      // ─── EstimateLineMaterialMeta 추출 (PDF/UI 표시용) ───
      matchMetaByRoom[r.roomName] = surfaces.map((s) => {
        const fromVision =
          visionRoomResult?.find((a) => surfaceTypeToKorean(a.observation.surfaceType) === s.surface);
        const status = fromVision?.recommendation.status === "confirmed"
          ? "confirmed"
          : fromVision?.recommendation.status === "recommended"
            ? "recommended"
            : s.brand
              ? "recommended"
              : "fallback";
        // surface 필드 함께 반환 — UI에서 자재 행과 매칭하는 키로 사용
        return {
          surface: s.surface,
          materialProductId: fromVision?.candidates[0]?.materialProductId,
          brand: s.brand,
          productName: s.materialName,
          sku: s.sku,
          spec: s.spec,
          unit: s.unit,
          unitPrice: s.unitPriceWon,
          priceSource: s.priceSource,
          matchStatus: status,
          confidence: fromVision?.recommendation.confidence ?? s.confidence,
          fallbackReason: fromVision?.recommendation.fallbackReason,
          observationId: fromVision?.observation.id,
        } as EstimateLineMaterialMeta & { surface: string };
      });

      estimates.push(
        buildRoomEstimate({
          roomName: r.roomName,
          dim: {
            name: r.dim.name || r.roomName,
            widthMm: r.dim.widthMm,
            depthMm: r.dim.depthMm,
            heightMm: r.dim.heightMm ?? 2400,
          },
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
      // Phase 6 후속 — vision-materials 메타 (UI에서 [확정]/[추천]/[기본] 표시)
      matchMetaByRoom,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/* ─── photo_only / commercial 가견적 (MD §10-3, §10-4) ─────────────────
 * 17공종 정밀 견적이 불가능한 모드를 위한 단순화된 견적.
 * UI에 "현장 실측 필요" 안내 함께 표시. */

const PHOTO_ONLY_UNIT_PRICE_BY_GRADE_PER_PYEONG: Record<"basic" | "standard" | "premium", number> = {
  basic: 600_000,
  standard: 900_000,
  premium: 1_500_000,
};

const PYEONG_TO_M2 = 3.305785;

function buildPhotoOnlyEstimate(body: Record<string, unknown>) {
  const areaM2 = Number(body.areaM2 ?? body.totalAreaM2 ?? 0);
  const pyung = Number(body.pyung ?? (areaM2 ? areaM2 / PYEONG_TO_M2 : 0));
  const tier: "basic" | "standard" | "premium" =
    (body.budgetTier as "basic" | "standard" | "premium") ?? "standard";

  if (!pyung || pyung <= 0) {
    return NextResponse.json(
      { error: "missing_area", hint: "areaM2 또는 pyung이 필요합니다." },
      { status: 400 },
    );
  }
  const unitPricePerPyeong = PHOTO_ONLY_UNIT_PRICE_BY_GRADE_PER_PYEONG[tier];
  const directCost = Math.round(pyung * unitPricePerPyeong);
  const indirect = Math.round(directCost * 0.06); // 관리비 6%
  const profit = Math.round((directCost + indirect) * 0.05); // 이윤 5%
  const subtotal = directCost + indirect + profit;
  const vat = Math.round(subtotal * 0.1);
  const grandTotalWon = subtotal + vat;

  return NextResponse.json({
    mode: "photo_only",
    quotationType: "rough_estimate",
    pyung,
    areaM2: pyung * PYEONG_TO_M2,
    budgetTier: tier,
    unitPricePerPyeongWon: unitPricePerPyeong,
    breakdown: {
      directCostWon: directCost,
      indirectCostWon: indirect,
      profitWon: profit,
      vatWon: vat,
    },
    grandTotalWon,
    disclaimerKo:
      "사진 기반 가견적입니다. 정확한 견적은 현장 실측, 철거 범위, 설비 상태, 선택 자재에 따라 달라질 수 있습니다.",
  });
}

type CommercialBusinessKey =
  | "cafe"
  | "restaurant"
  | "retail"
  | "beauty_salon"
  | "clinic"
  | "academy"
  | "office"
  | "gym"
  | "bakery"
  | "bar"
  | "studio"
  | "other_commercial";

type CommercialZoneKey =
  | "main_hall"
  | "counter"
  | "kitchen"
  | "storage"
  | "restroom"
  | "treatment_room"
  | "fitting_room"
  | "office_room"
  | "front_facade"
  | "signage"
  | "corridor"
  | "other";

// 업종 × zone 단가 (원/평) — 임시값. KPA/조달청 기준은 P3에서 보강.
const COMMERCIAL_UNIT_PRICE_PER_PYEONG: Record<
  CommercialBusinessKey,
  Partial<Record<CommercialZoneKey, number>>
> = {
  cafe: {
    main_hall: 1_100_000,
    counter: 1_500_000,
    kitchen: 1_800_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_500_000,
    corridor: 700_000,
    other: 900_000,
  },
  restaurant: {
    main_hall: 1_000_000,
    counter: 1_400_000,
    kitchen: 2_200_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_500_000,
    corridor: 700_000,
    other: 900_000,
  },
  retail: {
    main_hall: 900_000,
    counter: 1_200_000,
    storage: 500_000,
    fitting_room: 1_000_000,
    front_facade: 1_500_000,
    signage: 1_500_000,
    corridor: 600_000,
    other: 800_000,
  },
  beauty_salon: {
    main_hall: 1_000_000,
    counter: 1_200_000,
    treatment_room: 1_300_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 900_000,
  },
  clinic: {
    main_hall: 1_100_000,
    counter: 1_400_000,
    treatment_room: 1_600_000,
    storage: 600_000,
    restroom: 2_000_000,
    front_facade: 1_300_000,
    signage: 1_400_000,
    corridor: 800_000,
    other: 900_000,
  },
  academy: {
    office_room: 900_000,
    main_hall: 800_000,
    restroom: 1_500_000,
    storage: 400_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 600_000,
    other: 700_000,
  },
  office: {
    office_room: 800_000,
    main_hall: 700_000,
    counter: 1_000_000,
    storage: 400_000,
    restroom: 1_500_000,
    front_facade: 1_000_000,
    signage: 900_000,
    corridor: 600_000,
    other: 700_000,
  },
  gym: {
    main_hall: 900_000,
    treatment_room: 1_100_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_200_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 800_000,
  },
  bakery: {
    main_hall: 1_100_000,
    counter: 1_500_000,
    kitchen: 2_000_000,
    restroom: 1_900_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_400_000,
    corridor: 700_000,
    other: 900_000,
  },
  bar: {
    main_hall: 1_300_000,
    counter: 1_700_000,
    kitchen: 1_900_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_400_000,
    signage: 1_600_000,
    corridor: 800_000,
    other: 1_000_000,
  },
  studio: {
    main_hall: 1_100_000,
    storage: 500_000,
    restroom: 1_700_000,
    front_facade: 1_200_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 900_000,
  },
  other_commercial: {
    main_hall: 900_000,
    counter: 1_100_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 800_000,
  },
};

// 설비 가산 (1식 정액, 만원)
const SYSTEM_SURCHARGE_WON: Record<string, number> = {
  water_supply: 500_000,
  drainage: 500_000,
  ventilation: 800_000,
  kitchen_exhaust: 1_500_000,
  electrical_upgrade: 1_000_000,
  fire_sprinkler: 1_200_000,
  soundproofing: 1_500_000,
  signage: 1_000_000,
  gas: 800_000,
  hvac: 1_200_000,
};

function buildCommercialEstimate(body: Record<string, unknown>) {
  const businessType = (body.businessType as CommercialBusinessKey) || "other_commercial";
  const tier = ((body.budgetTier as "basic" | "standard" | "premium") ?? "standard");
  const zones = (body.zones as Array<{
    id?: string;
    nameKo?: string;
    type?: CommercialZoneKey;
    areaM2?: number;
    requiredSystems?: string[];
  }>) || [];
  const requiredSystems = (body.requiredSystems as string[]) || [];

  if (zones.length === 0) {
    return NextResponse.json(
      { error: "missing_zones", hint: "zones 배열이 비어있습니다." },
      { status: 400 },
    );
  }

  const tierMultiplier = { basic: 0.8, standard: 1.0, premium: 1.4 }[tier];
  const businessPrices = COMMERCIAL_UNIT_PRICE_PER_PYEONG[businessType] || {};

  const zoneEstimates = zones.map((z) => {
    const areaM2 = Number(z.areaM2 || 0);
    const pyung = areaM2 / PYEONG_TO_M2;
    const zoneType: CommercialZoneKey = z.type || "other";
    const basePerPyeong = businessPrices[zoneType] ?? businessPrices.other ?? 900_000;
    const directWon = Math.round(pyung * basePerPyeong * tierMultiplier);
    return {
      id: z.id,
      nameKo: z.nameKo,
      type: zoneType,
      areaM2,
      pyung,
      unitPricePerPyeongWon: Math.round(basePerPyeong * tierMultiplier),
      directCostWon: directWon,
    };
  });
  const zonesDirectCost = zoneEstimates.reduce((s, z) => s + z.directCostWon, 0);

  const systemSurchargeWon = requiredSystems.reduce(
    (s, k) => s + (SYSTEM_SURCHARGE_WON[k] ?? 0),
    0,
  );

  const directCost = zonesDirectCost + systemSurchargeWon;
  const indirect = Math.round(directCost * 0.06);
  const profit = Math.round((directCost + indirect) * 0.05);
  const subtotal = directCost + indirect + profit;
  const vat = Math.round(subtotal * 0.1);
  const grandTotalWon = subtotal + vat;

  const totalAreaM2 = zones.reduce((s, z) => s + Number(z.areaM2 || 0), 0);

  return NextResponse.json({
    mode: "commercial",
    quotationType: "rough_estimate",
    businessType,
    budgetTier: tier,
    totalAreaM2,
    totalPyung: totalAreaM2 / PYEONG_TO_M2,
    zones: zoneEstimates,
    requiredSystems,
    breakdown: {
      zonesDirectCostWon: zonesDirectCost,
      systemSurchargeWon,
      directCostWon: directCost,
      indirectCostWon: indirect,
      profitWon: profit,
      vatWon: vat,
    },
    grandTotalWon,
    disclaimerKo:
      "상가/사무실 가견적입니다. 정확한 견적은 업종별 설비 사양, 소방·환기·전기 증설 범위, 자재 등급에 따라 달라질 수 있어 현장 실측이 필요합니다.",
  });
}
