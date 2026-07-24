import type { ParsedFloorPlanLike } from "./render-room-spec-builder";
import { normalizeRoomType } from "./room-label-normalizer";

export interface WorkflowFloorplanPoint {
  x: number;
  y: number;
}

export interface WorkflowFloorplanRoom {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  source: "vision" | "standard";
  xMm?: number;
  yMm?: number;
  shape?: "rectangular" | "l_shaped" | "irregular" | string;
  polygonMm?: WorkflowFloorplanPoint[];
}

export interface WorkflowFloorplanOpening {
  wall?: string;
  type?: "door" | "window" | "sliding" | string;
  widthMm?: number;
  heightMm?: number;
  fromRoom?: string;
  toRoom?: string;
  orientation?: string;
}

export interface WorkflowNormalizedFloorplan {
  pyeong: string;
  rooms: WorkflowFloorplanRoom[];
  openings: WorkflowFloorplanOpening[];
  notes: string;
  totalWidthMm?: number;
  totalDepthMm?: number;
}

function compactRoomName(name: string): string {
  return (name || "").replace(/\s+/g, "").toLowerCase();
}

function roomOrdinal(name: string): number {
  const match = compactRoomName(name).match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * UI 명칭(부엌, 욕실, 침실)과 도면 명칭(주방, 욕실1, 침실2)을 연결한다.
 * 정확 일치가 없을 때에만 정규화된 실 종류를 사용한다.
 */
export function findWorkflowFloorplanRoom(
  floorplan: WorkflowNormalizedFloorplan | undefined,
  targetName: string,
): WorkflowFloorplanRoom | undefined {
  const rooms = floorplan?.rooms || [];
  const targetCompact = compactRoomName(targetName);
  const exact = rooms.find((room) => compactRoomName(room.name) === targetCompact);
  if (exact) return exact;

  const targetType = normalizeRoomType(targetName);
  if (targetType === "unknown") {
    return rooms.find((room) => {
      const name = compactRoomName(room.name);
      return name.includes(targetCompact) || targetCompact.includes(name);
    });
  }

  return rooms
    .filter((room) => normalizeRoomType(room.name) === targetType)
    .sort((left, right) => {
      const ordinalDiff = roomOrdinal(left.name) - roomOrdinal(right.name);
      if (ordinalDiff !== 0) return ordinalDiff;
      return right.widthMm * right.depthMm - left.widthMm * left.depthMm;
    })[0];
}

function roomId(index: number): string {
  return `floorplan_room_${index}`;
}

function roomPolygonInMeters(room: WorkflowFloorplanRoom) {
  if (room.polygonMm && room.polygonMm.length >= 3) {
    return room.polygonMm.map((point) => ({
      x: point.x / 1000,
      y: point.y / 1000,
    }));
  }
  if (room.xMm == null || room.yMm == null) return undefined;
  const x = room.xMm / 1000;
  const y = room.yMm / 1000;
  const width = room.widthMm / 1000;
  const depth = room.depthMm / 1000;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

function mentionedRoomIndexes(
  opening: WorkflowFloorplanOpening,
  rooms: WorkflowFloorplanRoom[],
): number[] {
  const explicitNames = [opening.fromRoom, opening.toRoom].filter(
    (name): name is string => Boolean(name),
  );
  const explicitIndexes = explicitNames
    .map((name) => {
      const exact = rooms.findIndex(
        (room) => compactRoomName(room.name) === compactRoomName(name),
      );
      if (exact >= 0) return exact;
      const type = normalizeRoomType(name);
      return type === "unknown"
        ? -1
        : rooms.findIndex((room) => normalizeRoomType(room.name) === type);
    })
    .filter((index) => index >= 0);
  const haystack = compactRoomName(opening.wall || "");
  const wallIndexes = rooms
    .map((room, index) => ({ index, name: compactRoomName(room.name) }))
    .filter(({ name }) => name && haystack.includes(name))
    .map(({ index }) => index);
  return Array.from(new Set([...explicitIndexes, ...wallIndexes]));
}

/**
 * Step1 정규화 결과를 RenderRoomSpec 빌더가 이해하는 방 그래프/개구부로 변환한다.
 * 좌표 단위는 mm → m로 바꿔 인접 거리 판정(0.15~0.20m)이 정상 동작하게 한다.
 */
export function buildParsedFloorPlanFromWorkflow(
  floorplan: WorkflowNormalizedFloorplan | undefined,
): ParsedFloorPlanLike | undefined {
  if (!floorplan?.rooms?.length) return undefined;

  const rooms: NonNullable<ParsedFloorPlanLike["rooms"]> = floorplan.rooms.map(
    (room, index) => {
      const polygon = roomPolygonInMeters(room);
      return {
        id: roomId(index),
        name: room.name,
        polygon,
        bbox:
          room.xMm != null && room.yMm != null
            ? {
                x: room.xMm / 1000,
                y: room.yMm / 1000,
                width: room.widthMm / 1000,
                height: room.depthMm / 1000,
              }
            : undefined,
        areaM2: (room.widthMm * room.depthMm) / 1_000_000,
        confidence: room.source === "vision" ? 0.88 : 0.45,
      };
    },
  );

  const doors: NonNullable<ParsedFloorPlanLike["doors"]> = [];
  const windows: NonNullable<ParsedFloorPlanLike["windows"]> = [];
  const openings: NonNullable<ParsedFloorPlanLike["openings"]> = [];

  floorplan.openings.forEach((opening, index) => {
    const mentioned = mentionedRoomIndexes(opening, floorplan.rooms);
    const fromRoomId = mentioned[0] != null ? roomId(mentioned[0]) : undefined;
    const toRoomId = mentioned[1] != null ? roomId(mentioned[1]) : undefined;
    const type = (opening.type || "").toLowerCase();
    const wallId = opening.wall || `workflow_wall_${index}`;

    if (type === "window" || (type === "sliding" && !toRoomId)) {
      if (!fromRoomId) return;
      windows.push({
        id: `workflow_window_${index}`,
        roomId: fromRoomId,
        toRoomId,
        wallId,
        widthMm: opening.widthMm,
        isOnExteriorWall: !toRoomId,
      });
      return;
    }
    if (type === "door" || type === "sliding") {
      if (!fromRoomId) return;
      doors.push({
        id: `workflow_door_${index}`,
        fromRoomId,
        toRoomId,
        wallId,
        rawSymbolType: type === "sliding" ? "sliding" : "door",
        widthMm: opening.widthMm,
        isOnExteriorWall: false,
      });
      return;
    }
    if (fromRoomId) {
      openings.push({
        id: `workflow_opening_${index}`,
        fromRoomId,
        toRoomId,
        wallId,
        rawSymbolType: "opening",
      });
    }
  });

  return { rooms, doors, windows, openings };
}

function describeShape(room: WorkflowFloorplanRoom): string {
  if (room.shape) return room.shape;
  if (room.polygonMm && room.polygonMm.length > 4) {
    return `irregular polygon (${room.polygonMm.length} vertices)`;
  }
  return "rectangular";
}

/**
 * 이미지 모델에 전달할 선택 세대·실의 구조 증거.
 * 전형적인 아파트 레이아웃으로 대체하지 못하도록 전체 실 목록과 좌표를 함께 기록한다.
 */
export function buildWorkflowFloorplanEvidence(
  floorplan: WorkflowNormalizedFloorplan | undefined,
  targetName: string,
): string {
  if (!floorplan?.rooms?.length) return "";
  const target = findWorkflowFloorplanRoom(floorplan, targetName);
  if (!target) return "";
  const hasMeasuredStructure = floorplan.rooms.some(
    (room) => room.source === "vision",
  );

  const targetOpenings = floorplan.openings.filter((opening) => {
    const text = compactRoomName(
      [opening.wall, opening.fromRoom, opening.toRoom].filter(Boolean).join(" "),
    );
    return text.includes(compactRoomName(target.name));
  });
  const targetPosition =
    target.xMm != null && target.yMm != null
      ? `x=${target.xMm}mm, y=${target.yMm}mm`
      : "position not confidently detected";
  const roomInventory = floorplan.rooms.map((room, index) => {
    const position =
      room.xMm != null && room.yMm != null
        ? ` at (${room.xMm}, ${room.yMm})mm`
        : "";
    return `${index + 1}. ${room.name}: ${room.widthMm}×${room.depthMm}mm, ${describeShape(room)}${position}, source=${room.source}`;
  });
  const openingInventory =
    targetOpenings.length > 0
      ? targetOpenings.map(
          (opening, index) =>
            `${index + 1}. ${opening.type || "opening"} · ${opening.wall || "wall unknown"}${opening.widthMm ? ` · width ${opening.widthMm}mm` : ""}`,
        )
      : ["- No target-room opening was confidently detected; do not invent its position."];

  return [
    hasMeasuredStructure
      ? "=== SELECTED UNIT FLOORPLAN EVIDENCE — HIGHER PRIORITY THAN STYLE ==="
      : "=== AREA-AVERAGE ROOM GUIDE — NOT A MEASURED FLOORPLAN ===",
    `Unit: ${floorplan.pyeong || "unknown unit type"}`,
    `Target UI room: ${targetName}`,
    `Matched plan room: ${target.name}`,
    `Target geometry: ${target.widthMm}×${target.depthMm}×${target.heightMm}mm; shape=${describeShape(target)}; ${targetPosition}`,
    floorplan.totalWidthMm && floorplan.totalDepthMm
      ? `Unit bounds: ${floorplan.totalWidthMm}×${floorplan.totalDepthMm}mm`
      : "Unit bounds: not confidently detected",
    "",
    "FULL ROOM MAP:",
    ...roomInventory,
    "",
    "TARGET OPENINGS:",
    ...openingInventory,
    "",
    hasMeasuredStructure ? "NON-NEGOTIABLE:" : "GUIDANCE:",
    "- Render only the matched target room, viewed from inside it.",
    hasMeasuredStructure
      ? "- Preserve this unit's target-room aspect ratio, wall lengths, opening count and relative opening locations."
      : "- Treat these dimensions as an area-based estimate; do not claim they are measured.",
    hasMeasuredStructure
      ? "- Use the full room map to understand adjacency; do not substitute a generic Korean apartment layout."
      : "- Keep the selected room identity and estimated proportions consistent.",
    "- Do not turn a bathroom, bedroom, entrance, or kitchen request into a wide living-room scene.",
    "- Style and materials may change; architecture, room identity, and openings may not.",
    floorplan.notes ? `Analysis note: ${floorplan.notes}` : "",
    hasMeasuredStructure
      ? "=== END SELECTED UNIT FLOORPLAN EVIDENCE ==="
      : "=== END AREA-AVERAGE ROOM GUIDE ===",
  ]
    .filter(Boolean)
    .join("\n");
}
