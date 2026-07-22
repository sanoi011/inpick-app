interface PhotoRenderPrompt {
  prompt?: string;
  revisedPrompt?: string;
}

export interface PhotoEstimateRoom {
  roomName: string;
  areaM2: number;
  prompts: string[];
  roomKey: string;
  kitchenPlan?: {
    tallCabinetEa: number;
    tallCabinetLabels: string[];
  };
}

interface BuildPhotoEstimateRoomsInput {
  totalAreaM2: number;
  rendersByRoom: Record<string, PhotoRenderPrompt[]>;
  requestedRoomKeys?: string[];
}

const ROOM_ORDER = ["living", "bedroom", "master", "kitchen", "bath", "entrance", "other"];
const ROOM_NAMES: Record<string, string> = {
  living: "거실",
  bedroom: "침실",
  master: "안방",
  kitchen: "주방",
  bath: "욕실",
  entrance: "현관",
  other: "기타 공간",
};
const ROOM_AREA_WEIGHTS: Record<string, number> = {
  living: 22,
  bedroom: 9,
  master: 12,
  kitchen: 8,
  bath: 4,
  entrance: 3,
  other: 10,
};

function roomSort(a: string, b: string): number {
  const ai = ROOM_ORDER.indexOf(a);
  const bi = ROOM_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

/**
 * 사진 기반 주거 견적에서도 Step2의 실 정체성을 보존한다.
 * Vision 분석 결과가 없어도 실 타입별 표준 SurfacePlan이 만들어지도록 room 단위 입력을 반환한다.
 */
export function buildPhotoEstimateRooms({
  totalAreaM2,
  rendersByRoom,
  requestedRoomKeys = [],
}: BuildPhotoEstimateRoomsInput): PhotoEstimateRoom[] {
  const generatedKeys = Object.entries(rendersByRoom)
    .filter(([key, renders]) => key !== "all" && renders.length > 0)
    .map(([key]) => key);
  const keys = Array.from(
    new Set([...generatedKeys, ...requestedRoomKeys.filter((key) => key !== "all")]),
  ).sort(roomSort);

  const effectiveKeys = keys.length > 0 ? keys : ["other"];
  const safeTotalArea = Number.isFinite(totalAreaM2) && totalAreaM2 > 0 ? totalAreaM2 : 79.3;
  const totalWeight = effectiveKeys.reduce(
    (sum, key) => sum + (ROOM_AREA_WEIGHTS[key] ?? ROOM_AREA_WEIGHTS.other),
    0,
  );
  let allocatedArea = 0;

  return effectiveKeys.map((roomKey, index) => {
    const isLast = index === effectiveKeys.length - 1;
    const weight = ROOM_AREA_WEIGHTS[roomKey] ?? ROOM_AREA_WEIGHTS.other;
    const areaM2 = isLast
      ? Math.max(0.1, Math.round((safeTotalArea - allocatedArea) * 10) / 10)
      : Math.max(0.1, Math.round((safeTotalArea * weight / totalWeight) * 10) / 10);
    allocatedArea += areaM2;
    const prompts = (rendersByRoom[roomKey] || [])
      .map((render) => render.revisedPrompt || render.prompt || "")
      .filter(Boolean);
    const promptText = prompts.join(" ");
    const kitchenPlan = roomKey === "kitchen"
      ? (() => {
          const withoutKimchi = promptText.split("김치냉장고장").join("");
          const labels = [
            withoutKimchi.includes("냉장고장") ? "냉장고장" : null,
            promptText.includes("김치냉장고장") ? "김치냉장고장" : null,
          ].filter((label): label is string => Boolean(label));
          return labels.length > 0
            ? { tallCabinetEa: labels.length, tallCabinetLabels: labels }
            : undefined;
        })()
      : undefined;

    return {
      roomKey,
      roomName: ROOM_NAMES[roomKey] || roomKey,
      areaM2,
      prompts,
      kitchenPlan,
    };
  });
}
