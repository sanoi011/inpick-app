import type { SurfaceType } from "@/lib/inpick/editable-render/types";

export interface PromptRoomTab {
  key: string;
  label: string;
}

export interface PromptRoomRoute {
  roomKey: string;
  roomLabel: string;
  mentionedRoom: boolean;
  targetSurfaces: SurfaceType[];
  shouldEditExistingImage: boolean;
}

const ROOM_ALIASES: Record<string, string[]> = {
  living: ["거실", "리빙룸", "living room", "living"],
  master: ["안방", "마스터룸", "master bedroom", "master"],
  bedroom: ["침실", "작은방", "아이방", "자녀방", "bedroom"],
  kitchen: ["주방", "부엌", "키친", "kitchen"],
  bath: ["욕실", "화장실", "배스룸", "bathroom", "bath"],
  entrance: ["현관", "입구", "entrance"],
  balcony: ["베란다", "발코니", "balcony"],
  dress: ["드레스룸", "옷방", "dress room"],
};

const EDIT_VERB =
  /(바꿔|바꾸|변경|수정|교체|없애|제거|추가|설치|달아|적용|칠해|꾸며|고쳐|보여\s*줘|replace|change|edit|remove|add)/i;
const GENERATION_REQUEST =
  /(?:이미지|디자인|시안|렌더(?:링)?)\s*(?:을|를)?\s*(?:생성|만들|뽑|그려|제작)|(?:생성|만들|뽑|그려|제작)\s*(?:해|해줘|해주세요|해\s*주세요|하자|진행)/i;
const GENERATION_QUESTION =
  /(?:이미지|디자인|시안|렌더(?:링)?)\s*(?:을|를)?\s*(?:생성|만들|뽑|그려|제작).{0,12}(?:할까요|하시겠습니까|해드릴까요|진행할까요)/i;
const AFFIRMATIVE =
  /^(?:네|넵|예|응|어|그래|좋아|좋습니다|해줘|해주세요|진행해|진행해주세요|만들어줘|생성해줘|그렇게\s*해줘)[.!?\s]*$/i;

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[·_,./()[\]{}:;!?"']/g, " ").replace(/\s+/g, " ").trim();
}

export function isDesignGenerationRequest(
  prompt: string,
  previousAssistantMessage = "",
): boolean {
  const normalizedPrompt = normalize(prompt);
  if (!normalizedPrompt) return false;
  if (GENERATION_REQUEST.test(normalizedPrompt)) return true;
  return (
    AFFIRMATIVE.test(normalizedPrompt) &&
    GENERATION_QUESTION.test(normalize(previousAssistantMessage))
  );
}

function aliasesFor(tab: PromptRoomTab): string[] {
  const labelParts = normalize(tab.label)
    .split(/\s*\/\s*|\s+/)
    .filter((part) => part.length >= 2);
  return Array.from(
    new Set([tab.label, tab.key, ...(ROOM_ALIASES[tab.key] || []), ...labelParts].map(normalize)),
  ).filter(Boolean);
}

export function detectTargetSurfaces(prompt: string): SurfaceType[] {
  const normalized = normalize(prompt);
  const surfaces: SurfaceType[] = [];
  const add = (surface: SurfaceType) => {
    if (!surfaces.includes(surface)) surfaces.push(surface);
  };

  if (/바닥|마루|장판|floor|flooring/.test(normalized)) add("floor");
  if (/벽지|벽면|벽\s|페인트|wall/.test(normalized)) add("wall");
  if (/천장|ceiling/.test(normalized)) add("ceiling");
  if (/창문|창호|샷시|새시|window/.test(normalized)) add("window");
  if (/현관문|방문|도어|문짝|문\s|문은|문을|문만|문색|door/.test(normalized.replace(/창문/g, "창"))) add("door");
  if (/수납장|붙박이장|싱크대|캐비닛|cabinet/.test(normalized)) add("cabinet");
  if (/카운터|상판|countertop|counter/.test(normalized)) add("counter");
  if (/가구|소파|침대|테이블|의자|furniture|sofa|bed\s|table/.test(normalized)) add("furniture");

  return surfaces;
}

export function routePromptToRoom(
  prompt: string,
  tabs: PromptRoomTab[],
  activeRoomKey: string,
  roomsWithImages: ReadonlySet<string>,
): PromptRoomRoute {
  const usableTabs = tabs.filter((tab) => tab.key !== "all");
  const normalizedPrompt = normalize(prompt);
  let matched: { tab: PromptRoomTab; aliasLength: number } | null = null;

  for (const tab of usableTabs) {
    for (const alias of aliasesFor(tab)) {
      if (!alias || !normalizedPrompt.includes(alias)) continue;
      if (!matched || alias.length > matched.aliasLength) {
        matched = { tab, aliasLength: alias.length };
      }
    }
  }

  const activeTab = usableTabs.find((tab) => tab.key === activeRoomKey);
  const fallbackTab = activeTab || usableTabs[0] || { key: activeRoomKey || "living", label: "현재 공간" };
  const targetTab = matched?.tab || fallbackTab;

  return {
    roomKey: targetTab.key,
    roomLabel: targetTab.label,
    mentionedRoom: !!matched,
    targetSurfaces: detectTargetSurfaces(prompt),
    shouldEditExistingImage: roomsWithImages.has(targetTab.key) && EDIT_VERB.test(prompt),
  };
}
