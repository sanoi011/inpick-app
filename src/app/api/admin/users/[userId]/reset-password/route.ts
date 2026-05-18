/**
 * POST /api/admin/users/[userId]/reset-password
 *
 * 2026-05-18: Supabase 기본 SMTP가 신뢰 불가 → 관리자가 직접 비번을 변경하는 통로.
 * 사용 케이스:
 *   * 대표 본인 계정 비번 복구 (Supabase 대시보드 대안)
 *   * 사용자가 "비번 잊었어요" 문의 시 임시 비번 발급 후 안내
 *
 * 인증: Bearer ADMIN_PASSWORD (다른 admin 라우트와 동일)
 *
 * Body:
 *   { newPassword: string }  // 8자 이상, 영문+숫자 필수
 *
 * Response:
 *   { ok: true, userId, email }  // 성공 시
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

function validatePassword(pw: unknown): { ok: boolean; error?: string } {
  if (typeof pw !== "string") return { ok: false, error: "비밀번호가 필요합니다." };
  if (pw.length < 8) return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return { ok: false, error: "비밀번호는 영문과 숫자를 모두 포함해야 합니다." };
  }
  return { ok: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = params.userId;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { newPassword?: string };
  const v = validatePassword(body.newPassword);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  // 대상 사용자 조회 — 존재 여부 + email 반환
  const { data: target, error: lookupErr } = await admin.auth.admin.getUserById(userId);
  if (lookupErr || !target?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 비번 + 이메일 인증 동시 처리 (혹시라도 confirmed=false면 같이 해결)
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: body.newPassword,
    email_confirm: true,
  });
  if (updateErr) {
    console.error("[admin/reset-password] updateUserById error:", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[admin/reset-password] userId=${userId} email=${target.user.email} 비번 재설정 완료`);

  return NextResponse.json({
    ok: true,
    userId,
    email: target.user.email,
    message: "비밀번호가 재설정되었습니다. 사용자에게 새 비번을 안전한 채널로 전달하세요.",
  });
}
