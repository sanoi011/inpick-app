/**
 * GET /api/contractor/test-accounts
 *
 * 테스트용 사업자 계정 목록 + 자동 생성.
 * - specialty_contractors 테이블에 'test'/'inpick' 키워드 포함된 계정 list
 * - 없으면 contractor@inpick.kr 자동 생성
 *
 * Production 보안 노출 OK — 테스트 전용 (실제 인증·권한 처리 X)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();

    // 1) 기존 테스트 계정 조회
    const { data: existing } = await admin
      .from("specialty_contractors")
      .select(
        "id, email, company_name, contact_name, region, is_verified, is_active, created_at",
      )
      .or("email.ilike.%test%,email.ilike.%inpick%,email.ilike.%demo%,company_name.ilike.%테스트%")
      .order("created_at", { ascending: false })
      .limit(20);

    // 2) 기본 테스트 계정 (contractor@inpick.kr) 보장
    const ensure = "contractor@inpick.kr";
    let primary = existing?.find((r) => r.email === ensure);
    if (!primary) {
      const { data: created } = await admin
        .from("specialty_contractors")
        .insert({
          email: ensure,
          company_name: "테스트 인테리어",
          contact_name: "테스트 담당자",
          phone: "010-0000-0000",
          region: "seoul",
          rating: 4.5,
          is_verified: true,
          is_active: true,
        })
        .select()
        .single();
      if (created) primary = created;
    }

    return NextResponse.json({
      primary: primary
        ? {
            email: primary.email,
            company_name: primary.company_name,
            password_note: "비밀번호 없음 — OAuth 사용 또는 /api/contractor/login 이메일 입력만으로 진입",
            login_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://interiorpick.co.kr"}/contractor/login`,
          }
        : null,
      all: existing || [],
      count: existing?.length || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
