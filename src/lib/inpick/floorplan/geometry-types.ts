/**
 * Floorplan geometry 타입 — Phase 4.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §5 (공통 타입 설계) + §7 (도면 구조 파이프라인)
 *
 * 책임:
 *   - 도면에서 추출된/수동 입력된 방 geometry의 단일 진실 소스
 *   - 평면도(top-down) 좌표계: x→오른쪽, y→아래 (이미지 좌표 호환). 정규화(0~1) 또는 mm.
 *   - 벽/개구부/카메라 메타로 RunPod worker가 2.5D proxy 생성 가능
 *
 * source 구분:
 *   - "manual": 사용자가 직접 입력
 *   - "heuristic": 단순 룰 기반 추출 (parser.ts)
 *   - "model": AI 모델 (Gemini Vision 등) 추출
 *   - "db": Supabase에 캐시된 결과
 *
 * 좌표 단위 정책:
 *   - normalizeMode="ratio": polygon/walls/openings 좌표는 0~1 정규화 (도면 이미지 기준)
 *   - normalizeMode="mm": 좌표는 mm 단위 (실측)
 *   - 둘 다 허용. RunPod worker가 image 좌표로 변환 시 사용.
 *
 * 호환:
 *   - 기존 floorplan-storage.ts, parsed-floorplan.ts와 별도 (이미지 생성 백엔드 전용)
 *   - 기존 image-backends/types.ts의 RoomGeometryHint는 simplified 버전 — 이 파일이 본격
 */

// ─── 기본 ───
export interface Point2D {
  x: number;
  y: number;
}

/** 좌표 정규화 모드 */
export type GeometryNormalizeMode = "ratio" | "mm";

// ─── 벽 ───
export interface WallSegment {
  id: string;
  from: Point2D;
  to: Point2D;
  /** 외벽/내벽 — proxy 두께/depth에 사용 */
  kind: "interior" | "exterior";
  /** 벽 두께 (mm) — 미지정 시 외벽=200, 내벽=100 기본 */
  thicknessMm?: number;
}

// ─── 개구부 (문/창/오픈) ───
export type OpeningKind = "door" | "window" | "opening";

export interface Opening {
  id: string;
  type: OpeningKind;
  /** 어느 벽에 위치하는지 (WallSegment.id) */
  wallId: string;
  /** 벽 시작점 기준 0~1 위치비 */
  positionRatio: number;
  /** 벽 길이 대비 폭 비율 (0~1). 미지정 시 기본 door=0.15, window=0.25 */
  widthRatio?: number;
  /** 바닥에서 개구부 하단까지 높이 (mm) — window=900, door=0 기본 */
  sillHeightMm?: number;
  /** 개구부 높이 (mm) — door=2100, window=1200 기본 */
  heightMm?: number;
}

// ─── 카메라 ───
export interface RoomCamera {
  /** 평면도 좌표계의 카메라 위치 */
  position: Point2D;
  /** 카메라가 바라보는 타깃 (보통 방 중심) */
  target: Point2D;
  /** Field of view (도) — 기본 70 */
  fovDeg: number;
  /** 카메라 높이 (m) — 기본 1.45 (eye-level) */
  heightM?: number;
}

// ─── 방 geometry ───
export type GeometrySource = "manual" | "heuristic" | "model" | "db";

export interface RoomGeometry {
  roomId: string;
  roomName: string;
  /** 방 폴리곤 (CCW 권장). 좌표는 normalizeMode를 따름. */
  polygon: Point2D[];
  /** 방을 구성하는 벽 목록 */
  walls: WallSegment[];
  /** 문/창/오픈 */
  openings: Opening[];
  /** 추정 면적 (m²). 검증/디버그용 */
  estimatedAreaM2?: number;
  /** 좌표 정규화 모드 (기본 "ratio") */
  normalizeMode?: GeometryNormalizeMode;
  /** 천장 높이 (mm) — 기본 2400 (한국 아파트) */
  ceilingHeightMm?: number;
  /** geometry 출처 — 신뢰도 평가용 */
  source: GeometrySource;
  /** 추가 메타 (parser version, confidence 등) */
  metadata?: Record<string, unknown>;
}

// ─── 평면도 전체 (방 여러 개) ───
export interface FloorplanGeometry {
  /** propertyId 또는 도면 id */
  floorplanId: string;
  /** 도면 이미지 URL (control image 생성용) */
  floorplanImageUrl?: string;
  /** 도면 이미지 픽셀 크기 (정규화 좌표 → 픽셀 변환용) */
  imageSize?: { widthPx: number; heightPx: number };
  /** 모든 방 */
  rooms: RoomGeometry[];
  /** 좌표 정규화 모드 (rooms 전체 default) */
  normalizeMode: GeometryNormalizeMode;
  /** floorplan source */
  source: GeometrySource;
  /** 메타 (parser version, address 등) */
  metadata?: Record<string, unknown>;
}

// ─── 검증 헬퍼 ───
/** 폴리곤 면적 (Shoelace). 좌표 단위에 따라 결과 단위 다름. */
export function polygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** 폴리곤 중심점 */
export function polygonCentroid(polygon: Point2D[]): Point2D {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of polygon) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / polygon.length, y: sy / polygon.length };
}

/** 벽 길이 */
export function wallLength(wall: WallSegment): number {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** RoomGeometry 기본 검증 — 명백한 오류만 잡음 */
export function validateRoomGeometry(g: RoomGeometry): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!g.roomId) errors.push("roomId 누락");
  if (!g.roomName) errors.push("roomName 누락");
  if (g.polygon.length < 3) errors.push("polygon 정점 3개 미만");
  for (const o of g.openings) {
    if (!g.walls.find((w) => w.id === o.wallId)) {
      errors.push(`opening ${o.id}의 wallId(${o.wallId}) 미존재`);
    }
    if (o.positionRatio < 0 || o.positionRatio > 1) {
      errors.push(`opening ${o.id} positionRatio 범위 밖 (${o.positionRatio})`);
    }
  }
  return { ok: errors.length === 0, errors };
}
