/**
 * POST /api/inpick/build-estimate
 *
 * 입력 (둘 중 하나):
 *  A) { rooms: [{ roomName, dim, surfaces: [...] }] } — 자재 직접 지정
 *  B) { rooms: [{ roomName, dim, renderImageUrl }] } — 렌더 이미지에서 자재 자동 추출
 *
 * Vision 추출 실패 또는 imageUrl 없으면 표준 자재(MOCK_SURFACES)로 fallback.
 *
 * 출력: { estimates: RoomEstimate[], grandTotal: { mainTotal, auxTotal, laborTotal, totalWon } }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildRoomEstimate,
  extractMaterialsFromRender,
  type MaterialItem,
  type RoomEstimate,
} from "@/lib/inpick/estimate";

export const runtime = "nodejs";
export const maxDuration = 120;

// 실 종류별 표준 자재 (Vision 실패 시 fallback)
function mockSurfacesFor(roomName: string): MaterialItem[] {
  const base: MaterialItem[] = [
    {
      surface: "바닥",
      materialName: "오크 강마루 12T (헤링본)",
      brand: "LX하우시스",
      spec: "12mm 헤링본 오크",
      unitPriceWon: 64000,
      unit: "m²",
      confidence: 0.5,
    },
    {
      surface: "벽",
      materialName: "친환경 실크 벽지",
      brand: "KCC",
      spec: "프리미엄 실크",
      unitPriceWon: 9500,
      unit: "m²",
      confidence: 0.5,
    },
    {
      surface: "천장",
      materialName: "친환경 수성 도장",
      brand: "삼화",
      spec: "친환경 수성",
      unitPriceWon: 11000,
      unit: "m²",
      confidence: 0.5,
    },
  ];

  const n = roomName.toLowerCase();
  if (n.includes("욕실") || n.includes("bath")) {
    return [
      {
        surface: "바닥",
        materialName: "포세린 타일 600×600",
        brand: "이누스",
        spec: "포세린 600×600",
        unitPriceWon: 75000,
        unit: "m²",
        confidence: 0.5,
      },
      {
        surface: "벽",
        materialName: "벽 타일 300×600",
        brand: "이누스",
        spec: "도기질 300×600",
        unitPriceWon: 55000,
        unit: "m²",
        confidence: 0.5,
      },
      {
        surface: "fixture",
        materialName: "양변기 + 세면대 + 수전 일체",
        brand: "대림",
        spec: "프리미엄 라인",
        unitPriceWon: 950000,
        unit: "set",
        confidence: 0.5,
      },
    ];
  }
  if (n.includes("주방") || n.includes("부엌") || n.includes("kitchen")) {
    return [
      ...base,
      {
        surface: "fixture",
        materialName: "주방 가구 일체 (싱크 + 상부장)",
        brand: "한샘",
        spec: "제트 4.2m",
        unitPriceWon: 8900000,
        unit: "set",
        confidence: 0.5,
      },
      {
        surface: "fixture",
        materialName: "인덕션 + 후드",
        brand: "삼성",
        spec: "3구 인덕션 + 슬림 후드",
        unitPriceWon: 1900000,
        unit: "set",
        confidence: 0.5,
      },
    ];
  }
  if (n.includes("현관")) {
    return [
      {
        surface: "바닥",
        materialName: "현관 타일 300×300",
        brand: "이누스",
        spec: "포세린 매트 마감",
        unitPriceWon: 65000,
        unit: "m²",
        confidence: 0.5,
      },
      {
        surface: "fixture",
        materialName: "중문",
        brand: "한샘",
        spec: "3연동 슬라이딩",
        unitPriceWon: 2200000,
        unit: "set",
        confidence: 0.5,
      },
    ];
  }
  if (n.includes("발코니") || n.includes("베란다")) {
    return [
      {
        surface: "바닥",
        materialName: "베란다 타일 600×600",
        brand: "이누스",
        spec: "포세린 외장형",
        unitPriceWon: 70000,
        unit: "m²",
        confidence: 0.5,
      },
      {
        surface: "벽",
        materialName: "발코니 결로 방지 페인트",
        brand: "삼화",
        spec: "단열 페인트",
        unitPriceWon: 14000,
        unit: "m²",
        confidence: 0.5,
      },
    ];
  }
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rooms } = body;
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "rooms 배열 필수" }, { status: 400 });
    }

    const estimates: RoomEstimate[] = [];
    let usedMockCount = 0;

    for (const r of rooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];

      // 렌더 이미지에서 자재 자동 추출 시도
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl && process.env.OPENAI_API_KEY) {
        try {
          // mock 이미지 URL은 Vision 추출 의미 없음 → mock surfaces로
          if (r.renderImageUrl.includes("picsum.photos")) {
            surfaces = mockSurfacesFor(r.roomName);
            usedMockCount++;
          } else {
            surfaces = await extractMaterialsFromRender({
              renderImageUrl: r.renderImageUrl,
              roomName: r.roomName,
              dim: r.dim,
            });
          }
        } catch {
          surfaces = [];
        }
      }

      // Vision 추출 실패 또는 키 없음 → 표준 자재 fallback
      if (!surfaces || surfaces.length === 0) {
        surfaces = mockSurfacesFor(r.roomName);
        usedMockCount++;
      }

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
      usedMockCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
