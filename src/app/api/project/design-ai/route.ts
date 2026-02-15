import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";
import { searchKnowledgeSemantic } from "@/lib/knowledge-search";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const DESIGN_SYSTEM_PROMPT = `당신은 INPICK의 AI 인테리어 디자인 전문가입니다.

역할:
- 사용자가 공유하는 도면, 사진, 주석을 분석하여 인테리어 디자인을 제안합니다.
- 마감재(벽지, 바닥재, 타일 등), 색상, 가구 배치, 조명을 추천합니다.
- 공간별 특성(거실, 주방, 침실, 욕실 등)에 맞는 맞춤 제안을 합니다.
- 대략적인 비용 정보를 함께 안내합니다.

규칙:
- 한국어로 답변하세요.
- 사용자가 이미지를 공유하면 이미지 내용을 상세히 분석하세요.
- 사용자가 표시한 주석 영역에 집중하여 답변하세요.
- 비용 언급 시 "대략적인 참고 금액"임을 명시하세요.
- 답변은 전문적이면서도 이해하기 쉽게, 구조화하여 작성하세요.
- 마감재 추천 시 제품명, 규격, 평당 단가를 함께 안내하세요.
- 공간의 넓이, 채광, 동선을 고려하여 실용적인 제안을 하세요.`;


