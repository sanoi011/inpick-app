import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

export async function GET(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }
  if (contractorId !== authContractorId) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const supabase = createClient();

    const { data: contractor, error } = await supabase
      .from("specialty_contractors")
      .select(`
        id, company_name, contact_name, phone, email, address, region,
        license_number, introduction, description, logo_url,
        is_public, is_verified, contractor_type,
        contractor_trades(id, trade_code, trade_name, experience_years, is_primary),
        contractor_portfolio(id, title, description, project_type, completion_date, images, tags, work_scope, features),
        contractor_reviews(id, overall_rating, rating, content, response_content, response_at, created_at, is_verified)
      `)
      .eq("id", contractorId)
      .single();

    if (error || !contractor) {
      return NextResponse.json({ error: "업체 정보를 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json({ contractor });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { contractorId, trades, ...updateFields } = body;

    if (!contractorId) {
      return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
    }
    if (contractorId !== authContractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const supabase = createClient();

    // 기본 정보 업데이트
    const allowedFields: Record<string, string> = {
      companyName: "company_name",
      representativeName: "contact_name",
      phone: "phone",
      email: "email",
      address: "address",
      region: "region",
      licenseNumber: "license_number",
      introduction: "introduction",
      description: "description",
      logoUrl: "logo_url",

      isPublic: "is_public",
      contractorType: "contractor_type",
    };

    const dbUpdate: Record<string, unknown> = {};
    for (const [key, dbKey] of Object.entries(allowedFields)) {
      if (updateFields[key] !== undefined) {
        dbUpdate[dbKey] = updateFields[key];
      }
    }

    if (Object.keys(dbUpdate).length > 0) {
      dbUpdate.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("specialty_contractors")
        .update(dbUpdate)
        .eq("id", contractorId);

      if (updateError) {
        console.error("Profile update error:", updateError);
        return NextResponse.json({ error: "프로필 업데이트 실패" }, { status: 500 });
      }
    }

    // 공종 업데이트 (있으면)
    if (trades && Array.isArray(trades)) {
      // 기존 공종 삭제
      await supabase
        .from("contractor_trades")
        .delete()
        .eq("contractor_id", contractorId);

      // 새 공종 삽입
      if (trades.length > 0) {
        const tradeRows = trades.map((t: { code: string; label: string; experienceYears?: number; isPrimary?: boolean }) => ({
          contractor_id: contractorId,
          trade_code: t.code,
          trade_name: t.label,
          experience_years: t.experienceYears || 0,
          is_primary: t.isPrimary || false,
        }));

        const { error: tradeError } = await supabase
          .from("contractor_trades")
          .insert(tradeRows);

        if (tradeError) {
          console.error("Trade update error:", tradeError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
