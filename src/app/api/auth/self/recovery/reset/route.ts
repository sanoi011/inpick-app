/**
 * POST /api/auth/self/recovery/reset
 *
 * 비밀번호 복구 2단계 — challenge 토큰 검증 + 새 비번 설정.
 *
 * 처리:
 *   1. recoveryToken (cookie 또는 body) 검증
 *   2. challenge 유효성 (pending + 미만료) 확인
 *   3. 비번 강도 검증
 *   4. Supabase admin updateUserById(password)
 *   5. challenge 'used' 표시
 *   6. 기존 세션 무효화 (Supabase admin.deleteSession — 미구현 API라 skip, 새 비번으로 다시 로그인 필요)
 *   7. auth_audit_events 기록
 *
 * 가이드: §0-A-10 (POST /api/auth/self/recovery/reset)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAdmin,
  recordAuditEvent,
  verifyRecoveryChallenge,
  markChallengeUsed,
  clearRecoveryRateLimit,
  hashPii,
} from "@/lib/auth/self-member-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  recoveryToken?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
}

function validatePassword(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: "비밀번호는 8자 이상" };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return { ok: false, error: "영문과 숫자를 모두 포함" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // cookie 우선, body fallback
  const cookieToken = req.cookies.get("inpick_recovery")?.value;
  const token = cookieToken || body.recoveryToken;
  if (!token) {
    return NextResponse.json({ error: "복구 토큰 없음. 다시 시도해주세요" }, { status: 400 });
  }

  if (!body.newPassword || !body.newPasswordConfirm) {
    return NextResponse.json({ error: "새 비밀번호를 입력하세요" }, { status: 400 });
  }
  if (body.newPassword !== body.newPasswordConfirm) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다" }, { status: 400 });
  }
  const pv = validatePassword(body.newPassword);
  if (!pv.ok) {
    return NextResponse.json({ error: pv.error }, { status: 400 });
  }

  const challenge = await verifyRecoveryChallenge(token);
  if (!challenge) {
    await recordAuditEvent({
      eventName: "self_recovery.reset",
      result: "failure",
      errorCode: "invalid_or_expired_challenge",
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "복구 토큰이 만료되었거나 유효하지 않습니다. 처음부터 다시 시도해주세요" },
      { status: 400 }
    );
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // 비번 변경 + email_confirm 보장
  const { data: targetUser } = await admin.auth.admin.getUserById(challenge.userId);
  const { error: updateErr } = await admin.auth.admin.updateUserById(challenge.userId, {
    password: body.newPassword,
    email_confirm: true,
  });

  if (updateErr) {
    await recordAuditEvent({
      userId: challenge.userId,
      eventName: "self_recovery.reset",
      result: "failure",
      errorCode: "supabase_update_failed",
      ip,
      userAgent,
      details: { error: updateErr.message },
    });
    return NextResponse.json({ error: "비밀번호 변경 실패" }, { status: 500 });
  }

  await markChallengeUsed(challenge.challengeId);

  // rate limit 해제 (이메일 hash 기준)
  if (targetUser?.user?.email) {
    const emailHash = hashPii(targetUser.user.email);
    if (emailHash) clearRecoveryRateLimit(emailHash);
  }

  await recordAuditEvent({
    userId: challenge.userId,
    eventName: "self_recovery.reset",
    result: "success",
    email: targetUser?.user?.email ?? null,
    ip,
    userAgent,
  });

  const res = NextResponse.json({
    ok: true,
    message: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요",
  });
  // recovery cookie 삭제
  res.cookies.set("inpick_recovery", "", { maxAge: 0, path: "/" });
  return res;
}
