import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

// GET: 사업자 알림 목록 (실제 DB 조회)
export async function GET(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId || contractorId !== authContractorId) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("contractor_notifications")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "알림 조회 실패" }, { status: 500 });
  }

  // camelCase 변환
  const notifications = (data || []).map((n) => ({
    id: n.id,
    contractorId: n.contractor_id,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    isRead: n.is_read,
    link: n.link,
    referenceId: n.reference_id,
    createdAt: n.created_at,
  }));

  return NextResponse.json({ notifications });
}

// PATCH: 알림 읽음 처리
export async function PATCH(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const supabase = createClient();

  try {
    const body = await req.json();
    const { id, ids, markAllRead, contractorId } = body;

    // 전체 읽음 처리
    if (markAllRead && contractorId) {
      if (contractorId !== authContractorId) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
      }
      await supabase
        .from("contractor_notifications")
        .update({ is_read: true })
        .eq("contractor_id", authContractorId)
        .eq("is_read", false);

      return NextResponse.json({ success: true });
    }

    // 여러 건 읽음 처리
    if (ids && Array.isArray(ids)) {
      await supabase
        .from("contractor_notifications")
        .update({ is_read: true })
        .in("id", ids)
        .eq("contractor_id", authContractorId);

      return NextResponse.json({ success: true });
    }

    // 단일 읽음 처리
    if (id) {
      await supabase
        .from("contractor_notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("contractor_id", authContractorId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "id, ids, 또는 markAllRead가 필요합니다." }, { status: 400 });
  } catch (err) {
    console.error("Notification PATCH error:", err);
    return NextResponse.json({ error: "알림 업데이트 실패" }, { status: 500 });
  }
}
