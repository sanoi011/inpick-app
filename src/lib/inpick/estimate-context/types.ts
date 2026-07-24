/**
 * 견적 evidence 파이프라인 공통 타입.
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §5-3
 *
 * Flow:
 *   Step2 이미지 생성 → design_outputs (evidence 저장)
 *     → vision-materials/analyze (자동 백그라운드) → materialHints/status 갱신
 *   견적 페이지 진입 → estimate-context/finalize → estimate_contexts 스냅샷
 *     → build-estimate (contextId) → estimate lines + source/confidence
 */

export type ProjectMode = "apartment" | "photo_only" | "commercial";

export type DesignTargetType = "whole" | "room" | "zone" | "surface";

export type RenderKind =
  | "full_render"
  | "room_render"
  | "zone_render"
  | "surface_render"
  | "space_edit";

export type DesignOutputStatus =
  | "generated"
  | "analysis_pending"
  | "analysis_done"
  | "analysis_failed";

export type MaterialHintSource =
  | "prompt_extract"
  | "scope_default"
  | "vision_analysis"
  | "user_selected";

export type SurfaceTypeKind =
  | "floor"
  | "wall"
  | "ceiling"
  | "window"
  | "door"
  | "counter"
  | "signage"
  | "facade"
  | "partition"
  | "lighting"
  | "built_in_furniture"
  | "fixture"
  | "sink"
  | "unknown";

export interface MaterialHint {
  surfaceType: SurfaceTypeKind;
  /** "porcelain_tile" / "engineered_wood" 등 카테고리 키 */
  materialCategory: string;
  /** material_products.id — DB에서 검증된 제품만 저장 */
  materialProductId?: string;
  materialNameKo?: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  observationId?: string;
  matchStatus?: "confirmed" | "recommended" | "fallback";
  /** 0~1 신뢰도 */
  confidence: number;
  source: MaterialHintSource;
  assumptions?: string[];
}

export interface DesignOutput {
  id: string;
  projectId: string;
  userId: string;
  projectMode: ProjectMode;
  targetType: DesignTargetType;
  targetId: string;
  targetName: string;
  renderKind: RenderKind;
  imageUrl: string;
  prompt?: string;
  negativePrompt?: string;
  materialHints: MaterialHint[];
  status: DesignOutputStatus;
  analysisJobId?: string;
  analysisError?: string;
  createdAt: string;
  updatedAt: string;
}

export type EstimateLevel =
  | "L0_BASIC"
  | "L1_DESIGN"
  | "L2_IMAGE_ANALYZED"
  | "L3_USER_CONFIRMED";

export interface EstimateReadiness {
  canBuildEstimate: boolean;
  estimateLevel: EstimateLevel;
  /** 0~1 */
  score: number;
  missingBlockingFields: string[];
  missingOptionalFields: string[];
  warnings: string[];
}

export interface EstimateContext {
  id: string;
  projectId: string;
  userId: string;
  projectMode: ProjectMode;
  step1Snapshot: unknown;
  scopeSnapshot: unknown;
  designOutputs: DesignOutput[];
  materialEvidence: unknown[];
  userMaterialEdits: unknown[];
  readiness: EstimateReadiness;
  createdAt: string;
}

/**
 * 견적 line item에 부착할 source/confidence/evidence.
 * P4에서 build-estimate 모든 라인에 채워야 함.
 */
export type EstimateLineSource =
  | "user_selected_material"
  | "vision_confirmed_material"
  | "vision_recommended_material"
  | "prompt_extracted_material"
  | "scope_default_material"
  | "standard_fallback_material";

export interface EstimateEvidenceRef {
  type:
    | "design_output"
    | "vision_observation"
    | "material_match_candidate"
    | "material_match_decision"
    | "render_material_edit"
    | "scope_spec"
    | "standard_table";
  id?: string;
  label?: string;
}

export interface EstimateLineSourceMeta {
  source: EstimateLineSource;
  /** 0~1 */
  confidence: number;
  evidenceRefs: EstimateEvidenceRef[];
  assumptions: string[];
}

/** DB row -> DesignOutput */
export function mapDbDesignOutput(row: Record<string, unknown>): DesignOutput {
  const hints = Array.isArray(row.material_hints) ? (row.material_hints as MaterialHint[]) : [];
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    projectMode: row.project_mode as ProjectMode,
    targetType: row.target_type as DesignTargetType,
    targetId: String(row.target_id),
    targetName: String(row.target_name),
    renderKind: row.render_kind as RenderKind,
    imageUrl: String(row.image_url),
    prompt: row.prompt ? String(row.prompt) : undefined,
    negativePrompt: row.negative_prompt ? String(row.negative_prompt) : undefined,
    materialHints: hints,
    status: row.status as DesignOutputStatus,
    analysisJobId: row.analysis_job_id ? String(row.analysis_job_id) : undefined,
    analysisError: row.analysis_error ? String(row.analysis_error) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
