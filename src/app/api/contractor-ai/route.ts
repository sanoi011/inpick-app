import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildSystemPrompt(context?: Record<string, unknown>) {
  let prompt = `당신은 INPICK의 사업자 AI 비서입니다.

역할:
- 인테리어 시공업체의 입찰 전략을 분석하고 조언합니다.
- 프로젝트 견적서를 검토하고 적정 단가를 제안합니다.
- 공종별 시공 일정 최적화를 도와줍니다.
- 하도급 업체 선정 시 고려사항을 안내합니다.
- 재무 현황 분석과 현금흐름 관리를 조언합니다.
- 리스크 요인을 식별하고 대응 방안을 제시합니다.

규칙:
- 한국어로 답변하세요.
- 건설/인테리어 사업 관련 질문에만 답변하세요.
- 입찰가 제안 시 공식 단가 기준임을 명시하세요.
- 답변은 전문적이고 실무적으로, 500자 이내로 하세요.
- 법규(건설산업기본법, 하도급법 등) 관련 사항은 확인을 권유하세요.

응답 형식 지시:
- 경고/주의 사항이 있으면 [ALERT] 태그로 감싸세요. 예: [ALERT]이 입찰은 적자 위험이 있습니다.[ALERT]
- 제안/추천이 있으면 [SUGGESTION] 태그로 감싸세요. 예: [SUGGESTION]할인율 5%를 적용하면 낙찰 확률이 높아집니다.[SUGGESTION]
- 데이터/수치 분석이 있으면 [DATA] 태그로 감싸세요. 예: [DATA]현재 마진율: 15%, 업계 평균: 20%[DATA]
- 태그는 필요할 때만 사용하세요. 일반 대화에는 사용하지 않아도 됩니다.`;

  if (context) {
    prompt += `\n\n현재 사업자 컨텍스트:`;
    if (context.companyName) prompt += `\n- 업체명: ${context.companyName}`;
    if (context.activeProjectCount !== undefined) prompt += `\n- 진행 중 프로젝트: ${context.activeProjectCount}건`;
    if (context.pendingBidCount !== undefined) prompt += `\n- 대기 중 입찰: ${context.pendingBidCount}건`;
    if (context.monthlyRevenue !== undefined) prompt += `\n- 이번달 매출: ${Number(context.monthlyRevenue).toLocaleString()}원`;
    if (context.receivableTotal !== undefined) prompt += `\n- 미수금: ${Number(context.receivableTotal).toLocaleString()}원`;
    if (context.upcomingScheduleCount !== undefined) prompt += `\n- 이번주 일정: ${context.upcomingScheduleCount}건`;
    if (context.avgRating !== undefined) prompt += `\n- 평균 평점: ${context.avgRating}`;
  }

  return prompt;
}

async function collectContext(contractorId: string): Promise<Record<string, unknown>> {
  try {
    const supabase = createClient();

    // 업체 정보
    const { data: profile } = await supabase
      .from("specialty_contractors")
      .select("company_name, rating")
      .eq("id", contractorId)
      .single();

    // 진행 중 프로젝트 수
    const { count: projectCount } = await supabase
      .from("contractor_projects")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .eq("status", "in_progress");

    // 대기 중 입찰 수
    const { count: bidCount } = await supabase
      .from("bids")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .eq("status", "pending");

    // 이번달 매출
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: payments } = await supabase
      .from("payment_records")
      .select("amount")
      .eq("contractor_id", contractorId)
      .eq("payment_type", "income")
      .gte("paid_at", monthStart);

    const monthlyRevenue = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);

    // 미수금
    const { data: unpaid } = await supabase
      .from("invoices")
      .select("total")
      .eq("contractor_id", contractorId)
      .in("status", ["sent", "overdue"]);

    const receivableTotal = (unpaid || []).reduce((s, i) => s + (i.total || 0), 0);

    // 이번주 일정
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const { count: scheduleCount } = await supabase
      .from("contractor_schedules")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .gte("date", now.toISOString().split("T")[0])
      .lte("date", weekEnd.toISOString().split("T")[0]);

    return {
      companyName: profile?.company_name || "",
      activeProjectCount: projectCount || 0,
      pendingBidCount: bidCount || 0,
      monthlyRevenue,
      receivableTotal,
      upcomingScheduleCount: scheduleCount || 0,
      avgRating: profile?.rating || 0,
    };
  } catch {
    return {};
  }
}

// construction_knowledge에서 관련 지식 검색
async function searchKnowledge(query: string): Promise<string> {
  try {
    const supabase = createClient();
    const keywords = query.match(/[가-힣]{2,}/g) || [];
    if (keywords.length === 0) return "";

    const searchTerms = keywords.slice(0, 3);
    const results: { title: string; content: string; category: string }[] = [];

    for (const term of searchTerms) {
      const { data } = await supabase
        .from("construction_knowledge")
        .select("title, content, category")
        .ilike("content", `%${term}%`)
        .limit(2);
      if (data) results.push(...data);
    }

    const unique = Array.from(new Map(results.map(r => [r.content, r])).values()).slice(0, 3);
    if (unique.length === 0) return "";

    return "\n\n[참고 건설 지식베이스]\n" + unique.map(r =>
      `[${r.category}] ${r.title}\n${r.content.slice(0, 500)}`
    ).join("\n---\n");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI 서비스가 설정되지 않았습니다." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, contractorId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "메시지가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 컨텍스트 수집
    let context: Record<string, unknown> | undefined;
    if (contractorId) {
      context = await collectContext(contractorId);
    }

    // 지식베이스 검색
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const knowledgeContext = await searchKnowledge(lastUserMsg);

    const systemPrompt = buildSystemPrompt(context) + knowledgeContext;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        stream: true,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", await response.text());
      return new Response(
        JSON.stringify({ error: "AI 응답 생성 중 오류가 발생했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) { controller.close(); return; }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                  }
                } catch { /* skip */ }
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    console.error("Contractor AI error:", err);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
