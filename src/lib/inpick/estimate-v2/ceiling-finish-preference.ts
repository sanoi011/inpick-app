import type { ProjectMode, RoomType, SurfacePlan } from "./types";

export type ResidentialCeilingFinish = "wallpaper" | "paint";

const RESIDENTIAL_DRY_ROOMS = new Set<RoomType>([
  "living_room",
  "master_bedroom",
  "bedroom",
  "kitchen",
  "entry",
  "dress_room",
  "corridor",
  "unknown",
]);

const CONVENTIONAL_CEILING_PATTERN =
  /wallpaper|silk|paint|ceiling_paint|도배|벽지|도장|페인트/i;

function isConventionalResidentialCeiling(plan: SurfacePlan): boolean {
  if (plan.surfaceType !== "ceiling") return false;
  if (!RESIDENTIAL_DRY_ROOMS.has(plan.roomType)) return false;
  return CONVENTIONAL_CEILING_PATTERN.test(
    `${plan.materialCategory} ${plan.materialNameKo || ""}`,
  );
}

function normalizePlan(
  plan: SurfacePlan,
  preference: ResidentialCeilingFinish,
): SurfacePlan {
  const wallpaper = preference === "wallpaper";
  return {
    ...plan,
    materialCategory: wallpaper ? "wallpaper" : "ceiling_paint",
    materialNameKo: wallpaper ? "천장 도배" : "천장 친환경 수성 도장",
    materialProductId: undefined,
    brand: undefined,
    sku: undefined,
    spec: wallpaper ? "실크벽지 또는 천장용 합지" : "친환경 수성페인트 무광 2회",
    selectedMaterialUnitPrice: undefined,
    selectedMaterialPriceSource: undefined,
    source: "user_selected_material",
    confidence: 1,
    assumptions: Array.from(
      new Set([
        ...(plan.assumptions || []),
        wallpaper
          ? "사용자가 주거 천장 마감 기본값으로 도배를 선택했습니다."
          : "사용자가 주거 천장 마감으로 도장을 선택했습니다.",
      ]),
    ),
  };
}

/**
 * 국내 공동주택의 일반 건식 공간 천장 마감을 프로젝트 단위 선택값으로 통일한다.
 *
 * Vision/prompt가 같은 실에 도장과 도배 SurfacePlan을 동시에 만든 경우 첫 계획만
 * 남겨 수량이 이중 합산되지 않게 한다. 욕실 SMC, 발코니 탄성코트, 우드/텍스 등
 * 특수 천장은 사용자의 별도 설계 의도로 보고 건드리지 않는다.
 */
export function applyResidentialCeilingFinishPreference(
  plans: SurfacePlan[],
  projectMode: ProjectMode,
  preference: ResidentialCeilingFinish = "wallpaper",
): SurfacePlan[] {
  if (projectMode === "commercial") return plans;

  const normalizedRooms = new Set<string>();
  const output: SurfacePlan[] = [];

  for (const plan of plans) {
    if (!isConventionalResidentialCeiling(plan)) {
      output.push(plan);
      continue;
    }
    if (normalizedRooms.has(plan.roomId)) continue;
    normalizedRooms.add(plan.roomId);
    output.push(normalizePlan(plan, preference));
  }

  return output;
}
