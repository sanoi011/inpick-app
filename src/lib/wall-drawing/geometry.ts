/**
 * Wall Drawing Geometry - 직선 보정, 끝점 스냅, 거리 계산
 */

import type { DrawingPoint, DrawnWall } from "@/types/wall-drawing";
import {
  STRAIGHTEN_ANGLE,
  SNAP_THRESHOLD,
  GRID_SIZE,
} from "@/types/wall-drawing";

// ─── 직선 보정 ─────────────────────────────────────

/**
 * 사용자가 드래그한 끝점을 수평/수직으로 보정
 * ±STRAIGHTEN_ANGLE 이내이면 해당 축으로 스냅
 */
export function straightenLine(
  start: DrawingPoint,
  end: DrawingPoint,
  angleTolerance: number = STRAIGHTEN_ANGLE
): DrawingPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // 너무 짧은 선은 보정하지 않음
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return end;

  const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

  // 수평 (0° 또는 180°) ±tolerance → y를 시작점에 고정
  if (angle <= angleTolerance || angle >= 180 - angleTolerance) {
    return { x: end.x, y: start.y };
  }
  // 수직 (90°) ±tolerance → x를 시작점에 고정
  if (angle >= 90 - angleTolerance && angle <= 90 + angleTolerance) {
    return { x: start.x, y: end.y };
  }
  // 대각선: 보정 없이 반환
  return end;
}

// ─── 끝점 스냅 ─────────────────────────────────────

/**
 * 가장 가까운 기존 벽 끝점을 찾아 스냅
 * threshold 이내이면 해당 끝점으로 스냅, 아니면 null
 */
export function findNearestEndpoint(
  point: DrawingPoint,
  walls: DrawnWall[],
  threshold: number = SNAP_THRESHOLD
): DrawingPoint | null {
  let closest: DrawingPoint | null = null;
  let minDist = threshold;

  for (const wall of walls) {
    for (const ep of [wall.start, wall.end]) {
      const dist = distance(point, ep);
      if (dist < minDist) {
        minDist = dist;
        closest = { x: ep.x, y: ep.y };
      }
    }
  }
  return closest;
}

/**
 * 포인트를 기존 벽 끝점 또는 그리드에 스냅
 * 우선순위: 끝점 스냅 > 그리드 스냅
 */
export function snapPoint(
  point: DrawingPoint,
  walls: DrawnWall[],
  snapEnabled: boolean,
  gridEnabled: boolean
): DrawingPoint {
  if (snapEnabled) {
    const nearest = findNearestEndpoint(point, walls);
    if (nearest) return nearest;
  }
  if (gridEnabled) {
    return snapToGrid(point);
  }
  return point;
}

// ─── 그리드 스냅 ───────────────────────────────────

export function snapToGrid(
  point: DrawingPoint,
  gridSize: number = GRID_SIZE
): DrawingPoint {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

// ─── 거리/기하학 유틸리티 ──────────────────────────

export function distance(a: DrawingPoint, b: DrawingPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** 벽의 길이 (미터) */
export function wallLength(wall: DrawnWall): number {
  return distance(wall.start, wall.end);
}

/** 벽의 각도 (라디안) */
export function wallAngle(wall: DrawnWall): number {
  return Math.atan2(
    wall.end.y - wall.start.y,
    wall.end.x - wall.start.x
  );
}

/** 벽의 각도 (도) */
export function wallAngleDeg(wall: DrawnWall): number {
  return wallAngle(wall) * (180 / Math.PI);
}

/** 점에서 선분까지의 최단 거리 */
export function pointToSegmentDistance(
  point: DrawingPoint,
  segStart: DrawingPoint,
  segEnd: DrawingPoint
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 0.0001) return distance(point, segStart);

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };
  return distance(point, proj);
}

/** 선분 위 점의 위치 (0~1 비율) */
export function getPositionOnSegment(
  point: DrawingPoint,
  segStart: DrawingPoint,
  segEnd: DrawingPoint
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return 0;

  const t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/** 선분 위의 특정 비율(0~1) 지점의 좌표 */
export function interpolateOnSegment(
  segStart: DrawingPoint,
  segEnd: DrawingPoint,
  t: number
): DrawingPoint {
  return {
    x: segStart.x + (segEnd.x - segStart.x) * t,
    y: segStart.y + (segEnd.y - segStart.y) * t,
  };
}

/** 벽의 법선 벡터 (두께 계산용) */
export function wallNormal(wall: DrawnWall): DrawingPoint {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 0, y: 1 };
  return { x: -dy / len, y: dx / len };
}

/** Shoelace formula로 폴리곤 면적 계산 */
export function polygonArea(points: DrawingPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/** 폴리곤 중심점 */
export function polygonCentroid(points: DrawingPoint[]): DrawingPoint {
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

/** 스크린 좌표 → 미터 좌표 변환 */
export function screenToMeters(
  screenX: number,
  screenY: number,
  scale: number,
  panOffset: DrawingPoint
): DrawingPoint {
  return {
    x: (screenX - panOffset.x) / scale,
    y: (screenY - panOffset.y) / scale,
  };
}

/** 미터 좌표 → 스크린 좌표 변환 */
export function metersToScreen(
  meterX: number,
  meterY: number,
  scale: number,
  panOffset: DrawingPoint
): { x: number; y: number } {
  return {
    x: meterX * scale + panOffset.x,
    y: meterY * scale + panOffset.y,
  };
}
