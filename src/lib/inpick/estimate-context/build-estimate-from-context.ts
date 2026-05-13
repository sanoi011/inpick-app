/**
 * estimate_contexts 단일 row → 견적 응답 합성.
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §10
 *
 * 합성 우선순위:
 *   1. user_selected_material  (render_material_edits / userMaterialEdits)
 *   2. vision_confirmed_material  (materialEvidence: confirmed)
 *   3. vision_recommended_material  (materialEvidence: recommended)
 *   4. prompt_extracted_material  (designOutputs[*].material_hints, source=prompt_extract)
 *   5. scope_default_material  (commercial scope surface/system plans)
 *   6. standard_fallback_material  (defaultSurfacesForRoom — KPA 단가)
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type {
  DesignOutput,
  EstimateLevel,
  EstimateLineSource,
  EstimateLineSourceMeta,
  MaterialHint,
  ProjectMode,
} from "./types";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface ContextRow {
  id: string;
  project_id: string;
  project_mode: ProjectMode;
  step1_snapshot: Record<string, unknown>;
  scope_snapshot: Record<string, unknown>;
  design_outputs_snapshot: DesignOutput[];
  material_evidence_snapshot: unknown[];
  user_material_edits_snapshot: unknown[];
  estimate_level: EstimateLevel;
  readiness_score: number;
  can_build_estimate: boolean;
  missing_blocking_fields: string[];
  missing_optional_fields: string[];
  warnings: string[];
  created_at: string;
}

export interface ContextEstimateResponse {
  /** estimate_contexts.id — UI에서 다시 fetch 용 */
  contextId: string;
  projectMode: ProjectMode;
  estimateLevel: EstimateLevel;
  /** L1=design_based, L2=image_analyzed, L3=user_confirmed 으로 매핑 */
  quotationType:
    | "rough_estimate"
    | "design_based_estimate"
    | "image_analyzed_estimate"
    | "user_confirmed_estimate";
  /** 각 surface별 합성된 line 목록 — UI는 이를 trade로 묶어서 표시 */
  lines: ContextEstimateLine[];
  grandTotalWon: number;
  warnings: string[];
  missingOptionalFields: string[];
  readinessScore: number;
}

export interface ContextEstimateLine {
  targetType: "whole" | "room" | "zone" | "surface";
  targetName: string;
  surface: string;
  materialName: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit: string;
  quantity: number;
  unitPriceWon: number;
  subtotalWon: number;
  meta: EstimateLineSourceMeta;
}

/**
 * Main entry — contextId로 견적 합성. context 없거나 에러 시 null 반환.
 */
export async function buildEstimateFromContext(
  contextId: string,
): Promise<ContextEstimateResponse | null> {
  const admin = getAdmin();
  if (!admin) {
    console.error("[buildEstimateFromContext] service not configured");
    return null;
  }
  const { data, error } = await admin
    .from("estimate_contexts")
    .select("*")
    .eq("id", contextId)
    .single();
  if (error || !data) {
    console.warn("[buildEstimateFromContext] not found:", error?.message);
    return null;
  }
  const ctx = data as ContextRow;

  // 각 design_output 단위로 lines 생성
  const lines: ContextEstimateLine[] = [];
  for (const out of ctx.design_outputs_snapshot ?? []) {
    const linesForOutput = synthesizeLinesForOutput(out, ctx);
    lines.push(...linesForOutput);
  }

  // design_outputs가 아예 없으면 → scope/standard fallback으로 최소 line 생성
  if (lines.length === 0) {
    lines.push(...synthesizeFallbackLines(ctx));
  }

  const grandTotalWon = lines.reduce((s, l) => s + l.subtotalWon, 0);

  const quotationType = mapLevelToQuotationType(ctx.estimate_level);

  return {
    contextId: ctx.id,
    projectMode: ctx.project_mode,
    estimateLevel: ctx.estimate_level,
    quotationType,
    lines,
    grandTotalWon,
    warnings: ctx.warnings ?? [],
    missingOptionalFields: ctx.missing_optional_fields ?? [],
    readinessScore: Number(ctx.readiness_score) || 0,
  };
}

/**
 * 단일 design_output에서 surfaces별 line을 합성.
 * - materialHints 기반 prompt 추출 surfaces (floor/wall/ceiling)
 * - 표준 면적 추정 (target dim 없으면 평수 비율 기반 분배)
 * - source는 hint.source에 따라 결정
 */
