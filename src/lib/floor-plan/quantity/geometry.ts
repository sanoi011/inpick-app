// src/lib/floor-plan/quantity/geometry.ts

import type { Point2D, Polygon2D } from '@/types/floor-plan';

/** Shoelace 공식 — 폴리곤 면적 (㎡ 반환) */
export function calcPolygonArea(polygon: Polygon2D): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2 / 1_000_000; // mm² → ㎡
}

/** 폴리곤 둘레 (mm 반환) */
export function calcPolygonPerimeter(polygon: Polygon2D): number {
  let perimeter = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/** 벽체 길이 (mm) */
export function calcWallLength(wall: { start: Point2D; end: Point2D }): number {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 폴리곤 중심점 */
export function calcCentroid(polygon: Polygon2D): Point2D {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  const sum = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / n, y: sum.y / n };
}

/** 벽체의 어느 면이 해당 실에 속하는지 판별 */
export function determineWallSide(
  wall: { start: Point2D; end: Point2D },
  roomCenter: Point2D
): 'LEFT' | 'RIGHT' {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return 'LEFT';

  // 법선 벡터 (좌측)
  const nx = -dy / len;
  const ny = dx / len;

  const toCenterX = roomCenter.x - wall.start.x;
  const toCenterY = roomCenter.y - wall.start.y;
  const dot = nx * toCenterX + ny * toCenterY;
  return dot >= 0 ? 'LEFT' : 'RIGHT';
}
