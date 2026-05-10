/**
 * Control plan — Phase 4.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §7-3 (fallback baseline)
 *
 * 책임:
 *   - 어떤 control image (perspective canny / depth / segmentation / floorplan canny)를 사용할지 결정
 *   - geometry 유무에 따라 다른 plan 반환
 *   - flat floorplan canny는 baseline 태깅 (구조 정확도 X — 비교용)
 *
 * RunPod handler가 이 plan을 보고 control image를 생성/선택.
 *
 * 평가 (Phase 7):
 *   - flat baseline (A) vs geometry proxy (B) 나란히 비교
 *   - 평가 지표: 방 형태/문창 위치/벽 개수 일치율
 */

import type { RoomCamera, RoomGeometry } from "./geometry-types";

// ─── Control 모드 ───
export type ControlMode =
  | "geometry_proxy"      // RoomGeometry → 2.5D proxy → perspective canny/depth/seg
  | "floorplan_canny"     // 평면도 이미지 → flat canny baseline
  | "prompt_only"         // control 없음, 텍스트만
  | "openai_edit";        // OpenAI EDITS API (현재 default — gpt-image-2)

// ─── 개별 control image ───
export interface ControlImagePlan {
  /** "perspective_canny" | "depth" | "segmentation" | "floorplan_canny" */
  kind:
    | "perspective_canny"
    | "depth"
    | "segmentation"
    | "wall_mask"
    | "floor_mask"
    | "floorplan_canny";
  /** ControlNet 강도 (0~1) — Flux 기준 0.5~0.7 권장 */
  strength: number;
  /** baseline 태깅 — 평가 시 비교 기준임을 명시 */
  isBaseline?: boolean;
}

// ─── ControlPlan ───
export interface ControlPlan {
  mode: ControlMode;
  /** 사용할 control image들 */
  images: ControlImagePlan[];
  /** 카메라 정보 (geometry_proxy 모드에만 의미) */
  camera?: RoomCamera;
  /** 디버그/평가용 메타 */
  notes?: string;
}

// ─── Plan 결정 입력 ───
export interface ControlPlanInput {
  geometry?: RoomGeometry | null;
  camera?: RoomCamera | null;
  hasFloorplanImage: boolean;
  /** 백엔드 기본 mode 힌트 (env IMAGE_GEN_BACKEND) */
  preferredBackend?: "openai" | "runpod" | "auto";
  /** 사용자/관리자가 baseline 강제 비교 (Phase 7 평가 시 true) */
  forceBaseline?: boolean;
  /** controlStrength override */
  controlStrength?: number;
}

// ─── 기본 카메라 ───
/**
 * Geometry가 있는데 camera가 없으면 — 방 중심에서 한 모서리 쪽 시점으로 추정.
 * 정규화 좌표(0~1) 기준.
 */
export function defaultCameraForRoom(geometry: RoomGeometry): RoomCamera {
  if (geometry.polygon.length === 0) {
    return {
      position: { x: 0.5, y: 0.9 },
      target: { x: 0.5, y: 0.5 },
      fovDeg: 70,
      heightM: 1.45,
    };
  }
  // 중심
  let sx = 0;
  let sy = 0;
  for (const p of geometry.polygon) {
    sx += p.x;
    sy += p.y;
  }
  const cx = sx / geometry.polygon.length;
  const cy = sy / geometry.polygon.length;
  // 카메라는 한 변에서 안쪽으로 (남향벽 기준)
  return {
    position: { x: cx, y: Math.min(cy + 0.4, 0.95) },
    target: { x: cx, y: cy },
    fovDeg: 70,
    heightM: 1.45,
  };
}

