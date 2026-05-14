/**
 * GenerationBase + WorkflowState + Image Route Resolver.
 * 가이드: inpick-ultra-precision-estimate-engine-v3-dev-plan-20260513.md §4
 *
 * project-mode.ts의 저수준 `routeGenerationPlan(generationType)` 위에 얹는 고수준 resolver.
 * Step2의 사용자 입력 + Step1 결과를 종합한 WorkflowState 기반으로 endpoint/payload를 결정.
 */
import type { ConsumerProject } from "@/types/consumer-project";
import type {
  ProjectMode,
  GenerationType,
  CommercialProgramSpec,
} from "./project-mode";
import { routeGenerationPlan, defaultGenerationTypeForMode } from "./project-mode";

/**
 * 이미지 생성의 근거 — 견적 산출 단계에서 어떤 base가 사용됐는지 추적.
 */
export interface GenerationBase {
  generationType: GenerationType;
  projectMode: ProjectMode;
  endpoint: string | null;
  /** 도면 ID (apartment 모드) */
  floorPlanId?: string;
  /** 사진 개수 (photo/commercial 모드) */
  photoCount?: number;
  /** 사용자 prompt 요약 */
  stylePromptSummary?: string;
  /** 이 base로 추론 가능한 공간들 */
  inferredSpaces?: Array<{
    roomType: string;
    areaM2?: number;
    source: "floorplan" | "photo_inferred" | "user_input" | "commercial_zone";
  }>;
  generatedAt: string;
}

export interface WorkflowState {
  projectMode: ProjectMode;
  hasFloorPlan: boolean;
  floorPlanId?: string | null;
  floorPlanImageUrl?: string | null;
  inferredRooms?: Array<{ roomType: string; areaM2?: number }>;
  photoCount: number;
  photoLabels?: string[];
  prompt?: string;
  commercialSpec?: CommercialProgramSpec | null;
}

export interface ImageRouteDecision {
  generationType: GenerationType;
  endpoint: string | null;
  payload: Record<string, unknown>;
  statusMessageKo: string;
  missingInputs?: string[];
  baseDraft: Omit<GenerationBase, "generatedAt">;
}

/**
 * ConsumerProject → WorkflowState.
 */
export function buildWorkflowState(project: ConsumerProject | null): WorkflowState {
  if (!project) {
    return { projectMode: "residential", hasFloorPlan: false, photoCount: 0 };
  }
  const anyProject = project as unknown as Record<string, unknown>;
  const projectMode = (anyProject.projectMode as ProjectMode | undefined) ?? "residential";
  const floorPlan = anyProject.floorPlan as { id?: string; rooms?: Array<{ type?: string; areaM2?: number }> } | null | undefined;
  const photos = (anyProject.photos as Array<{ label?: string }> | undefined) ?? [];
  return {
    projectMode,
    hasFloorPlan: !!floorPlan,
    floorPlanId: floorPlan?.id,
    floorPlanImageUrl: (anyProject.floorPlanImageUrl as string | null | undefined) ?? null,
    inferredRooms:
      floorPlan?.rooms?.map((r) => ({ roomType: r.type ?? "unknown", areaM2: r.areaM2 })) ?? [],
    photoCount: photos.length,
    photoLabels: photos.map((p) => p.label ?? "").filter(Boolean),
    prompt: (anyProject.designPrompt as string | undefined) ?? undefined,
    commercialSpec: (anyProject.commercialSpec as CommercialProgramSpec | null | undefined) ?? null,
  };
}

/**
 * 핵심 — 어떤 endpoint로 가야 하는가.
 */
export function resolveImageGenerationRoute(state: WorkflowState): ImageRouteDecision {
  const generationType = inferGenerationType(state);
  const route = routeGenerationPlan(generationType);
  const summary = summarizePrompt(state.prompt);

  const missing: string[] = [];
  if (route.requiresFloorplan && !state.hasFloorPlan) {
    missing.push("도면 (Step1에서 주소→도면 생성 필요)");
  }
  if (route.requiresPropertyId && !state.floorPlanId) {
    missing.push("선택된 단지/타입 (propertyId)");
  }
  if ((generationType === "reference_style" || generationType === "own_space_remodel") && state.photoCount === 0) {
    missing.push("참고 사진 1장 이상");
  }
  if (generationType === "commercial_zone") {
    if (!state.commercialSpec) missing.push("상가 프로그램 정보 (업종/면적/시스템)");
    if (state.photoCount === 0 && !state.commercialSpec?.areaM2) {
      missing.push("상가 사진 또는 면적");
    }
  }

  const baseDraft: Omit<GenerationBase, "generatedAt"> = {
    generationType,
    projectMode: state.projectMode,
    endpoint: route.endpoint,
    floorPlanId: state.floorPlanId ?? undefined,
    photoCount: state.photoCount,
    stylePromptSummary: summary,
    inferredSpaces: collectInferredSpaces(state, generationType),
  };

  return {
    generationType,
    endpoint: missing.length === 0 ? route.endpoint : null,
    payload: buildPayload(state, generationType),
    statusMessageKo: statusMessage(generationType, missing.length > 0),
    missingInputs: missing.length > 0 ? missing : undefined,
    baseDraft,
  };
}

