import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateIdempotencyKey } from "@/lib/inpick/locked-design/contracts";
import { createLockedDesignSignedUrl } from "@/lib/inpick/storage/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 480;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function rpcError(message: string): { status: number; code: string } {
  if (message.includes("INSUFFICIENT_CREDITS")) return { status: 402, code: "INSUFFICIENT_CREDITS" };
  if (message.includes("LOCKED_ASSET_NOT_FOUND_OR_FORBIDDEN")) {
    return { status: 404, code: "LOCKED_ASSET_NOT_FOUND" };
  }
  if (message.includes("LOCKED_ASSET_NOT_COMPLETED")) return { status: 409, code: "LOCKED_ASSET_NOT_COMPLETED" };
  if (message.includes("IDEMPOTENCY_KEY_REUSED")) return { status: 409, code: "IDEMPOTENCY_KEY_REUSED" };
  if (message.includes("INVALID_IDEMPOTENCY_KEY")) return { status: 400, code: "INVALID_IDEMPOTENCY_KEY" };
  return { status: 500, code: "UNLOCK_FAILED" };
}

interface UnlockResult {
  grantId: string;
  assetId: string;
  charged: boolean;
  cost: number;
  balance: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } },
) {
  if (!UUID_PATTERN.test(params.assetId)) return json({ error: "INVALID_ASSET_ID" }, 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!validateIdempotencyKey(body.idempotencyKey)) {
    return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "UNAUTHENTICATED" }, 401);

  const { data, error } = await supabase.rpc("unlock_locked_design_asset", {
    p_asset_id: params.assetId,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error || !data) {
    const message = error?.message ?? "UNLOCK_FAILED";
    const mapped = rpcError(message);
    if (mapped.status === 500) console.error("[locked-design] unlock RPC failed", message);
    return json({ error: mapped.code }, mapped.status);
  }

  const grant = data as UnlockResult;
  const admin = createAdminClient();
  const { data: asset, error: assetError } = await admin
    .from("locked_design_assets")
    .select("original_storage_path")
    .eq("id", params.assetId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .single();
  if (assetError || !asset) {
    console.error("[locked-design] granted asset lookup failed");
    return json({ error: "SIGNED_URL_FAILED" }, 500);
  }

  try {
    const url = await createLockedDesignSignedUrl(
      admin,
      asset.original_storage_path,
      SIGNED_URL_TTL_SECONDS,
    );
    return json({
      assetId: params.assetId,
      url,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      grant: {
        id: grant.grantId,
        charged: grant.charged,
        cost: grant.cost,
        balance: grant.balance,
      },
    });
  } catch (signError) {
    console.error("[locked-design] signed URL failed", signError instanceof Error ? signError.message : "unknown");
    return json({ error: "SIGNED_URL_FAILED" }, 500);
  }
}
