import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 채팅방 목록
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const userId = req.nextUrl.searchParams.get("userId");
    const userType = req.nextUrl.searchParams.get("userType") || "consumer";

    if (!userId) {
      return NextResponse.json({ error: "userId 필요" }, { status: 400 });
    }

    const column = userType === "contractor" ? "contractor_id" : "consumer_id";

    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq(column, userId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: "채팅방 조회 실패" }, { status: 500 });
    }

    // 각 방의 미읽음 수 계산
    const rooms = await Promise.all(
      (data || []).map(async (room) => {
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .neq("sender_id", userId)
          .eq("is_read", false);

        return { ...room, unreadCount: count || 0 };
      })
    );

    return NextResponse.json({ rooms });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
