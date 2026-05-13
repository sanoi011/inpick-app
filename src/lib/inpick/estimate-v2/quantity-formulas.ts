/**
 * 수량 산출 공식 — RoomQuantityBasis 계산 + WorkPackageLineTemplate.quantityFormula 해석.
 * 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §5
 */
import type {
  RoomQuantityBasis,
  RoomType,
  SurfacePlan,
  SurfaceType,
  WorkPackageLineTemplate,
} from "./types";

/** 방 종류별 벽 노출 비율 — 욕실/주방은 가구·설비로 가려져 도배/도장 면적 감소 */
function getWallExposureFactor(roomType: RoomType): number {
  switch (roomType) {
    case "kitchen":
      return 0.55; // 싱크대·타일 영역 차감
    case "bathroom":
      return 0.0; // 욕실은 도배 X (별도 타일 공정)
    case "dress_room":
      return 0.7; // 붙박이장 가려진 부분 차감
    case "utility":
    case "balcony":
      return 0.85;
    case "entry":
      return 0.9;
    default:
      return 1.0;
  }
}

/** 표준 천장 높이 (한국 아파트 2.4m) */
const DEFAULT_HEIGHT_M = 2.4;

export interface ComputeRoomQuantityBasisInput {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  areaM2: number;
  widthM?: number;
  depthM?: number;
  heightM?: number;
  doorCount?: number;
  windowCount?: number;
  fixtureCount?: number;
  basisSource?: RoomQuantityBasis["basisSource"];
}

export function computeRoomQuantityBasis(
  input: ComputeRoomQuantityBasisInput,
): RoomQuantityBasis {
  const heightM = input.heightM ?? DEFAULT_HEIGHT_M;
  const floorM2 = Math.max(0, input.areaM2);
  const ceilingM2 = floorM2;

  let perimeterM: number;
  if (input.widthM && input.depthM && input.widthM > 0 && input.depthM > 0) {
    perimeterM = 2 * (input.widthM + input.depthM);
  } else {
    perimeterM = 4 * Math.sqrt(Math.max(0, floorM2));
  }

  // 개구부 면적 차감 (문 1.8m² + 창문 1.5m² 기본)
  const doorCount = input.doorCount ?? 1;
  const windowCount = input.windowCount ?? (isInteriorOnly(input.roomType) ? 0 : 1);
  const openingDeductionM2 = doorCount * 1.8 + windowCount * 1.5;

  const wallExposureFactor = getWallExposureFactor(input.roomType);
  const wallM2 = Math.max(
    0,
    perimeterM * heightM * wallExposureFactor - openingDeductionM2,
  );

  const basisSource: RoomQuantityBasis["basisSource"] =
    input.basisSource ||
    (input.widthM && input.depthM ? "floorplan_asset" : "area_inference");

  const assumptions: string[] = [];
  if (basisSource === "area_inference") {
    assumptions.push(
      "도면 치수가 부족하여 면적 기준 정사각형에 가까운 평면으로 둘레를 추정했습니다.",
    );
  } else {
    assumptions.push("도면 치수 기반으로 산출했습니다.");
  }
  if (wallExposureFactor < 1) {
    assumptions.push(
      `${input.roomName} 벽 노출률 ${Math.round(wallExposureFactor * 100)}% 적용 (가구·설비·타일 영역 제외)`,
    );
  }

  return {
    roomId: input.roomId,
    roomName: input.roomName,
    roomType: input.roomType,
    floorM2,
    ceilingM2,
    wallM2,
    perimeterM,
    doorCount,
    windowCount,
    fixtureCount: input.fixtureCount,
    // P14-1: width/depth가 입력에 있으면 basis에 그대로 보존 (KitchenPlan 등에서 활용)
    widthM: input.widthM,
    depthM: input.depthM,
    heightM,
    basisSource,
    assumptions,
  };
}

function isInteriorOnly(roomType: RoomType): boolean {
  return ["bathroom", "dress_room", "corridor", "utility"].includes(roomType);
}

/** SurfaceType별 한국어 라벨 */
export function surfaceLabel(s: SurfaceType): string {
  const m: Record<SurfaceType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    baseboard: "걸레받이",
    door: "도어",
    window: "창호",
    partition: "파티션",
    counter: "카운터",
    cabinet: "수납장",
    sink: "싱크",
    lighting: "조명",
    fixture: "위생설비",
    signage: "사인/간판",
    facade: "파사드",
  };
  return m[s] || s;
}

/** SurfaceType → RoomQuantityBasis에서 가져올 면적 */
export function getSurfaceArea(
  surface: SurfaceType,
  basis: RoomQuantityBasis,
): number {
  switch (surface) {
    case "floor":
      return basis.floorM2;
    case "ceiling":
      return basis.ceilingM2;
    case "wall":
    case "partition":
      return basis.wallM2;
    case "baseboard":
      return basis.perimeterM;
    default:
      return basis.floorM2; // fallback
  }
}

export function roundQuantity(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface ResolvedQuantity {
  quantity: number;
  formulaKo: string;
  assumptions: string[];
}

export function resolveQuantity(
  template: WorkPackageLineTemplate,
  surfacePlan: SurfacePlan,
  basis: RoomQuantityBasis,
): ResolvedQuantity {
  const multiplier = template.quantityMultiplier ?? 1;
  const wasteFactor = template.wasteFactor ?? 0;

  let base = 0;
  let formulaKo = "";

  switch (template.quantityFormula) {
    case "surface_area":
      base =
        surfacePlan.quantityHint?.m2 ??
        getSurfaceArea(surfacePlan.surfaceType, basis);
      formulaKo = `${surfaceLabel(surfacePlan.surfaceType)} 면적`;
      break;
    case "floor_area":
      base = basis.floorM2;
      formulaKo = "방 바닥면적";
      break;
    case "ceiling_area":
      base = basis.ceilingM2;
      formulaKo = "방 천장면적";
      break;
    case "wall_area":
      base = basis.wallM2;
      formulaKo = "방 둘레 × 층고 - 개구부 차감";
      break;
    case "room_perimeter":
      base = basis.perimeterM;
      formulaKo = "방 둘레";
      break;
    case "door_count":
      base = basis.doorCount;
      formulaKo = "문 개수";
      break;
    case "window_count":
      base = basis.windowCount;
      formulaKo = "창 개수";
      break;
    case "fixture_count":
      base = basis.fixtureCount ?? 1;
      formulaKo = "설비 개수";
      break;
    case "manual_one_set":
      base = 1;
      formulaKo = "1식";
      break;
    case "waste_volume_estimate":
      base = Math.max(1, Math.ceil((basis.floorM2 + basis.wallM2) / 30));
      formulaKo = "면적 기반 폐기물 추정";
      break;
    case "total_project_area":
      base = basis.floorM2;
      formulaKo = "프로젝트 전체 면적";
      break;
  }

  const quantity = roundQuantity(base * multiplier * (1 + wasteFactor));

  const assumptions: string[] = [];
  if (wasteFactor > 0) {
    assumptions.push(`손실률 ${Math.round(wasteFactor * 100)}% 적용`);
  }

  return { quantity, formulaKo, assumptions };
}
