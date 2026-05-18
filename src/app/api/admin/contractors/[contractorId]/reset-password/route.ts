/**
 * POST /api/admin/contractors/[contractorId]/reset-password
 *
 * 사업자 비밀번호 직접 재설정 (관리자).
 * specialty_contractors.password_hash에 bcrypt 12-round 해시 저장.
 *
 * 주의: 현재 /api/contractor/login은 비밀번호 검증을 하지 않음 (별도 보안 강화 필요).
 * 이 기능은 향후 contractor login에서 비번 검증 도입할 때를 위한 사전 인프라.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

export async function POST(
  req: NextRequest,
  { params }: { params: { contractorId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const { newPassword } = (await req.json().catch(() => ({}))) as { newPassword?: string };
  if (typeof newPassword !== "string" || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json({ error: "비밀번호는 영문+숫자 포함 8자 이상" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const { error } = await admin
    .from("specialty_contractors")
    .update({ password_hash: hash, updated_at: new Date().toISOString() })
    .eq("id", params.contractorId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
