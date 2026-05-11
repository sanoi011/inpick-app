/**
 * POST /api/inpick/design-chat/stream
 *
 * 가이드(InPick_STEP02_Workflow.md §1) 준수:
 * - 모델: claude-sonnet-4-6 (Anthropic 직접 호출, fallback 금지)
 * - SSE 스트리밍
 * - 시스템 프롬프트는 가이드 49~65 그대로
 *
 * 입력: { messages: [{role, content}, ...] }
 * 출력: SSE 'data: <chunk>\n\n' ... 'data: [DONE]\n\n'
 */
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `당신은 InPick의 인테리어 상담 AI입니다.
사용자의 거주 공간(아파트/주택), 평수, 가족 구성, 라이프스타일을 자연스럽게 파악하고,
원하는 인테리어 스타일(미니멀/모던/클래식/내추럴 등)과 톤(우드톤/모노톤/컬러)을 끌어냅니다.

대화 규칙 (중요):
- 한국어로 친근하게 대화
- **인사말 금지**: 사용자가 이미 화면에서 인사를 받았으니 절대 "안녕하세요"/"반갑습니다"/"InPick AI입니다" 등으로 시작하지 마라.
  사용자의 질문에 곧바로 답변/추천부터 시작.
- 한 번에 한 가지 질문만
- 4~5턴 안에 핵심 정보 수집 완료
- 정보가 충분하면 마지막에 '이미지를 생성하시겠습니까?' 물어봄
- 사용자가 구체적인 자재/가구/색상 등을 물으면 인테리어 전문가로서 즉시 추천 (예: "손잡이 추천" → 바로 손잡이 종류와 추천 시작)

이미지가 첨부된 경우:
- 사진을 자세히 보고 공간 유형/현재 상태/구조/마감재/조명/가구를 한국어로 정확히 묘사
- 사용자의 "이렇게 꾸며줘"/"이 분위기로" 요청에 맞춰 변경할 부분과 유지할 부분을 구체적으로 제안
- 평수/방 정보가 없다면 사진 기반으로 추정하고 사용자에게 확인 질문

수집할 정보:
1. 공간 종류 (거실/안방/부엌/욕실 등)
2. 평수/면적
3. 선호 스타일
4. 톤/컬러
5. 특별 요구사항 (수납, 조명, 가구 등)`;

interface ChatImageRef {
  data: string; // base64 (data URL prefix 제거된 본문)
  mediaType?: string; // image/jpeg | image/png | image/webp | image/gif
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: ChatImageRef[]; // user 메시지에만 의미 있음
}

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function buildAnthropicContent(m: ChatMessage):
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: { type: "base64"; media_type: string; data: string };
        }
    > {
  if (m.role !== "user" || !m.images || m.images.length === 0) {
    return m.content;
  }
  const blocks: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
  > = [];
  for (const img of m.images) {
    if (!img?.data) continue;
    const mt = img.mediaType && ALLOWED_MEDIA_TYPES.has(img.mediaType)
      ? img.mediaType
      : "image/jpeg";
    // dataURL이 통째로 들어왔으면 prefix 떼어내기
    const data = img.data.startsWith("data:")
      ? img.data.replace(/^data:[^;]+;base64,/, "")
      : img.data;
    if (!data) continue;
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: mt, data },
    });
  }
  // 텍스트는 마지막에 (Claude vision 권장 순서: 이미지 → 텍스트)
  if (m.content && m.content.trim()) {
    blocks.push({ type: "text", text: m.content });
  } else if (blocks.length > 0) {
    // 텍스트가 비어있어도 이미지만 보낼 수 있도록 최소 안내
    blocks.push({ type: "text", text: "(이미지 첨부)" });
  }
  return blocks;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI 상담 서비스가 설정되지 않았습니다 (관리자에게 문의)" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { messages } = (await request.json()) as { messages?: ChatMessage[] };
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages 필수" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 가이드 v2 §5-3 — prompt caching (ephemeral 5분 TTL).
    // 시스템 프롬프트 (~600 tokens)를 캐싱 → 동일 사용자 5분 내 재호출 시 입력 90% 할인.
    // GA 이후 anthropic-version만으로 동작하지만, 안전하게 베타 헤더도 함께 전송.
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: buildAnthropicContent(m) })),
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.warn("[design-chat/stream] upstream error:", upstream.status, errText.slice(0, 200));
      let hint = "AI 상담 응답 실패";
      if (upstream.status === 401) hint = "AI 상담 서비스 인증 실패 (관리자 문의)";
      else if (upstream.status === 429) hint = "현재 상담 요청이 많습니다 — 잠시 후 재시도";
      else if (upstream.status === 404 || errText.includes("model_not_found")) {
        hint = "AI 상담 모델 사용 권한 미설정 (관리자 문의)";
      }
      return new Response(
        JSON.stringify({ error: "AI 상담 응답 실패", hint }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Anthropic SSE → 클라이언트 SSE (text 만 추출)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const j = JSON.parse(data);
                if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
                  const txt: string = j.delta.text || "";
                  // 텍스트에 줄바꿈/특수문자가 있어도 안전하게 — JSON 인코딩.
                  // 클라이언트가 JSON.parse(data).text 로 받음.
                  if (txt) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: txt })}\n\n`),
                    );
                  }
                }
                if (j.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch {
                /* ping 등 비-JSON 무시 */
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[design-chat/stream] error:", msg);
    return new Response(
      JSON.stringify({ error: "AI 상담 처리 중 오류" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
