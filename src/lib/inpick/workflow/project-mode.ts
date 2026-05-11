/**
 * Project mode 타입 (residential / commercial).
 *
 * 가이드: c:\Users\user\Downloads\inpick-commercial-editable-render-workflow-plan-20260511.md §2
 *
 * 정책:
 *   - Step1에서 projectMode 결정
 *   - residential/apartment만 기존 평면도 자동 호출 루프
 *   - commercial은 면적/층고/전면폭으로 ShellGeometry 추정
 */

export type ProjectMode = "residential" | "commercial";

export type ResidentialBuildingType =
  | "apartment"
  | "house"
  | "officetel"
  | "other_residential";

export type CommercialBusinessType =
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

export type CommercialSystemRequirement =
  | "demolition"
  | "flooring"
  | "wall_finish"
  | "ceiling"
  | "lighting"
  | "electrical_upgrade"
  | "plumbing"
  | "gas"
  | "kitchen_exhaust"
  | "hvac"
  | "fire_sprinkler"
  | "signage"
  | "facade"
  | "custom_millwork"
  | "restroom"
  | "waterproofing"
  | "soundproofing"
  | "network_cctv";

export interface CommercialZoneSpec {
  id: string;
  nameKo: string;
  type:
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
  areaM2?: number;
  priority: number;
}

export interface CommercialProgramSpec {
  projectMode: "commercial";
  businessType: CommercialBusinessType;
  businessTypeLabelKo: string;
  address?: string;
  floor?: string;
  areaM2?: number;
  areaPyeong?: number;
  ceilingHeightMm?: number;
  frontWidthMm?: number;
  depthMm?: number;
  hasExistingFloorPlan: boolean;
  hasPhotos: boolean;
  frontFacadeIncluded: boolean;
  restroomIncluded: boolean;
  wetAreaRequired: boolean;
  kitchenRequired: boolean;
  gasRequired: boolean;
  exhaustRequired: boolean;
  electricalUpgradeRequired: boolean;
  fireSafetyRequired: boolean;
  requiredSystems: CommercialSystemRequirement[];
  zones: CommercialZoneSpec[];
  notes?: string;
}

/**
 * Design target — residential room + commercial zone + facade를 통합.
 * Step2Designer가 같은 컴포넌트에서 다룸.
 */
export type DesignTargetKind = "room" | "commercial_zone" | "facade";

export interface DesignTarget {
  id: string;
  kind: DesignTargetKind;
  nameKo: string;
  type: string;
  areaM2?: number;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
}

// ─── 임시 매장 쉘 (도면 없을 때) ───
export interface ShellGeometry {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** 사각형 폴리곤 (0~1 정규화 시 ratio="ratio") */
  polygon: Array<{ x: number; y: number }>;
  source: "estimated" | "provided";
  notes?: string;
}

/**
 * 면적 + 전면 폭으로 사각형 쉘 추정.
 */
export function buildCommercialShellFromInputs(spec: CommercialProgramSpec): ShellGeometry {
  const areaM2 = spec.areaM2 || 33; // default 10평
  const frontM = spec.frontWidthMm ? spec.frontWidthMm / 1000 : Math.sqrt(areaM2 * 0.9);
  const depthM = areaM2 / Math.max(2, frontM);
  const widthMm = Math.round(frontM * 1000);
  const depthMm = Math.round(depthM * 1000);
  const heightMm = spec.ceilingHeightMm || 2700; // 상가 표준
  return {
    widthMm,
    depthMm,
    heightMm,
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    source: spec.frontWidthMm ? "estimated" : "estimated",
    notes: spec.frontWidthMm
      ? "전면 폭 + 면적으로 사각형 쉘 추정"
      : "면적만 입력 — sqrt(area * 0.9)로 전면 추정 (정확도 낮음)",
  };
}

/**
 * 업종 → 표시 라벨.
 */
export function businessTypeLabelKo(t: CommercialBusinessType): string {
  const map: Record<CommercialBusinessType, string> = {
    cafe: "카페",
    restaurant: "음식점",
    retail: "판매점",
    beauty_salon: "미용실",
    clinic: "병원/의원",
    academy: "학원",
    office: "사무실",
    gym: "헬스/필라테스",
    bakery: "베이커리",
    bar: "주점/바",
    studio: "스튜디오",
    other_commercial: "기타 상가",
  };
  return map[t] || "기타";
}
