import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
    }

    // 이메일로 사업자 조회
    const { data: contractor, error } = await supabase
      .from("specialty_contractors")
      .select("id, company_name, contact_name, email, region, rating, is_verified, is_active")
      .eq("email", email)
      .eq("is_active", true)
      .single();

    if (error || !contractor) {
      return NextResponse.json({ error: "등록되지 않은 이메일입니다." }, { status: 401 });
    }

    // 간단한 토큰 생성 (email + timestamp base64)
    const token = Buffer.from(`${contractor.id}:${contractor.email}:${Date.now()}`).toString("base64");

    return NextResponse.json({
      token,
      contractor: {
        id: contractor.id,
        company_name: contractor.company_name,
        contact_name: contractor.contact_name,
        email: contractor.email,
        region: contractor.region,
        rating: contractor.rating,
        is_verified: contractor.is_verified,
      },
    });
  } catch {
    return NextResponse.json({ error: "로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
