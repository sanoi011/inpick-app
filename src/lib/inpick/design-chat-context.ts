export type DesignChatProjectMode = "apartment" | "photo_only" | "commercial";

export interface DesignChatFloorplanRoom {
  name: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
}

export interface DesignChatContext {
  projectMode?: DesignChatProjectMode;
  workflowEntry?: "apartment_drawing" | "photo_residential" | "photo_commercial";
  buildingType?: "apartment" | "house" | "store" | "etc" | null;
  residentialType?: string;
  commercialBusiness?: string;
  address?: string;
  complexName?: string;
  pyeongName?: string;
  exclusiveAreaM2?: number;
  roomCount?: number;
  expansionType?: "basic" | "extended" | null;
  budgetManwon?: number;
  selectedRooms?: string[];
  activeRoom?: string;
  floorplanPyeong?: string;
  floorplanRooms?: DesignChatFloorplanRoom[];
  floorplanNotes?: string;
}

const MAX_TEXT_LENGTH = 240;
const MAX_NOTES_LENGTH = 1_000;
const MAX_ROOMS = 24;

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function cleanPositiveNumber(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(value, max);
}

export function sanitizeDesignChatContext(value: unknown): DesignChatContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;

  const projectMode =
    source.projectMode === "apartment" ||
    source.projectMode === "photo_only" ||
    source.projectMode === "commercial"
      ? source.projectMode
      : undefined;
  const workflowEntry =
    source.workflowEntry === "apartment_drawing" ||
    source.workflowEntry === "photo_residential" ||
    source.workflowEntry === "photo_commercial"
      ? source.workflowEntry
      : undefined;
  const buildingType =
    source.buildingType === "apartment" ||
    source.buildingType === "house" ||
    source.buildingType === "store" ||
    source.buildingType === "etc"
      ? source.buildingType
      : source.buildingType === null
        ? null
        : undefined;
  const expansionType =
    source.expansionType === "basic" || source.expansionType === "extended"
      ? source.expansionType
      : source.expansionType === null
        ? null
        : undefined;

  const selectedRooms = Array.isArray(source.selectedRooms)
    ? source.selectedRooms
        .map((room) => cleanText(room, 40))
        .filter((room): room is string => Boolean(room))
        .slice(0, MAX_ROOMS)
    : undefined;
  const floorplanRooms = Array.isArray(source.floorplanRooms)
    ? source.floorplanRooms
        .map((room): DesignChatFloorplanRoom | null => {
          if (!room || typeof room !== "object" || Array.isArray(room)) return null;
          const item = room as Record<string, unknown>;
          const name = cleanText(item.name, 60);
          if (!name) return null;
          return {
            name,
            widthMm: cleanPositiveNumber(item.widthMm, 100_000),
            depthMm: cleanPositiveNumber(item.depthMm, 100_000),
            heightMm: cleanPositiveNumber(item.heightMm, 20_000),
          };
        })
        .filter((room): room is DesignChatFloorplanRoom => Boolean(room))
        .slice(0, MAX_ROOMS)
    : undefined;

  const context: DesignChatContext = {
    projectMode,
    workflowEntry,
    buildingType,
    residentialType: cleanText(source.residentialType, 80),
    commercialBusiness: cleanText(source.commercialBusiness, 80),
    address: cleanText(source.address),
    complexName: cleanText(source.complexName),
    pyeongName: cleanText(source.pyeongName, 80),
    exclusiveAreaM2: cleanPositiveNumber(source.exclusiveAreaM2, 100_000),
    roomCount: cleanPositiveNumber(source.roomCount, 100),
    expansionType,
    budgetManwon: cleanPositiveNumber(source.budgetManwon, 10_000_000),
    selectedRooms: selectedRooms?.length ? selectedRooms : undefined,
    activeRoom: cleanText(source.activeRoom, 60),
    floorplanPyeong: cleanText(source.floorplanPyeong, 80),
    floorplanRooms: floorplanRooms?.length ? floorplanRooms : undefined,
    floorplanNotes: cleanText(source.floorplanNotes, MAX_NOTES_LENGTH),
  };

  return Object.values(context).some((item) => item !== undefined && item !== null)
    ? context
    : undefined;
}

export function resolveDesignChatSpaceType(
  context: DesignChatContext | undefined,
): "apartment" | "house" | "commercial" | "residential" | "unknown" {
  if (!context) return "unknown";
  if (context.projectMode === "commercial" || context.workflowEntry === "photo_commercial") {
    return "commercial";
  }
  if (
    context.buildingType === "apartment" ||
    context.workflowEntry === "apartment_drawing" ||
    context.residentialType === "apartment" ||
    context.residentialType === "officetel"
  ) {
    return "apartment";
  }
  if (context.buildingType === "house" || context.residentialType === "house") {
    return "house";
  }
  if (context.projectMode === "photo_only" || context.workflowEntry === "photo_residential") {
    return "residential";
  }
  return "unknown";
}

