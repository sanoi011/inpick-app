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
// Vercel Pro 플랜 함수 한계 60초 — gpt-image-1/2는 timeout 위험으로 dall-e-3 standard 우선
export const maxDuration = 60;

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
    // OpenAI 에러를 그대로 사용자에게 노출 (디버깅용)
    let hint: string | undefined;
    if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key")) {
      hint = "API 키가 잘못되었습니다. https://platform.openai.com/api-keys 에서 새 키 발급 → Vercel 환경변수 갱신";
    } else if (msg.includes("billing") || msg.includes("quota") || msg.includes("insufficient")) {
      hint = "OpenAI 결제 한도 초과 또는 잔액 부족. https://platform.openai.com/account/billing 에서 충전";
    } else if (msg.includes("gpt-image-2")) {
      hint = "gpt-image-2 access 없음 — https://platform.openai.com/settings/organization/general 에서 Verify Organization 클릭 (신분증·얼굴 인증). 인증 후 최대 15분 대기. 그래도 안 되면 tier upgrade 필요";
    } else if (msg.includes("organization") || msg.includes("verify")) {
      hint = "OpenAI 조직 인증이 필요합니다. https://platform.openai.com/settings/organization/general 에서 Verify Organization";
    } else if (msg.includes("rate limit") || msg.includes("429")) {
      hint = "OpenAI Rate limit 초과 — 잠시 후 다시 시도";
    }
    return NextResponse.json(
      { error: msg, hint },
      { status: 502 },
    );
  }
}
