import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPO_DECISION_COMMENT_MAX,
  type ExpoClientDecision,
} from "@/lib/expo/client-decision";

/**
 * POST /api/expo/proposal-decision — 공유 토큰 소지자(고객)의 결정 기록.
 * 로그인 없이 토큰 소지 = 결정 권한 (공유 링크가 곧 capability).
 * 최신 결정 1건만 저장하며, 결정 시각은 서버가 찍는다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { token?: unknown; decision?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "TOKEN_INVALID" }, { status: 400 });
  }
  if (body.decision !== "approved" && body.decision !== "changes_requested") {
    return NextResponse.json({ error: "DECISION_INVALID" }, { status: 400 });
  }
  const comment =
    typeof body.comment === "string"
      ? body.comment.trim().slice(0, EXPO_DECISION_COMMENT_MAX)
      : "";
  if (body.decision === "changes_requested" && !comment) {
    return NextResponse.json({ error: "COMMENT_REQUIRED" }, { status: 400 });
  }

  const decision: ExpoClientDecision = {
    decision: body.decision,
    comment,
    decidedAt: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("expo_projects")
    .update({ client_decision: decision })
    .eq("share_token", token)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "PROPOSAL_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ decision });
}
