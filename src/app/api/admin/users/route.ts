import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return createServiceClient(url, serviceKey);
  return createClient();
}

function sanitizeFilterValue(value: string): string {
  return value.replace(/[.,()\\]/g, "");
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") || "consumer";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search") || "";

  try {
    if (type === "contractor") {
      const offset = (page - 1) * limit;
      let query = supabase
        .from("specialty_contractors")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        const safe = sanitizeFilterValue(search);
        query = query.or(`company_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return NextResponse.json({ users: data || [], total: count || 0, page, limit });
    }

    // Consumer: auth.users 기반 (모든 가입 회원 표시)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage: limit,
    });
    if (authError) throw authError;

    const allUsers = authData.users || [];
    const total = (authData as { users: unknown[]; total?: number }).total || allUsers.length;

    // 검색 필터 (클라이언트 사이드 - auth.admin.listUsers는 서버 필터 미지원)
    let filteredUsers = allUsers;
    if (search) {
      const q = search.toLowerCase();
      filteredUsers = allUsers.filter((u) => {
        const email = (u.email || "").toLowerCase();
        const name = ((u.user_metadata?.full_name as string) || "").toLowerCase();
        const id = u.id.toLowerCase();
        return email.includes(q) || name.includes(q) || id.startsWith(q);
      });
    }

    const userIds = filteredUsers.map((u) => u.id);

    // user_credits LEFT JOIN
    const creditMap: Record<string, { balance: number; free_generations_used: number }> = {};
    if (userIds.length > 0) {
      const { data: credits } = await supabase
        .from("user_credits")
        .select("user_id, balance, free_generations_used")
        .in("user_id", userIds);
      (credits || []).forEach((c: { user_id: string; balance: number; free_generations_used: number }) => {
        creditMap[c.user_id] = { balance: c.balance, free_generations_used: c.free_generations_used };
      });
    }

    // consumer_projects 카운트
    const projectCounts: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: projects } = await supabase
        .from("consumer_projects")
        .select("user_id")
        .in("user_id", userIds);
      (projects || []).forEach((p: { user_id: string }) => {
        projectCounts[p.user_id] = (projectCounts[p.user_id] || 0) + 1;
      });
    }

    // consumer_profiles LEFT JOIN (phone, 약관 동의, 본인인증)
    interface ProfileRow {
      id: string;
      phone: string | null;
      agreed_terms_at: string | null;
      agreed_privacy_at: string | null;
      agreed_age14_at: string | null;
      agreed_marketing_at: string | null;
      phone_verified: boolean | null;
    }
    const profileMap: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("consumer_profiles")
        .select(
          "id, phone, agreed_terms_at, agreed_privacy_at, agreed_age14_at, agreed_marketing_at, phone_verified"
        )
        .in("id", userIds);
      (profiles || []).forEach((p: ProfileRow) => {
        profileMap[p.id] = p;
      });
    }

    const users = filteredUsers.map((u) => {
      const p = profileMap[u.id];
      return {
        id: u.id,
        email: u.email || "",
        name: (u.user_metadata?.full_name as string) || "",
        phone: p?.phone || (u.user_metadata?.phone as string) || "",
        provider: (u.app_metadata?.provider as string) || "email",
        emailConfirmedAt: u.email_confirmed_at || null,
        lastSignInAt: u.last_sign_in_at || null,
        phoneVerified: p?.phone_verified ?? false,
        agreedTermsAt: p?.agreed_terms_at || null,
        agreedPrivacyAt: p?.agreed_privacy_at || null,
        agreedAge14At: p?.agreed_age14_at || null,
        agreedMarketingAt: p?.agreed_marketing_at || null,
        balance: creditMap[u.id]?.balance || 0,
        freeGenerationsUsed: creditMap[u.id]?.free_generations_used || 0,
        projectCount: projectCounts[u.id] || 0,
        createdAt: u.created_at,
      };
    });

    return NextResponse.json({
      users,
      total: search ? filteredUsers.length : total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "사용자 조회 실패" }, { status: 500 });
  }
}
