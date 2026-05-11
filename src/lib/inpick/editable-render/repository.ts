/**
 * Editable Render repository.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  EditableRender,
  EditableRenderLayer,
  EditableRenderLayerRow,
  EditableRenderRow,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export interface CreateEditableRenderInput {
  projectId: string;
  renderId?: string;
  targetId: string;
  targetNameKo?: string;
  projectMode: "residential" | "commercial";
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  renderSpec?: Record<string, unknown>;
}

export async function insertEditableRender(
  input: CreateEditableRenderInput,
): Promise<string | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("editable_renders")
    .insert({
      project_id: input.projectId,
      render_id: input.renderId,
      target_id: input.targetId,
      target_name_ko: input.targetNameKo,
      project_mode: input.projectMode,
      image_url: input.imageUrl,
      image_width: input.imageWidth,
      image_height: input.imageHeight,
      render_spec: input.renderSpec ?? {},
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`[editable-render/repo] insert fail: ${error?.message || "unknown"}`);
    return null;
  }
  return (data as { id: string }).id;
}

export async function insertLayers(
  editableRenderId: string,
  projectId: string,
  layers: EditableRenderLayer[],
): Promise<string[]> {
  const admin = getAdmin();
  if (!admin || layers.length === 0) return [];
  const rows = layers.map((l) => ({
    editable_render_id: editableRenderId,
    project_id: projectId,
    target_id: l.targetId,
    surface_type: l.surfaceType,
    label_ko: l.labelKo,
    label_en: l.labelEn,
    instance_index: l.instanceIndex,
    polygon: l.polygon,
    bbox: l.bbox,
    mask_url: l.maskUrl,
    z_index: l.zIndex,
    plane: l.plane,
    area_m2: l.areaM2,
    confidence: l.confidence,
    source: l.source,
    material_product_id: l.materialProductId,
    material_label: l.materialLabel,
    estimate_line_ids: l.estimateLineIds || [],
    locked: l.locked || false,
    warnings: l.warnings || [],
  }));
  const { data, error } = await admin
    .from("editable_render_layers")
    .insert(rows)
    .select("id");
  if (error || !data) {
    console.warn(`[editable-render/repo] layers insert fail: ${error?.message || "unknown"}`);
    return [];
  }
  return (data as Array<{ id: string }>).map((r) => r.id);
}

export async function getEditableRender(
  id: string,
): Promise<EditableRender | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data: r } = await admin
    .from("editable_renders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const row = r as unknown as EditableRenderRow;
  const { data: layerRows } = await admin
    .from("editable_render_layers")
    .select("*")
    .eq("editable_render_id", id)
    .order("z_index", { ascending: false });
  const layers: EditableRenderLayer[] = ((layerRows || []) as unknown as EditableRenderLayerRow[]).map(
    (lr) => ({
      id: lr.id,
      projectId: lr.project_id,
      renderId: row.render_id,
      targetId: lr.target_id,
      surfaceType: lr.surface_type,
      labelKo: lr.label_ko,
      labelEn: lr.label_en || "",
      instanceIndex: lr.instance_index,
      polygon: lr.polygon,
      bbox: lr.bbox,
      maskUrl: lr.mask_url,
      zIndex: lr.z_index,
      plane: lr.plane,
      areaM2: lr.area_m2,
      confidence: lr.confidence,
      source: lr.source,
      materialProductId: lr.material_product_id,
      materialLabel: lr.material_label,
      estimateLineIds: lr.estimate_line_ids,
      locked: lr.locked,
      warnings: lr.warnings,
    }),
  );
  return {
    id: row.id,
    projectId: row.project_id,
    imageUrl: row.image_url,
    imageWidth: row.image_width || 1024,
    imageHeight: row.image_height || 1024,
    projectMode: row.project_mode,
    targetId: row.target_id,
    targetNameKo: row.target_name_ko || "",
    layers,
    createdAt: row.created_at,
  };
}

export async function updateLayerMaterial(input: {
  layerId: string;
  materialProductId?: string;
  materialLabel?: string;
  estimateLineIds?: string[];
}): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const patch: Record<string, unknown> = {};
  if (input.materialProductId !== undefined) patch.material_product_id = input.materialProductId;
  if (input.materialLabel !== undefined) patch.material_label = input.materialLabel;
  if (input.estimateLineIds !== undefined) patch.estimate_line_ids = input.estimateLineIds;
  const { error } = await admin.from("editable_render_layers").update(patch).eq("id", input.layerId);
  return !error;
}

export async function insertMaterialEdit(input: {
  projectId: string;
  editableRenderId: string;
  layerId: string;
  materialProductId?: string;
  previousMaterialProductId?: string;
  previewImageUrl?: string;
  method: "texture_warp" | "inpaint" | "replace";
  estimateDelta?: Record<string, unknown>;
  createdBy?: string;
}): Promise<string | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("render_material_edits")
    .insert({
      project_id: input.projectId,
      editable_render_id: input.editableRenderId,
      layer_id: input.layerId,
      material_product_id: input.materialProductId,
      previous_material_product_id: input.previousMaterialProductId,
      preview_image_url: input.previewImageUrl,
      method: input.method,
      estimate_delta: input.estimateDelta ?? {},
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`[editable-render/repo] material edit insert fail: ${error?.message}`);
    return null;
  }
  return (data as { id: string }).id;
}
