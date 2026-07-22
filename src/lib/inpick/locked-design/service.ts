import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeImageSource,
  removeLockedDesignImage,
  uploadLockedDesignImage,
} from "@/lib/inpick/storage/image-storage";
import { sanitizeLockedAsset, type SanitizedLockedAsset } from "./contracts";

const PROJECT_MODES = new Set(["apartment", "photo_only", "commercial"]);
const TARGET_TYPES = new Set(["whole", "room", "zone", "surface"]);
const RENDER_KINDS = new Set([
  "full_render",
  "room_render",
  "zone_render",
  "surface_render",
  "space_edit",
]);

export class LockedDesignRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LockedDesignRequestError";
  }
}

export interface RegisterLockedDesignInput {
  projectId: string;
  projectMode: string;
  targetType: string;
  targetId: string;
  targetName: string;
  renderKind: string;
  imageSource: string;
  unlockCost: number;
  prompt?: string;
  negativePrompt?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRegisterInput(value: unknown): RegisterLockedDesignInput {
  if (!value || typeof value !== "object") throw new LockedDesignRequestError("INVALID_BODY", 400);
  const body = value as Record<string, unknown>;
  const requiredStrings = [
    "projectId",
    "projectMode",
    "targetType",
    "targetId",
    "targetName",
    "renderKind",
    "imageSource",
  ] as const;
  for (const key of requiredStrings) {
    if (typeof body[key] !== "string" || body[key].length === 0) {
      throw new LockedDesignRequestError("MISSING_REQUIRED_FIELDS", 400);
    }
  }
  if (!UUID_PATTERN.test(body.projectId as string)) throw new LockedDesignRequestError("INVALID_PROJECT_ID", 400);
  if (!PROJECT_MODES.has(body.projectMode as string)) throw new LockedDesignRequestError("INVALID_PROJECT_MODE", 400);
  if (!TARGET_TYPES.has(body.targetType as string)) throw new LockedDesignRequestError("INVALID_TARGET_TYPE", 400);
  if (!RENDER_KINDS.has(body.renderKind as string)) throw new LockedDesignRequestError("INVALID_RENDER_KIND", 400);
  if ((body.targetId as string).length > 200 || (body.targetName as string).length > 200) {
    throw new LockedDesignRequestError("TARGET_TOO_LONG", 400);
  }
  if (!Number.isInteger(body.unlockCost) || (body.unlockCost as number) < 1 || (body.unlockCost as number) > 1000) {
    throw new LockedDesignRequestError("INVALID_UNLOCK_COST", 400);
  }
  if (body.prompt !== undefined && typeof body.prompt !== "string") {
    throw new LockedDesignRequestError("INVALID_PROMPT", 400);
  }
  if (body.negativePrompt !== undefined && typeof body.negativePrompt !== "string") {
    throw new LockedDesignRequestError("INVALID_NEGATIVE_PROMPT", 400);
  }
  return body as unknown as RegisterLockedDesignInput;
}

async function requireOwnedProject(admin: SupabaseClient, projectId: string, userId: string) {
  const { data, error } = await admin
    .from("consumer_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("PROJECT_LOOKUP_FAILED");
  if (!data) throw new LockedDesignRequestError("PROJECT_NOT_FOUND", 404);
}

export async function registerLockedDesign(
  admin: SupabaseClient,
  userId: string,
  rawInput: unknown,
): Promise<SanitizedLockedAsset> {
  const input = validateRegisterInput(rawInput);
  await requireOwnedProject(admin, input.projectId, userId);
  const normalized = await normalizeImageSource(input.imageSource);
  const assetId = randomUUID();
  const designOutputId = randomUUID();
  const storagePath = `${userId}/${input.projectId}/${assetId}.webp`;
  let outputInserted = false;

  await uploadLockedDesignImage(admin, storagePath, normalized);
  try {
    const { error: outputError } = await admin.from("design_outputs").insert({
      id: designOutputId,
      project_id: input.projectId,
      user_id: userId,
      project_mode: input.projectMode,
      target_type: input.targetType,
      target_id: input.targetId,
      target_name: input.targetName,
      render_kind: input.renderKind,
      image_url: `locked-design:${assetId}`,
      prompt: input.prompt?.slice(0, 20_000) ?? null,
      negative_prompt: input.negativePrompt?.slice(0, 20_000) ?? null,
      status: "generated",
    });
    if (outputError) throw new Error("DESIGN_OUTPUT_INSERT_FAILED");
    outputInserted = true;

    const assetRow = {
      id: assetId,
      design_output_id: designOutputId,
      project_id: input.projectId,
      user_id: userId,
      storage_bucket: "private-design-renders",
      original_storage_path: storagePath,
      source_kind: input.imageSource.startsWith("data:") ? "data_url" : "remote_url",
      status: "completed",
      unlock_cost: input.unlockCost,
      mime_type: normalized.mimeType,
      width: normalized.width,
      height: normalized.height,
      byte_size: normalized.bytes.length,
      content_sha256: normalized.sha256,
    };
    const { data, error: assetError } = await admin
      .from("locked_design_assets")
      .insert(assetRow)
      .select("id, design_output_id, project_id, status, unlock_cost, mime_type, width, height, byte_size, created_at")
      .single();
    if (assetError || !data) throw new Error("LOCKED_ASSET_INSERT_FAILED");

    return sanitizeLockedAsset({
      ...data,
      target_type: input.targetType,
      target_id: input.targetId,
      target_name: input.targetName,
      render_kind: input.renderKind,
    });
  } catch (error) {
    if (outputInserted) await admin.from("design_outputs").delete().eq("id", designOutputId);
    await removeLockedDesignImage(admin, storagePath);
    throw error;
  }
}

interface DesignOutputSummary {
  id: string;
  target_type: string;
  target_id: string;
  target_name: string;
  render_kind: string;
}

export async function listLockedDesigns(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<SanitizedLockedAsset[]> {
  if (!UUID_PATTERN.test(projectId)) throw new LockedDesignRequestError("INVALID_PROJECT_ID", 400);
  await requireOwnedProject(admin, projectId, userId);

  const { data: assets, error: assetsError } = await admin
    .from("locked_design_assets")
    .select("id, design_output_id, project_id, status, unlock_cost, mime_type, width, height, byte_size, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (assetsError) throw new Error("LOCKED_ASSET_LIST_FAILED");
  if (!assets?.length) return [];

  const outputIds = assets.map((asset) => asset.design_output_id);
  const assetIds = assets.map((asset) => asset.id);
  const [{ data: outputs, error: outputsError }, { data: grants, error: grantsError }] = await Promise.all([
    admin
      .from("design_outputs")
      .select("id, target_type, target_id, target_name, render_kind")
      .in("id", outputIds)
      .eq("user_id", userId),
    admin
      .from("locked_design_access_grants")
      .select("id, asset_id")
      .in("asset_id", assetIds)
      .eq("user_id", userId),
  ]);
  if (outputsError || grantsError) throw new Error("LOCKED_ASSET_LIST_FAILED");

  const outputsById = new Map(
    ((outputs ?? []) as DesignOutputSummary[]).map((output) => [output.id, output]),
  );
  const grantsByAsset = new Map(
    (grants ?? []).map((grant) => [grant.asset_id, grant.id]),
  );

  return assets.flatMap((asset) => {
    const output = outputsById.get(asset.design_output_id);
    if (!output) return [];
    return [sanitizeLockedAsset({
      ...output,
      ...asset,
      design_output_id: asset.design_output_id,
      target_type: output.target_type,
      target_id: output.target_id,
      target_name: output.target_name,
      render_kind: output.render_kind,
      grant_id: grantsByAsset.get(asset.id) ?? null,
    })];
  });
}
