import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId 필요" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("consumer_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "알림 조회 실패" }, { status: 500 });
  }

  const notifications = (data || []).map((n) => ({
    id: n.id,
    userId: n.user_id,
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

export async function PATCH(req: NextRequest) {
  const supabase = createClient();

  try {
    const body = await req.json();
    const { id, ids, markAllRead, userId } = body;

    if (markAllRead && userId) {
      await supabase
        .from("consumer_notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids)) {
      await supabase
        .from("consumer_notifications")
        .update({ is_read: true })
        .in("id", ids);

      return NextResponse.json({ success: true });
    }

    if (id) {
      await supabase
        .from("consumer_notifications")
        .update({ is_read: true })
        .eq("id", id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "id, ids, 또는 markAllRead 필요" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "알림 업데이트 실패" }, { status: 500 });
  }
}
