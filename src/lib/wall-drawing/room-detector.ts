/**
 * Wall Drawing Room Detector - 벽으로 둘러싸인 닫힌 영역(방) 자동 감지
 *
 * 알고리즘: Planar Graph Face Detection
 * 1. 벽 끝점을 노드로, 벽을 간선으로 하는 평면 그래프 구축
 * 2. 각 노드에서 나가는 간선을 각도순 정렬
 * 3. 최소 순환(face)을 찾아 방으로 인식
 * 4. Shoelace 공식으로 면적 계산
 */

import type { DrawingPoint, DrawnWall, DetectedRoom } from "@/types/wall-drawing";
import { polygonArea } from "./geometry";

// ─── 내부 타입 ───────────────────────────────────────

interface GraphNode {
  id: string;
  point: DrawingPoint;
  edges: GraphEdge[];
}

interface GraphEdge {
  targetId: string;
  angle: number; // 라디안
  wallId: string;
}

// ─── 점 키 생성 ──────────────────────────────────────

const SNAP_EPSILON = 0.05; // 5cm 이내 동일점 처리

function pointKey(p: DrawingPoint): string {
  const rx = Math.round(p.x / SNAP_EPSILON) * SNAP_EPSILON;
  const ry = Math.round(p.y / SNAP_EPSILON) * SNAP_EPSILON;
  return `${rx.toFixed(3)},${ry.toFixed(3)}`;
}

// ─── 그래프 구축 ─────────────────────────────────────

