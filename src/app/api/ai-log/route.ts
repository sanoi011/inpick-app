import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: AI 대화 로깅
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const {
      sessionId,
      userId,
      agentType = "consumer_design",
      userMessage,
      assistantResponse,
      contextType,
      contextId,
      contextData,
      modelName = "gemini-2.0-flash",
      responseTimeMs,
      tokenCount,
    } = body;

    if (!sessionId || !userMessage || !assistantResponse) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        session_id: sessionId,
        user_id: userId || null,
        agent_type: agentType,
        user_message: userMessage,
        assistant_response: assistantResponse,
        context_type: contextType || null,
        context_id: contextId || null,
        context_data: contextData || {},
        model_name: modelName,
        response_time_ms: responseTimeMs || null,
        token_count: tokenCount || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("AI log insert error:", error);
      return NextResponse.json({ error: "로깅 실패" }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("AI log error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH: 피드백 업데이트
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { id, userRating, wasHelpful, feedbackText } = body;

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (userRating !== undefined) updateData.user_rating = userRating;
    if (wasHelpful !== undefined) updateData.was_helpful = wasHelpful;
    if (feedbackText !== undefined) updateData.feedback_text = feedbackText;

    const { error } = await supabase
      .from("ai_conversations")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("AI feedback update error:", error);
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("AI feedback error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
