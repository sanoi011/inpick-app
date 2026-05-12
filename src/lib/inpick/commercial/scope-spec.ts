/**
 * CommercialScopeSpec — 상가·사무실 견적 산출용 구조화 데이터.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-1
 *
 * 핵심:
 *  - 이미지 생성용 stylePrompt와 분리
 *  - zone × surface × system × fixture × quantity × grade × confidence
 *  - build-estimate가 이걸 읽어 line item 생성
 *  - AI + 사용자 입력 + Vision layer + default가 merge되며 version +1
 */

export type CommercialBusinessType =
  | "cafe"
  | "restaurant"
  | "retail"
  | "beauty_salon"
  | "clinic"
  | "academy"
  | "office"
  | "bakery"
  | "bar"
  | "gym"
  | "studio_space"
  | "other_commercial";

export type CommercialZoneType =
  | "main_hall"
  | "counter"
  | "kitchen"
  | "storage"
  | "restroom"
  | "treatment_room"
  | "fitting_room"
  | "office_room"
  | "meeting_room"
  | "lounge"
  | "front_facade"
  | "signage"
  | "corridor"
  | "other";

export type CommercialSurfaceType =
  | "floor"
  | "wall"
  | "ceiling"
  | "baseboard"
  | "door"
  | "window"
  | "partition"
  | "counter"
  | "built_in_furniture"
  | "lighting"
  | "signage"
  | "facade";

export type CommercialSystemType =
  | "electrical"
  | "lighting"
  | "plumbing"
  | "drainage"
  | "hvac"
  | "ventilation"
  | "exhaust_hood"
  | "fire_safety"
  | "gas"
  | "network"
  | "cctv"
  | "access_control"
  | "soundproofing";

export type CommercialFixtureType =
  | "counter"
  | "sink"
  | "cabinet"
  | "display_shelf"
  | "table_set"
  | "partition"
  | "reception_desk"
  | "office_desk"
  | "meeting_table"
  | "storage_cabinet"
  | "restroom_fixture"
  | "signage_unit"
  | "other";

export type FinishGrade = "basic" | "standard" | "premium";

export type WorkAction =
  | "keep_existing"
  | "repair"
  | "replace"
  | "new_install"
  | "demolish_and_new"
  | "unknown";

export type SiteCondition =
  | "empty_shell"
  | "existing_interior"
  | "partial_remodel"
  | "operating_store"
  | "unknown";

export type ScopeSource =
  | "user_input"
  | "ai_extracted"
  | "vision_layer"
  | "default_inferred";

export interface CommercialSurfacePlan {
  id: string;
  zoneId: string;
  surfaceType: CommercialSurfaceType;
  action: WorkAction;
  materialCategory: string;
  materialNameKo?: string;
  brand?: string;
  sku?: string;
  grade: FinishGrade;
  quantityM2?: number;
  quantityM?: number;
  quantityEa?: number;
  confidence: number; // 0~1
  source: ScopeSource;
  assumptions: string[];
  warnings: string[];
}

export interface CommercialSystemPlan {
  id: string;
  zoneId?: string;
  type: CommercialSystemType;
  action: WorkAction;
  grade: FinishGrade;
  quantityEa?: number;
  quantityM?: number;
  quantityM2?: number;
  descriptionKo: string;
  confidence: number;
  source: ScopeSource;
  assumptions: string[];
  warnings: string[];
}

export interface CommercialFixturePlan {
  id: string;
  zoneId: string;
  type: CommercialFixtureType;
  action: WorkAction;
  grade: FinishGrade;
  quantityEa?: number;
  quantityM?: number;
  descriptionKo: string;
  confidence: number;
  source: ScopeSource;
}

export interface CommercialZoneScope {
  id: string;
  nameKo: string;
  type: CommercialZoneType;
  areaM2: number;
  priority: "P1" | "P2" | "P3";
  surfacePlans: CommercialSurfacePlan[];
  systemPlans: CommercialSystemPlan[];
  fixturePlans: CommercialFixturePlan[];
  assumptions: string[];
  missingFields: string[];
  confidence: number;
}

export interface DemolitionPlan {
  required: boolean;
  scopeKo: string;
  confidence: number;
}

export interface SignagePlan {
  exteriorSignage: boolean;
  interiorSignage: boolean;
  facadeWork: boolean;
  descriptionKo: string;
  confidence: number;
}

export interface EstimateReadiness {
  canBuildEstimate: boolean;
  score: number; // 0~1
  requiredMissingFields: string[];
  optionalMissingFields: string[];
}

export interface CommercialScopeSpec {
  projectMode: "commercial";
  businessType: CommercialBusinessType;
  totalAreaM2: number;
  totalPyeong?: number;
  ceilingHeightM?: number;
  siteCondition: SiteCondition;
  budgetTier: FinishGrade;
  zones: CommercialZoneScope[];
  globalSystems: CommercialSystemPlan[];
  demolitionPlan: DemolitionPlan;
  signagePlan?: SignagePlan;
  estimateReadiness: EstimateReadiness;
  assumptions: string[];
  warnings: string[];
  source: "chat_extract" | "user_form" | "vision_layer" | "merged";
  version: number;
}
