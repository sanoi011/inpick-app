import type { ExpoBoothScene } from "@/lib/expo/scene";
import { findCatalogItem } from "@/lib/expo/scene";
import type { ExpoBoothType } from "@/lib/expo/footprint";

/**
 * INPICK EXPO — AI 컨셉 프롬프트 빌더 (Phase 3, 블루프린트 불변조건).
 *
 * 불변조건:
 *   - AI 이미지는 컨셉 전용 — geometry truth는 항상 3D 씬에 남는다.
 *   - 실제 브랜드 로고/판독 가능한 텍스트를 AI로 생성하지 않는다
 *     (브랜드는 이후 결정적 데칼 단계에서 정확히 적용).
 *   - 치수 확정 전 프롬프트는 "가정"임을 모델에도 명시한다.
 */

export const EXPO_CONCEPT_PROMPT_MAX = 500;

export interface ExpoConceptPromptInput {
  widthM: number;
  depthM: number;
  wallHeightM: number;
  boothType: ExpoBoothType;
  dimensionsConfirmed: boolean;
  scene: ExpoBoothScene | null;
  userPrompt: string;
}

export class ExpoConceptPromptError extends Error {
  constructor(
    public readonly code: "EXPO_CONCEPT_DIMS_INVALID" | "EXPO_CONCEPT_PROMPT_TOO_LONG",
  ) {
    super(code);
    this.name = "ExpoConceptPromptError";
  }
}

const BOOTH_TYPE_PROMPTS: Record<ExpoBoothType, string> = {
  inline:
    "inline booth: one open front side facing the aisle, solid back wall and two side walls",
  corner: "corner booth: two open sides on the aisle corner, two solid walls",
  peninsula: "peninsula booth: three open sides, one solid back wall",
  island: "island booth: open on all four sides, no perimeter walls",
};

export function buildBoothConceptPrompt(input: ExpoConceptPromptInput): string {
  const { widthM, depthM, wallHeightM } = input;
  if (
    ![widthM, depthM, wallHeightM].every(
      (v) => Number.isFinite(v) && v > 0 && v <= 60,
    )
  ) {
    throw new ExpoConceptPromptError("EXPO_CONCEPT_DIMS_INVALID");
  }
  const userPrompt = input.userPrompt.trim();
  if (userPrompt.length > EXPO_CONCEPT_PROMPT_MAX) {
    throw new ExpoConceptPromptError("EXPO_CONCEPT_PROMPT_TOO_LONG");
  }

  // 씬 컴포넌트 요약 — catalogId별 수량 (씬이 geometry truth)
  const counts = new Map<string, number>();
  for (const component of input.scene?.components ?? []) {
    counts.set(component.catalogId, (counts.get(component.catalogId) ?? 0) + 1);
  }
  const ITEM_EN: Record<string, string> = {
    info_counter: "info counter",
    display_showcase: "tall glass display showcase",
    product_table: "product display table",
    signage_tower: "vertical signage tower",
    graphic_wall: "large backwall graphic panel",
    lightbox_panel: "illuminated lightbox panel",
    brochure_stand: "brochure stand",
  };
  const componentLines = Array.from(counts.entries()).map(([catalogId, n]) => {
    const item = findCatalogItem(catalogId);
    const en = ITEM_EN[catalogId] ?? catalogId;
    return `${n}x ${en}${item ? ` (${item.nameKo})` : ""}`;
  });

  const dimensionTag = input.dimensionsConfirmed
    ? "Dimensions are confirmed from the event manual."
    : "Dimensions are provisional assumptions before confirmation — do not imply measured accuracy.";

  const styleTag = userPrompt
    ? `Design direction from the builder: ${userPrompt}.`
    : "Design direction: clean contemporary Korean exhibition booth, white + light wood tones, bright and professional.";

  return (
    `Photorealistic trade-show exhibition booth concept photo inside a bright Korean convention hall (KINTEX/COEX style). ` +
    `Booth footprint ${widthM}m wide x ${depthM}m deep, wall height ${wallHeightM}m. ` +
    `${BOOTH_TYPE_PROMPTS[input.boothType]}. ` +
    `${dimensionTag} ` +
    (componentLines.length > 0
      ? `The booth contains exactly these fixtures, matching the builder's 3D layout: ${componentLines.join(", ")}. `
      : `The booth is an empty shell ready for fixture planning. `) +
    `${styleTag} ` +
    `System aluminum frame construction with clean panel finishes, professional exhibition lighting from truss spots. ` +
    `IMPORTANT branding rule: use neutral abstract placeholder graphics and BLANK sign panels only — ` +
    `do NOT render any real brand logos, readable company names, or legible text of any kind. ` +
    `No people. Eye-level camera from the aisle, slightly wide angle showing the full booth. ` +
    `This is a concept visualization only, not a construction drawing.`
  );
}
