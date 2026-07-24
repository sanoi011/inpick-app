import type { FinalSelectedDesign } from "./final-selection";

interface WorkflowRenderEvidence {
  url?: string;
  refinedUrl?: string;
  prompt?: string;
  revisedPrompt?: string;
}

interface WorkflowMaterialSelection {
  roomId: string;
  roomName: string;
  surfaceType: string;
  materialCategory: string;
  materialProductId?: string;
  materialNameKo?: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  observationId?: string;
  confidence?: number;
  assemblyId?: string;
  partCode?: string;
}

export interface WorkflowEstimateEvidenceInput {
  selectedByRoom?: Record<string, number | null>;
  rendersByRoom?: Record<string, WorkflowRenderEvidence[]>;
  finalSelectedImageUrlsByRoom?: Record<string, string>;
  conceptPrompt?: string;
  promptByRoom?: Record<string, string>;
  materialSelections?: Record<string, WorkflowMaterialSelection>;
}

export interface WorkflowEstimateEvidence {
  selectedDesigns: FinalSelectedDesign[];
  userMaterialEdits: Array<WorkflowMaterialSelection & { id: string }>;
  selectedImageUrls: string[];
}

function compactPrompt(parts: Array<string | undefined>): string | undefined {
  const unique = Array.from(
    new Set(parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part))),
  );
  return unique.length > 0 ? unique.join("\n\n") : undefined;
}

function normalizeSelectedSurface(selection: WorkflowMaterialSelection): string {
  if (selection.surfaceType !== "unknown") return selection.surfaceType;
  if (!selection.materialCategory.startsWith("room-product.")) return "wall";
  return selection.partCode === "main_lighting" ? "lighting" : "fixture";
}

/**
 * Step2의 최종 선택만 견적 evidence로 직렬화한다.
 * 선택하지 않은 과거 시안의 Vision 결과나 프롬프트가 현재 견적에 섞이지 않게 하는
 * 클라이언트/서버 경계용 순수 함수다.
 */
export function buildWorkflowEstimateEvidence(
  step2: WorkflowEstimateEvidenceInput,
  roomNameFor: (roomId: string) => string = (roomId) => roomId,
): WorkflowEstimateEvidence {
  const finalUrls = step2.finalSelectedImageUrlsByRoom || {};
  const finalRoomIds = Object.keys(finalUrls).filter((roomId) => Boolean(finalUrls[roomId]));
  const roomIds =
    finalRoomIds.length > 0
      ? finalRoomIds
      : Object.entries(step2.selectedByRoom || {})
          .filter(([, selectedIndex]) => selectedIndex != null)
          .map(([roomId]) => roomId);

  const selectedDesigns = roomIds.flatMap((roomId) => {
    const renders = step2.rendersByRoom?.[roomId] || [];
    const finalImageUrl = finalUrls[roomId];
    const selectedIndex = step2.selectedByRoom?.[roomId];
    const finalMatchedRender = finalImageUrl
      ? renders.find(
          (render) => render.refinedUrl === finalImageUrl || render.url === finalImageUrl,
        )
      : undefined;
    const selectedRender =
      finalMatchedRender ||
      (selectedIndex != null ? renders[selectedIndex] : undefined);
    const imageUrl =
      (finalMatchedRender ? finalImageUrl : undefined) ||
      selectedRender?.refinedUrl ||
      selectedRender?.url ||
      finalImageUrl;
    if (!imageUrl) return [];

    const roomPrompt = step2.promptByRoom?.[roomId];
    const globalPrompt = step2.promptByRoom?.__global__;
    const prompt = compactPrompt([
      selectedRender?.revisedPrompt,
      selectedRender?.prompt,
      roomPrompt,
      step2.conceptPrompt,
      globalPrompt,
    ]);
    return [{
      targetId: roomId,
      targetName: roomNameFor(roomId),
      imageUrl,
      sourceImageUrl:
        selectedRender?.url && selectedRender.url !== imageUrl
          ? selectedRender.url
          : undefined,
      prompt,
    }];
  });

  const selectedRoomIds = new Set(selectedDesigns.map((design) => design.targetId));
  const userMaterialEdits = Object.entries(step2.materialSelections || {}).flatMap(
    ([id, selection]) => {
      if (!selection?.roomId || !selection.materialProductId) return [];
      if (selectedRoomIds.size > 0 && !selectedRoomIds.has(selection.roomId)) return [];
      return [{
        id,
        ...selection,
        surfaceType: normalizeSelectedSurface(selection),
      }];
    },
  );

  return {
    selectedDesigns,
    userMaterialEdits,
    selectedImageUrls: selectedDesigns.map((design) => design.imageUrl),
  };
}
