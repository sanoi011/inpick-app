/**
 * InPick 견적 산정 — 부자재 10% + 인건비 국토부 일위대가.
 * 자재 카탈로그 매칭은 Supabase material_price_lookup + LLM fallback.
 */
import { analyzeImageVision } from "./openai-client";
import { roomAreaM2, type RoomDim } from "./korean-apt-dimensions";

export const AUX_RATE_PCT = 0.10; // 부자재 = 주자재의 10% (대표 명시)

// 국토부 일위대가 (건설공사 표준품셈 2026 평균, 원/m² 또는 원/EA)
// TODO: Supabase labor_unit_price_lookup 테이블 신설 후 동기화
export const MOLIT_LABOR: Record<string, number> = {
  // 바닥
  "FLOOR/마루": 18000,
  "FLOOR/원목": 28000,
  "FLOOR/타일": 35000,
  "FLOOR/장판": 8000,
  // 벽
  "WALL/도배": 8000,
  "WALL/도장": 12000,
  "WALL/타일": 40000,
  "WALL/패널": 25000,
  "WALL/필름": 15000,
  // 천장
  "CEIL/도배": 7000,
  "CEIL/도장": 10000,
  "CEIL/석고": 15000,
  "CEIL/우물천장": 80000,
  // 위생기구·가구 (EA)
  "FIX/변기": 80000,
  "FIX/세면대": 60000,
  "FIX/싱크대": 200000,
  "FIX/욕조": 150000,
  "FIX/가스레인지": 50000,
  // 창호
  "WIN/창호": 180000,
  "WIN/현관문": 250000,
};

export function laborUnitPrice(surface: string, materialName: string): number {
  const trade = surfaceToTrade(surface);
  const matLower = materialName.toLowerCase();
  for (const key of Object.keys(MOLIT_LABOR)) {
    const [t, kw] = key.split("/");
    if (t === trade && (matLower.includes(kw) || materialName.includes(kw))) {
      return MOLIT_LABOR[key];
    }
  }
  // fallback: 공종별 평균
  const avg: Record<string, number> = { FLOOR: 25000, WALL: 15000, CEIL: 12000, FIX: 100000, WIN: 200000 };
  return avg[trade] || 18000;
}

function surfaceToTrade(surface: string): string {
  const s = surface.toLowerCase();
  if (s.includes("floor") || s.includes("바닥")) return "FLOOR";
  if (s.includes("wall") || s.includes("벽")) return "WALL";
  if (s.includes("ceil") || s.includes("천장")) return "CEIL";
  if (s.includes("fixture") || s.includes("위생") || s.includes("가구")) return "FIX";
  if (s.includes("window") || s.includes("창호") || s.includes("door")) return "WIN";
  return "WALL";
}

export interface MaterialItem {
  surface: string;          // "바닥" | "벽" | "천장" | ...
  materialName: string;     // "오크 원목마루 12T"
  brand?: string;
  spec?: string;
  sku?: string;
  unitPriceWon: number;     // 자재 단가 (원/m² 또는 원/EA)
  unit: "m²" | "m" | "EA" | "set";
  confidence?: number;
  priceSource?: "korea_price_assoc" | "vision_estimate" | "standard" | "manual";
}

/** 한국물가협회 표준 단가 (2026 Q1 평균 기준) — Vision이 단가 못 추정할 때 fallback */
const KPA_PRICE: Record<string, number> = {
  // 바닥 (원/m²)
  "바닥/마루": 64000,
  "바닥/원목마루": 110000,
  "바닥/강마루": 64000,
  "바닥/장판": 18000,
  "바닥/타일": 75000,
  "바닥/포세린": 78000,
  // 벽 (원/m²)
  "벽/도배": 9500,
  "벽/실크벽지": 12000,
  "벽/도장": 14000,
  "벽/타일": 55000,
  "벽/패널": 45000,
  // 천장 (원/m²)
  "천장/도배": 7500,
  "천장/도장": 10500,
  "천장/석고": 18000,
  "천장/우물천장": 80000,
  // 창호·도어 (원/EA or set)
  "창호/창호": 280000,
  "도어/현관문": 320000,
  "도어/방문": 180000,
  // 붙박이·위생 (원/set)
  "fixture/싱크대": 8900000,
  "fixture/주방가구": 8900000,
  "fixture/욕실세트": 1900000,
  "fixture/변기": 280000,
  "fixture/세면대": 220000,
  "fixture/욕조": 850000,
  "fixture/중문": 2200000,
  "fixture/붙박이장": 1800000,
  // 조명
  "조명/매입LED": 35000,
  "조명/펜던트": 180000,
  "조명/일괄": 2100000,
};

