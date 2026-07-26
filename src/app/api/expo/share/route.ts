import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/expo/share — 제안 공유 토큰 발급 (블루프린트 §3.16 Concept 공유).
 * provisional 상태에서도 공유 가능 — 공유본에는 가정/컨셉 라벨이 그대로
 * 노출된다. RLS(소유자)로만 발급되고, 토큰은 한 번 만들면 유지된다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { projectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return NextResponse.json({ error: "PROJECT_ID_REQUIRED" }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("expo_projects")
    .select("id, share_token")
    .eq("id", projectId)
    .maybeSingle();
  if (readError || !existing) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  let token = existing.share_token as string | null;
  if (!token) {
    token = randomUUID();
    const { error: updateError } = await supabase
      .from("expo_projects")
      .update({ share_token: token, shared_at: new Date().toISOString() })
      .eq("id", projectId);
    if (updateError) {
      console.error("[expo-share] token update failed:", updateError.message);
      return NextResponse.json({ error: "SHARE_FAILED" }, { status: 500 });
    }
  }

  return NextResponse.json({ token, path: `/expo/p/${token}` });
}
