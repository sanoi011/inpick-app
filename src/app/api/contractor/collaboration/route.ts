import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

// 받은/보낸 협업 요청 조회
export async function GET(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const contractorId = req.nextUrl.searchParams.get("contractorId");
  const direction = req.nextUrl.searchParams.get("direction") || "received"; // received | sent

  if (!contractorId || contractorId !== authContractorId) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const column = direction === "sent" ? "requester_id" : "target_id";

    const { data, error } = await supabase
      .from("collaboration_requests")
      .select("*, requester:specialty_contractors!requester_id(id, company_name, contact_name, phone, region, rating), target:specialty_contractors!target_id(id, company_name, contact_name, phone, region, rating)")
      .eq(column, contractorId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Collaboration GET error:", error);
      return NextResponse.json({ error: "협업 요청 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error("Collaboration GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// 협업 요청 수락/거절
export async function PATCH(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, contractorId, status: newStatus, responseMessage } = body;

    if (!id || !contractorId || !newStatus) {
      return NextResponse.json({ error: "id, contractorId, status 필수" }, { status: 400 });
    }

    if (contractorId !== authContractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const validStatuses = ["accepted", "rejected", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
    }

    const supabase = createClient();

    // 권한 확인: target_id (수락/거절) 또는 requester_id (취소)
    const { data: existing } = await supabase
      .from("collaboration_requests")
      .select("requester_id, target_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });
    }

    if (newStatus === "cancelled" && existing.requester_id !== contractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    if ((newStatus === "accepted" || newStatus === "rejected") && existing.target_id !== contractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (responseMessage) updates.response_message = responseMessage;
    if (newStatus === "accepted" || newStatus === "rejected") {
      updates.responded_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("collaboration_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Collaboration PATCH error:", error);
      return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
    }

    // 알림 전송
    const notifyTarget = newStatus === "cancelled" ? existing.target_id : existing.requester_id;
    const statusLabel = newStatus === "accepted" ? "수락" : newStatus === "rejected" ? "거절" : "취소";
    await supabase.from("contractor_notifications").insert({
      contractor_id: notifyTarget,
      type: "COLLABORATION",
      title: `협업 요청이 ${statusLabel}되었습니다`,
      message: responseMessage || `협업 요청 상태: ${statusLabel}`,
      priority: "normal",
      link: "/contractor/matching",
    });

    return NextResponse.json({ request: data });
  } catch (err) {
    console.error("Collaboration PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { requesterId, targetId, projectId, message, proposedAmount, proposedStartDate, proposedEndDate } = body;

    if (!requesterId || !targetId) {
      return NextResponse.json({ error: "requesterId, targetId 필수" }, { status: 400 });
    }

    if (requesterId !== authContractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("collaboration_requests")
      .insert({
        requester_id: requesterId,
        target_id: targetId,
        project_id: projectId || null,
        message: message || null,
        proposed_amount: proposedAmount || null,
        proposed_start_date: proposedStartDate || null,
        proposed_end_date: proposedEndDate || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Collaboration POST error:", error);
      return NextResponse.json({ error: "협업 요청 실패" }, { status: 500 });
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err) {
    console.error("Collaboration POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
