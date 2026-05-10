/**
 * POST /api/project/design-ai
 *
 * AI 디자인 상담 (SSE 스트리밍).
 * 변경 (2026-05-10): Gemini → Anthropic Claude Sonnet 4.6 교체.
 * 가이드: docs/ops/GEMINI_REMOVAL_AUDIT.md Phase C
 *
 * 입력: { messages, floorPlanContext?, annotations? }
 * 출력: SSE — data: {"text":"..."} ... data: [DONE]
 */
import { NextRequest } from "next/server";
import { searchKnowledgeSemantic } from "@/lib/knowledge-search";
import { searchRegulations, formatRegulations } from "@/lib/regulations-search";
import { streamAnthropicChat, type ChatMessage } from "@/lib/ai/anthropic-stream";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DESIGN_SYSTEM_PROMPT = `당신은 INPICK의 AI 인테리어 디자인 전문가입니다.

역할:
- 사용자가 공유하는 도면, 사진, 주석을 분석하여 인테리어 디자인을 제안합니다.
- 마감재(벽지, 바닥재, 타일 등), 색상, 가구 배치, 조명을 추천합니다.
- 공간별 특성(거실, 주방, 침실, 욕실 등)에 맞는 맞춤 제안을 합니다.
- 대략적인 비용 정보를 함께 안내합니다.

규칙:
- 한국어로 답변하세요.
- **인사말 금지**: 이미 사용자가 화면에서 인사를 받았습니다. "안녕하세요" 등으로 시작하지 말고 사용자 질문에 곧바로 답변하세요.
- 사용자가 표시한 주석 영역에 집중하여 답변하세요.
- 비용 언급 시 "대략적인 참고 금액"임을 명시하세요.
- 답변은 전문적이면서도 이해하기 쉽게, 구조화하여 작성하세요.
- 마감재 추천 시 제품명, 규격, 평당 단가를 함께 안내하세요.
- 공간의 넓이, 채광, 동선을 고려하여 실용적인 제안을 하세요.
- 이전 대화 내용을 기억하고, 사용자가 이전에 언급한 선호도나 결정사항을 반영하세요.`;

interface DesignAiBody {
  messages?: ChatMessage[];
  floorPlanContext?: string;
  annotations?: { type: string; label?: string }[];
}

export async function POST(request: NextRequest) {
  let body: DesignAiBody;
  try {
    body = (await request.json()) as DesignAiBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "잘못된 요청 형식입니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, floorPlanContext, annotations } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "메시지가 필요합니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 지식베이스 + 법규 병렬 검색 (마지막 메시지 기반)
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const [knowledgeContext, regulations] = await Promise.all([
    searchKnowledgeSemantic(lastUserMsg).catch(() => ""),
    searchRegulations(lastUserMsg).catch(() => []),
  ]);
  const regulationContext = formatRegulations(regulations);

  // 시스템 프롬프트 구성
  const systemInstruction = [
    DESIGN_SYSTEM_PROMPT,
    knowledgeContext ? `\n\n[참고 지식]\n${knowledgeContext}` : "",
    regulationContext,
    floorPlanContext ? `\n\n[도면 정보]\n공간 구성: ${floorPlanContext}` : "",
  ]
    .filter(Boolean)
    .join("");

  // annotations를 마지막 user 메시지에 추가 (Anthropic은 별도 parts 없음 — content에 합침)
  const enrichedMessages: ChatMessage[] = messages.map((m, i) => ({ ...m }));
  if (annotations && annotations.length > 0 && enrichedMessages.length > 0) {
    const last = enrichedMessages[enrichedMessages.length - 1];
    if (last.role === "user") {
      const annotationDesc = annotations
        .map(
          (a, idx) =>
            `주석 ${idx + 1}: ${a.type}${a.label ? ` - "${a.label}"` : ""}`,
        )
        .join("\n");
      last.content = `${last.content}\n\n[사용자 주석]\n${annotationDesc}`;
    }
  }

  return streamAnthropicChat({
    system: systemInstruction,
    messages: enrichedMessages,
    maxTokens: 2048,
    temperature: 0.7,
    mockFallback: createDesignMockResponse,
  });
}

function createDesignMockResponse(messages: ChatMessage[]): string {
  const lastMsg = messages[messages.length - 1]?.content || "";
  if (lastMsg.includes("바닥") || lastMsg.includes("마루")) {
    return `해당 공간의 바닥재를 분석해 보겠습니다.

**추천 바닥재:**
1. **LX 하우시스 디아망 오크** - 평당 약 45,000원
2. **한화 아쿠아텍 자작나무** - 평당 약 38,000원
3. **KCC 숲 에코 월넛** - 평당 약 52,000원

선택하신 공간의 면적과 용도를 고려하면 1번 디아망 오크를 추천드립니다.
시공비 포함 시 평당 약 65,000원~75,000원 수준입니다.`;
  }
  if (lastMsg.includes("벽") || lastMsg.includes("색상") || lastMsg.includes("도배")) {
    return `벽면 디자인을 분석했습니다.

**벽 색상 제안:**
1. 베이지 톤 (NCS S 1005-Y20R)
2. 라이트 그레이 (NCS S 1502-B)
3. 소프트 민트 (NCS S 1010-G10Y)

**도배 비용 참고:**
- 실크 벽지: 평당 약 12,000원~15,000원
- 합지 벽지: 평당 약 8,000원~10,000원`;
  }
  return `해당 공간을 분석해 보겠습니다.

도면이나 사진을 보면서 궁금한 부분을 표시해주시면 더 정확한 답변을 드릴 수 있습니다.

**도움을 드릴 수 있는 영역:**
- 바닥재/벽지/타일 추천 및 비용
- 색상 컨셉 및 조합 제안
- 가구 배치 및 동선 최적화
- 조명 계획 및 설치 비용
- 수납 솔루션 및 공간 활용
- 공종별 예상 비용 안내

궁금한 점을 자유롭게 물어봐 주세요.`;
}
