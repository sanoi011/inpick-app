import type { DesignOutput, ProjectMode } from "./types";
import { extractMaterialHintsFromPrompt } from "./prompt-hints";

export interface FinalSelectedDesign {
  targetId: string;
  targetName?: string;
  imageUrl: string;
  sourceImageUrl?: string;
  prompt?: string;
}

interface SelectionContext {
  projectId: string;
  userId: string;
  projectMode: ProjectMode;
}

export function selectFinalDesignOutputs(
  outputs: DesignOutput[],
  selections: FinalSelectedDesign[],
  context: SelectionContext,
): DesignOutput[] {
  const sorted = [...outputs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return selections.map((selection, index) => {
    const matched = sorted.find(
      (output) =>
        output.targetId === selection.targetId &&
        output.imageUrl === selection.imageUrl,
    );

    if (matched) {
      const prompt = selection.prompt || matched.prompt;
      const promptHints = extractMaterialHintsFromPrompt({
        prompt,
        projectMode: context.projectMode,
        targetName: selection.targetName || matched.targetName,
      });
      const seenSurfaces = new Set(matched.materialHints.map((hint) => hint.surfaceType));
      return {
        ...matched,
        // 사용자가 최종 선택창에서 확정한 현재 실 이름을 신뢰한다.
        // 과거 DB 행에 targetName="전체"가 남아 있으면 living 결과가
        // 세부견적의 "전체" 그룹으로 빠져 거실이 사라져 보였다.
        targetName: selection.targetName || matched.targetName,
        imageUrl: selection.imageUrl,
        prompt,
        materialHints: [
          ...matched.materialHints,
          ...promptHints.filter((hint) => !seenSurfaces.has(hint.surfaceType)),
        ],
      };
    }

    const now = new Date().toISOString();
    const prompt = selection.prompt;
    return {
      id: `final-selected:${selection.targetId}:${index}`,
      projectId: context.projectId,
      userId: context.userId,
      projectMode: context.projectMode,
      targetType: context.projectMode === "commercial" ? "zone" : "room",
      targetId: selection.targetId,
      targetName: selection.targetName || selection.targetId,
      renderKind: context.projectMode === "commercial" ? "zone_render" : "room_render",
      imageUrl: selection.imageUrl,
      prompt,
      materialHints: extractMaterialHintsFromPrompt({
        prompt,
        projectMode: context.projectMode,
        targetName: selection.targetName || selection.targetId,
      }),
      status: "generated",
      createdAt: now,
      updatedAt: now,
    };
  });
}
