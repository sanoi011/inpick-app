/**
 * Elevation drawing package — 입면전개도 타입 (Track B Phase 4).
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §11~13
 *
 * 정책:
 *   - 생성형 AI 절대 사용 금지 (정확도 보장)
 *   - ParsedFloorPlan + RoomGeometry + RenderRoomSpec + EstimateSnapshot 기반 deterministic
 *   - hash 검증으로 다른 프로젝트 도면 잘못 제공 방지
 */

export interface ElevationDrawingSetInput {
  projectId: string;
  contractId: string;
  contractorId: string;
  estimateDocumentId: string;
}

export interface ElevationOpeningSpec {
  id: string;
  /** 'door' | 'window' | 'balcony_sliding_door' | 'opening' | 'unknown' */
  kind: string;
  /** 벽 좌측 끝에서부터 mm */
  xMm: number;
  /** 바닥에서 mm */
  yMm: number;
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface ElevationFinishSpec {
  /** 'wall' | 'floor' | 'ceiling' | 'tile' | 'baseboard' | 'fixture' */
  surfaceType: string;
  materialProductId?: string;
  brand?: string;
  productName?: string;
  sku?: string;
  areaM2?: number;
  confidence?: number;
  notes?: string;
}

export interface ElevationDimensionSpec {
  from: { xMm: number; yMm: number };
  to: { xMm: number; yMm: number };
  label: string;
}

export interface ElevationWallSpec {
  roomId: string;
  roomName: string;
  wallId: string;
  /** 'A' | 'B' | 'C' | 'D' — 방의 4면 라벨 */
  wallLabel: string;
  direction?: "north" | "east" | "south" | "west" | "unknown";
  widthMm: number;
  heightMm: number;
  openings: ElevationOpeningSpec[];
  finishes: ElevationFinishSpec[];
  dimensions: ElevationDimensionSpec[];
  warnings: string[];
  confidence: number;
}

export interface ElevationDrawingSetSpec {
  projectId: string;
  contractId: string;
  contractorId: string;
  estimateDocumentId: string;
  floorPlanHash: string;
  roomGeometryHash: string;
  materialHash: string;
  scopeHash: string;
  walls: ElevationWallSpec[];
  warnings: string[];
}

export interface ElevationDrawingPackageResult {
  drawingSetId: string;
  pdfUrl: string;
  drawingCount: number;
  warnings: string[];
  scopeHash: string;
}
