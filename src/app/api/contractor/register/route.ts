import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const {
      companyName, representativeName, phone, email,
      licenseNumber, region, address, selectedTrades,
      experienceYears, introduction,
    } = body;

    if (!companyName || !representativeName || !phone || !email) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 1. 사업자 등록
    const { data: contractor, error: insertErr } = await supabase
      .from("specialty_contractors")
      .insert({
        company_name: companyName,
        contact_name: representativeName,
        phone,
        email,
        license_number: licenseNumber || null,
        region: region || "서울",
        address: address || null,
        rating: 0,
        total_reviews: 0,
        completed_projects: 0,
        is_verified: false,
        is_active: true,
        metadata: { introduction: introduction || "", registration_status: "pending" },
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "이미 등록된 업체입니다." }, { status: 409 });
      }
      return NextResponse.json({ error: "등록 실패: " + insertErr.message }, { status: 500 });
    }

    // 2. 공종 등록
    if (selectedTrades && selectedTrades.length > 0 && contractor) {
      const tradeRows = selectedTrades.map((code: string, i: number) => ({
        contractor_id: contractor.id,
        trade_code: code,
        trade_name: getTradeLabel(code),
        experience_years: experienceYears || 0,
        is_primary: i === 0,
      }));

      await supabase.from("contractor_trades").insert(tradeRows);
    }

    return NextResponse.json({ contractor }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}

function getTradeLabel(code: string): string {
  const map: Record<string, string> = {
    T01: "도배", T02: "타일", T03: "목공", T04: "전기", T05: "설비",
    T06: "도장", T07: "철거", T08: "방수", T09: "금속", T10: "유리",
    T11: "석재", T12: "조적", T13: "미장", T14: "단열", T15: "주방가구",
    T16: "붙박이장", T17: "바닥재", T18: "조명", T19: "욕실", T20: "HVAC",
    T21: "보양", T22: "청소",
  };
  return map[code] || code;
}