function synthesizeLinesForOutput(
  output: DesignOutput,
  ctx: ContextRow,
): ContextEstimateLine[] {
  const lines: ContextEstimateLine[] = [];

  // 면적 추정: target_type=room이면 표준 방 면적 룩업, whole/zone이면 전체 면적의 1/N
  const surfaceArea = estimateSurfaceArea(output, ctx);

  // material_hints 우선 사용. 없으면 표준 surface 셋 (floor/wall/ceiling)으로 폴백.
  const hintsBySurface = groupHintsBySurface(output.materialHints ?? []);

  // 기본 surface 3종 — 모든 공간에서 사실상 필요
  const baseSurfaces: Array<"floor" | "wall" | "ceiling"> = [
    "floor",
    "wall",
    "ceiling",
  ];
  for (const sKind of baseSurfaces) {
    const hint = hintsBySurface[sKind];
    const stdLine = standardLineForSurface(sKind, output.targetName);
    if (hint) {
      lines.push({
        targetType: output.targetType,
        targetName: output.targetName,
        surface: sKind === "floor" ? "바닥" : sKind === "wall" ? "벽" : "천장",
        materialName: hint.materialNameKo || stdLine.materialName,
        brand: hint.brand,
        sku: hint.sku,
        unit: stdLine.unit,
        quantity: roundDim(surfaceArea[sKind] ?? stdLine.quantity),
        unitPriceWon: stdLine.unitPriceWon,
        subtotalWon: Math.round(
          (surfaceArea[sKind] ?? stdLine.quantity) * stdLine.unitPriceWon,
        ),
        meta: {
          source: hintSourceToLineSource(hint.source),
          confidence: hint.confidence,
          evidenceRefs: [
            { type: "design_output", id: output.id, label: output.targetName },
          ],
          assumptions: hint.assumptions ?? [],
        },
      });
    } else {
      // 표준 fallback
      lines.push({
        targetType: output.targetType,
        targetName: output.targetName,
        surface: sKind === "floor" ? "바닥" : sKind === "wall" ? "벽" : "천장",
        materialName: stdLine.materialName,
        unit: stdLine.unit,
        quantity: roundDim(surfaceArea[sKind] ?? stdLine.quantity),
        unitPriceWon: stdLine.unitPriceWon,
        subtotalWon: Math.round(
          (surfaceArea[sKind] ?? stdLine.quantity) * stdLine.unitPriceWon,
        ),
        meta: {
          source: "standard_fallback_material",
          confidence: 0.45,
          evidenceRefs: [
            { type: "standard_table", label: "INPICK 표준 단가" },
            { type: "design_output", id: output.id, label: output.targetName },
          ],
          assumptions: ["이미지에서 명시적 자재 식별 없음 — 표준 자재 적용"],
        },
      });
    }
  }

  // 추가 hint (counter / built_in / signage / partition 등) — 정수형 가산
  for (const hint of output.materialHints ?? []) {
    if (baseSurfaces.includes(hint.surfaceType as "floor" | "wall" | "ceiling"))
      continue;
    const ext = extraSurfaceLine(hint, output.targetName);
    if (!ext) continue;
    lines.push({
      targetType: output.targetType,
      targetName: output.targetName,
      surface: ext.surface,
      materialName: hint.materialNameKo || ext.materialName,
      brand: hint.brand,
      sku: hint.sku,
      unit: ext.unit,
      quantity: ext.quantity,
      unitPriceWon: ext.unitPriceWon,
      subtotalWon: ext.unitPriceWon * ext.quantity,
      meta: {
        source: hintSourceToLineSource(hint.source),
        confidence: hint.confidence,
        evidenceRefs: [{ type: "design_output", id: output.id }],
        assumptions: hint.assumptions ?? [],
      },
    });
  }

  return lines;
}

/**
 * design_outputs 없을 때 폴백 lines — projectMode별 최소 견적.
 */
function synthesizeFallbackLines(ctx: ContextRow): ContextEstimateLine[] {
  const step1 = ctx.step1_snapshot as { areaM2?: number; selectedPyeong?: { exclusiveArea?: number } };
  const areaM2 =
    step1?.areaM2 ||
    step1?.selectedPyeong?.exclusiveArea ||
    (ctx.scope_snapshot as { totalAreaM2?: number })?.totalAreaM2 ||
    79.3; // 24평 기본
  const lines: ContextEstimateLine[] = [];
  const baseSurfaces: Array<"floor" | "wall" | "ceiling"> = [
    "floor",
    "wall",
    "ceiling",
  ];
  for (const sKind of baseSurfaces) {
    const stdLine = standardLineForSurface(sKind, "전체 공간");
    const quantity =
      sKind === "floor"
        ? areaM2
        : sKind === "wall"
          ? areaM2 * 2.5 // 벽면적 = 면적 × 2.5 (대략적 추정)
          : areaM2;
    lines.push({
      targetType: "whole",
      targetName: "전체 공간",
      surface: sKind === "floor" ? "바닥" : sKind === "wall" ? "벽" : "천장",
      materialName: stdLine.materialName,
      unit: stdLine.unit,
      quantity: roundDim(quantity),
      unitPriceWon: stdLine.unitPriceWon,
      subtotalWon: Math.round(quantity * stdLine.unitPriceWon),
      meta: {
        source: "standard_fallback_material",
        confidence: 0.4,
        evidenceRefs: [{ type: "standard_table", label: "INPICK 표준 단가" }],
        assumptions: ["생성 이미지 없음 — 평수 기반 표준 가견적"],
      },
    });
  }
  return lines;
}

