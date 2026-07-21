/**
 * 한국 아파트 평형별 표준 실 치수 DB.
 * 단위: mm (가로 × 세로 × 천장고)
 * 근거: 국토교통부 표준 주택형 + 부동산 평면도 통계 평균
 */

export type PyungType = "15평" | "20평" | "24평" | "30평" | "34평" | "40평" | "50평";

export interface RoomDim {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number; // 천장고 (한국 아파트 표준 2400, 대형은 2700)
}

export function roomAreaM2(r: RoomDim): number {
  return Math.round((r.widthMm * r.depthMm) / 10_000) / 100;
}

export const APT_STANDARD: Record<PyungType, Record<string, RoomDim>> = {
  "15평": {
    거실: { name: "거실", widthMm: 3500, depthMm: 3000, heightMm: 2400 },
    안방: { name: "안방", widthMm: 3000, depthMm: 3000, heightMm: 2400 },
    주방: { name: "주방", widthMm: 2400, depthMm: 2200, heightMm: 2400 },
    욕실: { name: "욕실", widthMm: 1800, depthMm: 1500, heightMm: 2400 },
    현관: { name: "현관", widthMm: 1500, depthMm: 1200, heightMm: 2400 },
    발코니: { name: "발코니", widthMm: 3500, depthMm: 1200, heightMm: 2400 },
  },
  "20평": {
    거실: { name: "거실", widthMm: 4200, depthMm: 3500, heightMm: 2400 },
    안방: { name: "안방", widthMm: 3500, depthMm: 3200, heightMm: 2400 },
    침실: { name: "침실", widthMm: 3000, depthMm: 2800, heightMm: 2400 },
    주방: { name: "주방", widthMm: 3000, depthMm: 2400, heightMm: 2400 },
    욕실: { name: "욕실", widthMm: 2000, depthMm: 1700, heightMm: 2400 },
    현관: { name: "현관", widthMm: 1800, depthMm: 1300, heightMm: 2400 },
    발코니: { name: "발코니", widthMm: 4200, depthMm: 1500, heightMm: 2400 },
  },
  "24평": {
    거실: { name: "거실", widthMm: 4800, depthMm: 3800, heightMm: 2400 },
    안방: { name: "안방", widthMm: 3800, depthMm: 3500, heightMm: 2400 },
    침실1: { name: "침실1", widthMm: 3200, depthMm: 2800, heightMm: 2400 },
    침실2: { name: "침실2", widthMm: 3000, depthMm: 2700, heightMm: 2400 },
    주방: { name: "주방", widthMm: 3300, depthMm: 2700, heightMm: 2400 },
    욕실: { name: "욕실", widthMm: 2100, depthMm: 1800, heightMm: 2400 },
    현관: { name: "현관", widthMm: 1900, depthMm: 1400, heightMm: 2400 },
    발코니: { name: "발코니", widthMm: 4800, depthMm: 1500, heightMm: 2400 },
  },
  "30평": {
    거실: { name: "거실", widthMm: 5800, depthMm: 4200, heightMm: 2400 },
    안방: { name: "안방", widthMm: 4200, depthMm: 3500, heightMm: 2400 },
    침실1: { name: "침실1", widthMm: 3500, depthMm: 3000, heightMm: 2400 },
    침실2: { name: "침실2", widthMm: 3300, depthMm: 2800, heightMm: 2400 },
    주방: { name: "주방", widthMm: 3800, depthMm: 3000, heightMm: 2400 },
    욕실1: { name: "욕실1", widthMm: 2200, depthMm: 1800, heightMm: 2400 },
    욕실2: { name: "욕실2", widthMm: 2000, depthMm: 1500, heightMm: 2400 },
    드레스룸: { name: "드레스룸", widthMm: 2500, depthMm: 1800, heightMm: 2400 },
    현관: { name: "현관", widthMm: 2100, depthMm: 1500, heightMm: 2400 },
    발코니: { name: "발코니", widthMm: 5800, depthMm: 1500, heightMm: 2400 },
  },
  "34평": {
    거실: { name: "거실", widthMm: 6200, depthMm: 4500, heightMm: 2400 },
    안방: { name: "안방", widthMm: 4500, depthMm: 3800, heightMm: 2400 },
    침실1: { name: "침실1", widthMm: 3800, depthMm: 3200, heightMm: 2400 },
    침실2: { name: "침실2", widthMm: 3500, depthMm: 3000, heightMm: 2400 },
    침실3: { name: "침실3", widthMm: 3200, depthMm: 2800, heightMm: 2400 },
    주방: { name: "주방", widthMm: 4200, depthMm: 3200, heightMm: 2400 },
    욕실1: { name: "욕실1", widthMm: 2400, depthMm: 1900, heightMm: 2400 },
    욕실2: { name: "욕실2", widthMm: 2100, depthMm: 1700, heightMm: 2400 },
    드레스룸: { name: "드레스룸", widthMm: 2800, depthMm: 2000, heightMm: 2400 },
    현관: { name: "현관", widthMm: 2300, depthMm: 1700, heightMm: 2400 },
    발코니: { name: "발코니", widthMm: 6200, depthMm: 1500, heightMm: 2400 },
  },
  "40평": {
    거실: { name: "거실", widthMm: 7000, depthMm: 4800, heightMm: 2700 },
    안방: { name: "안방", widthMm: 5000, depthMm: 4200, heightMm: 2700 },
    침실1: { name: "침실1", widthMm: 4200, depthMm: 3500, heightMm: 2700 },
    침실2: { name: "침실2", widthMm: 3800, depthMm: 3200, heightMm: 2700 },
    침실3: { name: "침실3", widthMm: 3500, depthMm: 3000, heightMm: 2700 },
    주방: { name: "주방", widthMm: 4800, depthMm: 3500, heightMm: 2700 },
    다이닝: { name: "다이닝", widthMm: 3500, depthMm: 3000, heightMm: 2700 },
    욕실1: { name: "욕실1", widthMm: 2700, depthMm: 2100, heightMm: 2700 },
    욕실2: { name: "욕실2", widthMm: 2400, depthMm: 1900, heightMm: 2700 },
    드레스룸: { name: "드레스룸", widthMm: 3200, depthMm: 2400, heightMm: 2700 },
    팬트리: { name: "팬트리", widthMm: 2200, depthMm: 1800, heightMm: 2700 },
    현관: { name: "현관", widthMm: 2500, depthMm: 1900, heightMm: 2700 },
    발코니: { name: "발코니", widthMm: 7000, depthMm: 1800, heightMm: 2400 },
  },
  "50평": {
    거실: { name: "거실", widthMm: 8200, depthMm: 5500, heightMm: 2700 },
    안방: { name: "안방", widthMm: 5800, depthMm: 4500, heightMm: 2700 },
    침실1: { name: "침실1", widthMm: 4500, depthMm: 3800, heightMm: 2700 },
    침실2: { name: "침실2", widthMm: 4200, depthMm: 3500, heightMm: 2700 },
    침실3: { name: "침실3", widthMm: 3800, depthMm: 3300, heightMm: 2700 },
    주방: { name: "주방", widthMm: 5500, depthMm: 4000, heightMm: 2700 },
    다이닝: { name: "다이닝", widthMm: 4200, depthMm: 3500, heightMm: 2700 },
    욕실1: { name: "욕실1", widthMm: 3000, depthMm: 2400, heightMm: 2700 },
    욕실2: { name: "욕실2", widthMm: 2700, depthMm: 2100, heightMm: 2700 },
    욕실3: { name: "욕실3", widthMm: 2400, depthMm: 1900, heightMm: 2700 },
    드레스룸1: { name: "드레스룸1", widthMm: 3800, depthMm: 2700, heightMm: 2700 },
    드레스룸2: { name: "드레스룸2", widthMm: 2700, depthMm: 2100, heightMm: 2700 },
    팬트리: { name: "팬트리", widthMm: 2800, depthMm: 2200, heightMm: 2700 },
    서재: { name: "서재", widthMm: 3500, depthMm: 3000, heightMm: 2700 },
    현관: { name: "현관", widthMm: 3000, depthMm: 2200, heightMm: 2700 },
    발코니: { name: "발코니", widthMm: 8200, depthMm: 2000, heightMm: 2400 },
  },
};

