import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 채팅 메시지 조회
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const roomId = req.nextUrl.searchParams.get("roomId");
    const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;
    const before = req.nextUrl.searchParams.get("before");

    if (!roomId) {
      return NextResponse.json({ error: "roomId 필요" }, { status: 400 });
    }

    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "메시지 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ messages: (data || []).reverse() });
  } catch (err) {
    console.error("Chat GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST: 메시지 전송
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const { roomId, senderId, senderType, senderName, content, messageType } = body;

    if (!roomId || !senderId || !senderType || !content) {
      return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
    }

    // senderName 길이 제한
    const safeSenderName = senderName ? String(senderName).substring(0, 100) : null;

    // 채팅방 존재 확인 및 자동 생성
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("id, consumer_id, contractor_id")
      .eq("id", roomId)
      .single();

    if (!room) {
      // 채팅방이 없으면 생성
      await supabase.from("chat_rooms").insert({
        id: roomId,
        consumer_id: senderType === "consumer" ? senderId : null,
        contractor_id: senderType === "contractor" ? senderId : null,
      });
    } else {
      // 기존 채팅방이면 참가자인지 확인
      const isParticipant = room.consumer_id === senderId || room.contractor_id === senderId;
      if (!isParticipant) {
        return NextResponse.json({ error: "채팅방 참가자가 아닙니다" }, { status: 403 });
      }
    }

    // 메시지 저장
    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: senderId,
        sender_type: senderType,
        sender_name: safeSenderName,
        content,
        message_type: messageType || "text",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "메시지 전송 실패" }, { status: 500 });
    }

    // 채팅방 마지막 메시지 업데이트
    await supabase
      .from("chat_rooms")
      .update({
        last_message: content.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("Chat POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 읽음 처리
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const { roomId, readerId } = body;

    if (!roomId || !readerId) {
      return NextResponse.json({ error: "roomId, readerId 필요" }, { status: 400 });
    }

    // 채팅방 참가자 확인
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("consumer_id, contractor_id")
      .eq("id", roomId)
      .single();

    if (room && room.consumer_id !== readerId && room.contractor_id !== readerId) {
      return NextResponse.json({ error: "채팅방 참가자가 아닙니다" }, { status: 403 });
    }

    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("room_id", roomId)
      .neq("sender_id", readerId)
      .eq("is_read", false);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Chat PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
