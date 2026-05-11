/**
 * Image generation backend — 공통 인터페이스.
 *
 * 가이드: docs/inpick-image-generation/MODEL_AND_DATA_POLICY.md
 *        reports/FLUX-CONTROLNET-MIGRATION-PLAN-20260510.md (참고: superseded)
 *        c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md (정본)
 *
 * 설계 원칙:
 *   - 백엔드 무관 단일 인터페이스 (OpenAI / RunPod / 미래 BFL 직접 등)
 *   - 응답 shape 호환 (기존 render-room API의 imageUrl/model/costUsd 필드 보존)
 *   - sync/async 모드 둘 다 지원 (production은 async 권장)
 *   - geometry 정보는 optional (구조 파이프라인 점진 도입)
 *
 * 참고: 기존 openai-client.ts의 RenderRoomInput과 호환되되, geometry/camera 추가.
 */

export type ImageBackendName = "openai" | "runpod" | "auto";

/**
 * Render quality tier.
 *  - 가이드 v2 §5-1 (openai-client.ts) 호환: "low" | "medium" | "high"
 *  - 신규 가이드: "draft" | "standard" | "high"
 *  - 둘 다 받음. backend별로 매핑.
 */
export type RenderQuality = "draft" | "standard" | "high" | "low" | "medium";

// ─── Geometry types ───
// 본격 정의: src/lib/inpick/floorplan/geometry-types.ts (Phase 4)
// 호환을 위해 simplified hint는 유지하면서 full type도 re-export.
import type {
  Point2D as GPoint2D,
  RoomGeometry as GRoomGeometry,
  RoomCamera as GRoomCamera,
} from "@/lib/inpick/floorplan/geometry-types";

export type Point2D = GPoint2D;

/** 본격 RoomGeometry (Phase 4+) — RunPod 2.5D proxy 입력 */
export type RoomGeometry = GRoomGeometry;

/** 본격 RoomCamera (Phase 4+) */
export type RoomCamera = GRoomCamera;

/** Phase 1~3 호환용 simplified hint — RoomGeometry로 점진 마이그레이션 */
export interface RoomGeometryHint {
  roomId: string;
  roomName: string;
  polygon?: Point2D[]; // 정규화 좌표 (0~1) 또는 mm 좌표
  estimatedAreaM2?: number;
}

/** Phase 1~3 호환용 simplified camera hint */
export interface RoomCameraHint {
  position: Point2D;
  target: Point2D;
  fovDeg?: number;
  heightM?: number;
}

// ─── Render request (Step2Designer body 호환) ───
export interface RenderRoomRequest {
  // 필수
  roomName: string;
  prompt: string;

  // 방 메타
  roomType?: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  expansion?: boolean;

  // 평면도 reference
  floorplanImageUrl?: string;
  floorplanImageB64?: string;
  propertyId?: string;
  wallLayout?: string; // 자연어 wall 묘사 (Step1 결과)

  // 구조 신뢰성
  windows?: number;
  doors?: number;
  windowWalls?: string[];
  doorWalls?: string[];
  adjacentRooms?: string[];
  isInteriorRoom?: boolean;
  furnishingOptions?: string[];

  // 도면 기반 정확도
  aspectRatio?: number;
  isFromFloorplan?: boolean;
  previousReference?: string;

  // 출력 파라미터
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: RenderQuality;
  stylePreset?: string;
  seed?: number;

  // Geometry-first pipeline (Phase 4+)
  // Phase 4부터는 본격 RoomGeometry/RoomCamera를 권장. Hint는 호환용 폴백.
  roomGeometry?: RoomGeometry | RoomGeometryHint;
  camera?: RoomCamera | RoomCameraHint;

  // Launch-critical RenderRoomSpec (2026-05-11) — 도면 구조 강제
  // 가이드: docs/launch/LAUNCH_ERROR_AUDIT_20260511.md
  renderRoomSpec?: import("@/lib/inpick/floorplan/render-room-spec").RenderRoomSpec;
  /** prompt-compiler가 미리 만든 prompt (지정 시 backend는 이 prompt 사용) */
  compiledPrompt?: string;
  /** 확장형/기본형 등 (공간별) */
  extensionOptions?: import("@/lib/inpick/floorplan/render-room-spec").ExtensionOptions;

  // 콜러 컨텍스트 (env, request id 등)
  requestId?: string;
}

// ─── Render result ───
export type JobStatus = "completed" | "queued" | "processing" | "failed";

export interface RenderRoomResult {
  // 성공 (sync 또는 async 완료 후)
  imageUrl?: string;
  imageBase64?: string; // PoC만 — production은 imageUrl
  revisedPrompt?: string;

  // async용
  jobId?: string;
  status: JobStatus;

  // 메타 (어떤 backend가 성공했는지 추적)
  backend: "openai" | "runpod";
  model: string;
  costUsd?: number;
  elapsedMs?: number;

  // 실패
  error?: string;
  hint?: string;
  modelStatus?: "blocked" | "rate_limited" | "billing" | "auth" | "timeout" | "unknown";

  // 디버그/로깅
  metadata?: Record<string, unknown>;
}

// ─── Backend interface ───
export interface ImageGenerationBackend {
  name: "openai" | "runpod";
  /** 단일 방 렌더 — sync (즉시 반환) 또는 async (jobId 반환) */
  renderRoom(input: RenderRoomRequest): Promise<RenderRoomResult>;
  /** async 모드 시 job 상태 조회 */
  getJobStatus?(jobId: string): Promise<RenderRoomResult>;
}

// ─── Backend selection input ───
export interface BackendSelectionContext {
  preferredBackend?: ImageBackendName; // env IMAGE_GEN_BACKEND
  isProduction: boolean;
  hasOpenAIKey: boolean;
  hasRunpodConfig: boolean;
}
