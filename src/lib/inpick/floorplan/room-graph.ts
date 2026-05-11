/**
 * Room graph builder — ParsedFloorPlan → RoomNode + adjacency.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §7-2
 *
 * 책임:
 *   - ParsedFloorPlan (또는 normalized rooms)에서 RoomNode 추출
 *   - adjacency 그래프 구축 (polygon shared edge / bbox distance / room label fallback)
 *   - findAttachedZones(roomId) — 타겟 방에 부속된 attached zones 반환
 */

import type {
  AttachedZone,
  AttachedZoneType,
  Point,
  RoomNode,
} from "./render-room-spec";
import { bboxDistance, polygonsAreAdjacent } from "./render-room-spec";
import {
  isAttachedServiceZone,
  isBalconyLike,
  normalizeRoomType,
  inferAttachedTargetType,
} from "./room-label-normalizer";

// ─── 입력 (Parsed FloorPlan과 호환 가능한 최소 shape) ───
export interface RoomGraphInputRoom {
  id?: string;
  name: string;
  /** 정규화 좌표 (0~1) 또는 mm */
  polygon?: Point[];
  bbox?: { x: number; y: number; width: number; height: number };
  areaM2?: number;
  type?: string;
  confidence?: number;
}

export interface RoomGraph {
  rooms: RoomNode[];
  /** roomId → 인접 roomId 집합 + confidence */
  adjacency: Map<string, Array<{ neighborId: string; confidence: number }>>;
}

/**
 * RoomGraph 구축.
 */
export function buildRoomGraph(inputRooms: RoomGraphInputRoom[]): RoomGraph {
  // 1. RoomNode 정규화
  const rooms: RoomNode[] = inputRooms.map((r, i) => ({
    id: r.id || `room_${i}`,
    name: r.name || `방${i}`,
    type: normalizeRoomType(r.name || ""),
    polygon: r.polygon,
    bbox: r.bbox,
    areaM2: r.areaM2,
    confidence: r.confidence,
  }));

  // 2. adjacency 계산
  const adjacency = new Map<string, Array<{ neighborId: string; confidence: number }>>();
  for (let i = 0; i < rooms.length; i++) {
    adjacency.set(rooms[i].id, []);
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const conf = computeAdjacencyConfidence(a, b);
      if (conf > 0) {
        adjacency.get(a.id)!.push({ neighborId: b.id, confidence: conf });
        adjacency.get(b.id)!.push({ neighborId: a.id, confidence: conf });
      }
    }
  }

  return { rooms, adjacency };
}

/**
 * 두 방의 인접 확률 (0~1).
 * 우선순위:
 *   1. polygon shared edge (>= 20%) — 0.9
 *   2. polygon edge distance <= 0.15m — 0.75
 *   3. bbox distance <= 0.2 (정규화) — 0.6
 *   4. room label proximity fallback — 0.45
 */
function computeAdjacencyConfidence(a: RoomNode, b: RoomNode): number {
  if (a.polygon && b.polygon && a.polygon.length >= 3 && b.polygon.length >= 3) {
    if (polygonsAreAdjacent(a.polygon, b.polygon, { edgeOverlapThreshold: 0.2 })) {
      return 0.9;
    }
    if (polygonsAreAdjacent(a.polygon, b.polygon, { edgeDistanceThreshold: 0.15 })) {
      return 0.75;
    }
  }
  if (a.bbox && b.bbox) {
    const d = bboxDistance(a.bbox, b.bbox);
    if (d <= 0.2) return 0.6;
  }
  // label proximity fallback — 안방 + 안방발코니 같은 명백한 case
  const targetType = inferAttachedTargetType(b.name);
  if (targetType === a.type) return 0.55;
  const targetType2 = inferAttachedTargetType(a.name);
  if (targetType2 === b.type) return 0.55;
  return 0;
}

/**
 * findAdjacentRooms — 타겟 방의 인접 방 목록.
 */
export function findAdjacentRooms(
  roomId: string,
  graph: RoomGraph,
): Array<{ room: RoomNode; confidence: number }> {
  const adj = graph.adjacency.get(roomId);
  if (!adj || adj.length === 0) return [];
  const out: Array<{ room: RoomNode; confidence: number }> = [];
  for (const entry of adj) {
    const room = graph.rooms.find((r) => r.id === entry.neighborId);
    if (room) out.push({ room, confidence: entry.confidence });
  }
  return out;
}

/**
 * findAttachedZones — 타겟 방에 부속된 zone (발코니/베란다/다용도실/드레스룸/대피공간/실외기실).
 *
 * 정책:
 *   - room.type ∈ attached service zone
 *   - 또는 room name이 타겟 방 이름을 포함 (예: "안방발코니" 안에 "안방")
 *   - confidence는 adjacency confidence 사용
 */
export function findAttachedZones(
  roomId: string,
  graph: RoomGraph,
): AttachedZone[] {
  const target = graph.rooms.find((r) => r.id === roomId);
  if (!target) return [];

  const adjacent = findAdjacentRooms(roomId, graph);
  const out: AttachedZone[] = [];

  for (const { room, confidence } of adjacent) {
    if (!isAttachedServiceZone(room)) continue;

    // attached zone type 결정 (room.type 활용)
    let zoneType: AttachedZoneType = "balcony";
    if (isBalconyLike(room)) {
      zoneType = room.type === "service_balcony" ? "service_balcony" : "balcony";
    } else if (room.type === "utility") zoneType = "utility";
    else if (room.type === "closet") zoneType = "closet";
    else if (room.type === "dress_room") zoneType = "dress_room";
    else if (room.type === "evacuation_space") zoneType = "evacuation_space";
    else if (room.type === "mechanical_room") zoneType = "mechanical_room";

    // 추가 신뢰도 부스트 — 이름 매칭 ("안방발코니" + 타겟 "안방")
    let zoneConfidence = confidence;
    const targetType = inferAttachedTargetType(room.name);
    if (targetType === target.type) {
      zoneConfidence = Math.min(1, zoneConfidence + 0.1);
    }

    out.push({
      id: `zone_${room.id}`,
      name: room.name,
      type: zoneType,
      attachedToRoomId: roomId,
      treatment: "unknown",
      polygon: room.polygon,
      bbox: room.bbox,
      confidence: zoneConfidence,
    });
  }
  return out;
}

/**
 * 타겟 방의 인접 방 이름 list (legacy adjacentRooms 호환용).
 */
export function adjacentRoomNames(roomId: string, graph: RoomGraph): string[] {
  return findAdjacentRooms(roomId, graph).map((a) => a.room.name);
}
