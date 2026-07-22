export interface PhotoRenderPromptInput {
  projectMode?: "photo_only" | "commercial" | string;
  stylePrompt: string;
  negativePrompt?: string;
  areaM2?: number;
  pyung?: number;
  spaceType?: string;
  residentialType?: string;
  businessType?: string;
  zoneName?: string;
  budgetTier?: "basic" | "standard" | "premium";
  furnishingOptions?: string[];
}

export const PHOTO_RENDER_PROMPT_VERSION = "inpick-photo-render-v1";

const FURNISHING_LABELS: Record<string, string> = {
  sinkUpper: "상부장 (upper cabinets)",
  sinkLower: "하부장 (lower cabinets)",
  sinkFull: "상·하부장 일체형 싱크대 (full kitchen cabinetry)",
  fridgeCabinet: "냉장고장 (refrigerator cabinet)",
  kimchiCabinet: "김치냉장고장 (kimchi refrigerator cabinet)",
  builtIn: "붙박이장 (built-in cabinet)",
  systemCloset: "시스템장 (system closet)",
};

export function formatPhotoFurnishingRequirements(options?: string[]): string[] {
  return (options || []).map((option) => FURNISHING_LABELS[option]).filter(Boolean);
}

const RESIDENTIAL_TYPE_PROMPTS: Record<string, string> = {
  studio: "compact Korean one-room studio with one continuous living/sleeping zone",
  one_bed: "compact Korean two-room home with one separate bedroom",
  two_bed: "compact Korean three-room home with two separate bedrooms",
  apartment: "Korean apartment dwelling",
  house: "Korean detached house",
  officetel: "compact Korean officetel with realistic mixed living and sleeping scale",
  other_residential: "Korean residential dwelling",
};

export function buildPhotoRenderPrompt(b: PhotoRenderPromptInput): string {
  const lines: string[] = [
    `[INPICK PROMPT ${PHOTO_RENDER_PROMPT_VERSION}]`,
    "",
    "Photorealistic Korean interior concept image, 8K, magazine quality.",
  ];

  if (b.projectMode === "commercial" && b.businessType) {
    lines.push(`Business type: ${b.businessType}.`);
    if (b.zoneName) lines.push(`Target zone: ${b.zoneName}.`);
  } else if (b.residentialType) {
    const residentialDescription =
      RESIDENTIAL_TYPE_PROMPTS[b.residentialType] || b.residentialType;
    lines.push(`Residential typology: ${residentialDescription}.`);
    lines.push(
      `Do not convert this ${b.residentialType} into a larger apartment or add rooms that are not requested.`,
    );
  }
  if (b.spaceType) lines.push(`Space type: ${b.spaceType}.`);

  const area = b.areaM2 ?? (b.pyung ? Math.round(b.pyung * 3.305785) : undefined);
  if (area) lines.push(`Total floor area: ${area} m² (${(area / 3.305785).toFixed(1)} pyung).`);

  if (b.budgetTier) {
    const tierWords = {
      basic: "Budget-friendly finishes (vinyl flooring, painted walls, basic lighting).",
      standard: "Mid-range finishes (engineered wood, accent wall, layered lighting).",
      premium: "Premium finishes (natural stone or wide-plank wood, designer fixtures, indirect lighting).",
    }[b.budgetTier];
    lines.push(tierWords);
  }

  lines.push("", "STYLE DIRECTION:", b.stylePrompt);
  const furnishingLabels = formatPhotoFurnishingRequirements(b.furnishingOptions);
  if (furnishingLabels.length > 0) {
    lines.push(
      "",
      "REQUIRED BUILT-IN PARTS (must remain distinct and visible):",
      ...furnishingLabels.map((label) => `- ${label}`),
    );
  }
  if (b.negativePrompt) lines.push("", `AVOID: ${b.negativePrompt}`);
  lines.push(
    "",
    "COMPOSITION:",
    "- Preserve the requested residential typology, room count, and realistic floor-area scale.",
    "- Realistic perspective, eye-level camera, soft natural lighting mixed with warm interior light.",
    "- Show actual usable furniture and accessories suitable for Korean interior context.",
    "- No watermarks, no text overlays, no logos.",
  );

  return lines.join("\n");
}
