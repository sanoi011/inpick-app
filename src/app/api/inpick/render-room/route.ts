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
import {
  enforceConsume,
  refundCredits,
  CreditError,
  type CreditFeature,
} from "@/lib/inpick/credit-policy";

export const runtime = "nodejs";
// gpt-image-2는 40~80초 소요 — Vercel Pro maxDuration 800초 한도 내에서 300초로 설정
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RenderBody extends RenderRoomInput {
  /** 가이드 §3 — propertyId로 Storage에서 normalized.png 자동 로드 */
  propertyId?: string;
  /** v2 §5-1 quality tier — 기본 "low" (1차 미리보기 1토큰), "high"는 2토큰 */
  quality?: "low" | "medium" | "high";
}

export async function POST(req: NextRequest) {
  // 차감 정보 — 외부 API 실패 시 환불에 사용
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;

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

    // ─── v2 §4-2 토큰 차감 (인증 + 잔액 검증) ──
    const feature: CreditFeature =
      body.quality === "high" ? "render-room-high" : "render-room";
    try {
      charge = await enforceConsume(feature, {
        propertyId: body.propertyId,
        roomName: body.roomName,
        quality: body.quality ?? "low",
      });
    } catch (e) {
      if (e instanceof CreditError) {
        return NextResponse.json(
          {
            error: e.code,
            hint:
              e.code === "UNAUTHENTICATED"
                ? "로그인이 필요합니다"
                : e.code === "INSUFFICIENT_CREDITS"
                  ? "토큰이 부족합니다 — 충전 후 다시 시도해주세요"
                  : "요청을 처리할 수 없습니다",
            ...e.details,
          },
          { status: e.status },
        );
      }
      throw e;
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
    return NextResponse.json({
      ...result,
      credits_charged: charge?.charged ?? 0,
      credits_remaining: charge && charge.balance >= 0 ? charge.balance : undefined,
    });
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

    // ─── v2 §4-2 실패 시 자동 환불 ──
    let refunded = false;
    if (charge && charge.charged > 0) {
      const r = await refundCredits(charge.userId, charge.charged, `render-room-failed:${model_status}`);
      refunded = r.refunded;
    }

    return NextResponse.json(
      {
        error: "이미지 생성에 실패했습니다",
        hint,
        model_status,
        tokenConsumed: !refunded && (charge?.charged ?? 0) > 0,
        refunded,
      },
      { status: 502 },
    );
  }
}
