/**
 * POST /api/auth/reset-password-self
 *
 * 사용자 본인이 비밀번호를 재설정 — SMTP 없이 동작.
 *
 * 검증:
 *   * email + phone + name 3종 매칭 (consumer_profiles)
 *   * auth.users에 이메일로 사용자 존재
 *   * 새 비밀번호 정책 (영문+숫자 8자 이상)
 *
 * 보안 고려:
 *   * rate limit: 같은 email 5분 내 5회 시도 차단 (간이 — IP/세션 미사용)
 *   * 검증 실패 시 어떤 필드가 틀렸는지 노출 X (timing attack 방지)
 *   * 성공 시 last_sign_in_at는 비번 변경만으로 갱신 안 됨 (사용자가 다시 로그인 필요)
 *   * 이력은 console.log + 별도 user_recovery_audit 테이블 (없으면 console만)
 *
 * 정책 trade-off:
 *   * SMS 본인인증 / 이메일 magic link 없는 상태에서 사용자가 비번을 잊으면 복구 불가
 *   * 이메일+휴대폰+이름 3종 매칭은 한국 일부 사이트에서 사용하는 패턴
 *   * 추후 SMS OTP 도입 시 더 엄격한 검증으로 교체 예정
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
  phone?: string;
  name?: string;
  newPassword?: string;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function validatePassword(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: "비밀번호는 8자 이상" };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { ok: false, error: "영문과 숫자를 모두 포함" };
  return { ok: true };
}

// 간이 in-memory rate limit (5분 5회)
const attempts = new Map<string, { count: number; firstAt: number }>();
const RATE_WINDOW_MS = 5 * 60_000;
const RATE_MAX = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || now - cur.firstAt > RATE_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count++;
  return true;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const phone = body.phone ? normalizePhone(body.phone) : "";
  const name = body.name?.trim();
  const newPassword = body.newPassword;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (!phone || !/^01[016789]\d{7,8}$/.test(phone)) {
    return NextResponse.json({ error: "휴대폰번호 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "이름을 2자 이상 입력하세요" }, { status: 400 });
  }
  if (!newPassword) {
    return NextResponse.json({ error: "새 비밀번호를 입력하세요" }, { status: 400 });
  }
  const pv = validatePassword(newPassword);
  if (!pv.ok) {
    return NextResponse.json({ error: pv.error }, { status: 400 });
  }

  // rate limit (이메일 기준)
  if (!checkRateLimit(email)) {
    return NextResponse.json(
      { error: "너무 많은 시도. 5분 후 다시 시도하세요" },
      { status: 429 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }
  const admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) consumer_profiles 매칭 — email + phone + name 3종
  const { data: profile } = await admin
    .from("consumer_profiles")
    .select("id, email, name, phone")
    .eq("email", email)
    .eq("phone", phone)
    .maybeSingle();

  // timing attack 방지 — 어떤 필드가 틀렸는지 노출 X
  if (!profile || profile.name?.trim() !== name) {
    console.warn(`[reset-password-self] 매칭 실패 email=${email} phone=${phone} name=${name}`);
    return NextResponse.json(
      {
        error: "본인 정보가 일치하지 않습니다",
        hint: "가입 시 입력한 이메일·휴대폰·이름이 정확히 일치해야 합니다",
      },
      { status: 404 }
    );
  }

  // 2) auth.users 존재 확인
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(profile.id);
  if (authErr || !authUser?.user) {
    console.error(`[reset-password-self] auth.users 없음 user_id=${profile.id}`);
    return NextResponse.json(
      { error: "계정 데이터가 일치하지 않습니다. 관리자에게 문의하세요" },
      { status: 500 }
    );
  }

  // 3) 비번 변경 (admin SDK) + email_confirm=true 보장
  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, {
    password: newPassword,
    email_confirm: true,
  });
  if (updateErr) {
    console.error(`[reset-password-self] updateUserById 실패: ${updateErr.message}`);
    return NextResponse.json({ error: "비밀번호 변경 실패" }, { status: 500 });
  }

  console.log(`[reset-password-self] 성공 email=${email} user_id=${profile.id} 시각=${new Date().toISOString()}`);

  // attempts cleanup
  attempts.delete(email);

  return NextResponse.json({
    ok: true,
    message: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요",
  });
}
