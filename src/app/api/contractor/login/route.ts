import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createToken } from "@/lib/contractor-auth";

/**
 * POST /api/contractor/login
 *
 * 입력: { email, password }
 * - service_role로 specialty_contractors 조회 (RLS 우회)
 * - 미등록 이메일이면 자동 등록 (이메일 형식 유효 시) + 토큰 발급
 *   → 개발·운영 편의: 별도 회원가입 단계 없이 즉시 접근 가능
 * - is_active=false면 거부
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1) specialty_contractors 조회 (RLS 우회 — service_role)
    const { data: contractor, error } = await admin
      .from("specialty_contractors")
      .select(
        "id, company_name, contact_name, email, region, rating, is_verified, is_active",
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[contractor login] select error:", error);
      return NextResponse.json(
        { error: "DB 조회 실패", detail: error.message },
        { status: 500 },
      );
    }

    let row = contractor;

    // 2) 등록된 사업자 없으면 자동 생성 (테스트 + 신규 가입 자동화)
    if (!row) {
      const guess = email.split("@")[0];
      const { data: created, error: insErr } = await admin
        .from("specialty_contractors")
        .insert({
          email,
          company_name: `${guess} 사업자`,
          contact_name: guess,
          region: "전국",
          rating: 0,
          is_verified: false,
          is_active: true,
        })
        .select(
          "id, company_name, contact_name, email, region, rating, is_verified, is_active",
        )
        .single();

      if (insErr || !created) {
        console.error("[contractor login] auto-create fail:", insErr);
        return NextResponse.json(
          {
            error: "사업자 자동 등록 실패. 가입 페이지에서 직접 등록해주세요.",
            detail: insErr?.message,
          },
          { status: 500 },
        );
      }
      row = created;
    }

    if (!row.is_active) {
      return NextResponse.json(
        { error: "비활성화된 사업자 계정입니다. 관리자에게 문의해주세요." },
        { status: 403 },
      );
    }

    // 비밀번호는 현재 별도 검증 없음 (소셜·이메일 인증 도입 전 단계)
    void password;

    const token = createToken(row.id, row.email);

    return NextResponse.json({
      token,
      contractor: {
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        email: row.email,
        region: row.region,
        rating: row.rating,
        is_verified: row.is_verified,
      },
    });
  } catch (err) {
    console.error("Contractor login error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "로그인 중 오류" },
      { status: 500 },
    );
  }
}
