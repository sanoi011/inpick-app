/**
 * POST /api/auth/post-login
 *
 * 자체/소셜 로그인 성공 직후 클라이언트가 호출하는 경량 후처리 라우트.
 *  1. 서버 세션(쿠키)으로 현재 로그인 사용자 확인
 *  2. consumer_profiles 누락 시 ensureConsumerProfile로 자동 복구 (orphan self-heal)
 *  3. login audit 이벤트 기록 (/admin/members 감사 탭 데이터 소스)
 *
 * 원칙:
 *  - 실패해도 로그인 흐름 자체를 막지 않는다 (클라이언트는 결과와 무관하게 이동).
 *  - 어떤 PII도 평문 저장하지 않는다 (audit는 hash).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  ensureConsumerProfile,
  recordAuditEvent,
  normalizeEmail,
} from "@/lib/auth/self-member-service";
import {
  extractDemographicsFromIdentity,
  upsertUserDemographics,
} from "@/lib/analytics/demographics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const provider = (user.app_metadata?.provider as string) || "email";
  const email = normalizeEmail(user.email);
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  let created = false;
  let hasProfile = false;
  try {
    const r = await ensureConsumerProfile({
      userId: user.id,
      email,
      name: (meta.full_name as string) || (meta.name as string) || null,
      phone: (meta.phone as string) || null,
      provider,
    });
    created = r.created;
    hasProfile = r.profileExists;
  } catch (err) {
    console.error("[post-login] ensureConsumerProfile error:", err);
  }

  // 로그인 제공사별 인구통계 수집(대시보드 provider 세분화) — 성별/연령은 provider 동의 승인 시에만 채워짐.
  try {
    let demo = {};
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if ((provider === "kakao") && url && key) {
      // identity_data에서 카카오 연령대/성별 추출(관리자 조회 필요)
      const admin = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: full } = await admin.auth.admin.getUserById(user.id);
      const ident = full?.user?.identities?.find((i) => i.provider === "kakao");
      demo = extractDemographicsFromIdentity(provider, ident?.identity_data as Record<string, unknown> | undefined);
    }
    await upsertUserDemographics(user.id, provider, demo);
  } catch (err) {
    console.error("[post-login] demographics error:", err);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent");
  await recordAuditEvent({
    userId: user.id,
    eventName: "login",
    actorType: "consumer",
    provider,
    email,
    ip,
    userAgent: ua,
    result: "success",
    details: { profile_lazy_created: created, has_profile: hasProfile },
  });

  return NextResponse.json({ ok: true, hasProfile, created });
}
