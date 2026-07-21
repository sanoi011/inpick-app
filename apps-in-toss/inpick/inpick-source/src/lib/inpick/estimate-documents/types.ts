/**
 * Estimate Document Package — 건축공사 견적서 양식 (Track B Phase 1).
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §4
 *
 * 정책:
 *   - 발행 시점 snapshot — 발행 후 계정/견적/자재 변경되어도 문서는 불변
 *   - 3 mode: consumer_preview / contractor_bid / matched_contract
 *   - SKU hallucination 금지 — material_products.id 있는 경우만 확정 표시
 */

export type EstimateDocumentMode =
  | "consumer_preview" // 소비자 본인용 (전체 정보, 사업자 미선정 가능)
  | "contractor_bid"   // 사업자 입찰용 (사업자 정보 자동 + 소비자 마스킹)
  | "matched_contract"; // 계약 후 확정본 (전체 정보)

export type EstimateDocumentStatus =
  | "draft"
  | "issued"
  | "submitted"
  | "accepted"
  | "voided";

/**
 * 발행 시점 당사자 스냅샷.
 * (계정 변경되어도 과거 문서는 이 스냅샷 사용)
 */
export interface EstimatePartySnapshot {
  role: "consumer" | "contractor" | "inpick";
  userId?: string;
  contractorId?: string;
  displayName: string;
  companyName?: string;
  ceoName?: string;
  businessRegistrationNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNo?: string;
  tradeSpecialties?: string[];
  /** contractor_bid mode에서 소비자 정보 마스킹 시 true */
  isMasked?: boolean;
}

/**
 * 프로젝트 scope 스냅샷.
 * floorPlan/material/estimate hash 포함 → 도면 stale 검증.
 */
export interface ProjectScopeSnapshot {
  projectId: string;
  consumerId: string;
  rfqId?: string;
  bidId?: string;
  contractId?: string;
  propertyId?: string;
  projectName: string;
  addressText: string;
  /** contractor_bid 모드 — 상세 동/호 마스킹 */
  addressMaskedText?: string;
  apartmentName?: string;
  buildingDong?: string;
  unitHo?: string;
  floorPlanVersionId?: string;
  parsedFloorPlanId?: string;
  floorPlanHash?: string;
  roomGeometryHash?: string;
  materialSnapshotHash?: string;
  estimateSnapshotHash?: string;
  totalAreaM2?: number;
  exclusiveAreaM2?: number;
  expansionOption?: "basic" | "expanded" | "mixed" | "unknown";
  scopeSummary: string;
}

/**
 * 견적서 line item (공종별내역서 행).
 */
export interface EstimateDocumentLine {
  id: string;
  tradeCode: string;
  tradeName: string;
  roomName?: string;
  itemName: string;
  spec?: string;
  unit: string;
  quantity: number;
  materialUnitPrice?: number;
  materialAmount?: number;
  laborUnitPrice?: number;
  laborAmount?: number;
  expenseUnitPrice?: number;
  expenseAmount?: number;
  totalAmount: number;
  calculationBasis?: string;
  // 자재 정보 (DB row 있는 경우만 확정 표시)
  brand?: string;
  productName?: string;
  sku?: string;
  materialProductId?: string;
  priceSource?: string;
  confidence?: number;
  notes?: string;
  // P13: 자재집계표용 — manufacturer/supplier/spec 확장
  manufacturer?: string;
  supplierName?: string;
  vendorName?: string;
  modelNo?: string;
  productSpec?: string;
  materialCategoryName?: string;
  matchStatus?: string;
  fallbackReason?: string;
  appliedAt?: string;
}

/**
 * 총괄표 — 재료비/노무비/경비/간접비/이윤/공급가/VAT/총액.
 */
export interface EstimateDocumentSummary {
  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  directCost: number;       // 재료비 + 노무비 + 경비
  indirectCost: number;     // 간접비 6%
  profit: number;           // 이윤 5%
  supplyAmount: number;     // 공급가액
  vat: number;              // 부가가치세 10%
  totalAmount: number;      // 총 견적금액
}

/**
 * 총괄내역서 — 17공종별 한 줄.
 */
export interface TradeSummaryRow {
  tradeCode: string;
  tradeName: string;
  materialAmount: number;
  laborAmount: number;
  expenseAmount: number;
  directCost: number;
  indirectCost: number;
  profit: number;
  vat: number;
  totalAmount: number;
  notes?: string;
}

/**
 * 단일 견적서 패키지 (A4 가로 4페이지).
 */
export interface EstimateDocumentPackage {
  id: string;
  /** 예: INP-QT-20260511-AB12CD-V01 */
  documentNo: string;
  version: number;
  mode: EstimateDocumentMode;
  status: EstimateDocumentStatus;
  issuedAt: string;
  validUntil?: string;
  project: ProjectScopeSnapshot;
  consumer: EstimatePartySnapshot;
  contractor?: EstimatePartySnapshot;
  inpick?: EstimatePartySnapshot;
  summary: EstimateDocumentSummary;
  tradeSummaries: TradeSummaryRow[];
  lines: EstimateDocumentLine[];
  /** 견적 전제 조건 (현장 실측 X 등) */
  assumptions: string[];
  /** 견적 제외 항목 */
  exclusions: string[];
  warnings: string[];
  generatedBy: "system" | "contractor" | "admin";
}

/**
 * DB row → camelCase 변환용 (estimate_document_snapshots).
 */
export interface EstimateDocumentSnapshotRow {
  id: string;
  project_id: string;
  rfq_id?: string;
  bid_id?: string;
  contract_id?: string;
  consumer_id: string;
  contractor_id?: string;
  mode: EstimateDocumentMode;
  status: EstimateDocumentStatus;
  document_no: string;
  version: number;
  title: string;
  project_snapshot: ProjectScopeSnapshot;
  consumer_snapshot: EstimatePartySnapshot;
  contractor_snapshot?: EstimatePartySnapshot;
  inpick_snapshot?: EstimatePartySnapshot;
  summary_snapshot: EstimateDocumentSummary;
  trade_summary_snapshot: TradeSummaryRow[];
  line_snapshot: EstimateDocumentLine[];
  assumptions: string[];
  exclusions: string[];
  warnings: string[];
  pdf_url?: string;
  pdf_storage_path?: string;
  scope_hash: string;
  estimate_hash: string;
  material_hash?: string;
  issued_at: string;
  valid_until?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 사업자 입찰 단가 override input.
 */
export interface BidPriceOverrides {
  lineOverrides?: Array<{
    lineId: string;
    materialUnitPrice?: number;
    laborUnitPrice?: number;
    expenseUnitPrice?: number;
    memo?: string;
  }>;
  globalDiscountPercent?: number;
  constructionDays?: number;
  specialNotes?: string;
}
