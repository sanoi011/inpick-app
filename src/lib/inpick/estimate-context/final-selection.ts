import type { DesignOutput, ProjectMode } from "./types";

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
        [selection.imageUrl, selection.sourceImageUrl].filter(Boolean).includes(output.imageUrl),
    ) || sorted.find((output) => output.targetId === selection.targetId);

    if (matched) {
      return {
        ...matched,
        imageUrl: selection.imageUrl,
        prompt: selection.prompt || matched.prompt,
      };
    }

    const now = new Date().toISOString();
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
      prompt: selection.prompt,
      materialHints: [],
      status: "generated",
      createdAt: now,
      updatedAt: now,
    };
  });
}
