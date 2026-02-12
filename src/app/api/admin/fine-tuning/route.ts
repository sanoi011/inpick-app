import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/fine-tuning
 * 긍정 피드백 AI 대화를 JSONL 학습 데이터셋으로 추출
 *
 * Query params:
 *   agentType?: "consumer_design" | "contractor_ai" | "consult"
 *   minRating?: number (default 4)
 *   format?: "jsonl" | "json" (default "jsonl")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentType = searchParams.get("agentType");
  const minRating = parseInt(searchParams.get("minRating") || "4");
  const format = searchParams.get("format") || "jsonl";

  try {
    const supabase = createClient();

    let query = supabase
      .from("ai_conversations")
      .select("session_id, agent_type, user_message, assistant_response, context_type, context_data, user_rating, was_helpful, model_name, created_at")
      .order("created_at", { ascending: true });

    // 긍정 피드백 필터: rating >= minRating OR was_helpful = true
    if (minRating > 0) {
      query = query.or(`user_rating.gte.${minRating},was_helpful.eq.true`);
    }

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    const { data, error } = await query.limit(5000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "추출 가능한 데이터가 없습니다.", count: 0 }, { status: 404 });
    }

    // JSONL 형식: 각 행 = {"messages": [{"role":"system",...},{"role":"user",...},{"role":"assistant",...}]}
    if (format === "jsonl") {
      const lines = data.map((row) => {
        const systemPrompt = row.agent_type === "contractor_ai"
          ? "당신은 INPICK의 사업자 AI 비서입니다. 인테리어 시공업체의 입찰 전략, 견적 검토, 일정 최적화를 도와줍니다."
          : "당신은 INPICK의 AI 인테리어 디자인 전문가입니다. 마감재, 색상, 가구 배치, 조명을 추천합니다.";

        return JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: row.user_message },
            { role: "assistant", content: row.assistant_response },
          ],
          metadata: {
            session_id: row.session_id,
            agent_type: row.agent_type,
            rating: row.user_rating,
            helpful: row.was_helpful,
            created_at: row.created_at,
          },
        });
      });

      const jsonl = lines.join("\n");

      return new Response(jsonl, {
        headers: {
          "Content-Type": "application/jsonl",
          "Content-Disposition": `attachment; filename="inpick-finetune-${new Date().toISOString().split("T")[0]}.jsonl"`,
        },
      });
    }

    // JSON 형식: 통계 포함
    return NextResponse.json({
      count: data.length,
      stats: {
        avgRating: data.filter((d) => d.user_rating).reduce((s, d) => s + (d.user_rating || 0), 0) / (data.filter((d) => d.user_rating).length || 1),
        helpfulCount: data.filter((d) => d.was_helpful).length,
        agentTypes: Object.fromEntries(
          ["consumer_design", "contractor_ai", "consult"].map((t) => [t, data.filter((d) => d.agent_type === t).length])
        ),
      },
      data: data.map((row) => ({
        sessionId: row.session_id,
        agentType: row.agent_type,
        userMessage: row.user_message,
        assistantResponse: row.assistant_response,
        rating: row.user_rating,
        helpful: row.was_helpful,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error("Fine-tuning export error:", err);
    return NextResponse.json({ error: "데이터 추출 실패" }, { status: 500 });
  }
}
