import { NextRequest, NextResponse } from "next/server";
import { getAdminIdFromRequest, isAdminAuthorized } from "@/lib/admin-auth";
import { requestHankwonAdmin } from "@/lib/hankwon-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeSearch(value: string) {
  // PostgREST `or` filter separators/wildcards만 제거한다. 이메일의 `.`과 `@`는
  // 유지해야 전체 이메일 검색이 정상 동작한다.
  return value.trim().replace(/[(),\\%_*]/g, "").slice(0, 100);
}

function authUserProfile(user: {
  id: string;
  email?: string;
  created_at: string;
  user_metadata?: Record<string, unknown>;
}) {
  return {
    id: user.id,
    email: user.email || "",
    name: String(user.user_metadata?.full_name || user.user_metadata?.name || ""),
    created_at: user.created_at,
  };
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "HANKWON_ADMIN_REQUEST_FAILED";
  const status = code === "HANKWON_ADMIN_NOT_CONFIGURED" ? 503
    : code === "UNAUTHORIZED" ? 502
      : 500;
  console.error("[admin/hankwon-plans]", code);
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const supabase = createAdminClient();
  const rawSearch = request.nextUrl.searchParams.get("search") || "";
  const search = sanitizeSearch(rawSearch);

  try {
    let profiles: Array<{ id: string; email: string; name: string; created_at: string }> = [];
    if (UUID_PATTERN.test(search)) {
      const { data, error } = await supabase.auth.admin.getUserById(search);
      if (error && !error.message.toLowerCase().includes("not found")) throw error;
      if (data.user) {
        profiles = [authUserProfile(data.user)];
      }
    } else {
      let query = supabase
        .from("consumer_profiles")
        .select("id,email,name,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      profiles = data || [];

      // OAuth 직후 프로필 후처리가 지연되었거나 한권에서 먼저 가입한 통합
      // 계정도 검색에서 빠지지 않도록, 검색 시에만 Auth 사용자 목록을 보완한다.
      if (search && profiles.length < 30) {
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 });
        if (authError) throw authError;
        const needle = search.toLocaleLowerCase("ko-KR");
        const existing = new Set(profiles.map((profile) => profile.id));
        for (const user of authData.users) {
          if (profiles.length >= 30) break;
          if (existing.has(user.id)) continue;
          const profile = authUserProfile(user);
          if (`${profile.email} ${profile.name}`.toLocaleLowerCase("ko-KR").includes(needle)) {
            profiles.push(profile);
            existing.add(user.id);
          }
        }
      }
    }

    const statusResult = profiles.length
      ? await requestHankwonAdmin({ action: "lookup", userIds: profiles.map((profile) => profile.id) })
      : { statuses: {} };
    const statuses = (statusResult.statuses || {}) as Record<string, unknown>;

    return NextResponse.json({
      users: profiles.map((profile) => ({ ...profile, hankwon: statuses[profile.id] || null })),
      search,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const supabase = createAdminClient();

  try {
    const body = await request.json() as {
      action?: string;
      userId?: string;
      plan?: string;
      expiresAt?: string | null;
      reason?: string;
      testAccount?: boolean;
    };
    if (!body.userId || !UUID_PATTERN.test(body.userId)) {
      return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400 });
    }
    if (!body.action || !["history", "grant", "revoke"].includes(body.action)) {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }
    const { data: account, error: accountError } = await supabase.auth.admin.getUserById(body.userId);
    if (accountError || !account.user) return NextResponse.json({ error: "INPICK_USER_NOT_FOUND" }, { status: 404 });

    const adminId = getAdminIdFromRequest(request) || "admin-api";
    const result = await requestHankwonAdmin({
      action: body.action,
      userId: body.userId,
      plan: body.plan,
      expiresAt: body.expiresAt,
      reason: body.reason,
      testAccount: body.testAccount === true,
      adminId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
