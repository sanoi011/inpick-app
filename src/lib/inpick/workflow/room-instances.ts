export type WorkflowRoomKind =
  | "living"
  | "master"
  | "kitchen"
  | "bath"
  | "bedroom"
  | "entrance"
  | "balcony"
  | "dress";

export interface WorkflowFloorplanRoom {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  xMm?: number;
  yMm?: number;
  source?: "vision" | "standard";
}

export interface WorkflowRoomDescriptor {
  key: string;
  kind: WorkflowRoomKind;
  label: string;
  dimKey: string;
}

export interface WorkflowFloorplanOpening {
  wall?: string;
  type?: string;
  widthMm?: number;
  heightMm?: number;
}

export interface RenderFloorplanPayload {
  rooms: Array<{
    id: string;
    name: string;
    bbox?: { x: number; y: number; width: number; height: number };
    areaM2: number;
    confidence: number;
  }>;
  doors: Array<{
    id: string;
    fromRoomId: string;
    toRoomId?: string;
    rawSymbolType: "door" | "sliding";
    widthMm?: number;
    isOnExteriorWall: boolean;
  }>;
  windows: Array<{
    id: string;
    roomId: string;
    widthMm?: number;
    isOnExteriorWall: boolean;
  }>;
  openings: Array<{
    id: string;
    fromRoomId: string;
    toRoomId?: string;
    rawSymbolType: "opening";
  }>;
}

const FALLBACK_ROOMS: Array<{
  kind: WorkflowRoomKind;
  label: string;
  dimKey: string;
}> = [
  { kind: "living", label: "거실", dimKey: "거실" },
  { kind: "master", label: "안방", dimKey: "안방" },
  { kind: "kitchen", label: "부엌", dimKey: "주방" },
  { kind: "bath", label: "욕실", dimKey: "욕실1" },
  { kind: "bedroom", label: "침실", dimKey: "침실1" },
  { kind: "entrance", label: "현관", dimKey: "현관" },
  { kind: "balcony", label: "베란다", dimKey: "발코니" },
  { kind: "dress", label: "드레스룸", dimKey: "드레스룸" },
];

export function inferWorkflowRoomKind(name: string): WorkflowRoomKind | null {
  const text = (name || "").replace(/\s+/g, "").toLowerCase();
  if (/안방|부부침실|master/.test(text)) return "master";
  if (/거실|living/.test(text)) return "living";
  if (/주방|부엌|kitchen/.test(text)) return "kitchen";
  if (/욕실|화장실|bath|toilet|wc/.test(text)) return "bath";
  if (/현관|entrance|entry/.test(text)) return "entrance";
  if (/발코니|베란다|balcony|veranda/.test(text)) return "balcony";
  if (/드레스|dress|walkin/.test(text)) return "dress";
  if (/침실|작은방|방\d|bedroom/.test(text)) return "bedroom";
  return null;
}

export function canonicalizeFloorplanRoomNames<
  T extends { name: string },
>(rooms: T[]): T[] {
  const totals = new Map<WorkflowRoomKind, number>();
  for (const room of rooms) {
    const kind = inferWorkflowRoomKind(room.name);
    if (!kind) continue;
    totals.set(kind, (totals.get(kind) || 0) + 1);
  }
  const occurrences = new Map<WorkflowRoomKind, number>();
  return rooms.map((room) => {
    const kind = inferWorkflowRoomKind(room.name);
    if (!kind) return room;
    const occurrence = (occurrences.get(kind) || 0) + 1;
    occurrences.set(kind, occurrence);
    const total = totals.get(kind) || 1;
    if (kind === "bath" && total > 1) {
      return { ...room, name: `욕실${occurrence}` };
    }
    if (kind === "bedroom" && total > 1) {
      return { ...room, name: `침실${occurrence}` };
    }
    return room;
  });
}

