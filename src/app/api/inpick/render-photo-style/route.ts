/**
 * POST /api/inpick/render-photo-style
 *
 * 사진 모드 / 상가 모드용 새 이미지 생성 — propertyId/floorplan 요구 X.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §5-1
 *
 * 입력:
 *  - stylePrompt (required) — Claude Vision으로 참고사진/대화에서 추출된 영문 스타일 키워드
 *  - projectMode: "photo_only" | "commercial"
 *  - areaM2 / pyung, spaceType, businessType, zoneName, budgetTier (optional)
 *
 * 출력 (성공): { imageUrl, prompt, model, costUsd }
 * 출력 (실패): { error, hint }
 */
import { NextRequest, NextResponse } from "next/server";
import { hasOpenAIKey, getOpenAIKey } from "@/lib/inpick/openai-env";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";
import {
  enforceConsume,
  refundCredits,
  CreditError,
} from "@/lib/inpick/credit-policy";
import { enforceRateLimit, RateLimitError } from "@/lib/inpick/rate-limit";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { buildPhotoRenderPrompt } from "@/lib/inpick/photo-render-prompt";
import {
  completeLockedDelivery,
  prepareLockedDelivery,
  type LockedDeliveryRequest,
} from "@/lib/inpick/locked-design/delivery";
import { LockedDesignRequestError } from "@/lib/inpick/locked-design/service";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RenderPhotoStyleBody {
  projectMode?: "photo_only" | "commercial" | string;
  stylePrompt: string;
  negativePrompt?: string;
  areaM2?: number;
  pyung?: number;
  spaceType?: string;
  residentialType?: string;
  businessType?: string;
  zoneName?: string;
  budgetTier?: "basic" | "standard" | "premium";
  quality?: "low" | "medium" | "high";
  furnishingOptions?: string[];
  lockedDelivery?: LockedDeliveryRequest;
}

const OPENAI_BASE = "https://api.openai.com/v1";