function buildGraph(walls: DrawnWall[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();

  function getOrCreate(p: DrawingPoint): string {
    const key = pointKey(p);
    if (!nodes.has(key)) {
      nodes.set(key, { id: key, point: { x: p.x, y: p.y }, edges: [] });
    }
    return key;
  }

  for (const wall of walls) {
    const startId = getOrCreate(wall.start);
    const endId = getOrCreate(wall.end);

    if (startId === endId) continue; // 자기 자신 간선 무시

    const angle = Math.atan2(
      wall.end.y - wall.start.y,
      wall.end.x - wall.start.x
    );

    const startNode = nodes.get(startId)!;
    const endNode = nodes.get(endId)!;

    // 양방향 간선
    if (!startNode.edges.some(e => e.targetId === endId && e.wallId === wall.id)) {
      startNode.edges.push({ targetId: endId, angle, wallId: wall.id });
    }
    if (!endNode.edges.some(e => e.targetId === startId && e.wallId === wall.id)) {
      endNode.edges.push({
        targetId: startId,
        angle: angle + Math.PI, // 반대 방향
        wallId: wall.id,
      });
    }
  }

  // 각 노드의 간선을 각도순 정렬
  for (const node of Array.from(nodes.values())) {
    node.edges.sort((a, b) => {
      const aa = ((a.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const ab = ((b.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return aa - ab;
    });
  }

  return nodes;
}

// ─── 최소 순환 탐색 ──────────────────────────────────

/**
 * 각 방향 간선에서 "다음 간선"을 찾아 face를 추적
 * 반시계방향(CCW)으로 가장 가까운 간선을 선택
 */
function findNextEdge(
  nodes: Map<string, GraphNode>,
  fromId: string,
  currentId: string
): GraphEdge | null {
  const node = nodes.get(currentId);
  if (!node || node.edges.length === 0) return null;

  // fromId → currentId 방향의 각도
  const fromNode = nodes.get(fromId);
  if (!fromNode) return null;

  const incomingAngle = Math.atan2(
    node.point.y - fromNode.point.y,
    node.point.x - fromNode.point.x
  );

  // 반대 방향 (들어온 방향)
  const reverseAngle =
    ((incomingAngle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

  // 나가는 간선 중 reverseAngle 다음으로 시계방향에 있는 것
  // (= 좌회전 최소, 즉 가장 타이트한 우회전)
  let bestEdge: GraphEdge | null = null;
  let bestDelta = Infinity;

  for (const edge of node.edges) {
    if (edge.targetId === fromId) continue; // 왔던 길 제외

    const edgeAngle =
      ((edge.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // reverseAngle에서 시계방향으로 edge까지의 각도
    let delta = (edgeAngle - reverseAngle + 2 * Math.PI) % (2 * Math.PI);
    if (delta < 0.001) delta = 2 * Math.PI; // 거의 같은 방향은 마지막

    if (delta < bestDelta) {
      bestDelta = delta;
      bestEdge = edge;
    }
  }

  // 들어온 곳밖에 없으면 그것이라도 반환
  if (!bestEdge && node.edges.length > 0) {
    bestEdge = node.edges.find(e => e.targetId === fromId) || null;
  }

  return bestEdge;
}

function traceFace(
  nodes: Map<string, GraphNode>,
  startId: string,
  firstEdge: GraphEdge
): string[] | null {
  const path: string[] = [startId];
  let currentId = firstEdge.targetId;
  let fromId = startId;
  const maxSteps = 50;

  for (let step = 0; step < maxSteps; step++) {
    path.push(currentId);

    if (currentId === startId) {
      return path; // 순환 완성
    }

    const next = findNextEdge(nodes, fromId, currentId);
    if (!next) return null;

    fromId = currentId;
    currentId = next.targetId;
  }

  return null; // 최대 단계 초과
}

// ─── 메인 함수 ───────────────────────────────────────

/**
 * 벽들로부터 닫힌 영역(방)을 자동 감지
 */
export function detectRooms(walls: DrawnWall[]): DetectedRoom[] {
  if (walls.length < 3) return [];

  const nodes = buildGraph(walls);
  const foundFaces = new Set<string>();
  const rooms: DetectedRoom[] = [];
  let roomCounter = 0;

  // 모든 방향 간선에서 face 탐색
  for (const node of Array.from(nodes.values())) {
    for (const edge of node.edges) {
      const face = traceFace(nodes, node.id, edge);
      if (!face || face.length < 4) continue; // 최소 삼각형 (3노드 + 종점)

      // face 정규화 (순서 무관하게 동일 face 검출)
      const faceNodes = face.slice(0, -1); // 마지막 종점 제거
      const normalizedKey = normalizeFace(faceNodes);

      if (foundFaces.has(normalizedKey)) continue;
      foundFaces.add(normalizedKey);

      // 폴리곤 좌표 추출
      const polygon: DrawingPoint[] = faceNodes.map((nodeId) => {
        const n = nodes.get(nodeId)!;
        return { x: n.point.x, y: n.point.y };
      });

      // 면적 계산
      const area = polygonArea(polygon);

      // 노이즈 필터링
      if (area < 1) continue; // 1m² 미만 = 노이즈
      if (area > 200) continue; // 200m² 초과 = 외부 공간

      // signed area로 방향 확인 (시계방향만)
      const signedArea = signedPolygonArea(polygon);
      if (signedArea > 0) continue; // 반시계방향 = 외부 face

      roomCounter++;

      rooms.push({
        id: `room-${roomCounter}`,
        polygon,
        area: Math.round(area * 100) / 100,
      });
    }
  }

  return rooms;
}

// ─── 유틸리티 ────────────────────────────────────────

/** face 정규화: 노드 ID 리스트를 가장 작은 회전으로 */
function normalizeFace(nodeIds: string[]): string {
  if (nodeIds.length === 0) return "";

  // 가장 작은 ID를 시작점으로
  let minIdx = 0;
  for (let i = 1; i < nodeIds.length; i++) {
    if (nodeIds[i] < nodeIds[minIdx]) {
      minIdx = i;
    }
  }

  // 회전하여 정규화
  const rotated = [
    ...nodeIds.slice(minIdx),
    ...nodeIds.slice(0, minIdx),
  ];

  return rotated.join("|");
}

/** Signed area (양수 = 반시계방향, 음수 = 시계방향) */
function signedPolygonArea(points: DrawingPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}