function lookupKpaPrice(surface: string, materialName: string): number | null {
  const tradeMap: Record<string, string> = {
    바닥: "바닥",
    floor: "바닥",
    벽: "벽",
    wall: "벽",
    천장: "천장",
    ceil: "천장",
    창호: "창호",
    window: "창호",
    도어: "도어",
    door: "도어",
    fixture: "fixture",
    조명: "조명",
    light: "조명",
  };
  const sLower = surface.toLowerCase();
  const trade =
    Object.keys(tradeMap).find((k) => sLower.includes(k.toLowerCase())) || surface;
  const tradeKr = tradeMap[trade] || trade;
  const matLower = materialName.toLowerCase();

  for (const key of Object.keys(KPA_PRICE)) {
    const [t, kw] = key.split("/");
    if (t !== tradeKr) continue;
    if (matLower.includes(kw.toLowerCase()) || materialName.includes(kw)) {
      return KPA_PRICE[key];
    }
  }
  // 카테고리 평균 fallback
  const avg: Record<string, number> = {
    바닥: 64000,
    벽: 11000,
    천장: 9500,
    fixture: 1500000,
    창호: 280000,
    도어: 220000,
    조명: 50000,
  };
  return avg[tradeKr] ?? null;
}

export interface RoomEstimateInput {
  roomName: string;
  dim: RoomDim;
  surfaces: MaterialItem[]; // 바닥/벽/천장/위생기구 등
}

export interface LineItem {
  surface: string;
  materialName: string;
  brand?: string;
  spec?: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPriceWon: number;
  subtotalWon: number;
  category: "main" | "aux" | "labor";
  priceSource?: "korea_price_assoc" | "vision_estimate" | "standard" | "manual" | "molit";
}

export interface RoomEstimate {
  roomName: string;
  totalAreaM2: number;
  items: LineItem[];
  mainTotalWon: number;
  auxTotalWon: number;
  laborTotalWon: number;
  totalWon: number;
}

/** 단일 실 견적 */
export function buildRoomEstimate(input: RoomEstimateInput): RoomEstimate {
  const items: LineItem[] = [];
  const areaM2 = roomAreaM2(input.dim);
  let mainTotal = 0;
  let auxTotal = 0;
  let laborTotal = 0;

  for (const m of input.surfaces) {
    // 가구·소품은 견적에서 자동 제외 (시공 마감재만)
    const sLower = m.surface.toLowerCase();
    if (
      sLower.includes("가구") ||
      sLower.includes("furniture") ||
      sLower === "소품" ||
      sLower === "decor"
    ) {
      continue;
    }

    // 1) 면적·수량 결정
    let qty = 1;
    if (m.unit === "m²") {
      qty = surfaceQuantity(m.surface, input.dim);
    } else if (m.unit === "m") {
      qty = perimeterM(input.dim);
    } else {
      qty = 1; // EA, set
    }
    // 2) 단가 — Vision이 못 채운 경우 한국물가협회 KPA 표준 fallback
    let unitPrice = m.unitPriceWon;
    let priceSource: "korea_price_assoc" | "vision_estimate" | "standard" =
      m.priceSource === "korea_price_assoc" ? "korea_price_assoc" : "vision_estimate";
    if (!unitPrice || unitPrice < 1000) {
      const kpa = lookupKpaPrice(m.surface, m.materialName);
      if (kpa) {
        unitPrice = kpa;
        priceSource = "korea_price_assoc";
      }
    } else {
      // Vision이 단가 추정한 경우도 KPA 표준이 있으면 KPA 우선 (정밀성)
      const kpa = lookupKpaPrice(m.surface, m.materialName);
      if (kpa && Math.abs(kpa - unitPrice) / Math.max(unitPrice, 1) > 0.5) {
        unitPrice = kpa;
        priceSource = "korea_price_assoc";
      }
    }
    const subtotalMain = Math.round(qty * unitPrice);
    items.push({
      surface: m.surface,
      materialName: m.materialName,
      brand: m.brand,
      spec: m.spec,
      sku: m.sku,
      quantity: qty,
      unit: m.unit,
      unitPriceWon: unitPrice,
      subtotalWon: subtotalMain,
      category: "main",
      priceSource,
    });
    mainTotal += subtotalMain;

    // 부자재 = 주자재의 10%
    const auxSub = Math.round(subtotalMain * AUX_RATE_PCT);
    items.push({
      surface: m.surface,
      materialName: `${m.materialName} 부자재 일괄`,
      spec: "몰딩·본드·실링·자투리 (10%)",
      quantity: 1,
      unit: "set",
      unitPriceWon: auxSub,
      subtotalWon: auxSub,
      category: "aux",
      priceSource: "standard",
    });
    auxTotal += auxSub;

    // 3) 인건비 = 국토부 일위대가
    const laborUnit = laborUnitPrice(m.surface, m.materialName);
    const laborSub = Math.round(qty * laborUnit);
    items.push({
      surface: m.surface,
      materialName: `${m.materialName} 시공`,
      spec: "국토부 일위대가 기준 (건설공사 표준품셈)",
      quantity: qty,
      unit: m.unit,
      unitPriceWon: laborUnit,
      subtotalWon: laborSub,
      category: "labor",
      priceSource: "molit",
    });
    laborTotal += laborSub;
  }

  return {
    roomName: input.roomName,
    totalAreaM2: areaM2,
    items,
    mainTotalWon: mainTotal,
    auxTotalWon: auxTotal,
    laborTotalWon: laborTotal,
    totalWon: mainTotal + auxTotal + laborTotal,
  };
}

