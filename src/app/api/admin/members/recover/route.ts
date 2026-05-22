/**
 * POST /api/admin/members/recover
 *
 * 관리자가 /admin/members orphan 탭에서 "프로필 복구 시도"를 누를 때 호출.
 * auth.users는 있으나 consumer_profiles가 없는 회원에 대해 ensureConsumerProfile 실행.
 *
 * body: { userId: string }
 *
 * 결과:
 *  - 생성 성공      → { ok:true, created:true }
 *  - 이미 존재      → { ok:true, created:false }
 *  - 휴대폰 없어 불가 → { ok:false, reason:"phone_missing" }  (스키마상 phone NOT NULL/UNIQUE)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin } from "@/lib/admin-auth";
import { ensureConsumerProfile, normalizeEmail } from "@/lib/auth/self-member-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: "userId_required" }, { status: 400 });

  const admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: got, error: getErr } = await admin.auth.admin.getUserById(body.userId);
  if (getErr || !got?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const u = got.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const provider = (u.app_metadata?.provider as string) || "email";

  const r = await ensureConsumerProfile({
    userId: u.id,
    email: normalizeEmail(u.email),
    name: (meta.full_name as string) || (meta.name as string) || null,
    phone: (meta.phone as string) || null,
    provider,
  });

  if (r.profileExists) {
    return NextResponse.json({
      ok: true,
      created: r.created,
      message: r.created ? "프로필을 생성했습니다." : "이미 프로필이 존재합니다.",
    });
  }

  // phone이 없어 자동 생성 불가 (consumer_profiles.phone NOT NULL + UNIQUE)
  return NextResponse.json({
    ok: false,
    created: false,
    reason: "phone_missing",
    message: "휴대폰번호가 없어 자동 생성할 수 없습니다. 사용자 마이페이지에서 휴대폰 입력 후 재시도하거나 수동 처리가 필요합니다.",
  });
}
