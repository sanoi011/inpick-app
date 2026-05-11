/**
 * RenderRoomSpec — 출시 v0 도면 구조 강제 객체.
 *
 * 가이드: c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md §5
 *
 * 목적:
 *   - "안방 ↔ 안방발코니" 같은 공간 관계를 hard constraint로 명시
 *   - OpenAI gpt-image-2 prompt에 ARCHITECTURAL FACTS / MUST SHOW / MUST NOT SHOW 강제
 *   - RunPod backend도 같은 spec을 입력받음 (eval 통과 후 활성)
 *
 * 정책:
 *   - opening.kind="exterior_window"이면 toRoomId 가지면 안 됨
 *   - toRoom이 발코니/베란다/대피공간/실외기실이면 → balcony_sliding_door 강제
 *   - 안방 + 안방발코니 adjacent + opening 없음 → inferred sliding door 자동 생성
 */

export interface Point {
  x: number;
  y: number;
}

export type RoomType =
  | "living_room"
  | "master_bedroom"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "balcony"
  | "service_balcony"
  | "utility"
  | "closet"
  | "corridor"
  | "dress_room"
  | "evacuation_space"
  | "mechanical_room"
  | "entrance"
  | "unknown";

export type OpeningKind =
  | "interior_door"
  | "sliding_door"
  | "balcony_sliding_door"
  | "exterior_window"
  | "interior_window"
  | "open_passage"
  | "closet_door"
  | "unknown";

export type BalconyTreatment =
  | "unextended"
  | "extended"
  | "semi_extended"
  | "unknown";

export type AttachedZoneType =
  | "balcony"
  | "service_balcony"
  | "utility"
  | "closet"
  | "dress_room"
  | "evacuation_space"
  | "mechanical_room";

// ─── Spec building blocks ───
export interface RoomNode {
  id: string;
  name: string;
  type: RoomType;
  polygon?: Point[];
  bbox?: { x: number; y: number; width: number; height: number };
  areaM2?: number;
  confidence?: number;
}

export interface OpeningEdge {
  id: string;
  kind: OpeningKind;
  fromRoomId: string;
  toRoomId?: string;
  toExterior?: boolean;
  wallId?: string;
  position?: Point;
  widthM?: number;
  confidence: number;
  mustRender: boolean;
  source: "detected" | "inferred" | "user_corrected";
}

export interface AttachedZone {
  id: string;
  name: string;
  type: AttachedZoneType;
  attachedToRoomId: string;
  treatment: BalconyTreatment;
  polygon?: Point[];
  bbox?: { x: number; y: number; width: number; height: number };
  accessOpeningId?: string;
  confidence: number;
}

export interface ExteriorWall {
  wallId: string;
  roomId: string;
  hasExteriorWindow: boolean;
  confidence: number;
}

export interface ExtensionOptions {
  livingRoomBalcony?: "extended" | "unextended" | "unknown";
  masterBedroomBalcony?: "extended" | "unextended" | "unknown";
  bedroomBalconies?: Record<string, "extended" | "unextended" | "unknown">;
  kitchenServiceBalcony?: "extended" | "unextended" | "unknown";
}

export interface RenderConstraints {
  /** 반드시 이미지에 표현되어야 하는 항목 (한국어 자연어 + 영문) */
  mustShow: string[];
  /** 절대 표현되면 안 되는 항목 */
  mustNotShow: string[];
  cameraFacing?:
    | "north"
    | "south"
    | "east"
    | "west"
    | "balcony_wall"
    | "main_wall"
    | "unknown";
  /** UI 표시용 한국어 설명 */
  explanationKo: string;
}

export interface RenderRoomSpec {
  /** 메인 타겟 방 (이미지 생성 대상) */
  targetRoom: RoomNode;
  /** 같은 도면의 모든 방 (그래프 context용) */
  rooms: RoomNode[];
  /** 타겟 방에 부속된 zone (안방발코니 등) */
  attachedZones: AttachedZone[];
  /** 타겟 방과 직접 연결된 opening (또는 attached zone 경유 opening) */
  openings: OpeningEdge[];
  exteriorWalls: ExteriorWall[];
  extensionOptions: ExtensionOptions;
  renderConstraints: RenderConstraints;
  /** spec 전체 신뢰도 (0~1) */
  confidence: number;
  /** UI에 보여줄 warning 메시지 */
  warnings: string[];
}

// ─── 헬퍼 ───
/**
 * 두 polygon 간 공유 edge가 있는지 (인접 판정용).
 * 가이드 §7-2 인접 우선순위:
 *   1. polygon shared edge overlap >= 20%
 *   2. polygon edge distance <= 0.15m
 *   3. bbox distance <= 8px 또는 도면 scale 환산 0.20m
 */
export function polygonsAreAdjacent(
  a: Point[],
  b: Point[],
  options: { edgeOverlapThreshold?: number; edgeDistanceThreshold?: number } = {},
): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const overlapTh = options.edgeOverlapThreshold ?? 0.2;
  const distTh = options.edgeDistanceThreshold ?? 0.15;

  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      const segDist = segmentDistance(a1, a2, b1, b2);
      if (segDist <= distTh) return true;
      const overlap = segmentOverlapRatio(a1, a2, b1, b2);
      if (overlap >= overlapTh) return true;
    }
  }
  return false;
}

/**
 * 두 line segment 간 최소 거리.
 */
function segmentDistance(p1: Point, p2: Point, p3: Point, p4: Point): number {
  return Math.min(
    pointToSegment(p1, p3, p4),
    pointToSegment(p2, p3, p4),
    pointToSegment(p3, p1, p2),
    pointToSegment(p4, p1, p2),
  );
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * 두 line segment가 같은 방향일 때 겹치는 비율 (0~1).
 * 비슷한 방향 + 가까이면 overlap 측정.
 */
function segmentOverlapRatio(p1: Point, p2: Point, p3: Point, p4: Point): number {
  // 방향 벡터
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const len1 = Math.hypot(v1.x, v1.y);
  const len2 = Math.hypot(v2.x, v2.y);
  if (len1 < 1e-6 || len2 < 1e-6) return 0;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
  // 거의 같은 또는 반대 방향만 (|cos| ~ 1)
  if (Math.abs(cos) < 0.9) return 0;
  // p1-p2 직선에 p3, p4 정사영 후 overlap 길이 / min(len1, len2)
  const t3 = ((p3.x - p1.x) * v1.x + (p3.y - p1.y) * v1.y) / (len1 * len1);
  const t4 = ((p4.x - p1.x) * v1.x + (p4.y - p1.y) * v1.y) / (len1 * len1);
  const tMin = Math.max(0, Math.min(t3, t4));
  const tMax = Math.min(1, Math.max(t3, t4));
  if (tMax <= tMin) return 0;
  return (tMax - tMin) * len1 / Math.min(len1, len2);
}

/**
 * bbox 거리 (정규화 단위).
 */
export function bboxDistance(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const dx = Math.max(0, Math.max(a.x - bx2, b.x - ax2));
  const dy = Math.max(0, Math.max(a.y - by2, b.y - ay2));
  return Math.hypot(dx, dy);
}