/** surface 별 면적 산출 */
function surfaceQuantity(surface: string, dim: RoomDim): number {
  const w = dim.widthMm / 1000;
  const d = dim.depthMm / 1000;
  const h = dim.heightMm / 1000;
  const s = surface.toLowerCase();
  if (s.includes("floor") || s.includes("바닥")) return Math.round(w * d * 100) / 100;
  if (s.includes("ceil") || s.includes("천장")) return Math.round(w * d * 100) / 100;
  if (s.includes("wall") || s.includes("벽")) return Math.round(2 * (w + d) * h * 100) / 100;
  return Math.round(w * d * 100) / 100;
}

function perimeterM(dim: RoomDim): number {
  return Math.round(2 * (dim.widthMm + dim.depthMm) / 1000 * 100) / 100;
}

/** 렌더 이미지 → 부위별 자재 추출 (GPT-4o Vision) */
export interface ExtractMaterialsInput {
  renderImageUrl: string;
  roomName: string;
  dim: RoomDim;
}

export async function extractMaterialsFromRender(
  input: ExtractMaterialsInput,
): Promise<MaterialItem[]> {
  const prompt = `이 인테리어 렌더 이미지(${input.roomName}, ${input.dim.widthMm}×${input.dim.depthMm}×${input.dim.heightMm}mm)에서 시공 견적 대상 자재만 분석.

규칙 (매우 중요):
- 시공 마감재만 포함: 바닥, 벽, 천장, 창호, 도어, 붙박이장(주방·드레스룸 한정), 위생기구(욕실), 매입조명
- 가구 / 소품 절대 제외: 소파·의자·테이블·침대·매트리스·러그·쿠션·이불·식기·꽃·관엽식물·장식 — 모두 응답에서 빼기
- 펜던트·샹들리에는 fixture/조명으로만 (소품 X)

다음 JSON으로만 응답:
{
  "materials": [
    {
      "surface": "바닥|벽|천장|fixture|조명|창호|도어",
      "materialName": "구체 자재명 (예: 오크 원목마루 12T 헤링본)",
      "brand": "한국 실제 브랜드 (LX하우시스 / 한솔홈데코 / KCC / 동화자연마루 / 한샘 / 이누스 / 대림바스 등) — 모르면 '추정 미상'",
      "spec": "두께·규격·패턴 (예: 12T·900×150mm·헤링본)",
      "sku": "구체 SKU 또는 모델명 / 모르면 빈 문자열",
      "unit": "m²|m|EA|set"
    }
  ]
}

unitPriceWon 필드는 응답하지 마세요 — 단가는 서버에서 한국물가협회 DB로 자동 매칭.`;

  const v = await analyzeImageVision({
    imageUrl: input.renderImageUrl,
    prompt,
    responseFormat: "json_object",
  });
  try {
    const parsed = JSON.parse(v.content);
    return parsed.materials || [];
  } catch {
    return [];
  }
}
