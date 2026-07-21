/**
 * Vision Material Matcher — 공통 타입.
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md §6
 *
 * 정책: Gemini 절대 무사용 (Claude/OpenAI/RunPod/Supabase/Python만).
 *
 * 핵심 흐름:
 *   사용자 이미지 → 탐지(GroundingDINO) → 분할(SAM2) → embedding(CLIP) → OCR
 *   → material_products 검색 → rerank → confidence gate
 *   → 17공종 견적 엔진 연결 → 브랜드/SKU/스펙/단가 PDF
 */

// ─── 표면 타입 (탐지 대상) ───
export type SurfaceType =
  | "floor"
  | "wall"
  | "ceiling"
  | "tile"
  | "cabinet"
  | "countertop"
  | "baseboard"
  | "door"
  | "window"
  | "fixture"
  | "lighting"
  | "sanitary"
  | "unknown";

export type SourceImageKind = "user_photo" | "ai_render" | "floorplan" | "reference";

export type MatchStatus = "confirmed" | "recommended" | "fallback" | "rejected";

export type DecisionType =
  | "auto_high_confidence"
  | "user_selected"
  | "contractor_selected"
  | "fallback_generic"
  | "rejected";

export type ImageKind =
  | "reference"
  | "catalog"
  | "texture"
  | "package"
  | "user_confirmed";

// ─── 분석 요청/응답 ───
export interface VisionMaterialAnalyzeRequest {
  projectId: string;
  roomId?: string;
  roomName?: string;
  roomType?: string;
  imageUrl: string;
  sourceImageKind: SourceImageKind;
  /** 사용자가 클릭한 좌표 (원본 이미지 기준) — 있으면 클릭 주변 우선 분석 */
  clickedPoint?: { x: number; y: number };
  /** 사용자가 직접 그린 bbox (있으면 해당 영역만 분석) */
  selectedBbox?: { x: number; y: number; width: number; height: number };
  floorplanGeometry?: unknown;
  budgetTier?: "low" | "mid" | "high" | "premium";
  styleTags?: string[];
  /** 한정 surface 타입만 보고 싶을 때 */
  targetSurfaceTypes?: SurfaceType[];
  /** Top-K candidate 수 (default 5, max 20) */
  maxCandidates?: number;
}

export interface DominantColor {
  hex: string;
  ratio: number;
}

export interface CoarseLabel {
  label: string;
  confidence: number;
}

// ─── 단일 표면 observation ───
export interface SurfaceObservation {
  /** DB material_vision_observations.id */
  id?: string;
  surfaceType: SurfaceType;
  roomType?: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Supabase Storage URL (segmentation mask) */
  maskUrl?: string;
  /** Supabase Storage URL (cropped surface image) */
  cropUrl?: string;
  /** 0~1 — 이미지 전체 면적 대비 */
  areaRatio?: number;
  dominantColors?: DominantColor[];
  textureFeatures?: Record<string, unknown>;
  ocrText?: string;
  coarseLabels: CoarseLabel[];
  /** CLIP/OpenCLIP 512차원 (DB pgvector) */
  embedding?: number[];
  /** 탐지 confidence (0~1) */
  confidence: number;
}

// ─── 제품 후보 ───
export interface CandidateScores {
  category: number;
  visual: number;
  texture: number;
  color: number;
  ocr: number;
  price: number;
  roomRule: number;
  budgetStyle: number;
  total: number;
}

export interface MaterialProductCandidate {
  /** material_products.id (UUID) — 절대 hallucinate 금지 */
  materialProductId: string;
  rank: number;
  brand?: string;
  productName: string;
  sku?: string;
  spec?: string;
  category?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  imageUrl?: string;
  scores: CandidateScores;
  /** 가중합 후 정규화된 confidence (0~1) */
  confidence: number;
  reasons: string[];
  warnings: string[];
}

// ─── 매칭 결정 ───
export interface MatchRecommendation {
  status: MatchStatus;
  selectedMaterialProductId?: string;
  confidence: number;
  fallbackReason?: string;
  /** UI 표시용 라벨 — "[확정] LX Z:IN ...", "[추천] ...", "[기본] generic" */
  displayLabel: string;
}

// ─── 분석 결과 ───
export interface AnalyzedSurface {
  observation: SurfaceObservation;
  candidates: MaterialProductCandidate[];
  recommendation: MatchRecommendation;
}

export interface VisionMaterialAnalyzeResult {
  jobId?: string;
  status: "completed" | "processing" | "failed";
  observations: AnalyzedSurface[];
  summary: {
    observationCount: number;
    highConfidenceCount: number;
    recommendedCount: number;
    fallbackCount: number;
    /** {detector, segmenter, embedding, ocr, vision} 모델 버전 */
    modelVersions: Record<string, string>;
    elapsedMs: number;
    /** real=실제 탐지/임베딩, mock=분석 인프라 미연결 개발 폴백 */
    analysisMode: "real" | "mock";
  };
  /** 에러 시 — 사용자에게 보여줄 hint */
  error?: string;
  hint?: string;
}

// ─── 견적 line metadata 확장 (Phase 6) ───
export interface EstimateLineMaterialMeta {
  materialProductId?: string;
  brand?: string;
  productName?: string;
  sku?: string;
  spec?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  matchStatus: MatchStatus;
  confidence?: number;
  fallbackReason?: string;
  candidateCount?: number;
  observationId?: string;
}

// ─── DB row 매핑 (snake_case → camelCase 변환) ───
export interface MaterialProductImageRow {
  id: string;
  material_product_id: string;
  image_url: string;
  image_kind: ImageKind;
  viewpoint?: string;
  source?: string;
  source_license?: string;
  width?: number;
  height?: number;
  perceptual_hash?: string;
  clip_embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface MaterialVisionObservationRow {
  id: string;
  project_id?: string;
  room_id?: string;
  source_image_url: string;
  source_image_kind: SourceImageKind;
  surface_type: SurfaceType;
  room_type?: string;
  bbox?: Record<string, number>;
  mask_url?: string;
  crop_url?: string;
  area_ratio?: number;
  dominant_colors?: DominantColor[];
  texture_features?: Record<string, unknown>;
  ocr_text?: string;
  coarse_labels?: CoarseLabel[];
  clip_embedding?: number[];
  detector_model?: string;
  segmenter_model?: string;
  vision_model?: string;
  confidence: number;
  status: "pending" | "matched" | "fallback" | "rejected" | "confirmed";
  created_at: string;
}

export interface MaterialMatchCandidateRow {
  id: string;
  observation_id: string;
  material_product_id: string;
  rank: number;
  category_score: number;
  visual_score: number;
  texture_score: number;
  color_score: number;
  ocr_score: number;
  price_score: number;
  room_rule_score: number;
  budget_style_score: number;
  total_score: number;
  confidence: number;
  reasons?: string[];
  warnings?: string[];
  created_at: string;
}

export interface MaterialMatchDecisionRow {
  id: string;
  observation_id: string;
  selected_material_product_id?: string;
  decision_type: DecisionType;
  confidence: number;
  fallback_reason?: string;
  decided_by?: string;
  decided_at: string;
  metadata?: Record<string, unknown>;
}

export interface MaterialEstimateLineLinkRow {
  id: string;
  project_id: string;
  estimate_id?: string;
  estimate_line_id: string;
  observation_id?: string;
  material_product_id?: string;
  trade_code?: string;
  room_id?: string;
  room_name?: string;
  surface_type?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  price_source?: string;
  confidence?: number;
  match_status: MatchStatus;
  fallback_reason?: string;
  created_at: string;
}
