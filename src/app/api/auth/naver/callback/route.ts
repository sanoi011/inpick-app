import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

interface NaverProfile {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
    mobile?: string;
  };
}

// 네이버 OAuth 콜백
// 1) state 검증 (CSRF)
// 2) authorization code → access_token 교환
// 3) profile 조회
// 4) Supabase admin: user upsert (email confirm 자동)
// 5) magic link 생성 → hashed_token으로 서버에서 verifyOtp → 세션 쿠키 박힘
// 6) next로 리다이렉트
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const cookieState = req.cookies.get("naver_oauth_state")?.value;
  const next = req.cookies.get("naver_oauth_next")?.value || "/";
  const accountType =
    req.cookies.get("naver_oauth_account_type")?.value === "contractor" ? "contractor" : "consumer";

  const fail = (reason: string) => {
    console.error("[naver-oauth] fail:", reason);
    const res = NextResponse.redirect(new URL("/auth?error=naver_failed", origin));
    res.cookies.delete("naver_oauth_state");
    res.cookies.delete("naver_oauth_next");
    res.cookies.delete("naver_oauth_account_type");
    return res;
  };

  if (errorParam) return fail(`naver returned error: ${errorParam}`);
  if (!code || !state) return fail("missing code or state");
  if (!cookieState || cookieState !== state) return fail("state mismatch");

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret) return fail("NAVER_CLIENT_ID/SECRET not set");
  if (!supabaseUrl || !serviceKey) return fail("Supabase service role not configured");

  // 1) code → access_token
  const tokenRes = await fetch(
    `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${encodeURIComponent(
      clientId
    )}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`,
    { method: "GET" }
  );
  if (!tokenRes.ok) return fail(`token exchange failed: ${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    return fail(`token error: ${tokenJson.error_description ?? tokenJson.error ?? "no token"}`);
  }

  // 2) profile 조회
  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) return fail(`profile fetch failed: ${profileRes.status}`);
  const profileJson = (await profileRes.json()) as NaverProfile;
  if (profileJson.resultcode !== "00" || !profileJson.response) {
    return fail(`profile error: ${profileJson.message}`);
  }
  const naverId = profileJson.response.id;
  // 네이버 이메일이 없을 수 있음 (가입 시 동의 안한 경우) — 대체 식별자로 가짜 이메일 생성
  const email =
    profileJson.response.email?.toLowerCase().trim() || `naver_${naverId}@naver.inpick.local`;
  const fullName =
    profileJson.response.name || profileJson.response.nickname || `naver_${naverId.slice(0, 6)}`;

  // 3) Supabase admin client
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3-1) 기존 사용자 찾기 (admin.listUsers + 이메일 필터)
  // listUsers는 페이지네이션이지만 최근 가입자가 많지 않으니 1페이지 200건 검색 후 필터
  let existingUserId: string | null = null;
  try {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.warn("[naver-oauth] listUsers error:", listErr.message);
    } else {
      const found = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (found) existingUserId = found.id;
    }
  } catch (err) {
    console.warn("[naver-oauth] listUsers exception:", err);
  }

  // 3-2) 사용자 생성 (없을 때)
  if (!existingUserId) {
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        account_type: accountType,
        provider: "naver",
        naver_id: naverId,
        avatar_url: profileJson.response.profile_image ?? null,
        phone: profileJson.response.mobile ?? null,
      },
      app_metadata: {
        provider: "naver",
        providers: ["naver"],
      },
    });
    if (createErr || !createData?.user) {
      return fail(`createUser failed: ${createErr?.message ?? "no user"}`);
    }
    existingUserId = createData.user.id;
  }

  // 4) magic link 생성 → hashed_token 추출
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}${next}` },
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return fail(`generateLink failed: ${linkErr?.message ?? "no token"}`);
  }
  const tokenHash = linkData.properties.hashed_token;

  // 5) 서버 supabase 클라이언트로 verifyOtp → 응답에 세션 쿠키 박힘
  // createServerSupabase는 cookies()에 setAll 호출 → 다음 응답의 Set-Cookie가 자동 포함됨
  const supabase = createServerSupabase();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyErr) {
    return fail(`verifyOtp failed: ${verifyErr.message}`);
  }

  // 6) 정리 + redirect
  const res = NextResponse.redirect(new URL(next, origin));
  res.cookies.delete("naver_oauth_state");
  res.cookies.delete("naver_oauth_next");
  res.cookies.delete("naver_oauth_account_type");
  return res;
}
