/**
 * POST /api/inpick/render-room
 *
 * 실제 OpenAI DALL-E 3 호출. mock 사용 안 함 — 실패 시 명확한 에러 반환.
 *
 * 입력: { roomName, widthMm, depthMm, heightMm, style, materialHints?, expansion?, feeling?, size? }
 * 출력 (성공): { imageUrl, revisedPrompt, model, costUsd }
 * 출력 (실패): { error: string, hint?: string } 4xx/5xx
 */
import { NextRequest, NextResponse } from "next/server";
import { generateRoomRender, type RenderRoomInput } from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";

export const runtime = "nodejs";
// gpt-image-2는 40~80초 소요 — Vercel Pro maxDuration 800초 한도 내에서 300초로 설정
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RenderRoomInput;
    if (!body.roomName || !body.widthMm || !body.depthMm) {
      return NextResponse.json(
        { error: "roomName, widthMm, depthMm 필수" },
        { status: 400 },
      );
    }
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        {
          error: "OpenAI 키 환경변수 미설정",
          hint: "Vercel에 OPENAI_API_KEY (또는 openai_api_key) 등록 + Redeploy 필요",
        },
        { status: 500 },
      );
    }

    const result = await generateRoomRender({
      ...body,
      heightMm: body.heightMm || 2400,
      style: body.style || "modern minimal",
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 사용자 정책: gpt-image-2 only. 폴백 없음 — 실패 시 명확한 hint로 즉시 보고
    let hint: string | undefined;
    let model_status: "blocked" | "rate_limited" | "billing" | "auth" | "timeout" | "unknown" = "unknown";

    if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key")) {
      hint = "API 키가 잘못되었습니다. https://platform.openai.com/api-keys 에서 새 키 발급 → Vercel 환경변수 갱신";
      model_status = "auth";
    } else if (msg.includes("billing") || msg.includes("quota") || msg.includes("insufficient")) {
      hint = "OpenAI 결제 한도 초과 또는 잔액 부족. https://platform.openai.com/account/billing 에서 충전";
      model_status = "billing";
    } else if (
      msg.includes("model_not_found") ||
      msg.includes("does not have access") ||
      msg.includes("organization") ||
      msg.includes("verify") ||
      msg.includes("404")
    ) {
      hint = "gpt-image-2 사용 권한 없음 — https://platform.openai.com/settings/organization/general 에서 Verify Organization (신분증·얼굴 인증) → 인증 후 최대 15분 대기. tier upgrade 필요할 수 있음";
      model_status = "blocked";
    } else if (msg.includes("rate limit") || msg.includes("429")) {
      hint = "gpt-image-2 Rate limit 초과 — 잠시 후 재시도. 동시 호출 줄이기";
      model_status = "rate_limited";
    } else if (msg.includes("시간 초과") || msg.includes("timeout") || msg.includes("Abort")) {
      hint = "gpt-image-2 응답 지연 (280초 초과). OpenAI 측 서비스 지연 가능 — 잠시 후 재시도";
      model_status = "timeout";
    } else {
      hint = "gpt-image-2 호출 실패. 폴백 없이 즉시 종료됨 — 토큰 차감 안 됨";
    }

    return NextResponse.json(
      {
        error: msg,
        hint,
        model: "gpt-image-2",
        model_status,
        // 클라이언트가 토큰 차감 막는 신호
        tokenConsumed: false,
      },
      { status: 502 },
    );
  }
}