function explicitRoomIndex(name: string): number | null {
  const match = name.match(/(\d+)\s*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function indexedLabel(
  kind: WorkflowRoomKind,
  original: string,
  index: number,
  count: number,
): string {
  if (kind === "bath" && (count > 1 || explicitRoomIndex(original))) {
    return `욕실${index}`;
  }
  if (kind === "bedroom" && (count > 1 || explicitRoomIndex(original))) {
    return `침실${index}`;
  }
  return original.trim() || FALLBACK_ROOMS.find((room) => room.kind === kind)!.label;
}

/**
 * 도면의 동일 유형 실을 하나로 뭉개지 않고 `bath`, `bath-2`처럼 안정된 키로 만든다.
 * 첫 실 키는 기존 저장 데이터와 호환되도록 종전 키를 그대로 유지한다.
 */
export function buildApartmentRoomDescriptors(
  rooms: WorkflowFloorplanRoom[] | null | undefined,
): WorkflowRoomDescriptor[] {
  const descriptors: WorkflowRoomDescriptor[] = [];
  const grouped = new Map<WorkflowRoomKind, WorkflowFloorplanRoom[]>();

  for (const room of rooms || []) {
    const kind = inferWorkflowRoomKind(room.name);
    if (!kind) continue;
    const group = grouped.get(kind) || [];
    group.push(room);
    grouped.set(kind, group);
  }

  for (const fallback of FALLBACK_ROOMS) {
    const group = grouped.get(fallback.kind) || [];
    if (group.length === 0) {
      descriptors.push({
        key: fallback.kind,
        kind: fallback.kind,
        label: fallback.label,
        dimKey: fallback.dimKey,
      });
      continue;
    }

    const sorted = [...group].sort((left, right) => {
      const leftIndex = explicitRoomIndex(left.name);
      const rightIndex = explicitRoomIndex(right.name);
      if (leftIndex != null && rightIndex != null) return leftIndex - rightIndex;
      if (leftIndex != null) return -1;
      if (rightIndex != null) return 1;
      return 0;
    });
    sorted.forEach((room, position) => {
      const occurrence = position + 1;
      descriptors.push({
        key:
          occurrence === 1
            ? fallback.kind
            : `${fallback.kind}-${occurrence}`,
        kind: fallback.kind,
        label: indexedLabel(
          fallback.kind,
          room.name,
          occurrence,
          sorted.length,
        ),
        dimKey: room.name,
      });
    });
  }

  return descriptors;
}

export function expandWorkflowRoomSelection(
  selectedRooms: string[],
  descriptors: WorkflowRoomDescriptor[],
): string[] {
  const renderable = descriptors.filter(
    (room) => room.kind !== "balcony" && room.kind !== "dress",
  );
  if (selectedRooms.length === 0 || selectedRooms.includes("all")) {
    return renderable.map((room) => room.key);
  }

  const selected = new Set<string>();
  for (const requested of selectedRooms) {
    for (const descriptor of renderable) {
      if (descriptor.key === requested || descriptor.kind === requested) {
        selected.add(descriptor.key);
      }
    }
  }
  return Array.from(selected);
}

export function buildWorkflowRoomNameMap(
  rooms: WorkflowFloorplanRoom[] | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    buildApartmentRoomDescriptors(rooms).map((room) => [room.key, room.label]),
  );
}

/**
 * Step1 정형화 결과를 RenderRoomSpec 입력으로 변환한다.
 * bbox와 실별 고유 ID를 포함해 서버가 타겟 욕실/침실을 서로 구분할 수 있게 한다.
 */
export function buildRenderFloorplanPayload(input: {
  rooms: WorkflowFloorplanRoom[];
  openings?: WorkflowFloorplanOpening[];
}): RenderFloorplanPayload {
  const descriptors = buildApartmentRoomDescriptors(input.rooms);
  const descriptorQueues = new Map<WorkflowRoomKind, WorkflowRoomDescriptor[]>();
  for (const descriptor of descriptors) {
    const queue = descriptorQueues.get(descriptor.kind) || [];
    queue.push(descriptor);
    descriptorQueues.set(descriptor.kind, queue);
  }
  const cursors = new Map<WorkflowRoomKind, number>();

  const mappedRooms = input.rooms.flatMap((room) => {
    const kind = inferWorkflowRoomKind(room.name);
    if (!kind) return [];
    const cursor = cursors.get(kind) || 0;
    const descriptor = descriptorQueues.get(kind)?.[cursor];
    cursors.set(kind, cursor + 1);
    if (!descriptor) return [];
    return [{
      id: descriptor.key,
      name: descriptor.label,
      ...(room.xMm != null && room.yMm != null
        ? {
            bbox: {
              x: room.xMm,
              y: room.yMm,
              width: room.widthMm,
              height: room.depthMm,
            },
          }
        : {}),
      areaM2: (room.widthMm * room.depthMm) / 1_000_000,
      confidence: room.source === "vision" ? 0.9 : 0.55,
    }];
  });

  const doors: RenderFloorplanPayload["doors"] = [];
  const windows: RenderFloorplanPayload["windows"] = [];
  const openings: RenderFloorplanPayload["openings"] = [];
  (input.openings || []).forEach((opening, index) => {
    const wall = opening.wall || "";
    const related = mappedRooms.filter((room) => wall.includes(room.name));
    const fromRoom = related[0];
    const toRoom = related[1];
    if (!fromRoom) return;
    const type = (opening.type || "").toLowerCase();
    if (/window|창/.test(type)) {
      windows.push({
        id: `window_${index}`,
        roomId: fromRoom.id,
        widthMm: opening.widthMm,
        isOnExteriorWall: !toRoom,
      });
      return;
    }
    if (/opening|오픈|통로/.test(type)) {
      openings.push({
        id: `opening_${index}`,
        fromRoomId: fromRoom.id,
        toRoomId: toRoom?.id,
        rawSymbolType: "opening",
      });
      return;
    }
    doors.push({
      id: `door_${index}`,
      fromRoomId: fromRoom.id,
      toRoomId: toRoom?.id,
      rawSymbolType: /sliding|미닫|슬라이딩/.test(type)
        ? "sliding"
        : "door",
      widthMm: opening.widthMm,
      isOnExteriorWall: !toRoom,
    });
  });

  return { rooms: mappedRooms, doors, windows, openings };
}
