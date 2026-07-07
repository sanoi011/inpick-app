/**
 * GET /api/admin/chat-messages
 *
 * 관리자가 소비자-사업자 채팅을 모니터링 (분쟁 시 중재용).
 *
 * 쿼리:
 *  - roomId?: 특정 채팅방
 *  - userId?: 특정 사용자
 *  - since?: ISO 시각 이후
 *  - page, limit
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createServiceClient(url, key);
  return createClient();
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = getSupabase();
  const { searchParams } = request.nextUrl;
  const roomId = searchParams.get("roomId");
  const userId = searchParams.get("userId");
  const since = searchParams.get("since");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("chat_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (roomId) query = query.eq("room_id", roomId);
    if (userId) query = query.eq("sender_id", userId);
    if (since) query = query.gte("created_at", since);

    const { data, count, error } = await query;
    if (error) throw error;

    // 채팅방 목록 (메시지 카운트 + 마지막 메시지)
    const { data: rooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    return NextResponse.json({
      messages: data || [],
      total: count || 0,
      page,
      limit,
      recentRooms: rooms || [],
    });
  } catch (err) {
    console.error("Admin chat-messages error:", err);
    return NextResponse.json({ error: "채팅 조회 실패" }, { status: 500 });
  }
}