export async function POST(request: NextRequest) {
  try {
    const { messages, image, annotations } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "메시지가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = getOpenAIClient();

    // API 키 없으면 Mock 응답
    if (!client) {
      return createMockResponse(messages);
    }

    // 지식베이스 검색 (마지막 메시지 기반)
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const knowledgeContext = await searchKnowledgeSemantic(lastUserMsg);

    // OpenAI API 요청 구성
    const openaiMessages = buildOpenAIMessages(messages, image, annotations, knowledgeContext);

    try {
      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      });

      // OpenAI 스트림 → SSE 변환
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            }
          } catch (err: unknown) {
            const error = err as { message?: string };
            console.error("OpenAI stream error:", error.message);
          } finally {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      console.error("OpenAI API error:", error.status, error.message);
      return createMockResponse(messages);
    }
  } catch (err) {
    console.error("Design AI error:", err);
    return new Response(
      JSON.stringify({ error: "AI 서비스 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// OpenAI messages 구성
function buildOpenAIMessages(
  messages: { role: string; content: string }[],
  image?: string,
  annotations?: { type: string; label?: string; color: string }[],
  knowledgeContext?: string
) {
  type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

  const openaiMessages: ChatCompletionMessageParam[] = [];

  // System message
  openaiMessages.push({
    role: "system",
    content: DESIGN_SYSTEM_PROMPT + (knowledgeContext || ""),
  });

  // 대화 이력
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role === "assistant" ? "assistant" as const : "user" as const;

    // 마지막 user 메시지에 이미지/주석 추가
    if (i === messages.length - 1 && role === "user") {
      const contentParts: ContentPart[] = [];

      // 이미지 (base64 data URL)
      if (image && image.startsWith("data:image")) {
        contentParts.push({
          type: "image_url",
          image_url: { url: image },
        });
      }

      contentParts.push({ type: "text", text: msg.content });

      // 주석 컨텍스트
      if (annotations && annotations.length > 0) {
        const annotationDesc = annotations
          .map((a: { type: string; label?: string }, idx: number) => `주석 ${idx + 1}: ${a.type}${a.label ? ` - "${a.label}"` : ""}`)
          .join("\n");
        contentParts.push({
          type: "text",
          text: `\n\n[사용자가 도면/사진에 표시한 주석]\n${annotationDesc}`,
        });
      }

      openaiMessages.push({ role: "user", content: contentParts });
    } else {
      openaiMessages.push({ role, content: msg.content });
    }
  }

  return openaiMessages;
}

// Mock 응답 생성
function createMockResponse(messages: { role: string; content: string }[]) {
  const lastMsg = messages[messages.length - 1]?.content || "";
  let mockText = "";

  if (lastMsg.includes("바닥") || lastMsg.includes("마루")) {
    mockText = `해당 공간의 바닥재를 분석해 보겠습니다.

**추천 바닥재:**
1. **LX 하우시스 디아망 오크** - 내구성 우수, 평당 약 45,000원
   - 규격: 1,210×192×8mm / 친환경 E0 등급
2. **한화 아쿠아텍 자작나무** - 방수 기능, 평당 약 38,000원
   - 규격: 1,200×190×8mm / 욕실 인접 공간에 적합
3. **KCC 숲 에코 월넛** - 프리미엄 질감, 평당 약 52,000원
   - 규격: 1,220×195×12mm / 고급 인테리어에 적합

선택하신 공간의 면적과 용도를 고려하면 **1번 디아망 오크**를 추천드립니다.
시공비 포함 시 평당 약 65,000원~75,000원 수준입니다.

추가 궁금한 점이 있으시면 말씀해 주세요!`;
  } else if (lastMsg.includes("벽") || lastMsg.includes("색상") || lastMsg.includes("도배")) {
    mockText = `벽면 디자인을 분석했습니다.

**벽 색상 제안:**
1. **베이지 톤 (NCS S 1005-Y20R)** - 따뜻하고 넓어 보이는 효과
2. **라이트 그레이 (NCS S 1502-B)** - 모던하고 깔끔한 느낌
3. **소프트 민트 (NCS S 1010-G10Y)** - 밝고 산뜻한 분위기

**도배 비용 참고:**
- 실크 벽지: 평당 약 12,000원~15,000원
- 합지 벽지: 평당 약 8,000원~10,000원
- 포인트 벽지(수입): 평당 약 25,000원~40,000원

현재 공간의 채광과 크기를 고려하면 **1번 베이지 톤**을 추천드립니다.
가구와의 조화를 위해 포인트 벽면 1면을 다른 색상으로 구성하면 더욱 세련된 느낌을 줄 수 있습니다.`;
  } else if (lastMsg.includes("수납") || lastMsg.includes("정리") || lastMsg.includes("붙박이")) {
    mockText = `수납 공간 활용도를 높이는 솔루션을 제안드립니다.

**수납 확장 방안:**
- **붙박이장 설치** (벽면 활용) - 약 120만원~200만원
  - 폭 2.4m 기준 / 슬라이딩 도어 포함
- **시스템 행거** (드레스룸 구성) - 약 80만원~150만원
  - 폭 1.8m / 선반+행거봉+서랍 조합
- **키큰수납장** (주방/거실 벽면) - 약 60만원~100만원
  - 폭 0.8m / 전체 높이 활용

표시하신 영역에 맞춤형 붙박이장을 설치하면 수납량을 약 3배 늘릴 수 있습니다.
공간 효율을 극대화하려면 시스템 수납을 추천드립니다.`;
  } else {
    mockText = `안녕하세요! 해당 공간을 분석해 보겠습니다.

도면이나 사진을 보면서 궁금한 부분을 표시해주시면 더 정확한 답변을 드릴 수 있습니다.

**도움을 드릴 수 있는 영역:**
- 바닥재/벽지/타일 추천 및 비용
- 색상 컨셉 및 조합 제안
- 가구 배치 및 동선 최적화
- 조명 계획 및 설치 비용
- 수납 솔루션 및 공간 활용
- 공종별 예상 비용 안내

오른쪽 캔버스에서 도면이나 사진의 특정 부위를 표시하고 질문해 주시면, 해당 영역에 맞춤화된 디자인 제안을 드리겠습니다!`;
  }

  // Mock 스트리밍 응답
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const words = mockText.split("");
      for (let i = 0; i < words.length; i += 5) {
        const chunk = words.slice(i, i + 5).join("");
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
        );
        await new Promise((r) => setTimeout(r, 10));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
