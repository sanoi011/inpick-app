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
