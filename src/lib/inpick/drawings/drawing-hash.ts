/**
 * 도면 hash 생성/검증.
 *
 * 정책:
 *   - drawingSet 다운로드 시 현재 scope/floorplan/material hash와 비교
 *   - 불일치하면 DRAWING_SET_STALE_REGENERATE_REQUIRED 반환
 */
import crypto from "node:crypto";

export function createFloorPlanHash(parsedFloorPlan: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(parsedFloorPlan))
    .digest("hex")
    .slice(0, 16);
}

export function createMaterialHash(materials: unknown[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(materials))
    .digest("hex")
    .slice(0, 16);
}

export function createScopeHashFromProject(scope: {
  projectId: string;
  propertyId?: string;
  addressText?: string;
  exclusiveAreaM2?: number;
  expansionOption?: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        p: scope.projectId,
        pr: scope.propertyId,
        a: scope.addressText,
        e: scope.exclusiveAreaM2,
        x: scope.expansionOption,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

export function assertDrawingMatchesProject(input: {
  drawingSet: { source_scope_hash?: string; source_floorplan_hash?: string; source_material_hash?: string };
  currentScopeHash: string;
  currentFloorPlanHash: string;
  currentMaterialHash: string;
}): void {
  if (input.drawingSet.source_scope_hash !== input.currentScopeHash) {
    throw new Error("DRAWING_SET_STALE_REGENERATE_REQUIRED: scope_hash mismatch");
  }
  if (input.drawingSet.source_floorplan_hash !== input.currentFloorPlanHash) {
    throw new Error("DRAWING_SET_STALE_REGENERATE_REQUIRED: floorplan_hash mismatch");
  }
  if (input.drawingSet.source_material_hash !== input.currentMaterialHash) {
    throw new Error("DRAWING_SET_STALE_REGENERATE_REQUIRED: material_hash mismatch");
  }
}
