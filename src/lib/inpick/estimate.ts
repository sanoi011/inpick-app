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
    // 1) 면적·수량 결정
    let qty = 1;
    if (m.unit === "m²") {
      qty = surfaceQuantity(m.surface, input.dim);
    } else if (m.unit === "m") {
      qty = perimeterM(input.dim);
    } else {
      qty = 1; // EA, set
    }
    const subtotalMain = Math.round(qty * m.unitPriceWon);
    items.push({
      surface: m.surface,
      materialName: m.materialName,
      brand: m.brand,
      spec: m.spec,
      sku: m.sku,
      quantity: qty,
      unit: m.unit,
      unitPriceWon: m.unitPriceWon,
      subtotalWon: subtotalMain,
      category: "main",
    });
    mainTotal += subtotalMain;

    // 2) 부자재 = 주자재의 10%
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
  const prompt = `이 인테리어 렌더 이미지(${input.roomName}, ${input.dim.widthMm}×${input.dim.depthMm}×${input.dim.heightMm}mm)에서 사용된 자재를 분석.
다음 JSON으로만 응답:
{
  "materials": [
    {
      "surface": "바닥|벽|천장|fixture|조명|창호|도어|가구",
      "materialName": "구체 자재명 (예: 오크 원목마루 12T 헤링본)",
      "brand": "한국 실제 브랜드 (LX하우시스 / 한솔홈데코 / KCC / 동화자연마루 / 한샘 / 이누스 / 대림바스 / 삼성가전 / LG가전 / 시디즈 / 데스커 등) — 모르면 '추정 미상'",
      "spec": "두께·규격·패턴 (예: 12T·900×150mm·헤링본)",
      "sku": "구체 SKU 또는 모델명 (예: LX-MR3015·한샘제트4.2m / 모르면 빈 문자열)",
      "unitPriceWon": 0,
      "unit": "m²|m|EA|set",
      "confidence": 0.0
    }
  ]
}
한국 인테리어 자재 카탈로그 기준. 일반어 금지, "LX하우시스 강마루 12T 헤링본 오크" 수준 구체화. brand는 실제 한국 브랜드명만 (없으면 "추정 미상"), sku는 가능한 모델명/품번 추정.`;

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