function estimateSurfaceArea(
  output: DesignOutput,
  ctx: ContextRow,
): { floor: number; wall: number; ceiling: number } {
  // 1) target_type=room이면 표준 방 면적 룩업 (target_name 기반)
  const stdRoomArea = STANDARD_ROOM_AREA[output.targetName] ?? 12; // m²
  // 2) target_type=whole이면 전체 면적
  const step1 = ctx.step1_snapshot as { selectedPyeong?: { exclusiveArea?: number } };
  const totalArea =
    step1?.selectedPyeong?.exclusiveArea ??
    (ctx.scope_snapshot as { totalAreaM2?: number })?.totalAreaM2 ??
    79.3;
  if (output.targetType === "whole") {
    return { floor: totalArea, wall: totalArea * 2.5, ceiling: totalArea };
  }
  const ceilingH = 2.4;
  // 벽 = 둘레 × 천장높이 (둘레는 sqrt(area)*4로 근사)
  const perimeter = Math.sqrt(stdRoomArea) * 4;
  return { floor: stdRoomArea, wall: perimeter * ceilingH, ceiling: stdRoomArea };
}

/** 표준 방 면적 (m²) — fallback */
const STANDARD_ROOM_AREA: Record<string, number> = {
  거실: 22,
  안방: 12,
  부엌: 8,
  주방: 8,
  욕실: 4,
  욕실1: 4,
  욕실2: 3,
  침실: 9,
  침실1: 9,
  침실2: 9,
  현관: 3,
  드레스룸: 5,
  발코니: 6,
  전체: 79,
  "전체 공간": 79,
};

/** surface별 표준 단가 (vision 분석 전 1차 폴백) */
function standardLineForSurface(
  s: "floor" | "wall" | "ceiling",
  _targetName: string,
): {
  materialName: string;
  unit: string;
  unitPriceWon: number;
  quantity: number;
} {
  if (s === "floor")
    return {
      materialName: "강마루 (표준)",
      unit: "m²",
      unitPriceWon: 64000,
      quantity: 12,
    };
  if (s === "wall")
    return {
      materialName: "실크 벽지 (표준)",
      unit: "m²",
      unitPriceWon: 12000,
      quantity: 30,
    };
  return {
    materialName: "도배 (표준)",
    unit: "m²",
    unitPriceWon: 7500,
    quantity: 12,
  };
}

function extraSurfaceLine(
  hint: MaterialHint,
  _targetName: string,
): { surface: string; materialName: string; unit: string; quantity: number; unitPriceWon: number } | null {
  switch (hint.surfaceType) {
    case "counter":
      return {
        surface: "fixture",
        materialName: "싱크대 (표준)",
        unit: "set",
        quantity: 1,
        unitPriceWon: 8_900_000,
      };
    case "built_in_furniture":
      return {
        surface: "fixture",
        materialName: "붙박이장 (표준)",
        unit: "set",
        quantity: 1,
        unitPriceWon: 1_800_000,
      };
    case "lighting":
      return {
        surface: "조명",
        materialName: "조명 (표준)",
        unit: "set",
        quantity: 1,
        unitPriceWon: 350_000,
      };
    case "signage":
      return {
        surface: "signage",
        materialName: "외부 간판 (표준)",
        unit: "set",
        quantity: 1,
        unitPriceWon: 1_500_000,
      };
    case "partition":
      return {
        surface: "partition",
        materialName: "유리 파티션 (표준)",
        unit: "m",
        quantity: 4,
        unitPriceWon: 250_000,
      };
    case "door":
      return {
        surface: "도어",
        materialName: "방문 (표준)",
        unit: "EA",
        quantity: 1,
        unitPriceWon: 180_000,
      };
    case "window":
      return {
        surface: "창호",
        materialName: "창호 (표준)",
        unit: "EA",
        quantity: 1,
        unitPriceWon: 280_000,
      };
    default:
      return null;
  }
}

function groupHintsBySurface(
  hints: MaterialHint[],
): Record<string, MaterialHint | undefined> {
  const out: Record<string, MaterialHint> = {};
  for (const h of hints) {
    // 같은 surface 중 confidence 가장 높은 것
    const cur = out[h.surfaceType];
    if (!cur || h.confidence > cur.confidence) {
      out[h.surfaceType] = h;
    }
  }
  return out;
}

function hintSourceToLineSource(s: MaterialHint["source"]): EstimateLineSource {
  switch (s) {
    case "user_selected":
      return "user_selected_material";
    case "vision_analysis":
      // confidence로 confirmed/recommended 구분은 호출처에서 처리.
      // 여기선 일단 recommended로 매핑.
      return "vision_recommended_material";
    case "prompt_extract":
      return "prompt_extracted_material";
    case "scope_default":
      return "scope_default_material";
    default:
      return "standard_fallback_material";
  }
}

function mapLevelToQuotationType(
  lvl: EstimateLevel,
): ContextEstimateResponse["quotationType"] {
  switch (lvl) {
    case "L3_USER_CONFIRMED":
      return "user_confirmed_estimate";
    case "L2_IMAGE_ANALYZED":
      return "image_analyzed_estimate";
    case "L1_DESIGN":
      return "design_based_estimate";
    default:
      return "rough_estimate";
  }
}

function roundDim(v: number): number {
  return Math.round(v * 10) / 10;
}
