/**
 * POST /api/contractor-ai
 *
 * 사업자 AI 비서 (SSE 스트리밍).
 * 변경 (2026-05-10): Gemini → Anthropic Claude Sonnet 4.6 교체.
 * 가이드: docs/ops/GEMINI_REMOVAL_AUDIT.md Phase C
 *
 * 입력: { messages, contractorId? }
 * 출력: SSE — data: {"text":"..."} ... data: [DONE]
 *
 * 응답 태그 (UI에서 파싱):
 *   [ALERT]경고/주의[ALERT]
 *   [SUGGESTION]제안[SUGGESTION]
 *   [DATA]수치 분석[DATA]
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchKnowledgeSemantic } from "@/lib/knowledge-search";
import { searchRegulations, formatRegulations } from "@/lib/regulations-search";
import { streamAnthropicChat, type ChatMessage } from "@/lib/ai/anthropic-stream";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
- **인사말 금지**: 이미 사용자가 화면에서 인사를 받았습니다. "안녕하세요" 등으로 시작하지 말고 사용자 질문에 곧바로 답변하세요.
- 건설/인테리어 사업 관련 질문에만 답변하세요.
- 입찰가 제안 시 공식 단가 기준임을 명시하세요.
- 답변은 전문적이고 실무적으로 하되, 필요한 만큼 충분히 상세하게 답변하세요.
- 법규(건설산업기본법, 하도급법 등) 관련 사항은 확인을 권유하세요.

응답 형식 지시:
- 경고/주의 사항이 있으면 [ALERT] 태그로 감싸세요. 예: [ALERT]이 입찰은 적자 위험이 있습니다.[ALERT]
- 제안/추천이 있으면 [SUGGESTION] 태그로 감싸세요. 예: [SUGGESTION]할인율 5%를 적용하면 낙찰 확률이 높아집니다.[SUGGESTION]
- 데이터/수치 분석이 있으면 [DATA] 태그로 감싸세요. 예: [DATA]현재 마진율: 15%, 업계 평균: 20%[DATA]
- 태그는 필요할 때만 사용하세요. 일반 대화에는 사용하지 않아도 됩니다.`;

  if (context) {
    prompt += `\n\n현재 사업자 컨텍스트:`;
    if (context.companyName) prompt += `\n- 업체명: ${context.companyName}`;
    if (context.activeProjectCount !== undefined)
      prompt += `\n- 진행 중 프로젝트: ${context.activeProjectCount}건`;
    if (context.pendingBidCount !== undefined)
      prompt += `\n- 대기 중 입찰: ${context.pendingBidCount}건`;
    if (context.monthlyRevenue !== undefined)
      prompt += `\n- 이번달 매출: ${Number(context.monthlyRevenue).toLocaleString()}원`;
    if (context.receivableTotal !== undefined)
      prompt += `\n- 미수금: ${Number(context.receivableTotal).toLocaleString()}원`;
    if (context.upcomingScheduleCount !== undefined)
      prompt += `\n- 이번주 일정: ${context.upcomingScheduleCount}건`;
    if (context.avgRating !== undefined) prompt += `\n- 평균 평점: ${context.avgRating}`;
  }

  return prompt;
}

async function collectContext(contractorId: string): Promise<Record<string, unknown>> {
  try {
    const supabase = createClient();

    const { data: profile } = await supabase
      .from("specialty_contractors")
      .select("company_name, rating")
      .eq("id", contractorId)
      .single();

    const { count: projectCount } = await supabase
      .from("contractor_projects")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .eq("status", "in_progress");

    const { count: bidCount } = await supabase
      .from("bids")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .eq("status", "pending");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: payments } = await supabase
      .from("payment_records")
      .select("amount")
      .eq("contractor_id", contractorId)
      .eq("payment_type", "income")
      .gte("paid_at", monthStart);
    const monthlyRevenue = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);

    const { data: unpaid } = await supabase
      .from("invoices")
      .select("total")
      .eq("contractor_id", contractorId)
      .in("status", ["sent", "overdue"]);
    const receivableTotal = (unpaid || []).reduce((s, i) => s + (i.total || 0), 0);

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
  } catch (err) {
    console.error("[contractor-ai] Context collection failed:", err);
    return {};
  }
}

interface ContractorAiBody {
  messages?: ChatMessage[];
  contractorId?: string;
}

export async function POST(request: NextRequest) {
  let body: ContractorAiBody;
  try {
    body = (await request.json()) as ContractorAiBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "잘못된 요청 형식입니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, contractorId } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "메시지가 필요합니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 컨텍스트 수집
  let context: Record<string, unknown> | undefined;
  if (contractorId) {
    context = await collectContext(contractorId);
  }

  // 지식베이스 + 법규 병렬 검색
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const [knowledgeContext, regulations] = await Promise.all([
    searchKnowledgeSemantic(lastUserMsg).catch(() => ""),
    searchRegulations(lastUserMsg).catch(() => []),
  ]);

  const systemPrompt =
    buildSystemPrompt(context) + (knowledgeContext || "") + formatRegulations(regulations);

  return streamAnthropicChat({
    system: systemPrompt,
    messages,
    maxTokens: 4096,
    temperature: 0.7,
    mockFallback: (msgs) => createContractorMockResponse(msgs, context),
  });
}

function createContractorMockResponse(
  messages: ChatMessage[],
  context?: Record<string, unknown>,
): string {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const companyName = context?.companyName ? String(context.companyName) : "사업자";
  const projects = context?.activeProjectCount || 0;
  const bids = context?.pendingBidCount || 0;

  if (lastMsg.includes("입찰") || lastMsg.includes("견적")) {
    return `${companyName}님, 입찰/견적 관련 분석입니다.

현재 진행 중인 프로젝트 ${projects}건, 대기 중 입찰 ${bids}건을 확인했습니다.

[SUGGESTION]입찰 시 아래 사항을 확인하세요:
1. 직접 공사비 대비 일반관리비 6% + 이윤 5% 적용 여부
2. 자재비 시세 변동 (최근 3개월 추이 확인)
3. 현장 여건에 따른 할증 요소 (층고, 양중거리 등)[SUGGESTION]

구체적인 견적 내용을 알려주시면 더 정확한 분석을 드리겠습니다.`;
  }
  if (lastMsg.includes("일정") || lastMsg.includes("공정")) {
    return `${companyName}님의 공정 관리를 도와드리겠습니다.

일반적인 아파트 인테리어 공정 순서:
1. **철거** (2~3일) → 2. **설비 배관** (3~5일) → 3. **전기** (2~3일)
4. **방수** (3~5일, 양생 포함) → 5. **타일** (3~5일) → 6. **목공** (5~7일)
7. **도배/도장** (3~5일) → 8. **바닥재** (2~3일) → 9. **설비 마감** (2~3일)

[ALERT]방수 공정은 최소 48시간 양생이 필수입니다. 일정 단축 시에도 이 기간은 줄이지 마세요.[ALERT]`;
  }
  return `${companyName}님, INPICK AI 비서입니다.

현재 현황:
[DATA]진행 프로젝트: ${projects}건 | 대기 입찰: ${bids}건[DATA]

다음과 같은 도움을 드릴 수 있습니다:
- **입찰 전략**: 적정 단가 분석, 낙찰 확률 예측
- **견적 검토**: 공종별 단가 적정성, 누락 항목 확인
- **일정 관리**: 공정 최적화, 충돌 감지
- **재무 분석**: 현금흐름, 미수금 관리, 수익률

궁금한 점을 말씀해 주세요.`;
}
