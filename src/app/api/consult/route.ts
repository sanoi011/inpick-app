import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `당신은 INPICK의 AI 인테리어 컨설턴트입니다.

역할:
- 사용자의 인테리어 니즈를 파악하고 적절한 마감재와 시공법을 추천합니다.
- 실시간 공식 단가(한국물가협회, 대한건설협회, 조달청) 기반으로 정확한 견적 정보를 제공합니다.
- 선행공정(예: 타일 시공 전 방수 처리)을 자동으로 안내합니다.

규칙:
- 한국어로 답변하세요.
- 인테리어/건축/시공 관련 질문에만 답변하세요.
- 비용 언급 시 "대략적인 참고 금액"임을 명시하세요.
- 답변은 친절하고 전문적으로, 300자 이내로 간결하게 하세요.
- 공간 유형(거실, 주방, 안방, 침실, 욕실, 현관, 발코니)에 맞는 추천을 하세요.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI 서비스가 설정되지 않았습니다." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, sessionId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "메시지가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call Claude API with streaming
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
        system: SYSTEM_PROMPT,
        stream: true,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI 응답 생성 중 오류가 발생했습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save session to Supabase (non-blocking)
    if (sessionId) {
      saveSession(sessionId, messages).catch(console.error);
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

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
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                    );
                  }
                } catch {
                  // skip unparseable chunks
                }
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
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Consult API error:", err);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function saveSession(sessionId: string, messages: { role: string; content: string }[]) {
  try {
    const supabase = createClient();
    await supabase.from("consult_sessions").upsert(
      {
        id: sessionId,
        session_type: "chat",
        status: "active",
        messages: JSON.stringify(messages),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.error("Session save error:", err);
  }
}
