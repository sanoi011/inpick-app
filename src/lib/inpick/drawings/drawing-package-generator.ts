/**
 * Elevation drawing package generator (Track B Phase 4 — scaffold).
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §12
 *
 * Phase 4 (현재): scaffold + deterministic SVG renderer.
 *   - 실제 ParsedFloorPlan에서 wall geometry 추출은 후속 작업 (Phase 4+)
 *   - 현재는 EstimateDocumentSnapshot의 line/room 정보로 minimal wall spec 생성
 *   - 입면전개도 SVG만 생성 (PDF 패키지는 후속)
 *
 * 정책 (가이드 §11):
 *   - 생성형 이미지 절대 사용 금지
 *   - hash 검증으로 stale 차단
 *   - 자재 미확정 시 "현장 확인 필요" 표시
 */
import type {
  ElevationDrawingSetSpec,
  ElevationDrawingPackageResult,
  ElevationWallSpec,
} from "./elevation-types";
import { renderElevationWallSvg } from "./elevation-svg-renderer";
import { createScopeHashFromProject, createFloorPlanHash, createMaterialHash } from "./drawing-hash";
import type {
  EstimateDocumentSnapshotRow,
  EstimateDocumentLine,
} from "../estimate-documents/types";

export interface GenerateElevationPackageInput {
  projectId: string;
  contractId: string;
  contractorId: string;
  estimateDocument: EstimateDocumentSnapshotRow;
}

/**
 * 단순 구현: estimate line의 roomName + surfaceType → wall spec.
 *
 * Phase 4+에서 실제 ParsedFloorPlan에서 polygon → wall geometry 추출 + 4면 (A/B/C/D)
 * + opening 좌표 + 자재 매칭.
 */
export function generateElevationDrawingSet(
  input: GenerateElevationPackageInput,
): ElevationDrawingSetSpec {
  const project = input.estimateDocument.project_snapshot;
  const lines = input.estimateDocument.line_snapshot;
  const warnings: string[] = [];

  // hash 계산
  const scopeHash = createScopeHashFromProject(project);
  const floorPlanHash = createFloorPlanHash({ projectId: project.projectId });
  const materialHash = createMaterialHash(lines);

  // 방별 그룹
  const byRoom = new Map<string, EstimateDocumentLine[]>();
  for (const l of lines) {
    if (!l.roomName) continue;
    if (!byRoom.has(l.roomName)) byRoom.set(l.roomName, []);
    byRoom.get(l.roomName)!.push(l);
  }

  const walls: ElevationWallSpec[] = [];
  for (const [roomName, roomLines] of Array.from(byRoom.entries())) {
    // 4면 (A/B/C/D) — placeholder dimensions
    const wallLabels = ["A", "B", "C", "D"];
    for (const label of wallLabels) {
      walls.push({
        roomId: `room_${roomName}`,
        roomName,
        wallId: `wall_${roomName}_${label}`,
        wallLabel: label,
        widthMm: 3500, // placeholder — 후속에서 실제 geometry
        heightMm: 2400,
        openings: [], // 후속에서 실제 opening 좌표
        finishes: roomLines
          .filter((l) => l.materialAmount && l.materialAmount > 0)
          .slice(0, 5)
          .map((l) => ({
            surfaceType: l.tradeCode,
            materialProductId: l.materialProductId,
            brand: l.brand,
            productName: l.itemName,
            sku: l.sku,
            confidence: l.confidence,
            notes: l.notes,
          })),
        dimensions: [
          {
            from: { xMm: 0, yMm: 0 },
            to: { xMm: 3500, yMm: 0 },
            label: "3500mm",
          },
        ],
        warnings: roomLines.some((l) => !l.materialProductId)
          ? ["자재 미확정 라인 있음 — 현장 확인 필요"]
          : [],
        confidence: 0.6, // placeholder
      });
    }
  }

  if (walls.length === 0) {
    warnings.push("EMPTY_WALL_SPECS — estimate line에 roomName 정보가 부족");
  }

  return {
    projectId: input.projectId,
    contractId: input.contractId,
    contractorId: input.contractorId,
    estimateDocumentId: input.estimateDocument.id,
    floorPlanHash,
    roomGeometryHash: floorPlanHash, // placeholder
    materialHash,
    scopeHash,
    walls,
    warnings,
  };
}

/**
 * 입면전개도 SVG 일괄 생성.
 * 반환: roomName + wallLabel → SVG 문자열.
 */
export function renderElevationSvgs(
  spec: ElevationDrawingSetSpec,
): Array<{ roomName: string; wallLabel: string; svg: string }> {
  return spec.walls.map((w) => ({
    roomName: w.roomName,
    wallLabel: w.wallLabel,
    svg: renderElevationWallSvg(w),
  }));
}
