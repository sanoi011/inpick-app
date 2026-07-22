import type { DesignOutput, ProjectMode } from "./types";
import type { KitchenPlan } from "../estimate-v2/kitchen-plan-builder";
import type { RoomQuantityBasis } from "../estimate-v2/types";

export interface RequestedEstimateRoom {
  roomId: string;
  roomName: string;
}

export interface KitchenPlanRequirementOverride extends Partial<KitchenPlan> {
  requirementSource: "step1_room_furnishings";
  requestedParts: Array<
    | "lower_cabinet"
    | "upper_cabinet"
    | "refrigerator_cabinet"
    | "kimchi_refrigerator_cabinet"
  >;
}

const ROOM_NAMES: Record<string, string> = {
  living: "거실",
  master: "안방",
  bedroom: "침실",
  kitchen: "주방",
  bath: "욕실",
  entrance: "현관",
  balcony: "발코니",
  dressroom: "드레스룸",
  utility: "다용도실",
  other: "기타 공간",
};

const ALL_RESIDENTIAL_ROOM_KEYS = [
  "living",
  "master",
  "bedroom",
  "kitchen",
  "bath",
  "entrance",
];

export function normalizeEstimateStep1Snapshot(
  snapshot: Record<string, unknown> | undefined,
  projectMode: ProjectMode,
): Record<string, unknown> {
  const normalized = { ...(snapshot ?? {}) };
  if (projectMode !== "photo_only") return normalized;

  const residentialType = asString(normalized.residentialType) || asString(normalized.photoSpaceType);
  if (residentialType) normalized.residentialType = residentialType;
  return normalized;
}

export function deriveRequestedRoomsFromStep1(
  snapshot: Record<string, unknown> | undefined,
): RequestedEstimateRoom[] {
  const rooms = Array.isArray(snapshot?.rooms)
    ? snapshot.rooms.filter((room): room is string => typeof room === "string" && room.length > 0)
    : [];
  const furnishings = isRecord(snapshot?.roomFurnishings)
    ? snapshot.roomFurnishings
    : {};
  const furnishingRoomKeys = Object.entries(furnishings)
    .filter(([, values]) => Array.isArray(values) && values.length > 0)
    .map(([roomKey]) => roomKey);
  const selectedRoomKeys = rooms.includes("all")
    ? ALL_RESIDENTIAL_ROOM_KEYS
    : rooms.filter((roomKey) => roomKey !== "all");
  const roomKeys = Array.from(new Set([...selectedRoomKeys, ...furnishingRoomKeys]));

  return roomKeys.map((roomId) => ({
    roomId,
    roomName: ROOM_NAMES[roomId] || roomId,
  }));
}

export function deriveKitchenPlanOverridesFromStep1(
  snapshot: Record<string, unknown> | undefined,
  quantityBasisByRoom: Record<string, RoomQuantityBasis> = {},
): Record<string, KitchenPlanRequirementOverride> {
  const furnishings = isRecord(snapshot?.roomFurnishings)
    ? snapshot.roomFurnishings
    : {};
  const overrides: Record<string, KitchenPlanRequirementOverride> = {};

  for (const room of deriveRequestedRoomsFromStep1(snapshot)) {
    if (room.roomId !== "kitchen") continue;
    const rawOptions = furnishings[room.roomId];
    const options = new Set(
      Array.isArray(rawOptions)
        ? rawOptions.filter((option): option is string => typeof option === "string")
        : [],
    );
    const wantsLower = options.has("sinkLower") || options.has("sinkFull");
    const wantsUpper = options.has("sinkUpper") || options.has("sinkFull");
    const wantsFridge = options.has("fridgeCabinet");
    const wantsKimchi = options.has("kimchiCabinet");
    if (!wantsLower && !wantsUpper && !wantsFridge && !wantsKimchi) continue;

    const basis = quantityBasisByRoom[room.roomId];
    const counterLengthM = inferKitchenLengthM(basis);
    const tallCabinetLabels = [
      wantsFridge ? "냉장고장" : null,
      wantsKimchi ? "김치냉장고장" : null,
    ].filter((label): label is string => Boolean(label));
    const requestedParts: KitchenPlanRequirementOverride["requestedParts"] = [];
    if (wantsLower) requestedParts.push("lower_cabinet");
    if (wantsUpper) requestedParts.push("upper_cabinet");
    if (wantsFridge) requestedParts.push("refrigerator_cabinet");
    if (wantsKimchi) requestedParts.push("kimchi_refrigerator_cabinet");

    overrides[room.roomId] = {
      ...(wantsLower || wantsUpper ? { counterLengthM } : {}),
      lowerCabinetLengthM: wantsLower ? counterLengthM : 0,
      upperCabinetLengthM: wantsUpper ? Math.round(counterLengthM * 0.8 * 10) / 10 : 0,
      tallCabinetEa: tallCabinetLabels.length,
      tallCabinetLabels,
      requirementSource: "step1_room_furnishings",
      requestedParts,
    };
  }
  return overrides;
}

export function collectFinalSelectionImageUrls(
  selectedOutputs: DesignOutput[],
  selections: Array<{ imageUrl: string; sourceImageUrl?: string }>,
): Set<string> {
  return new Set(
    [
      ...selectedOutputs.map((output) => output.imageUrl),
      ...selections.flatMap((selection) => [selection.imageUrl, selection.sourceImageUrl]),
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  );
}

/** final_images_only에서도 선택된 실에 속한 기존 사용자 편집을 버리지 않는다. */
export function filterRecordsForSelectedRooms<T>(
  records: T[],
  selectedOutputs: DesignOutput[],
): T[] {
  const selectedRoomIds = new Set(selectedOutputs.map((output) => output.targetId));
  if (selectedRoomIds.size === 0) return records;
  return records.filter((record) => {
    if (!isRecord(record)) return false;
    const roomId = asString(record.roomId) || asString(record.room_id);
    return Boolean(roomId && selectedRoomIds.has(roomId));
  });
}

function inferKitchenLengthM(basis: RoomQuantityBasis | undefined): number {
  if (basis?.widthM && basis?.depthM) {
    return Math.round(Math.max(basis.widthM, basis.depthM) * 0.85 * 10) / 10;
  }
  const areaM2 = basis?.floorM2;
  if (!areaM2) return 3;
  if (areaM2 < 5) return 2.4;
  if (areaM2 < 8) return 3;
  if (areaM2 < 12) return 3.6;
  return 4.2;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