/** 전용면적(m²) → 평형 분류 */
export function classifyPyeong(exclusiveAreaM2: number): PyungType {
  if (exclusiveAreaM2 < 50) return "15평";
  if (exclusiveAreaM2 < 67) return "20평";
  if (exclusiveAreaM2 < 76) return "24평";
  if (exclusiveAreaM2 < 86) return "30평";
  if (exclusiveAreaM2 < 100) return "34평";
  if (exclusiveAreaM2 < 116) return "40평";
  return "50평";
}

export function getStandardRooms(pyeong: PyungType): Record<string, RoomDim> {
  return APT_STANDARD[pyeong];
}

export function getTotalArea(pyeong: PyungType, exclude: string[] = ["발코니"]): number {
  const rooms = APT_STANDARD[pyeong];
  let sum = 0;
  for (const [name, r] of Object.entries(rooms)) {
    if (!exclude.includes(name)) sum += roomAreaM2(r);
  }
  return Math.round(sum * 100) / 100;
}

/** 평형 또는 전용면적 → 실별 표준 치수 */
export function estimateRoomDimsFromPyeong(
  pyeongOrArea: number | PyungType,
  detectedRoomCount?: Record<string, number>,
): Record<string, RoomDim> {
  const pyeong: PyungType =
    typeof pyeongOrArea === "number" ? classifyPyeong(pyeongOrArea) : pyeongOrArea;
  const rooms: Record<string, RoomDim> = { ...getStandardRooms(pyeong) };

  if (detectedRoomCount) {
    for (const [type, count] of Object.entries(detectedRoomCount)) {
      const existing = Object.keys(rooms).filter((k) => k.includes(type));
      for (let i = existing.length; i < count; i++) {
        const name = count > 1 ? `${type}${i + 1}` : type;
        if (rooms[name]) continue;
        const ref = existing.length > 0 ? rooms[existing[existing.length - 1]] : null;
        rooms[name] = ref
          ? {
              name,
              widthMm: Math.round(ref.widthMm * 0.9),
              depthMm: Math.round(ref.depthMm * 0.9),
              heightMm: ref.heightMm,
            }
          : { name, widthMm: 3000, depthMm: 2800, heightMm: 2400 };
      }
    }
  }
  return rooms;
}
