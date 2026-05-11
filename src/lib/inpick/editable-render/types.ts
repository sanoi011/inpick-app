/**
 * Editable Render Layer 타입.
 *
 * 가이드: c:\Users\user\Downloads\inpick-commercial-editable-render-workflow-plan-20260511.md §4-1
 *
 * 핵심:
 *   - 1차 AI 렌더 이미지를 부위별 polygon/mask layer로 분해
 *   - 클릭 hit-test → 정확한 layer 선택
 *   - 자재 변경 → texture warp 또는 mask inpainting
 *   - 견적 라인과 연결 (estimate_line_ids)
 */

import type { ProjectMode } from "@/lib/inpick/workflow/project-mode";

export type SurfaceType =
  | "floor"
  | "wall"
  | "ceiling"
  | "window"
  | "door"
  | "baseboard"
  | "molding"
  | "counter"
  | "cabinet"
  | "tile_wall"
  | "fixture"
  | "signage"
  | "storefront_glass"
  | "facade_wall"
  | "furniture"
  | "unknown";

export type SurfaceSource =
  | "geometry_prior"
  | "grounding_dino"
  | "sam2"
  | "openai_vision"
  | "manual_user"
  | "merged";

export type SurfacePlane =
  | "floor"
  | "left_wall"
  | "right_wall"
  | "back_wall"
  | "ceiling"
  | "object";

export interface EditableRenderLayer {
  id: string;
  projectId: string;
  renderId?: string;
  targetId: string;
  surfaceType: SurfaceType;
  labelKo: string;
  labelEn: string;
  /** 고유 인스턴스 인덱스 — wall_back_001 같은 ID 만들 때 사용 */
  instanceIndex: number;
  /** normalized 0~1 image coords */
  polygon: Array<{ x: number; y: number }>;
  bbox: { x: number; y: number; width: number; height: number };
  maskUrl?: string;
  zIndex: number;
  plane?: SurfacePlane;
  areaM2?: number;
  confidence: number;
  source: SurfaceSource;
  materialProductId?: string;
  materialLabel?: string;
  estimateLineIds?: string[];
  locked?: boolean;
  warnings?: string[];
}

export interface EditableRender {
  id: string;
  projectId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  projectMode: ProjectMode;
  targetId: string;
  targetNameKo: string;
  layers: EditableRenderLayer[];
  createdAt: string;
}

// ─── DB row 변환 (snake_case) ───
export interface EditableRenderRow {
  id: string;
  project_id: string;
  render_id?: string;
  target_id: string;
  target_name_ko?: string;
  project_mode: ProjectMode;
  image_url: string;
  image_width?: number;
  image_height?: number;
  render_spec?: Record<string, unknown>;
  layer_summary?: Record<string, unknown>;
  created_at: string;
}

export interface EditableRenderLayerRow {
  id: string;
  editable_render_id: string;
  project_id: string;
  target_id: string;
  surface_type: SurfaceType;
  label_ko: string;
  label_en?: string;
  instance_index: number;
  polygon: Array<{ x: number; y: number }>;
  bbox: { x: number; y: number; width: number; height: number };
  mask_url?: string;
  z_index: number;
  plane?: SurfacePlane;
  area_m2?: number;
  confidence: number;
  source: SurfaceSource;
  material_product_id?: string;
  material_label?: string;
  estimate_line_ids?: string[];
  locked?: boolean;
  warnings?: string[];
  created_at: string;
  updated_at: string;
}

// ─── helper ───
export function makeLayerId(
  surfaceType: SurfaceType,
  plane: SurfacePlane | undefined,
  instance: number,
): string {
  const pp = plane && plane !== "object" ? plane : surfaceType;
  return `${pp}_${String(instance).padStart(3, "0")}`;
}

export function surfaceTypeLabelKo(t: SurfaceType): string {
  const map: Record<SurfaceType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    window: "창문",
    door: "문",
    baseboard: "걸레받이",
    molding: "몰딩",
    counter: "카운터",
    cabinet: "수납장",
    tile_wall: "타일벽",
    fixture: "설비",
    signage: "간판",
    storefront_glass: "쇼윈도",
    facade_wall: "외부벽",
    furniture: "가구",
    unknown: "기타",
  };
  return map[t] || "기타";
}
