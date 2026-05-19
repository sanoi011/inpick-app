/**
 * POST /api/auth/self/recovery/verify
 *
 * 비밀번호 복구 1단계 — 회원 DB 대조 (이메일+이름+휴대폰).
 *
 * 처리:
 *   1. rate limit (이메일 hash 기준 10분 5회)
 *   2. consumer_profiles 매칭
 *   3. auth.users 존재 + 자체 가입(has_password) 확인
 *   4. OAuth-only 사용자는 자체 복구 불가
 *   5. recovery_challenge 생성 + token 응답 (HttpOnly cookie 권장 — MVP는 body 반환)
 *   6. auth_audit_events 기록
 *
 * 응답은 계정 존재 여부를 노출하지 않음.
 * 가이드: §0-A-10 (POST /api/auth/self/recovery/verify)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAdmin,
  normalizeEmail,
  normalizePhone,
  hashPii,
  recordAuditEvent,
  createRecoveryChallenge,
  checkRecoveryRateLimit,
  openMemberCase,
} from "@/lib/auth/self-member-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
  name?: string;
  phone?: string;
}

const GENERIC_RESPONSE = NextResponse.json(
  {
    ok: false,
    error: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다. 잠시 후 다시 시도해주세요",
  },
  { status: 404 }
);

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const name = body.name?.trim() ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") ?? null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (!phone || !/^01[016789]\d{7,8}$/.test(phone)) {
    return NextResponse.json({ error: "휴대폰번호 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "이름을 2자 이상 입력하세요" }, { status: 400 });
  }

  const emailHash = hashPii(email) ?? "";

  // rate limit (이메일 hash 기준)
  if (!checkRecoveryRateLimit(emailHash)) {
    await recordAuditEvent({
      eventName: "self_recovery.verify",
      result: "blocked",
      errorCode: "rate_limit",
      email,
      phone,
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "너무 많은 시도. 10분 후 다시 시도하세요" },
      { status: 429 }
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  // consumer_profiles 매칭 (email + phone)
  const { data: profileRaw } = await admin
    .from("consumer_profiles")
    .select("id, email, name, phone, recovery_enabled, profile_status")
    .eq("email", email)
    .eq("phone", phone)
    .maybeSingle();
  const profile = profileRaw as {
    id: string; email: string; name: string; phone: string;
    recovery_enabled: boolean | null; profile_status: string | null;
  } | null;

  // 매칭 실패 OR 이름 불일치 OR recovery 차단 OR 비활성 프로필
  if (
    !profile ||
    profile.name?.trim() !== name ||
    profile.recovery_enabled === false ||
    profile.profile_status !== "active"
  ) {
    await recordAuditEvent({
      eventName: "self_recovery.verify",
      result: "failure",
      errorCode: "profile_mismatch",
      email,
      phone,
      ip,
      userAgent,
      details: {
        profile_found: !!profile,
        name_match: profile?.name?.trim() === name,
        recovery_enabled: profile?.recovery_enabled,
      },
    });
    // timing attack 방지 — 모두 동일한 generic 응답
    return GENERIC_RESPONSE;
  }

  // auth.users 존재 + 자체 가입 확인
  const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
  if (!authUser?.user) {
    await openMemberCase({
      userId: profile.id,
      caseType: "profile_missing_auth_user",
      severity: "high",
      email,
      details: { profile_id: profile.id },
    });
    return GENERIC_RESPONSE;
  }

  // OAuth-only 계정은 자체 비번 복구 불가
  // app_metadata.provider 또는 identities 확인
  const provider = (authUser.user.app_metadata?.provider as string) || "email";
  const hasEmailProvider = provider === "email";
  if (!hasEmailProvider) {
    await recordAuditEvent({
      userId: profile.id,
      eventName: "self_recovery.verify",
      result: "blocked",
      errorCode: "oauth_only_account",
      email,
      phone,
      ip,
      userAgent,
      provider,
    });
    return NextResponse.json(
      {
        error: `${provider} 로그인으로 가입된 계정입니다. ${provider}로 로그인하세요`,
      },
      { status: 403 }
    );
  }

  // recovery challenge 생성
  const challenge = await createRecoveryChallenge({
    userId: profile.id,
    email,
    phone,
    ip,
    userAgent,
  });

  if (!challenge) {
    await recordAuditEvent({
      userId: profile.id,
      eventName: "self_recovery.verify",
      result: "failure",
      errorCode: "challenge_create_failed",
      email,
      phone,
      ip,
      userAgent,
    });
    return NextResponse.json({ error: "복구 토큰 생성 실패" }, { status: 500 });
  }

  await recordAuditEvent({
    userId: profile.id,
    eventName: "self_recovery.verify",
    result: "success",
    email,
    phone,
    ip,
    userAgent,
  });

  // HttpOnly cookie + body 두 가지 — 클라이언트는 cookie 우선
  const res = NextResponse.json({
    ok: true,
    next: "enter_new_password",
    recoveryToken: challenge.token, // MVP: body 반환. 추후 cookie-only 권장
  });

  res.cookies.set("inpick_recovery", challenge.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10분
  });

  return res;
}
