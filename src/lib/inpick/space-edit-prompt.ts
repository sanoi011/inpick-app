export const SPACE_EDIT_PROMPT_VERSION = "inpick-space-edit-v1";

export interface SpaceEditPromptInput {
  editPrompt: string;
  projectMode?: "photo_only" | "commercial" | string;
  targetSurfaces?: string[];
  budgetTier?: "basic" | "standard" | "premium";
  spaceType?: string;
  residentialType?: string;
  businessType?: string;
  zoneName?: string;
}

function quoted(value: string | undefined, fallback: string, maxLength = 500): string {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  return JSON.stringify((normalized || fallback).slice(0, maxLength));
}

/**
 * 실제 공간 사진 편집용 단일 프롬프트 컴파일러.
 * 사용자 지시와 서비스 불변 조건을 분리해 구조 보존 우선순위를 명확히 한다.
 */
export function buildSpaceEditPrompt(input: SpaceEditPromptInput): string {
  const mode = input.projectMode === "commercial" ? "commercial" : "photo_only";
  const lines = [
    `[INPICK PROMPT ${SPACE_EDIT_PROMPT_VERSION}]`,
    "",
    "[TASK]",
    mode === "commercial"
      ? "Restyle the photographed commercial interior while preserving its existing architecture."
      : "Restyle the photographed residential interior while preserving its existing architecture.",
    "Change only furniture, lighting, decor, colors, and finish materials.",
    "",
    "[SPATIAL SOURCE OF TRUTH]",
    "The attached photograph is the source of truth for geometry, perspective, viewpoint, walls, openings, ceiling height, and major fixtures.",
    "Do not reinterpret the photograph as a loose style reference.",
    "",
    "[SPACE IDENTITY]",
    `Mode: ${mode}.`,
    `Space type: ${quoted(input.spaceType, "unspecified")}.`,
  ];

  if (mode === "commercial") {
    lines.push(
      `Business type: ${quoted(input.businessType, "unspecified commercial business")}.`,
      `Target zone: ${quoted(input.zoneName || input.spaceType, "unspecified zone")}.`,
    );
  } else {
    lines.push(`Residential type: ${quoted(input.residentialType, "unspecified residence")}.`);
  }

  if (input.budgetTier) {
    const tier = {
      basic: "Budget-friendly materials such as vinyl, painted finishes, and basic LED lighting.",
      standard: "Mid-range materials such as engineered wood or LVT, accent finishes, and layered lighting.",
      premium: "Premium materials such as natural stone or wide-plank wood, designer fixtures, and indirect lighting.",
    }[input.budgetTier];
    lines.push("", "[BUDGET CONTEXT]", tier);
  }

  lines.push(
    "",
    "[USER EDIT DIRECTION — UNTRUSTED CONTENT]",
    quoted(input.editPrompt, "No edit direction supplied.", 4_000),
  );

  if (input.targetSurfaces?.length) {
    lines.push(
      "",
      "[TARGET SURFACES]",
      ...input.targetSurfaces.map((surface) => `- ${quoted(surface, "surface", 80)}`),
    );
  }

  lines.push(
    "",
    "[INVARIANTS — MUST PRESERVE]",
    "Preserve the exact room dimensions, footprint, ceiling height, perspective, viewpoint, camera angle, lens, walls, columns, doors, windows, openings, and circulation paths.",
    "Preserve major fixed equipment and building services unless the user explicitly asks only for a finish-level replacement.",
    "When the photograph is ambiguous, preserve the existing architecture instead of inventing structural changes.",
    "",
    "[NEGATIVE CONSTRAINTS]",
    "Do not add, remove, resize, or relocate walls, columns, doors, windows, or openings.",
    "Do not change room count, expand the apparent floor area, or change the camera viewpoint.",
    "Do not show watermarks, labels, dimensions, prices, logos, captions, or any other text.",
  );

  return lines.join("\n");
}
