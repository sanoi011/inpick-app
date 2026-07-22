import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ImageInputError } from "@/lib/inpick/storage/image-storage";
import {
  listLockedDesigns,
  LockedDesignRequestError,
  registerLockedDesign,
} from "@/lib/inpick/locked-design/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function authenticatedUserId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId();
  if (!userId) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  try {
    const asset = await registerLockedDesign(createAdminClient(), userId, body);
    return json({ asset }, 201);
  } catch (error) {
    if (error instanceof LockedDesignRequestError) return json({ error: error.message }, error.status);
    if (error instanceof ImageInputError) return json({ error: error.message }, 400);
    console.error("[locked-design] registration failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "LOCKED_DESIGN_REGISTRATION_FAILED" }, 500);
  }
}

export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId();
  if (!userId) return json({ error: "UNAUTHENTICATED" }, 401);
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";

  try {
    const assets = await listLockedDesigns(createAdminClient(), userId, projectId);
    return json({ assets });
  } catch (error) {
    if (error instanceof LockedDesignRequestError) return json({ error: error.message }, error.status);
    console.error("[locked-design] list failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "LOCKED_DESIGN_LIST_FAILED" }, 500);
  }
}
