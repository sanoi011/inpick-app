/**
 * computeEstimateReadiness — projectMode별 최소 조건과 estimate level 계산.
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §7
 *
 * canBuildEstimate는 "전체 이미지 유무 / visionAnalysisByRoom 유무"로 절대 판단하지 않는다.
 */
import type {
  DesignOutput,
  EstimateLevel,
  EstimateReadiness,
  ProjectMode,
} from "./types";

interface ComputeInput {
  projectMode: ProjectMode;
  step1Snapshot: Record<string, unknown> | null | undefined;
  scopeSnapshot: Record<string, unknown> | null | undefined;
  designOutputs: DesignOutput[];
  materialEvidence: unknown[];
  userMaterialEdits: unknown[];
}

export function computeEstimateReadiness(input: ComputeInput): EstimateReadiness {
  const missingBlockingFields: string[] = [];
  const missingOptionalFields: string[] = [];
  const warnings: string[] = [];

  const hasAnyDesignOutput = input.designOutputs.length > 0;
  const hasAnalyzedMaterial = input.materialEvidence.length > 0;
  const hasUserConfirmedMaterial = input.userMaterialEdits.length > 0;

  if (input.projectMode === "apartment") {
    const step1Rooms = Array.isArray(input.step1Snapshot?.rooms)
      ? (input.step1Snapshot?.rooms as unknown[])
      : [];
    const normalizedRooms = (input.step1Snapshot as { normalizedFloorplan?: { rooms?: unknown[] } })
      ?.normalizedFloorplan?.rooms;
    const scopeRooms = Array.isArray((input.scopeSnapshot as { rooms?: unknown[] })?.rooms)
      ? ((input.scopeSnapshot as { rooms?: unknown[] }).rooms as unknown[])
      : [];
    const hasRoomDims =
      step1Rooms.length > 0 || (normalizedRooms?.length ?? 0) > 0 || scopeRooms.length > 0;
    if (!hasRoomDims) {
      // P0에서 API가 평수 폴백 → blocking 아님. optional로 강등.
      missingOptionalFields.push("방/면적/치수 정보");
      warnings.push(
        "방/치수 정보가 없어 평수 기반 표준 방 셋으로 가견적을 산출합니다.",
      );
    }
  }

  if (input.projectMode === "photo_only") {
    const areaM2 =
      Number((input.scopeSnapshot as { areaM2?: number })?.areaM2 ?? 0) ||
      Number((input.step1Snapshot as { areaM2?: number })?.areaM2 ?? 0);
    if (!areaM2 || areaM2 <= 0) {
      missingOptionalFields.push("면적 또는 평수");
      warnings.push("면적 정보가 없어 기본 24평 가견적을 산출합니다.");
    }
  }

  if (input.projectMode === "commercial") {
    const scope = input.scopeSnapshot as
      | { businessType?: string; totalAreaM2?: number; zones?: unknown[] }
      | null
      | undefined;
    if (!scope?.businessType) missingOptionalFields.push("업종");
    const totalAreaM2 = Number(scope?.totalAreaM2 ?? 0);
    if (!totalAreaM2 || totalAreaM2 <= 0) missingOptionalFields.push("전체 면적");
    const zones = Array.isArray(scope?.zones) ? scope!.zones : [];
    if (zones.length === 0) {
      missingOptionalFields.push("zone 구성");
      warnings.push("zone 정보가 없어 업종 기본 zone 셋으로 가견적을 산출합니다.");
    }
  }

  let estimateLevel: EstimateLevel = "L0_BASIC";
  if (hasAnyDesignOutput) estimateLevel = "L1_DESIGN";
  if (hasAnalyzedMaterial) estimateLevel = "L2_IMAGE_ANALYZED";
  if (hasUserConfirmedMaterial) estimateLevel = "L3_USER_CONFIRMED";

  if (!hasAnyDesignOutput) {
    missingOptionalFields.push("생성 이미지");
    warnings.push("생성 이미지가 없어 기본 가견적으로 산출합니다.");
  }

  if (!hasAnalyzedMaterial) {
    missingOptionalFields.push("자재 정밀 분석");
    warnings.push(
      "자재 정밀 분석 전이므로 일부 항목은 디자인 설명 또는 표준 기본값으로 산출합니다.",
    );
  }

  // P1: blocking 필드는 사실상 거의 없음 (API가 폴백 처리). UI에서만 안내.
  const canBuildEstimate = missingBlockingFields.length === 0;
  const scoreBase = canBuildEstimate ? 0.6 : 0.2;
  const score = Math.min(
    1,
    scoreBase +
      (hasAnyDesignOutput ? 0.15 : 0) +
      (hasAnalyzedMaterial ? 0.15 : 0) +
      (hasUserConfirmedMaterial ? 0.1 : 0),
  );

  return {
    canBuildEstimate,
    estimateLevel,
    score,
    missingBlockingFields,
    missingOptionalFields,
    warnings,
  };
}
