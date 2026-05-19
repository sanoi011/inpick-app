/**
 * GET /api/admin/members
 *
 * 회원 정합성 + 복구 로그 + audit events 통합 조회.
 * /admin/members 페이지의 데이터 소스.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // auth.users 전수 (admin SDK) + consumer_profiles 매칭
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 300 });
  const allUsers = authData?.users ?? [];
  const userIds = allUsers.map((u) => u.id);

  const profilesRes = userIds.length > 0
    ? await admin.from("consumer_profiles").select("id, name, phone, recovery_enabled, profile_status, provider, self_signup_completed_at").in("id", userIds)
    : { data: [] };
  const profilesMap: Record<string, {
    id: string; name: string; phone: string; recovery_enabled: boolean | null; profile_status: string | null; provider: string | null; self_signup_completed_at: string | null;
  }> = {};
  ((profilesRes.data ?? []) as Array<typeof profilesMap[string]>).forEach((p) => { profilesMap[p.id] = p; });

  // 회원 요약
  const members = allUsers.map((u) => {
    const provider = (u.app_metadata?.provider as string) || "email";
    const p = profilesMap[u.id];
    return {
      id: u.id,
      email: u.email,
      provider,
      hasEmailPassword: !!u.user_metadata?.account_type || provider === "email",
      emailConfirmed: !!u.email_confirmed_at,
      lastSignInAt: u.last_sign_in_at,
      createdAt: u.created_at,
      hasProfile: !!p,
      profileStatus: p?.profile_status ?? null,
      profileName: p?.name ?? null,
      profilePhone: p?.phone ?? null,
      recoveryEnabled: p?.recovery_enabled ?? null,
    };
  });

  // 회원 정합성 케이스
  const { data: cases } = await admin
    .from("member_reconciliation_cases")
    .select("*")
    .in("status", ["open", "in_progress"])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  // 최근 audit events (recovery + signup + login)
  const { data: recentAudits } = await admin
    .from("auth_audit_events")
    .select("*")
    .in("event_name", ["self_recovery.verify", "self_recovery.reset", "signup", "login"])
    .order("created_at", { ascending: false })
    .limit(100);

  // 최근 복구 시도 통계 (24시간)
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recoveryStats } = await admin
    .from("auth_audit_events")
    .select("result")
    .like("event_name", "self_recovery.%")
    .gte("created_at", since24h);
  const stats = {
    recovery24h_total: recoveryStats?.length ?? 0,
    recovery24h_success: recoveryStats?.filter((s) => s.result === "success").length ?? 0,
    recovery24h_failure: recoveryStats?.filter((s) => s.result === "failure").length ?? 0,
    recovery24h_blocked: recoveryStats?.filter((s) => s.result === "blocked").length ?? 0,
  };

  // 정합성 요약
  const summary = {
    total: members.length,
    self_signup: members.filter((m) => m.provider === "email").length,
    oauth: members.filter((m) => m.provider !== "email").length,
    profile_orphan_auth: members.filter((m) => !m.hasProfile).length,
    email_unconfirmed: members.filter((m) => !m.emailConfirmed).length,
    open_cases: cases?.length ?? 0,
  };

  return NextResponse.json({
    summary,
    stats,
    members,
    cases: cases ?? [],
    recentAudits: recentAudits ?? [],
  });
}