export async function POST(req: NextRequest) {
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;
  const startedAt = Date.now();
  let analyticsMode: "photo_only" | "commercial" = "photo_only";
  try {
    const body = (await req.json()) as RenderPhotoStyleBody;
    const lockedDelivery = await prepareLockedDelivery(body.lockedDelivery);
    analyticsMode = body.projectMode === "commercial" ? "commercial" : "photo_only";

    // ─── validation (토큰 차감 전) ─────────────────────────
    if (!body.stylePrompt || body.stylePrompt.trim().length < 5) {
      return NextResponse.json(
        {
          error: "missing_style_prompt",
          hint: "stylePrompt가 5자 이상 필요합니다. AI 상담에서 스타일을 더 구체화한 뒤 다시 시도해주세요.",
        },
        { status: 400 },
      );
    }
    if (
      body.projectMode &&
      body.projectMode !== "photo_only" &&
      body.projectMode !== "commercial"
    ) {
      return NextResponse.json(
        {
          error: "mode_mismatch",
          hint:
            "render-photo-style은 사진/상가 모드 전용입니다. 아파트 도면 모드는 /api/inpick/render-room을 사용하세요.",
        },
        { status: 400 },
      );
    }
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        {
          error: "openai_not_configured",
          hint: "Vercel에 OPENAI_API_KEY 등록 + Redeploy 필요",
        },
        { status: 500 },
      );
    }

    // ─── 토큰 차감 (validation 통과 후) ──────────────────────
    // 대표 거실은 5토큰, 그 외 공간/상업 공간은 이미지 1장당 1토큰.
    const isLivingRoom =
      /거실|living/i.test(body.spaceType || "") ||
      (body.projectMode !== "commercial" && !body.spaceType);
    try {
      if (!lockedDelivery) charge = await enforceConsume(isLivingRoom ? "render-room-living" : "render-room", {
        feature: "render-photo-style",
        projectMode: body.projectMode,
        businessType: body.businessType,
        zoneName: body.zoneName,
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

    // ─── rate limit ──────────────────────────────────────
    const actorUserId = lockedDelivery?.userId ?? charge!.userId;
    try {
      await enforceRateLimit(actorUserId, "render-room");
    } catch (e) {
      if (e instanceof RateLimitError) {
        if (charge) await refundCredits(charge.userId, charge.charged, "rate-limited:render-photo-style").catch(() => {});
        return NextResponse.json(
          {
            error: "RATE_LIMIT_EXCEEDED",
            hint: `요청이 너무 많습니다 — ${Math.ceil(e.retryAfterSec / 60)}분 후 다시 시도해주세요`,
            retryAfterSec: e.retryAfterSec,
          },
          { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } },
        );
      }
      throw e;
    }

    // ─── 이미지 생성 요청 계측 (차감·rate limit 통과 = 실제 생성 시작) ──
    trackServerEventAsync({
      eventName: AnalyticsEvents.ImageGenerationRequested,
      actorType: "consumer",
      userId: actorUserId,
      projectMode: analyticsMode,
      source: "api",
      props: {
        endpoint: "render-photo-style",
        quality: body.quality ?? "low",
        businessType: body.businessType,
        credit_charged: charge?.charged ?? 0,
      },
    });

    // ─── OpenAI generations 호출 ────────────────────────────
    const compiledPrompt = buildPhotoRenderPrompt(body);
    const apiKey = getOpenAIKey()!;
    const size = "1024x1024";
    const quality = body.quality || "low";
    const costMap: Record<string, number> = { low: 0.01, medium: 0.04, high: 0.17 };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    let imageBase64: string | null = null;
    let usedModel = "";
    const errors: string[] = [];
    try {
      for (const modelName of ["gpt-image-2"]) {
        const res = await fetch(`${OPENAI_BASE}/images/generations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            prompt: compiledPrompt,
            size,
            quality,
            n: 1,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) {
            imageBase64 = b64;
            usedModel = modelName;
            break;
          }
          errors.push(`${modelName}: 응답에 이미지 데이터 없음`);
          continue;
        }
        const errText = await res.text();
        errors.push(`${modelName} ${res.status}: ${errText.slice(0, 200)}`);
        throw new Error(`GPT Image 2 generations 실패 — ${errors.join(" | ")}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!imageBase64) {
      // 환불
      if (charge) {
        await refundCredits(charge.userId, charge.charged, "openai-failed:render-photo-style").catch(() => {});
      }
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge?.userId,
        projectMode: analyticsMode,
        source: "api",
        props: {
          endpoint: "render-photo-style",
          model_status: "provider_error",
          latency_ms: Date.now() - startedAt,
        },
      });
      return NextResponse.json(
        {
          error: "provider_error",
          hint: "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
          details: errors.join(" | "),
        },
        { status: 502 },
      );
    }

    // ─── Storage 업로드 ───────────────────────────────────
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    if (lockedDelivery) {
      const asset = await completeLockedDelivery(lockedDelivery, dataUrl, compiledPrompt);
      return NextResponse.json({
        asset,
        prompt: compiledPrompt,
        model: usedModel,
        backend: "openai",
        costUsd: costMap[quality] ?? 0.01,
        mode: body.projectMode || "photo_only",
      });
    }
    let storedUrl = dataUrl;
    try {
      const roomLabel =
        body.zoneName ||
        body.spaceType ||
        body.businessType ||
        (body.projectMode === "commercial" ? "commercial" : "photo_style");
      storedUrl = await ensureStorageUrl(dataUrl, { roomName: roomLabel });
    } catch (err) {
      console.warn("[render-photo-style] storage upload failed, returning base64:", err);
    }

    // ─── 이미지 생성 성공 계측 ──
    trackServerEventAsync({
      eventName: AnalyticsEvents.ImageGenerationCompleted,
      actorType: "consumer",
      userId: charge?.userId,
      projectMode: analyticsMode,
      source: "api",
      props: {
        endpoint: "render-photo-style",
        model: usedModel,
        costUsd: costMap[quality] ?? 0.01,
        latency_ms: Date.now() - startedAt,
        credit_charged: charge?.charged ?? 0,
      },
    });

    return NextResponse.json({
      imageUrl: storedUrl,
      prompt: compiledPrompt,
      model: usedModel,
      backend: "openai",
      costUsd: costMap[quality] ?? 0.01,
      mode: body.projectMode || "photo_only",
    });
  } catch (e) {
    if (e instanceof LockedDesignRequestError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[render-photo-style] error:", msg);
    if (charge) {
      await refundCredits(charge.userId, charge.charged, `internal:render-photo-style:${msg.slice(0, 80)}`).catch(() => {});
      // 차감 이후(=생성 시도) 실패만 계측
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge.userId,
        projectMode: analyticsMode,
        source: "api",
        props: {
          endpoint: "render-photo-style",
          model_status: "unknown",
          error: msg.slice(0, 200),
          latency_ms: Date.now() - startedAt,
        },
      });
    }
    return NextResponse.json(
      { error: "internal_error", hint: msg },
      { status: 500 },
    );
  }
}
