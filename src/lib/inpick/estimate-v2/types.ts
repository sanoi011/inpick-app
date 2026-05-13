/**
 * estimate-v2 — 공종별 실행내역서형 견적 엔진 타입.
 * 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §4
 *
 * 핵심 객체:
 *   1. SurfacePlan          — 공간×부위×자재 마감 계획 (입력)
 *   2. WorkPackageRule      — SurfacePlan을 실제 공사 라인으로 전개하는 규칙
 *   3. ConstructionEstimateLine — 견적서 라인 (출력)
 *   4. ConstructionEstimate — 견적서 패키지
 */

export type ProjectMode = "apartment" | "photo_only" | "commercial";

export type RoomType =
  | "living_room"
  | "master_bedroom"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "entry"
  | "balcony"
  | "dress_room"
  | "corridor"
  | "utility"
  | "commercial_zone"
  | "unknown";

export type SurfaceType =
  | "floor"
  | "wall"
  | "ceiling"
  | "baseboard"
  | "door"
  | "window"
  | "partition"
  | "counter"
  | "cabinet"
  | "sink"
  | "lighting"
  | "fixture"
  | "signage"
  | "facade";

export type WorkAction =
  | "keep_existing"
  | "repair"
  | "replace"
  | "new_install"
  | "demolish_and_new"
  | "unknown";

export type EvidenceSource =
  | "user_selected_material"
  | "vision_confirmed_material"
  | "vision_recommended_material"
  | "prompt_extracted_material"
  | "scope_default_material"
  | "standard_fallback_material"
  | "floorplan_dimension"
  | "manual_admin_adjustment";

export type QuantityFormula =
  | "surface_area"
  | "floor_area"
  | "ceiling_area"
  | "wall_area"
  | "room_perimeter"
  | "door_count"
  | "window_count"
  | "fixture_count"
  | "manual_one_set"
  | "waste_volume_estimate"
  | "total_project_area";

export type EstimateUnit = "m2" | "m" | "ea" | "set" | "day" | "lot";

// ─── 입력: SurfacePlan ───────────────────────────────────────

export interface SurfacePlan {
  id: string;
  projectId: string;
  projectMode: ProjectMode;

  roomId: string;
  roomName: string;
  roomType: RoomType;

  surfaceType: SurfaceType;
  action: WorkAction;

  materialCategory: string;
  materialNameKo?: string;
  brand?: string;
  sku?: string;
  spec?: string;
  grade?: "basic" | "standard" | "premium";

  /** 자재 단가 (선택 자재가 있으면) — 없으면 WorkPackageRule.costModel.defaultMaterialUnitPrice 사용 */
  selectedMaterialUnitPrice?: number;

  quantityHint?: {
    m2?: number;
    m?: number;
    ea?: number;
    set?: number;
  };

  /** P14-1: 도면 치수 (mm) — 있으면 KitchenPlan 등에서 floorplan_inferred 활용 */
  floorplanRoom?: {
    widthMm?: number;
    depthMm?: number;
  };

  source: EvidenceSource;
  confidence: number;
  evidenceRefs: Array<{
    type:
      | "design_output"
      | "vision_observation"
      | "material_edit"
      | "scope_spec"
      | "floorplan_asset";
    id: string;
  }>;

  assumptions: string[];
  warnings: string[];
}

// ─── 규칙: WorkPackageRule ──────────────────────────────────

export interface WorkPackageRuleMatch {
  roomTypes?: RoomType[];
  surfaceTypes: SurfaceType[];
  materialCategories: string[];
  actions: WorkAction[];
}

export interface WorkPackageLineTemplate {
  tradeCode: string;
  tradeNameKo: string;
  subTradeCode: string;
  subTradeNameKo: string;

  taskNameKo: string;
  defaultItemNameKo: string;
  defaultSpec?: string;

  /** P15-3: 자재 카테고리 코드 — material_products 매칭 강제 (없으면 fallback) */
  materialCategoryCode?: string;
  /** P15-4: 매칭 필수 여부 — true면 fallback 시 warning 자동 추가 */
  requiredProductMatch?: boolean;
  /** P15-4: 고액 품목 (500K+ standard_fallback이면 경고) */
  highValue?: boolean;

  unit: EstimateUnit;

  quantityFormula: QuantityFormula;
  quantityMultiplier?: number;
  wasteFactor?: number;

  costModel: {
    /** 자재 단가 키 — surfacePlan에서 가져올 수 있는 키 (예: "selected_material_unit_price") */
    materialUnitPriceKey?: string;
    laborUnitPriceKey?: string;
    expenseUnitPriceKey?: string;
    defaultMaterialUnitPrice?: number;
    defaultLaborUnitPrice?: number;
    defaultExpenseUnitPrice?: number;
  };

  includeWhen?: {
    action?: WorkAction[];
    roomTypes?: RoomType[];
    requiresDemolition?: boolean;
  };

  assumptions: string[];
}

export interface WorkPackageRule {
  id: string;
  match: WorkPackageRuleMatch;
  outputLines: WorkPackageLineTemplate[];
}

// ─── 수량 기반: RoomQuantityBasis ───────────────────────────

export interface RoomQuantityBasis {
  roomId: string;
  roomName: string;
  roomType: RoomType;

