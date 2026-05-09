/**
 * POST /api/inpick/render-room
 *
 * gpt-image-2 EDITS API 호출 (가이드 §3 정책).
 * 평면도 이미지를 input으로 보내 도면 형태 100% 보존.
 *
 * 입력: RenderRoomInput + propertyId? (있으면 Storage에서 normalized.png 자동 로드)
 *      또는 floorplanImageUrl 직접 제공
 * 출력 (성공): { imageUrl, revisedPrompt, model, costUsd }
 * 출력 (실패): { error: string, hint?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateRoomRender, type RenderRoomInput } from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { getFloorplanUrl, hasFloorplan } from "@/lib/inpick/floorplan-storage";

export const runtime = "nodejs";
// gpt-image-2는 40~80초 소요 — Vercel Pro maxDuration 800초 한도 내에서 300초로 설정
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RenderBody extends RenderRoomInput {
  /** 가이드 §3 — propertyId로 Storage에서 normalized.png 자동 로드 */
  propertyId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RenderBody;
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

    // 가이드 §3 정책: 평면도 이미지 강제. propertyId 또는 floorplanImageUrl 둘 중 하나 필수.
    let floorplanImageUrl = body.floorplanImageUrl;
    if (!floorplanImageUrl && body.propertyId) {
      // Storage에서 normalized 또는 original URL 조회
      if (await hasFloorplan(body.propertyId, "normalized")) {
        floorplanImageUrl = getFloorplanUrl(body.propertyId, "normalized") || undefined;
      } else if (await hasFloorplan(body.propertyId, "original")) {
        floorplanImageUrl = getFloorplanUrl(body.propertyId, "original") || undefined;
      }
    }
    if (!floorplanImageUrl) {
      return NextResponse.json(
        {
          error: "Floorplan not found. Crawl first.",
          hint: "Step1에서 주소+평형 선택 → /api/inpick/normalize-floorplan 호출 → propertyId 확보 후 다시 시도",
        },
        { status: 400 },
      );
    }

    const result = await generateRoomRender({
      ...body,
      heightMm: body.heightMm || 2400,
      style: body.style || "modern minimal",
      floorplanImageUrl,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 사용자 정책: gpt-image-2 only. 폴백 없음 — 실패 시 명확한 hint로 즉시 보고
    let hint: string | undefined;
    let model_status: "blocked" | "rate_limited" | "billing" | "auth" | "timeout" | "unknown" = "unknown";

    if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key") || msg.includes("401")) {
      hint = "이미지 생성 서비스 인증 문제 (관리자에게 문의)";
      model_status = "auth";
    } else if (msg.includes("billing") || msg.includes("quota") || msg.includes("insufficient")) {
      hint = "이미지 생성 서비스 결제 한도 초과 (관리자에게 문의)";
      model_status = "billing";
    } else if (
      msg.includes("model_not_found") ||
      msg.includes("does not have access") ||
      msg.includes("organization") ||
      msg.includes("verify") ||
      msg.includes("404")
    ) {
      hint = "이미지 생성 서비스 사용 권한 미설정 (관리자에게 문의)";
      model_status = "blocked";
    } else if (msg.includes("rate limit") || msg.includes("429")) {
      hint = "현재 요청이 많습니다 — 잠시 후 다시 시도해주세요";
      model_status = "rate_limited";
    } else if (msg.includes("시간 초과") || msg.includes("timeout") || msg.includes("Abort")) {
      hint = "응답 지연 — 잠시 후 다시 시도해주세요";
      model_status = "timeout";
    } else {
      hint = "이미지 생성 실패 (요금이 발생하지 않았습니다)";
    }

    // 내부 에러 메시지는 server log에만 기록, 클라이언트엔 일반화된 메시지만 노출
    console.warn("[render-room] image gen failed:", msg);

    return NextResponse.json(
      {
        error: "이미지 생성에 실패했습니다",
        hint,
        model_status,
        tokenConsumed: false,
      },
      { status: 502 },
    );
  }
}
