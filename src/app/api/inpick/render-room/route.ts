/**
 * POST /api/inpick/render-room
 *
 * 이미지 생성 backend adapter 호출 (Phase 1 — Prompt 1).
 * IMAGE_GEN_BACKEND 환경변수로 OpenAI / RunPod / auto 분기.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md §3 (제품 아키텍처)
 *
 * 입력: RenderRoomInput + propertyId? (있으면 Storage에서 normalized.png 자동 로드)
 *      또는 floorplanImageUrl 직접 제공
 * 출력 (성공): { imageUrl, revisedPrompt, model, backend, costUsd }
 * 출력 (실패): { error: string, hint?: string, model_status: ... }
 *
 * 변경 이력:
 *   - Phase 1: backend adapter 구조 추가 (이전: 직접 generateRoomRender 호출)
 *   - 기존 OpenAI path는 backend="openai"로 100% 보존
 */
import { NextRequest, NextResponse } from "next/server";
import { type RenderRoomInput } from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { renderRoomViaBackend } from "@/lib/inpick/image-backends/select-backend";
import { getFloorplanUrl, hasFloorplan } from "@/lib/inpick/floorplan-storage";
import {
  enforceConsume,
  refundCredits,
  CreditError,
  type CreditFeature,
} from "@/lib/inpick/credit-policy";
import { enforceRateLimit, RateLimitError } from "@/lib/inpick/rate-limit";

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

    // ─── v2 §5-5 사용자별 rate limit (KV 미설정 시 fail-open) ──
    try {
      await enforceRateLimit(charge.userId, "render-room");
    } catch (e) {
      if (e instanceof RateLimitError) {
        // 차감은 이미 됐으니 환불
        await refundCredits(charge.userId, charge.charged, "rate-limited:render-room").catch(() => {});
        return NextResponse.json(
          {
            error: "RATE_LIMIT_EXCEEDED",
            hint: `요청이 너무 많습니다 — ${Math.ceil(e.retryAfterSec / 60)}분 후 다시 시도해주세요`,
            retryAfterSec: e.retryAfterSec,
            limit: e.limit,
          },
          { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } },
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

    // ─── Backend adapter 호출 (Phase 1) ───
    // IMAGE_GEN_BACKEND 환경변수로 분기 (default: "openai" — 기존 path 100% 보존)
    const result = await renderRoomViaBackend({
      ...(body as RenderRoomInput & { roomName: string }),
      prompt: body.style || "modern minimal",
      heightMm: body.heightMm || 2400,
      floorplanImageUrl,
    });

    // ─── 실패 처리 ───
    if (result.status !== "completed" || !result.imageUrl) {
      const model_status = result.modelStatus || "unknown";
      console.warn(
        "[render-room] image gen failed:",
        `backend=${result.backend} model=${result.model} error=${result.error}`,
      );

      // ─── v2 §4-2 실패 시 자동 환불 ──
      let refunded = false;
      if (charge && charge.charged > 0) {
        const r = await refundCredits(
          charge.userId,
          charge.charged,
          `render-room-failed:${model_status}`,
        );
        refunded = r.refunded;
      }

      return NextResponse.json(
        {
          error: result.error || "이미지 생성에 실패했습니다",
          hint: result.hint,
          model_status,
          backend: result.backend,
          model: result.model,
          tokenConsumed: !refunded && (charge?.charged ?? 0) > 0,
          refunded,
          // async job 응답 (Phase 2 이후)
          jobId: result.jobId,
        },
        { status: 502 },
      );
    }

    // ─── 성공 응답 (기존 shape 보존 + backend/jobId 추가) ───
    return NextResponse.json({
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      model: result.model,
      backend: result.backend,
      costUsd: result.costUsd,
      jobId: result.jobId,
      credits_charged: charge?.charged ?? 0,
      credits_remaining: charge && charge.balance >= 0 ? charge.balance : undefined,
    });
  } catch (e) {
    // backend adapter 외부 에러 (예상 외) — 환불 + 일반 에러
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[render-room] unexpected error:", msg);

    let refunded = false;
    if (charge && charge.charged > 0) {
      const r = await refundCredits(
        charge.userId,
        charge.charged,
        `render-room-unexpected-error`,
      );
      refunded = r.refunded;
    }

    return NextResponse.json(
      {
        error: "이미지 생성 중 예상하지 못한 오류",
        hint: "잠시 후 다시 시도해주세요",
        model_status: "unknown",
        tokenConsumed: !refunded && (charge?.charged ?? 0) > 0,
        refunded,
      },
      { status: 500 },
    );
  }
}