  floorM2: number;
  ceilingM2: number;
  wallM2: number;
  perimeterM: number;

  doorCount: number;
  windowCount: number;
  fixtureCount?: number;

  /** P14-1: 도면 width/depth (m) — KitchenPlan 등에서 floorplan_inferred 사용 */
  widthM?: number;
  depthM?: number;

  heightM: number;

  basisSource:
    | "floorplan_asset"
    | "render_room_spec"
    | "manual_input"
    | "area_inference";
  assumptions: string[];
}

// ─── P12 product/price resolution 타입 ──────────────────────

export type ProductMatchStatus =
  | "confirmed"
  | "recommended"
  | "category_default"
  | "standard_fallback";

export type MaterialPriceSource =
  | "material_price_lookup"
  | "material_price_observations"
  | "contractor_price"
  | "catalog_price"
  | "category_standard"
  | "kpa_standard"
  | "manual_override";

export interface ResolvedMaterialProduct {
  materialProductId?: string;
  brand?: string;
  manufacturer?: string;
  supplierName?: string;
  vendorName?: string;
  productName: string;
  sku?: string;
  modelNo?: string;
  spec?: string;
  unit?: string;
  categoryCode?: string;
  categoryName?: string;
  matchStatus: ProductMatchStatus;
  matchConfidence: number;
  fallbackReason?: string;
  raw?: unknown;
}

export interface ResolvedMaterialPrice {
  unitPrice: number;
  currency: "KRW";
  priceSource: MaterialPriceSource;
  priceSourceId?: string;
  appliedAt?: string;
  confidence: number;
  fallbackReason?: string;
  raw?: unknown;
}

export interface ProductResolvedLineMeta {
  product?: ResolvedMaterialProduct;
  price?: ResolvedMaterialPrice;
}

// ─── 출력: ConstructionEstimateLine ─────────────────────────

export interface ConstructionEstimateLine {
  id: string;
  sortNo: number;

  tradeCode: string;
  tradeNameKo: string;
  subTradeCode: string;
  subTradeNameKo: string;

  roomId: string;
  roomName: string;
  roomType: RoomType;
  surfaceType?: SurfaceType;

  taskNameKo: string;
  itemNameKo: string;
  brand?: string;
  sku?: string;
  spec?: string;

  // P12: product/price meta — DB resolver가 채움
  materialProductId?: string;
  manufacturer?: string;
  supplierName?: string;
  vendorName?: string;
  productName?: string;
  modelNo?: string;
  productSpec?: string;
  productUnit?: string;
  materialCategoryCode?: string;
  materialCategoryName?: string;
  materialPriceSource?: MaterialPriceSource;
  materialPriceSourceId?: string;
  materialPriceAppliedAt?: string;
  productMatchStatus?: ProductMatchStatus;
  productMatchConfidence?: number;
  priceConfidence?: number;
  fallbackReason?: string;

  unit: EstimateUnit;
  quantityFormulaKo: string;
  quantity: number;

  materialUnitPrice: number;
  laborUnitPrice: number;
  expenseUnitPrice: number;

  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  totalAmount: number;

  included: boolean;
  source: EvidenceSource;
  confidence: number;

  evidenceRefs: Array<{
    type:
      | "surface_plan"
      | "design_output"
      | "vision_observation"
      | "material_edit"
      | "floorplan_asset";
    id: string;
  }>;

  assumptions: string[];
  warnings: string[];
}

// ─── 최종 패키지: ConstructionEstimate ──────────────────────

export interface TradeSummary {
  tradeCode: string;
  tradeNameKo: string;
  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  totalAmount: number;
  lineCount: number;
}

export interface RoomSummary {
  roomId: string;
  roomName: string;
  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  totalAmount: number;
}

export interface MaterialSummary {
  materialCategory: string;
  itemNameKo: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit: string;
  quantity: number;
  amount: number;
}

export interface EstimateTotals {
  directMaterial: number;
  directLabor: number;
  directExpense: number;
  directTotal: number;
  indirectCost: number;
  generalManagement: number;
  profit: number;
  vat: number;
  totalWithVat: number;
}

export interface EstimateRateConfig {
  /** 간접비율 (직접공사비 기준) — 기본 0.06 (6%) */
  indirectRate: number;
  /** 일반관리비율 — 기본 0.04 (4%) */
  generalManagementRate: number;
  /** 이윤율 — 기본 0.05 (5%) */
  profitRate: number;
  /** 부가세율 — 기본 0.10 (10%) */
  vatRate: number;
}

export const DEFAULT_RATE_CONFIG: EstimateRateConfig = {
  indirectRate: 0.06,
  generalManagementRate: 0.04,
  profitRate: 0.05,
  vatRate: 0.1,
};

export interface ConfidenceSummary {
  userSelectedRatio: number;
  visionBasedRatio: number;
  promptBasedRatio: number;
  fallbackRatio: number;
  averageConfidence: number;
}

export interface ConstructionEstimate {
  id: string;
  projectId: string;
  projectMode: ProjectMode;
  version: number;

  lines: ConstructionEstimateLine[];

  tradeSummaries: TradeSummary[];
  roomSummaries: RoomSummary[];
  materialSummary: MaterialSummary[];

  totals: EstimateTotals;
  confidenceSummary: ConfidenceSummary;

  assumptions: string[];
  warnings: string[];
}
