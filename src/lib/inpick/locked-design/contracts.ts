export interface LockedAssetRow {
  id: string;
  design_output_id: string;
  project_id: string;
  target_type: string;
  target_id: string;
  target_name: string;
  render_kind: string;
  status: string;
  unlock_cost: number;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
  grant_id?: string | null;
  [key: string]: unknown;
}

export interface SanitizedLockedAsset {
  id: string;
  designOutputId: string;
  projectId: string;
  targetType: string;
  targetId: string;
  targetName: string;
  renderKind: string;
  status: string;
  unlockCost: number;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
  unlocked: boolean;
}

export interface LockedDeliveryRequest {
  projectId: string;
  projectMode: "apartment" | "photo_only" | "commercial";
  targetType: "whole" | "room" | "zone" | "surface";
  targetId: string;
  targetName: string;
  renderKind: "full_render" | "room_render" | "zone_render" | "surface_render" | "space_edit";
  unlockCost: 1;
  negativePrompt?: string;
  prompt?: string;
}

export function sanitizeLockedAsset(row: LockedAssetRow): SanitizedLockedAsset {
  return {
    id: row.id,
    designOutputId: row.design_output_id,
    projectId: row.project_id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    renderKind: row.render_kind,
    status: row.status,
    unlockCost: row.unlock_cost,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    unlocked: typeof row.grant_id === "string" && row.grant_id.length > 0,
  };
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function validateIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_KEY_PATTERN.test(value);
}