// ─── 메인 ───
/**
 * 입력 상황을 보고 적절한 ControlPlan 생성.
 *
 * 우선순위:
 *   1. forceBaseline=true → floorplan_canny baseline (Phase 7 평가용)
 *   2. preferredBackend="openai" → openai_edit (현재 production default)
 *   3. geometry 있음 + RunPod 백엔드 → geometry_proxy (perspective canny+depth+seg)
 *   4. floorplan 이미지 있음 → floorplan_canny baseline
 *   5. 그 외 → prompt_only
 */
export function buildControlPlan(input: ControlPlanInput): ControlPlan {
  const strength = input.controlStrength ?? 0.65;

  // 1. 강제 baseline (평가 모드)
  if (input.forceBaseline && input.hasFloorplanImage) {
    return {
      mode: "floorplan_canny",
      images: [
        { kind: "floorplan_canny", strength, isBaseline: true },
      ],
      notes: "forceBaseline=true — Phase 7 평가용 baseline",
    };
  }

  // 2. OpenAI 백엔드 (현재 default)
  if (input.preferredBackend === "openai") {
    return {
      mode: "openai_edit",
      images: [],
      notes:
        "OpenAI EDITS API 사용 — control image 무시, 평면도 이미지가 mask로 들어감",
    };
  }

  // 3. Geometry 기반 (RunPod 백엔드)
  if (input.geometry && input.geometry.polygon.length >= 3) {
    const camera = input.camera || defaultCameraForRoom(input.geometry);
    return {
      mode: "geometry_proxy",
      images: [
        { kind: "perspective_canny", strength },
        { kind: "depth", strength: strength * 0.8 },
        { kind: "segmentation", strength: strength * 0.7 },
        { kind: "wall_mask", strength: strength * 0.6 },
        { kind: "floor_mask", strength: strength * 0.6 },
      ],
      camera,
      notes: `geometry source=${input.geometry.source}, walls=${input.geometry.walls.length}, openings=${input.geometry.openings.length}`,
    };
  }

  // 4. Floorplan canny baseline (geometry 없을 때)
  if (input.hasFloorplanImage) {
    return {
      mode: "floorplan_canny",
      images: [
        { kind: "floorplan_canny", strength: strength * 0.5, isBaseline: true },
      ],
      notes: "geometry 없음 — flat floorplan canny baseline (구조 정확도 낮음, 비교용)",
    };
  }

  // 5. Prompt only
  return {
    mode: "prompt_only",
    images: [],
    notes: "geometry/floorplan 둘 다 없음 — prompt만 사용",
  };
}

// ─── ControlPlan → RunPod handler input 직렬화 ───
/**
 * RunPod handler가 받을 control 블록 (가이드 §6-2 RunPod handler 입력 예시).
 *
 * 가이드 형식:
 *   "control": {
 *     "usePerspectiveCanny": true,
 *     "useDepth": true,
 *     "useSegmentation": true,
 *     "controlStrength": 0.65
 *   }
 */
export function controlPlanToHandlerControl(plan: ControlPlan): {
  usePerspectiveCanny: boolean;
  useDepth: boolean;
  useSegmentation: boolean;
  useWallMask: boolean;
  useFloorMask: boolean;
  useFloorplanCanny: boolean;
  controlStrength: number;
  isBaseline: boolean;
} {
  const hasKind = (k: ControlImagePlan["kind"]) =>
    plan.images.some((img) => img.kind === k);
  // 평균 strength
  const totalStrength = plan.images.reduce((a, b) => a + b.strength, 0);
  const avgStrength =
    plan.images.length > 0 ? totalStrength / plan.images.length : 0;
  return {
    usePerspectiveCanny: hasKind("perspective_canny"),
    useDepth: hasKind("depth"),
    useSegmentation: hasKind("segmentation"),
    useWallMask: hasKind("wall_mask"),
    useFloorMask: hasKind("floor_mask"),
    useFloorplanCanny: hasKind("floorplan_canny"),
    controlStrength: Number(avgStrength.toFixed(3)),
    isBaseline: plan.images.some((img) => img.isBaseline === true),
  };
}
