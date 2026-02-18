import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: contractorId } = params;

  try {
    const body = await req.json();
    const { consumerName, consumerPhone, consumerEmail, message, projectType, estimatedBudget, consumerId } = body;

    if (!consumerName || !consumerPhone) {
      return NextResponse.json({ error: "이름과 연락처는 필수입니다" }, { status: 400 });
    }

    const supabase = createClient();

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
        consumer_id: consumerId || null,
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
    ]).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Inquiry POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