function inferGenerationType(state: WorkflowState): GenerationType {
  if (state.projectMode === "commercial") return "commercial_zone";
  if (state.projectMode === "photo_only") {
    // 사진 모드 — label에 "내 공간"/"현재" 같은 키워드 있으면 own_space_remodel
    const labels = (state.photoLabels ?? []).join(" ").toLowerCase();
    if (/내\s*공간|현재|기존|remodel|before/.test(labels)) {
      return "own_space_remodel";
    }
    return "reference_style";
  }
  if (state.projectMode === "residential") {
    if (state.hasFloorPlan) return "apartment_room";
    if (state.photoCount > 0) return "own_space_remodel";
  }
  return defaultGenerationTypeForMode(state.projectMode);
}

function buildPayload(state: WorkflowState, generationType: GenerationType): Record<string, unknown> {
  switch (generationType) {
    case "apartment_room":
      return {
        floorPlanId: state.floorPlanId,
        floorPlanImageUrl: state.floorPlanImageUrl,
        prompt: state.prompt ?? "",
      };
    case "reference_style":
      return { prompt: state.prompt ?? "", referencePhotoLabels: state.photoLabels ?? [] };
    case "own_space_remodel":
      return { prompt: state.prompt ?? "", currentPhotoLabels: state.photoLabels ?? [] };
    case "commercial_zone":
      return {
        prompt: state.prompt ?? "",
        commercialSpec: state.commercialSpec,
        zones: state.commercialSpec?.zones ?? [],
      };
    case "consultation_only":
      return { prompt: state.prompt ?? "" };
  }
}

function statusMessage(generationType: GenerationType, blocked: boolean): string {
  if (blocked) return "이미지 생성에 필요한 정보가 부족합니다.";
  switch (generationType) {
    case "apartment_room":
      return "도면 기반 방별 디자인 생성 중…";
    case "reference_style":
      return "참고 스타일 기반 디자인 생성 중…";
    case "own_space_remodel":
      return "내 공간 사진 기반 리모델링 시안 생성 중…";
    case "commercial_zone":
      return "상가 zone 디자인 생성 중…";
    case "consultation_only":
      return "상담 모드 — 이미지는 생성되지 않습니다.";
  }
}

function collectInferredSpaces(
  state: WorkflowState,
  generationType: GenerationType,
): NonNullable<GenerationBase["inferredSpaces"]> {
  if (generationType === "apartment_room" && state.inferredRooms) {
    return state.inferredRooms.map((r) => ({ roomType: r.roomType, areaM2: r.areaM2, source: "floorplan" as const }));
  }
  if (generationType === "commercial_zone" && state.commercialSpec) {
    return state.commercialSpec.zones.map((z) => ({
      roomType: z.type,
      areaM2: z.areaM2,
      source: "commercial_zone" as const,
    }));
  }
  if (
    (generationType === "reference_style" || generationType === "own_space_remodel") &&
    state.photoLabels &&
    state.photoLabels.length > 0
  ) {
    return state.photoLabels.map((label) => ({
      roomType: inferRoomTypeFromLabel(label),
      source: "photo_inferred" as const,
    }));
  }
  return [];
}

function summarizePrompt(prompt?: string): string | undefined {
  if (!prompt) return undefined;
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

function inferRoomTypeFromLabel(label?: string): string {
  if (!label) return "unknown";
  const l = label.toLowerCase();
  if (l.includes("거실") || l.includes("living")) return "LIVING";
  if (l.includes("주방") || l.includes("kitchen")) return "KITCHEN";
  if (l.includes("욕실") || l.includes("화장실") || l.includes("bath")) return "BATHROOM";
  if (l.includes("침실") || l.includes("안방") || l.includes("bed")) return "BEDROOM";
  if (l.includes("현관") || l.includes("entrance")) return "ENTRANCE";
  if (l.includes("발코니") || l.includes("balcony")) return "BALCONY";
  if (l.includes("드레스") || l.includes("dressing")) return "DRESSROOM";
  return "unknown";
}

/**
 * GenerationBase 완성 헬퍼 — 이미지 생성 성공 직후 generatedAt 채워서 저장.
 */
export function finalizeGenerationBase(draft: Omit<GenerationBase, "generatedAt">): GenerationBase {
  return { ...draft, generatedAt: new Date().toISOString() };
}