function spaceTypeKo(context: DesignChatContext | undefined): string | undefined {
  switch (resolveDesignChatSpaceType(context)) {
    case "apartment":
      return context?.residentialType === "officetel" ? "오피스텔" : "아파트";
    case "house":
      return "주택";
    case "commercial":
      return context?.commercialBusiness ? `상업 공간(${context.commercialBusiness})` : "상업 공간";
    case "residential":
      return context?.residentialType || "주거 공간";
    default:
      return undefined;
  }
}

export function buildInitialDesignChatMessage(rawContext: DesignChatContext | undefined): string {
  const context = sanitizeDesignChatContext(rawContext);
  const known: string[] = [];
  const type = spaceTypeKo(context);
  if (type) known.push(type);
  if (context?.exclusiveAreaM2) known.push(`전용 ${context.exclusiveAreaM2}㎡`);
  if (context?.expansionType) {
    known.push(context.expansionType === "extended" ? "발코니 확장형" : "발코니 기본형");
  }

  const roomText = context?.selectedRooms?.length
    ? ` 선택하신 공간은 ${context.selectedRooms.join(", ")}입니다.`
    : "";
  if (known.length > 0) {
    return `Step 1에서 입력한 ${known.join(" · ")} 정보를 기준으로 디자인할게요.${roomText}\n원하시는 스타일·색감과 꼭 반영할 요구사항을 말씀해 주세요.`;
  }
  return "어떤 공간을 어떻게 꾸미고 싶으신가요? 원하시는 스타일·색감과 요구사항을 말씀해 주세요.";
}

export function buildDesignChatSystemContext(rawContext: unknown): string {
  const context = sanitizeDesignChatContext(rawContext);
  if (!context) return "";

  return `

<step1_context>
아래 JSON은 사용자가 Step 1에서 직접 선택했거나 도면 분석으로 확정된 구조화 정보입니다.
${JSON.stringify(context, null, 2)}
</step1_context>

Step 1 정보 사용 규칙:
- 위 정보는 이미 수집된 사실이므로 값이 있는 항목을 다시 질문하지 마라.
- buildingType/workflowEntry/residentialType 중 하나로 공간 유형이 확인되면 아파트인지 주택인지 다시 묻지 마라.
- exclusiveAreaM2는 집 전체 전용면적이다. 특정 실의 면적으로 오해하지 마라.
- selectedRooms와 activeRoom이 있으면 어떤 공간을 꾸밀지 다시 묻지 말고 해당 공간 기준으로 답하라.
- floorplanRooms의 실명·치수와 floorplanNotes는 구조 보존 및 공간별 제안에 사용하라.
- 이전 assistant가 이미 확정된 정보를 잘못 다시 물었더라도 그 질문을 반복하지 말고, 아직 없는 스타일·톤·특별 요구사항만 질문하라.
- 사용자가 이후 메시지에서 명시적으로 정보를 바꾸면 최신 사용자 발언을 우선한다.
- 정확한 도로명 주소는 상담 맥락 확인에만 사용하고 이미지 생성 프롬프트에는 포함하지 마라.`;
}

export function buildImagePromptContextSuffix(rawContext: unknown): string {
  const context = sanitizeDesignChatContext(rawContext);
  if (!context) return "";

  const clauses: string[] = [];
  switch (resolveDesignChatSpaceType(context)) {
    case "apartment":
      clauses.push("Korean apartment residence");
      break;
    case "house":
      clauses.push("Korean detached or multi-family house");
      break;
    case "commercial":
      clauses.push(
        context.commercialBusiness
          ? `Korean commercial ${context.commercialBusiness} space`
          : "Korean commercial interior",
      );
      break;
    case "residential":
      clauses.push("Korean residential interior");
      break;
  }
  if (context.exclusiveAreaM2) {
    clauses.push(`the full property has ${context.exclusiveAreaM2} square meters of exclusive area`);
  }
  if (context.expansionType === "extended") clauses.push("extended balcony layout");
  if (context.expansionType === "basic") clauses.push("original non-extended balcony layout");
  if (context.activeRoom && context.activeRoom !== "전체") {
    clauses.push(`target room: ${context.activeRoom}`);
  }
  if (context.floorplanRooms?.length) {
    clauses.push("strictly follow the supplied floor plan room geometry and openings");
  }

  return clauses.length ? `Step 1 spatial facts: ${clauses.join(", ")}.` : "";
}
