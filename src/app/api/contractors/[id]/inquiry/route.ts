import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: contractorId } = params;

  try {
    const body = await req.json();
    const {
      consumerName, consumerPhone, consumerEmail, message, projectType,
      estimatedBudget, consumerId, sharingAccepted, consentVersion,
    } = body;

    if (!consumerName || !consumerPhone) {
      return NextResponse.json({ error: "이름과 연락처는 필수입니다" }, { status: 400 });
    }
    if (sharingAccepted !== true || consentVersion !== "contractor-inquiry-v1") {
      return NextResponse.json({ error: "정보 공유 동의가 필요합니다" }, { status: 400 });
    }

    const supabase = createClient();

    // consumerId가 제공된 경우 인증된 사용자와 일치하는지 확인
    let verifiedConsumerId = null;
    if (consumerId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === consumerId) {
        verifiedConsumerId = consumerId;
      }
      // 인증 안 된 경우 consumerId 무시 (비회원 문의 허용)
    }

    // 업체 존재 확인
    const { data: contractor, error: contractorErr } = await supabase
      .from("specialty_contractors")
      .select("id, company_name, inquiry_count")
      .eq("id", contractorId)
      .eq("is_active", true)
      .single();

    if (contractorErr || !contractor) {
      return NextResponse.json({ error: "업체를 찾을 수 없습니다" }, { status: 404 });
    }

    // 문의 등록
    const { error: insertErr } = await supabase
      .from("contractor_inquiries")
      .insert({
        contractor_id: contractorId,
        consumer_id: verifiedConsumerId,
        consumer_name: consumerName,
        consumer_phone: consumerPhone,
        consumer_email: consumerEmail || null,
        message: message || null,
        project_type: projectType || null,
        estimated_budget: estimatedBudget || null,
        status: "pending",
      });

    if (insertErr) {
      console.error("Inquiry insert error:", insertErr);
      return NextResponse.json({ error: "문의 등록 실패" }, { status: 500 });
    }

    // 업체 문의 카운트 증가 + 알림 생성 (fire-and-forget)
    Promise.all([
      supabase
        .from("specialty_contractors")
        .update({ inquiry_count: (contractor.inquiry_count ?? 0) + 1 })
        .eq("id", contractorId)
        .then(() => {}),
      supabase.from("contractor_notifications").insert({
        contractor_id: contractorId,
        type: "INQUIRY",
        title: "새 문의가 도착했습니다",
        message: `${consumerName}님이 ${projectType || "인테리어"} 문의를 보냈습니다`,
        priority: "HIGH",
        is_read: false,
      }).then(() => {}),
    ]).catch((err) => {
      console.error("Inquiry side-effects error:", err);
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Inquiry POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
