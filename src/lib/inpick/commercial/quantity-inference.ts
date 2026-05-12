/**
 * 면적 기반 zone 수량 추정.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-3
 *
 * 사용:
 *   const q = inferZoneQuantities({ zoneAreaM2: 66, ceilingHeightM: 2.7, zoneType: "main_hall" });
 *   // q.floorM2 = 66, q.wallM2 ≈ 64.9, q.perimeterM ≈ 32.5
 *
 * 가정:
 *  - zone을 정사각형 평면으로 단순화 (둘레 4*sqrt(area))
 *  - 층고 미입력 시 2.7m (상가 표준)
 *  - 벽 노출률 (개구부·가구·붙박이 제외) zoneType별 0.5~1.0
 */
import type { CommercialZoneType } from "./scope-spec";

const WALL_EXPOSURE_BY_ZONE: Record<CommercialZoneType, number> = {
  main_hall: 0.75,
  counter: 0.6,
  kitchen: 0.9,
  storage: 0.5,
  restroom: 1.0,
  treatment_room: 0.85,
  fitting_room: 0.9,
  office_room: 0.7,
  meeting_room: 0.85,
  lounge: 0.7,
  front_facade: 0.4,
  signage: 0.3,
  corridor: 0.6,
  other: 0.7,
};

export interface InferredQuantities {
  floorM2: number;
  ceilingM2: number;
  wallM2: number;
  baseboardM: number; // 걸레받이 둘레
  perimeterM: number;
  ceilingHeightM: number;
  wallExposureFactor: number;
  assumptions: string[];
}

export function inferZoneQuantities(input: {
  zoneAreaM2: number;
  ceilingHeightM?: number;
  zoneType: CommercialZoneType;
}): InferredQuantities {
  const ceilingHeightM = input.ceilingHeightM ?? 2.7;
  const sideM = Math.sqrt(Math.max(input.zoneAreaM2, 0.5));
  const perimeterM = sideM * 4;
  const wallExposureFactor = WALL_EXPOSURE_BY_ZONE[input.zoneType] ?? 0.7;

  return {
    floorM2: input.zoneAreaM2,
    ceilingM2: input.zoneAreaM2,
    wallM2: perimeterM * ceilingHeightM * wallExposureFactor,
    baseboardM: perimeterM * 0.9, // 출입구 제외 10%
    perimeterM,
    ceilingHeightM,
    wallExposureFactor,
    assumptions: [
      `zone을 정사각형 평면 (한 변 ${sideM.toFixed(2)}m)으로 가정하여 둘레를 추정했습니다.`,
      `층고는 ${ceilingHeightM}m 기준입니다.`,
      `벽체 마감률은 ${Math.round(wallExposureFactor * 100)}%로 가정했습니다 (개구부·붙박이 제외).`,
    ],
  };
}
