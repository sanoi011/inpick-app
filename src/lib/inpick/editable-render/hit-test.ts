/**
 * Hit-test — 클릭 좌표 → layer 선택.
 *
 * 가이드: §10-3
 *
 * 정책:
 *   - point in polygon (ray casting)
 *   - 여러 layer 매칭 시 zIndex DESC + confidence DESC 정렬
 *   - 매칭 없으면 SAM2 point prompt fallback (호출자 책임)
 */

import type { EditableRenderLayer } from "./types";

/** Point-in-polygon (ray casting). normalized 0~1 좌표 가정. */
export function pointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 클릭 좌표에서 매칭되는 모든 layer 반환 (zIndex DESC + confidence DESC 정렬).
 */
export function hitTestLayers(
  point: { x: number; y: number },
  layers: EditableRenderLayer[],
): EditableRenderLayer[] {
  const matched = layers.filter((l) => pointInPolygon(point, l.polygon));
  matched.sort((a, b) => {
    if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
    return b.confidence - a.confidence;
  });
  return matched;
}

/**
 * 클릭 좌표 → 단일 layer 선택 (top-1).
 */
export function selectLayerAt(
  point: { x: number; y: number },
  layers: EditableRenderLayer[],
): EditableRenderLayer | null {
  const hits = hitTestLayers(point, layers);
  return hits[0] || null;
}

/**
 * bbox 기반 빠른 사전 필터 (large dataset 최적화용).
 */
export function pointInBBox(
  point: { x: number; y: number },
  bbox: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.width &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.height
  );
}
