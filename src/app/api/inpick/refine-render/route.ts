/**
 * POST /api/inpick/refine-render
 *
 * 사용자가 자재를 교체한 영역만 inpaint해서 고화질 재렌더.
 * 모델: gpt-image-2 단일 (사용자 정책 — 폴백 없음, 실패 시 즉시 에러)
 *
 * 입력: {
 *   originalImageUrl: string,
 *   maskBase64: string,        // 클라이언트에서 그린 마스크 (검정 = 유지, 흰색 = 재생성)
 *   prompt: string,            // 새 자재 설명 (예: "월넛 원목마루")
 *   roomName?: string,
 *   styleHint?: string,        // 전체 스타일 일관성 유지용
 * }
 * 출력: { imageUrl: string, costUsd: number, model: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/inpick/openai-env";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OPENAI_BASE = "https://api.openai.com/v1";

interface Body {
  originalImageUrl: string;
  maskBase64: string;
  prompt: string;
  roomName?: string;
  styleHint?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.originalImageUrl || !body.maskBase64 || !body.prompt) {
      return NextResponse.json(
        { error: "originalImageUrl, maskBase64, prompt 필수" },
        { status: 400 },
      );
    }
    const key = getOpenAIKey();
    if (!key) {
      return NextResponse.json({ error: "OpenAI 키 미설정" }, { status: 500 });
    }

    // 1) 원본 이미지 다운로드 (DALL-E 임시 URL)
    const imgRes = await fetch(body.originalImageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "원본 이미지 다운로드 실패" }, { status: 502 });
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    // 2) 마스크 base64 → buffer
    const maskBuf = Buffer.from(body.maskBase64.replace(/^data:.*;base64,/, ""), "base64");

    // 3) 고화질 프롬프트 조합
    const refinedPrompt =
      `한국 ${body.roomName || "실내"} 인테리어 렌더링. ` +
      `교체된 자재: ${body.prompt}. ` +
      `${body.styleHint ? `전체 스타일 유지: ${body.styleHint}. ` : ""}` +
      `포토리얼리스틱 고화질, 자연광, 다른 영역과 자연스럽게 어우러지도록.`;

    // 4) gpt-image-2 edit endpoint (사용자 정책: 단일 모델, 폴백 없음)
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("image", new Blob([new Uint8Array(imgBuf)], { type: "image/png" }), "image.png");
    form.append("mask", new Blob([new Uint8Array(maskBuf)], { type: "image/png" }), "mask.png");
    form.append("prompt", refinedPrompt);
    form.append("size", "1024x1024");
    form.append("quality", "high");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    let editRes: Response;
    try {
      editRes = await fetch(`${OPENAI_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!editRes.ok) {
      const errText = await editRes.text();
      const lower = errText.toLowerCase();
      let hint: string | undefined;
      let model_status: string = "unknown";
      if (lower.includes("model_not_found") || lower.includes("does not have access") || editRes.status === 404) {
        hint = "gpt-image-2 사용 권한 없음 — https://platform.openai.com/settings/organization/general 에서 Verify Organization 인증 → 최대 15분 대기. tier upgrade 필요할 수 있음";
        model_status = "blocked";
      } else if (editRes.status === 429) {
        hint = "gpt-image-2 Rate limit 초과";
        model_status = "rate_limited";
      } else if (lower.includes("billing") || lower.includes("quota") || lower.includes("insufficient")) {
        hint = "OpenAI 결제 한도 초과 또는 잔액 부족";
        model_status = "billing";
      } else if (editRes.status === 401) {
        hint = "API 키 인증 실패";
        model_status = "auth";
      }
      return NextResponse.json(
        {
          error: `gpt-image-2 edit 실패: ${editRes.status} ${errText.slice(0, 400)}`,
          hint,
          model: "gpt-image-2",
          model_status,
          tokenConsumed: false,
        },
        { status: 502 },
      );
    }
    const data = await editRes.json();

    // gpt-image-2는 b64_json으로 반환
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "gpt-image-2 응답에 이미지 데이터 없음", raw: data, model: "gpt-image-2", tokenConsumed: false },
        { status: 502 },
      );
    }

    return NextResponse.json({
      imageBase64: b64,
      imageUrl: `data:image/png;base64,${b64}`,
      model: "gpt-image-2",
      costUsd: 0.19,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("Abort") || msg.includes("timeout");
    return NextResponse.json(
      {
        error: msg,
        hint: isTimeout
          ? "gpt-image-2 응답 지연 (280초 초과). OpenAI 측 서비스 지연 — 재시도"
          : "gpt-image-2 edit 호출 실패 — 폴백 없이 즉시 종료",
        model: "gpt-image-2",
        model_status: isTimeout ? "timeout" : "unknown",
        tokenConsumed: false,
      },
      { status: 500 },
    );
  }
}
