/**
 * 업종별 기본 CommercialScopeSpec 템플릿.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-2
 *
 * 정책: 사용자/AI 입력 없으면 default_inferred로 채움.
 * 모든 zone에 floor/wall/ceiling surfacePlans 필수.
 * 업종별 필수 systemPlans (cafe=hvac, restaurant=exhaust_hood+gas+fire 등).
 */
import { inferZoneQuantities } from "./quantity-inference";
import type {
  CommercialBusinessType,
  CommercialScopeSpec,
  CommercialSurfacePlan,
  CommercialSurfaceType,
  CommercialSystemPlan,
  CommercialSystemType,
  CommercialZoneScope,
  CommercialZoneType,
  FinishGrade,
  SiteCondition,
} from "./scope-spec";

let idCounter = 1;
function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

// 업종별 zone 비율 (면적 분배) — main_hall 0.5, kitchen 0.2 등
const ZONE_RATIO_BY_BUSINESS: Record<
  CommercialBusinessType,
  Array<{ type: CommercialZoneType; nameKo: string; ratio: number; priority: "P1" | "P2" | "P3" }>
> = {
  cafe: [
    { type: "main_hall", nameKo: "메인 홀", ratio: 0.5, priority: "P1" },
    { type: "counter", nameKo: "카운터", ratio: 0.1, priority: "P1" },
    { type: "kitchen", nameKo: "제조/주방", ratio: 0.18, priority: "P1" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.07, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
    { type: "signage", nameKo: "간판", ratio: 0.05, priority: "P1" },
  ],
  restaurant: [
    { type: "main_hall", nameKo: "홀", ratio: 0.5, priority: "P1" },
    { type: "kitchen", nameKo: "주방", ratio: 0.25, priority: "P1" },
    { type: "storage", nameKo: "세척/창고", ratio: 0.07, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.08, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
    { type: "signage", nameKo: "간판", ratio: 0.05, priority: "P1" },
  ],
  bakery: [
    { type: "main_hall", nameKo: "쇼룸", ratio: 0.45, priority: "P1" },
    { type: "counter", nameKo: "카운터", ratio: 0.1, priority: "P1" },
    { type: "kitchen", nameKo: "베이킹실", ratio: 0.25, priority: "P1" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.07, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.04, priority: "P1" },
    { type: "signage", nameKo: "간판", ratio: 0.04, priority: "P1" },
  ],
  bar: [
    { type: "main_hall", nameKo: "홀", ratio: 0.55, priority: "P1" },
    { type: "counter", nameKo: "바", ratio: 0.18, priority: "P1" },
    { type: "kitchen", nameKo: "주방", ratio: 0.12, priority: "P1" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
  ],
  beauty_salon: [
    { type: "main_hall", nameKo: "메인 홀", ratio: 0.5, priority: "P1" },
    { type: "treatment_room", nameKo: "시술실", ratio: 0.2, priority: "P1" },
    { type: "counter", nameKo: "카운터", ratio: 0.08, priority: "P1" },
    { type: "storage", nameKo: "창고", ratio: 0.07, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
  ],
  clinic: [
    { type: "main_hall", nameKo: "대기실", ratio: 0.3, priority: "P1" },
    { type: "treatment_room", nameKo: "진료실", ratio: 0.4, priority: "P1" },
    { type: "counter", nameKo: "접수처", ratio: 0.1, priority: "P1" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
  ],
  academy: [
    { type: "office_room", nameKo: "강의실", ratio: 0.55, priority: "P1" },
    { type: "main_hall", nameKo: "로비", ratio: 0.2, priority: "P1" },
    { type: "office_room", nameKo: "교무실", ratio: 0.1, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P1" },
  ],
  office: [
    { type: "office_room", nameKo: "오픈 오피스", ratio: 0.5, priority: "P1" },
    { type: "meeting_room", nameKo: "회의실", ratio: 0.15, priority: "P1" },
    { type: "office_room", nameKo: "대표실", ratio: 0.1, priority: "P2" },
    { type: "lounge", nameKo: "탕비실/라운지", ratio: 0.1, priority: "P2" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
  ],
  gym: [
    { type: "main_hall", nameKo: "운동 공간", ratio: 0.6, priority: "P1" },
    { type: "treatment_room", nameKo: "PT실", ratio: 0.15, priority: "P2" },
    { type: "restroom", nameKo: "탈의실/샤워", ratio: 0.15, priority: "P1" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P2" },
  ],
  retail: [
    { type: "main_hall", nameKo: "매장 홀", ratio: 0.55, priority: "P1" },
    { type: "counter", nameKo: "카운터", ratio: 0.1, priority: "P1" },
    { type: "fitting_room", nameKo: "피팅룸", ratio: 0.1, priority: "P2" },
    { type: "storage", nameKo: "창고", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.1, priority: "P1" },
    { type: "signage", nameKo: "간판", ratio: 0.05, priority: "P1" },
  ],
  studio_space: [
    { type: "main_hall", nameKo: "촬영존", ratio: 0.7, priority: "P1" },
    { type: "lounge", nameKo: "라운지", ratio: 0.1, priority: "P2" },
    { type: "restroom", nameKo: "탈의/화장실", ratio: 0.15, priority: "P2" },
    { type: "storage", nameKo: "창고", ratio: 0.05, priority: "P2" },
  ],
  other_commercial: [
    { type: "main_hall", nameKo: "메인 공간", ratio: 0.65, priority: "P1" },
    { type: "counter", nameKo: "카운터", ratio: 0.1, priority: "P2" },
    { type: "storage", nameKo: "창고", ratio: 0.1, priority: "P2" },
    { type: "restroom", nameKo: "화장실", ratio: 0.1, priority: "P2" },
    { type: "front_facade", nameKo: "파사드", ratio: 0.05, priority: "P2" },
  ],
};

const REQUIRED_GLOBAL_SYSTEMS: Record<CommercialBusinessType, CommercialSystemType[]> = {
  cafe: ["electrical", "lighting", "plumbing", "drainage", "hvac", "cctv"],
  restaurant: [
    "electrical",
    "lighting",
    "plumbing",
    "drainage",
    "exhaust_hood",
    "ventilation",
    "gas",
    "fire_safety",
    "cctv",
  ],
  bakery: ["electrical", "lighting", "plumbing", "drainage", "ventilation", "hvac", "cctv"],
  bar: ["electrical", "lighting", "plumbing", "drainage", "hvac", "fire_safety", "cctv"],
  beauty_salon: ["electrical", "lighting", "plumbing", "drainage", "hvac", "ventilation"],
  clinic: ["electrical", "lighting", "plumbing", "drainage", "hvac", "ventilation", "fire_safety"],
  academy: ["electrical", "lighting", "hvac", "network", "fire_safety"],
  office: ["electrical", "lighting", "network", "hvac", "access_control", "soundproofing"],
  gym: ["electrical", "lighting", "plumbing", "drainage", "hvac", "ventilation"],
  retail: ["electrical", "lighting", "hvac", "cctv"],
  studio_space: ["electrical", "lighting", "soundproofing", "hvac"],
  other_commercial: ["electrical", "lighting", "hvac"],
};

const DEFAULT_MATERIAL_BY_SURFACE: Record<
  CommercialSurfaceType,
  { category: string; nameKo: string }
> = {
  floor: { category: "flooring", nameKo: "데코타일/포세린" },
  wall: { category: "wall_finish", nameKo: "도장/필름" },
  ceiling: { category: "ceiling", nameKo: "석고보드+도장" },
  baseboard: { category: "baseboard", nameKo: "PVC 걸레받이" },
  door: { category: "door", nameKo: "강화도어" },
  window: { category: "window", nameKo: "기존 유지" },
  partition: { category: "partition", nameKo: "유리 파티션" },
  counter: { category: "counter", nameKo: "솔리드 카운터" },
  built_in_furniture: { category: "furniture", nameKo: "맞춤 가구" },
  lighting: { category: "lighting", nameKo: "LED 조명" },
  signage: { category: "signage", nameKo: "아크릴 간판" },
  facade: { category: "facade", nameKo: "외부 마감" },
};

function makeSurfacePlan(
  zoneId: string,
  surfaceType: CommercialSurfaceType,
  grade: FinishGrade,
  quantityM2: number | undefined,
  perimeterM?: number,
): CommercialSurfacePlan {
  const def = DEFAULT_MATERIAL_BY_SURFACE[surfaceType];
  return {
    id: nextId("surf"),
    zoneId,
    surfaceType,
    action: "new_install",
    materialCategory: def.category,
    materialNameKo: def.nameKo,
    grade,
    quantityM2,
    quantityM: surfaceType === "baseboard" ? perimeterM : undefined,
    confidence: 0.5,
    source: "default_inferred",
    assumptions: ["면적 기반 자동 산출. 사용자 확정 필요."],
    warnings: [],
  };
}

function makeSystemPlan(
  zoneId: string | undefined,
  type: CommercialSystemType,
  grade: FinishGrade,
): CommercialSystemPlan {
  const descMap: Record<CommercialSystemType, string> = {
    electrical: "전기 콘센트/배선",
    lighting: "조명 설치",
    plumbing: "급수 배관",
    drainage: "배수 배관",
    hvac: "냉난방",
    ventilation: "환기",
    exhaust_hood: "주방 후드/덕트",
    fire_safety: "소방/방염",
    gas: "가스 배관",
    network: "LAN/네트워크",
    cctv: "CCTV",
    access_control: "출입통제",
    soundproofing: "방음/흡음",
  };
  return {
    id: nextId("sys"),
    zoneId,
    type,
    action: "new_install",
    grade,
    descriptionKo: descMap[type] || type,
    confidence: 0.55,
    source: "default_inferred",
    assumptions: ["업종 기본값. 실제 시공 범위 확정 필요."],
    warnings: [],
  };
}

function createZoneScope(
  zoneSpec: { type: CommercialZoneType; nameKo: string; ratio: number; priority: "P1" | "P2" | "P3" },
  totalAreaM2: number,
  ceilingHeightM: number,
  grade: FinishGrade,
): CommercialZoneScope {
  const zoneId = nextId("zone");
  const areaM2 = Math.round(totalAreaM2 * zoneSpec.ratio * 10) / 10;
  const q = inferZoneQuantities({
    zoneAreaM2: areaM2,
    ceilingHeightM,
    zoneType: zoneSpec.type,
  });
  const surfacePlans: CommercialSurfacePlan[] = [
    makeSurfacePlan(zoneId, "floor", grade, q.floorM2),
    makeSurfacePlan(zoneId, "wall", grade, q.wallM2),
    makeSurfacePlan(zoneId, "ceiling", grade, q.ceilingM2),
    makeSurfacePlan(zoneId, "baseboard", grade, undefined, q.baseboardM),
  ];
  return {
    id: zoneId,
    nameKo: zoneSpec.nameKo,
    type: zoneSpec.type,
    areaM2,
    priority: zoneSpec.priority,
    surfacePlans,
    systemPlans: [],
    fixturePlans: [],
    assumptions: q.assumptions,
    missingFields: [],
    confidence: 0.5,
  };
}

export interface CreateDefaultScopeInput {
  businessType: CommercialBusinessType;
  totalAreaM2: number;
  ceilingHeightM?: number;
  budgetTier?: FinishGrade;
  siteCondition?: SiteCondition;
}

export function createDefaultCommercialScope(
  input: CreateDefaultScopeInput,
): CommercialScopeSpec {
  const businessType = input.businessType;
  const totalAreaM2 = Math.max(1, input.totalAreaM2);
  const ceilingHeightM = input.ceilingHeightM ?? 2.7;
  const budgetTier: FinishGrade = input.budgetTier ?? "standard";
  const siteCondition: SiteCondition = input.siteCondition ?? "unknown";

  const zoneSpecs = ZONE_RATIO_BY_BUSINESS[businessType] || ZONE_RATIO_BY_BUSINESS.other_commercial;
  const zones = zoneSpecs.map((zs) =>
    createZoneScope(zs, totalAreaM2, ceilingHeightM, budgetTier),
  );

  const requiredSystems = REQUIRED_GLOBAL_SYSTEMS[businessType] || [];
  const globalSystems = requiredSystems.map((t) => makeSystemPlan(undefined, t, budgetTier));

  return {
    projectMode: "commercial",
    businessType,
    totalAreaM2,
    totalPyeong: Math.round((totalAreaM2 / 3.3058) * 10) / 10,
    ceilingHeightM,
    siteCondition,
    budgetTier,
    zones,
    globalSystems,
    demolitionPlan: {
      required: siteCondition !== "empty_shell",
      scopeKo:
        siteCondition === "empty_shell"
          ? "공실 — 철거 없음"
          : "기존 마감 일부 철거 추정. 현장 확인 필요.",
      confidence: 0.4,
    },
    signagePlan: {
      exteriorSignage: zones.some((z) => z.type === "signage" || z.type === "front_facade"),
      interiorSignage: false,
      facadeWork: zones.some((z) => z.type === "front_facade"),
      descriptionKo: "외부 간판 + 파사드 1식 (업종 기본).",
      confidence: 0.45,
    },
    estimateReadiness: {
      canBuildEstimate: true,
      score: 0.6, // default 템플릿 기준 0.6, 사용자 확정 시 ↑
      requiredMissingFields: [],
      optionalMissingFields: [],
    },
    assumptions: [
      "업종 기본 zone 비율로 면적을 분배했습니다. 실제 도면 입력 시 정확도 ↑",
      `층고 ${ceilingHeightM}m, 예산 등급 ${budgetTier}으로 가정했습니다.`,
    ],
    warnings: [],
    source: "default_inferred" as unknown as CommercialScopeSpec["source"],
    version: 1,
  };
}
