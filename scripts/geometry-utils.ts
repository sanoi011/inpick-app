// scripts/geometry-utils.ts
// Pure geometry utility functions for floorplan processing

export interface Point {
  x: number;
  y: number;
}

/** Ray casting point-in-polygon test */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance between two points */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Centroid of a polygon */
export function centroid(polygon: Point[]): Point {
  let cx = 0, cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / polygon.length, y: cy / polygon.length };
}

/** Polygon area via shoelace formula */
export function polygonArea(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

/** Bounding box of polygon */
export function boundingBox(polygon: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Check if a line segment is mostly horizontal (angle < 30deg from x-axis) */
export function isHorizontal(start: Point, end: Point): boolean {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx >= dy;
}

/** Midpoint of two points */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Convert flat [x1,y1,x2,y2,...] to Point[] */
export function flatToPoints(flat: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length - 1; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

/** Round a number to N decimal places */
export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Find collinear overlap between two line segments.
 * Returns the overlapping sub-segment, or null if segments are not
 * roughly parallel, too far apart, or don't overlap enough.
 *
 * @param tolerance perpendicular distance threshold (meters)
 * @param minOverlap minimum overlap length (meters)
 */
export function findCollinearOverlap(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
  tolerance = 0.3,
  minOverlap = 0.1
): [Point, Point] | null {
  // 1. Check if edges are roughly parallel
  const angleA = Math.atan2(a2.y - a1.y, a2.x - a1.x);
  const angleB = Math.atan2(b2.y - b1.y, b2.x - b1.x);

  let angleDiff = Math.abs(angleA - angleB) % Math.PI;
  if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff;
  if (angleDiff > 0.15) return null; // > ~8.5 degrees

  // 2. Check perpendicular distance from b1 to line(a1, a2)
  const dist = pointToLineDistance(b1, a1, a2);
  if (dist > tolerance) return null;

  // Also check b2
  const dist2 = pointToLineDistance(b2, a1, a2);
  if (dist2 > tolerance) return null;

  // 3. Project all points onto line A direction and find overlap
  const dx = a2.x - a1.x;
  const dy = a2.y - a1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  const ux = dx / len;
  const uy = dy / len;

  // Signed projection along the direction
  const projA1 = (a1.x - a1.x) * ux + (a1.y - a1.y) * uy; // = 0
  const projA2 = (a2.x - a1.x) * ux + (a2.y - a1.y) * uy;
  const projB1 = (b1.x - a1.x) * ux + (b1.y - a1.y) * uy;
  const projB2 = (b2.x - a1.x) * ux + (b2.y - a1.y) * uy;

  const rangeA = [Math.min(projA1, projA2), Math.max(projA1, projA2)];
  const rangeB = [Math.min(projB1, projB2), Math.max(projB1, projB2)];

  const overlapStart = Math.max(rangeA[0], rangeB[0]);
  const overlapEnd = Math.min(rangeA[1], rangeB[1]);

  if (overlapEnd - overlapStart < minOverlap) return null;

  // Convert back to 2D points (project onto line A)
  return [
    { x: round(a1.x + ux * overlapStart), y: round(a1.y + uy * overlapStart) },
    { x: round(a1.x + ux * overlapEnd), y: round(a1.y + uy * overlapEnd) },
  ];
}

/** Perpendicular distance from point p to line defined by l1-l2 */
export function pointToLineDistance(p: Point, l1: Point, l2: Point): number {
  const dx = l2.x - l1.x;
  const dy = l2.y - l1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return distance(p, l1);
  return Math.abs(dy * p.x - dx * p.y + l2.x * l1.y - l2.y * l1.x) / Math.sqrt(lenSq);
}

/**
 * Determine if an edge is on the exterior boundary (no room on one side).
 * Tests a point slightly offset from the edge midpoint perpendicular.
 */
export function isEdgeExterior(
  start: Point,
  end: Point,
  allRoomPolygons: Point[][],
  offset = 0.3
): boolean {
  const mid = midpoint(start, end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return false;

  // Normal vector (perpendicular)
  const nx = -dy / len;
  const ny = dx / len;

  const testLeft: Point = { x: mid.x + nx * offset, y: mid.y + ny * offset };
  const testRight: Point = { x: mid.x - nx * offset, y: mid.y - ny * offset };

  let roomsLeft = 0;
  let roomsRight = 0;
  for (const poly of allRoomPolygons) {
    if (pointInPolygon(testLeft, poly)) roomsLeft++;
    if (pointInPolygon(testRight, poly)) roomsRight++;
  }

  // Exterior if one side has no rooms
  return roomsLeft === 0 || roomsRight === 0;
}
