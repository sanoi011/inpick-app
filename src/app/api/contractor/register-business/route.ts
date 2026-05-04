/**
 * POST /api/contractor/register-business
 *
 * Supabase 인증된 사용자(OAuth로 로그인한 사람)가 사업자 정보를 등록.
 * 입력: { businessNumber, corpNumber?, ceoName, businessAddress, mainPhone, contactPhone, contactEmail, companyName? }
 * 동작: specialty_contractors INSERT/UPSERT (auth user 이메일 기준)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createToken } from "@/lib/contractor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  businessNumber: string;
  corpNumber?: string;
  ceoName: string;
  businessAddress: string;
  mainPhone: string;
  contactPhone: string;
  contactEmail: string;
  companyName?: string;
}

function isValidBizNumber(n: string): boolean {
  return /^\d{3}-?\d{2}-?\d{5}$/.test(n.replace(/\s/g, ""));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    if (!body.businessNumber || !isValidBizNumber(body.businessNumber)) {
      return NextResponse.json(
        { error: "사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)" },
        { status: 400 },
      );
    }
    if (!body.ceoName || !body.businessAddress || !body.mainPhone || !body.contactEmail) {
      return NextResponse.json(
        { error: "대표자명·사업장주소·대표연락처·담당자이메일은 필수입니다." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const email = user.email || body.contactEmail;
    const companyName = body.companyName || `${body.ceoName} 사업자`;

    // 이미 같은 이메일 또는 사업자번호로 등록된 경우 → update, 아니면 insert
    const { data: exist } = await admin
      .from("specialty_contractors")
      .select("id")
      .or(`email.eq.${email},business_number.eq.${body.businessNumber}`)
      .maybeSingle();

    const payload = {
      email,
      company_name: companyName,
      contact_name: body.ceoName,
      business_number: body.businessNumber.replace(/-/g, ""),
      corp_number: body.corpNumber?.replace(/-/g, "") || null,
      ceo_name: body.ceoName,
      business_address: body.businessAddress,
      main_phone: body.mainPhone,
      contact_phone: body.contactPhone || body.mainPhone,
      contact_email: body.contactEmail,
      region: body.businessAddress.split(" ")[0] || "전국",
      is_active: true,
      is_verified: false, // 관리자 검증 후 true
    };

    let row;
    if (exist?.id) {
      const { data, error } = await admin
        .from("specialty_contractors")
        .update(payload)
        .eq("id", exist.id)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: "업데이트 실패", detail: error.message },
          { status: 500 },
        );
      }
      row = data;
    } else {
      const { data, error } = await admin
        .from("specialty_contractors")
        .insert(payload)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: "등록 실패", detail: error.message },
          { status: 500 },
        );
      }
      row = data;
    }

    // 사업자 토큰 발급
    const token = createToken(row.id, row.email);

    return NextResponse.json({
      ok: true,
      token,
      contractor: {
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        email: row.email,
        business_number: row.business_number,
        is_verified: row.is_verified,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
