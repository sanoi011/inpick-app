/**
 * /api/admin/users/[userId]
 *
 * DELETE — 사용자 계정 영구 삭제
 *   * Supabase auth.admin.deleteUser 호출
 *   * CASCADE FK가 있는 자식 테이블은 자동 삭제 (consumer_profiles, design_outputs, payment_intents 등)
 *   * NO ACTION FK 테이블에 데이터가 있으면 삭제 실패 (consumer_projects, chat_rooms 등) → ?force=true 시 사전 정리
 *
 * GET — 사용자 단건 상세 (삭제 영향 사전 점검용)
 *   * auth.users + consumer_profiles + 자식 테이블 카운트
 *
 * 인증: Bearer ADMIN_PASSWORD
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (!auth || !expected) return false;
  return auth === `Bearer ${expected}`;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// NO ACTION FK를 가진 테이블 — force 모드에서 사전 정리해야 auth.users 삭제 가능
const NO_ACTION_TABLES = [
  "chat_rooms",
  "consumer_projects",
  "drawing_parse_logs",
  "payment_reconciliation_jobs",
  "payment_refunds",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const { data: user, error } = await admin.auth.admin.getUserById(params.userId);
  if (error || !user?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 삭제 영향 카운트 (NO ACTION 테이블만)
  const impact: Record<string, number> = {};
  for (const table of NO_ACTION_TABLES) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", params.userId);
    impact[table] = count ?? 0;
  }

  // consumer_profiles
  const { data: profile } = await admin
    .from("consumer_profiles")
    .select("name, phone, agreed_terms_at")
    .eq("id", params.userId)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: user.user.id,
      email: user.user.email,
      provider: user.user.app_metadata?.provider,
      createdAt: user.user.created_at,
      lastSignInAt: user.user.last_sign_in_at,
      emailConfirmedAt: user.user.email_confirmed_at,
    },
    profile,
    impact,
    canDeleteWithoutForce: Object.values(impact).every((c) => c === 0),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = params.userId;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // 대상 존재 확인
  const { data: target, error: lookupErr } = await admin.auth.admin.getUserById(userId);
  if (lookupErr || !target?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const email = target.user.email;

  // force 모드: NO ACTION 자식 테이블 사전 정리
  const cleaned: Record<string, number> = {};
  if (force) {
    for (const table of NO_ACTION_TABLES) {
      const { count, error } = await admin.from(table).delete({ count: "exact" }).eq("user_id", userId);
      if (error) {
        console.error(`[admin/users DELETE force] ${table} 정리 실패:`, error.message);
        return NextResponse.json(
          { error: `cleanup_failed:${table}`, hint: error.message },
          { status: 500 }
        );
      }
      cleaned[table] = count ?? 0;
    }
  }

  // auth.users 삭제 — CASCADE FK는 자동 처리
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("[admin/users DELETE] auth deleteUser 실패:", delErr.message);
    return NextResponse.json(
      {
        error: "auth_delete_failed",
        hint: delErr.message,
        suggestion: force
          ? "자식 데이터 정리는 됐지만 auth.users 삭제 실패 — Supabase 대시보드 확인 필요"
          : "?force=true 로 재시도 시 NO ACTION 자식 데이터 자동 정리됨",
      },
      { status: 500 }
    );
  }

  console.log(`[admin/users DELETE] userId=${userId} email=${email} 삭제 완료. force=${force}, cleaned=${JSON.stringify(cleaned)}`);

  return NextResponse.json({
    ok: true,
    userId,
    email,
    forced: force,
    cleanedTables: force ? cleaned : undefined,
    message: "계정이 영구 삭제되었습니다.",
  });
}
