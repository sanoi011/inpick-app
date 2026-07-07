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
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enforceConsume,
  refundCredits,
  CreditError,
} from "@/lib/inpick/credit-policy";
import { enforceRateLimit, RateLimitError } from "@/lib/inpick/rate-limit";
import {
  buildRefineCacheKey,
  getCachedRefine,
  saveRefineCache,
  isRefineCacheReady,
} from "@/lib/inpick/refine-cache";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * b64 PNG를 Supabase Storage에 업로드하고 public URL 반환.
 * 응답 body 크기를 줄여 Cloudflare 502 회피 (data:URL 5MB+ → URL 200B).
 */
async function uploadBase64ToStorage(b64: string): Promise<string | null> {
  try {
    const supa = createAdminClient();
    const buf = Buffer.from(b64, "base64");
    const fileName = `refined/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
    const { error } = await supa.storage
      .from("renders")
      .upload(fileName, buf, { contentType: "image/png", upsert: false });
    if (error) {
      console.warn("[refine-render] storage upload failed:", error.message);
      return null;
    }
    const { data: pub } = supa.storage.from("renders").getPublicUrl(fileName);
    return pub.publicUrl;
  } catch (e) {
    console.warn("[refine-render] storage exception:", e);
    return null;
  }
}

interface Body {
  originalImageUrl: string;
  maskBase64: string;          // alpha PNG: alpha=0=교체, alpha=255=보존 (가이드 §2-1)
  prompt: string;              // 새 자재 묘사 (영문 권장 — gpt-image-2 prompt에 직접 들어감)
  roomName?: string;
  styleHint?: string;          // 전체 스타일 일관성 유지용
  /** 가이드 §2-2 build_replacement_prompt — 카테고리 라벨 (floor/wall/...) */
  regionCategoryEn?: "floor" | "wall" | "ceiling" | "window" | "door" | "curtain";
  materialName?: string;       // 표시용 (예: "강마루 화이트오크")
  materialColor?: string;
  materialTexture?: string;
  materialFinish?: string;
  /** 가이드 v2 §5-1 — refine은 자재 미리보기 용도라 기본 medium 권장 (high는 명시 시) */
  quality?: "low" | "medium" | "high";
}

export async function POST(req: NextRequest) {
  // 차감 정보 — 외부 API 실패 시 환불에 사용
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;
  const startedAt = Date.now();

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

    // ─── v2 §4-2 토큰 차감 (인증 + 잔액 검증) ──
    try {
      charge = await enforceConsume("refine-render", {
        roomName: body.roomName,
        materialName: body.materialName,
        regionCategoryEn: body.regionCategoryEn,
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
      await enforceRateLimit(charge.userId, "refine-render");
    } catch (e) {
      if (e instanceof RateLimitError) {
        await refundCredits(charge.userId, charge.charged, "rate-limited:refine-render").catch(() => {});
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

    // ─── 이미지 생성 요청 계측 (차감·rate limit 통과 = 실제 요청 시작) ──
    trackServerEventAsync({
      eventName: AnalyticsEvents.ImageGenerationRequested,
      actorType: "consumer",
      userId: charge.userId,
      source: "api",
      props: {
        endpoint: "refine-render",
        quality: body.quality ?? "medium",
        roomName: body.roomName,
        regionCategory: body.regionCategoryEn,
        credit_charged: charge.charged,
      },
    });

    // ─── v2 §5-4 결과 캐시 hit 검사 — 적중 시 토큰 전액 환불 + gpt-image-2 skip ──
    const cacheKey = buildRefineCacheKey({
      imageRef: body.originalImageUrl,
      maskRef: body.maskBase64.slice(0, 4096), // 마스크 앞부분만 hash 입력 (전체는 너무 큼)
      materialKey: [
        body.regionCategoryEn ?? "",
        body.materialName ?? "",
        body.materialColor ?? "",
        body.materialTexture ?? "",
        body.materialFinish ?? "",
        body.prompt,
      ].join("|"),
    });
    if (await isRefineCacheReady()) {
      const cached = await getCachedRefine(cacheKey);
      if (cached) {
        // 캐시 hit — 토큰 100% 환불 (외부 호출 0)
        await refundCredits(charge.userId, charge.charged, "refine-cache-hit").catch(() => {});
        trackServerEventAsync({
          eventName: AnalyticsEvents.ImageGenerationCompleted,
          actorType: "consumer",
          userId: charge.userId,
          source: "api",
          props: {
            endpoint: "refine-render",
            from_cache: true,
            costUsd: 0,
            latency_ms: Date.now() - startedAt,
          },
        });
        return NextResponse.json({
          imageUrl: cached.result_url,
          costUsd: 0,
          quality: body.quality || "medium",
          credits_charged: 0,
          credits_remaining: charge.balance >= 0 ? charge.balance + charge.charged : undefined,
          from_cache: true,
          cache_hit_count: cached.hit_count,
        });
      }
    }

    // 1) 원본 이미지 다운로드 (DALL-E 임시 URL)
    const imgRes = await fetch(body.originalImageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "원본 이미지 다운로드 실패" }, { status: 502 });
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    // 2) 마스크 base64 → buffer
    const maskBuf = Buffer.from(body.maskBase64.replace(/^data:.*;base64,/, ""), "base64");

    // 3) 가이드 §2-2 build_replacement_prompt — [변경] + [보존 rules] + [스타일] 3블록 패턴
    const targetEn = body.regionCategoryEn || "target area";
    const refinedPrompt = [
      `Replace only the ${targetEn} with: ${body.prompt}.`,
      "",
      "Material details:",
      body.materialName ? `- Name: ${body.materialName}` : null,
      body.materialColor ? `- Color: ${body.materialColor}` : null,
      body.materialTexture ? `- Texture: ${body.materialTexture}` : null,
      body.materialFinish ? `- Finish: ${body.materialFinish}` : null,
      "",
      "Critical preservation rules:",
      "- Keep ALL other elements unchanged: furniture, lighting fixtures, windows, ceiling, walls (except the target area), decor items, plants, artwork",
      "- Preserve the exact camera angle, perspective, and viewpoint",
      "- Maintain the same lighting conditions, shadows, and natural daylight",
      "- Keep the room layout and proportions identical",
      "- Do not move, redesign, or recolor any object outside the target area",
      "",
      "Style:",
      `Photorealistic interior photography, ${body.roomName ? `Korean apartment ${body.roomName}` : "Korean apartment"}, professional architecture photography quality.`,
      body.styleHint ? `Overall design style: ${body.styleHint}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // 4) edits API — 모델 폴백 체인 (사용자 정책: gpt-image-2 우선, 5/8 워킹 상태 복원)
    // gpt-image-2 (40~80s, 우선) → gpt-image-1 (30~60s, 차선)
    // 가이드 v2 §5-1 quality tier — 미지정 시 medium (자재 미리보기는 medium으로 충분, 고화질은 명시)
    const quality = body.quality || "medium";
    const costMap: Record<string, number> = { low: 0.01, medium: 0.04, high: 0.17 };

    let editRes: Response | null = null;
    let usedModel = "";
    const editErrors: string[] = [];
    let lastErrText = "";
    let lastStatus = 0;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    try {
      for (const modelName of ["gpt-image-2", "gpt-image-1"]) {
        const form = new FormData();
        form.append("model", modelName);
        form.append("image", new Blob([new Uint8Array(imgBuf)], { type: "image/png" }), "image.png");
        form.append("mask", new Blob([new Uint8Array(maskBuf)], { type: "image/png" }), "mask.png");
        form.append("prompt", refinedPrompt);
        form.append("size", "1024x1024");
        form.append("quality", quality);

        const res = await fetch(`${OPENAI_BASE}/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
          signal: controller.signal,
        });

        if (res.ok) {
          editRes = res;
          usedModel = modelName;
          break;
        }

        const errText = await res.text();
        const lower = errText.toLowerCase();
        const recoverable =
          res.status === 404 ||
          lower.includes("model_not_found") ||
          lower.includes("does not have access") ||
          lower.includes("invalid_value");
        editErrors.push(`${modelName} ${res.status}: ${errText.slice(0, 200)}`);
        lastErrText = errText;
        lastStatus = res.status;
        if (!recoverable) break; // billing/auth/rate-limit 등은 다른 모델도 동일 → 폴백 중단
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!editRes || !editRes.ok) {
      const errText = lastErrText || editErrors.join(" | ");
      const lower = errText.toLowerCase();
      let hint: string | undefined;
      let model_status: string = "unknown";
      if (lower.includes("model_not_found") || lower.includes("does not have access") || lastStatus === 404) {
        hint = "이미지 편집 서비스 사용 권한 미설정 (관리자에게 문의)";
        model_status = "blocked";
      } else if (lastStatus === 429) {
        hint = "현재 요청이 많습니다 — 잠시 후 재시도";
        model_status = "rate_limited";
      } else if (lower.includes("billing") || lower.includes("quota") || lower.includes("insufficient")) {
        hint = "이미지 편집 서비스 결제 한도 초과 (관리자에게 문의)";
        model_status = "billing";
      } else if (lastStatus === 401) {
        hint = "이미지 편집 서비스 인증 실패 (관리자에게 문의)";
        model_status = "auth";
      } else {
        hint = "이미지 편집 실패 (요금이 발생하지 않았습니다)";
      }
      console.warn("[refine-render] edit failed (all fallback exhausted):", lastStatus, errText.slice(0, 300));
      // ─── v2 §4-2 실패 시 자동 환불 ──
      let refunded = false;
      if (charge && charge.charged > 0) {
        const r = await refundCredits(charge.userId, charge.charged, `refine-render-failed:${model_status}`);
        refunded = r.refunded;
      }
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge?.userId,
        source: "api",
        props: {
          endpoint: "refine-render",
          model_status,
          refunded,
          latency_ms: Date.now() - startedAt,
        },
      });
      return NextResponse.json(
        {
          error: "고화질 재렌더에 실패했습니다",
          hint,
          model_status,
          tokenConsumed: !refunded && (charge?.charged ?? 0) > 0,
          refunded,
        },
        { status: 502 },
      );
    }
    const data = await editRes.json();

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      let refunded = false;
      if (charge && charge.charged > 0) {
        const r = await refundCredits(charge.userId, charge.charged, "refine-render-empty-response");
        refunded = r.refunded;
      }
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge?.userId,
        source: "api",
        props: {
          endpoint: "refine-render",
          model_status: "empty_response",
          refunded,
          latency_ms: Date.now() - startedAt,
        },
      });
      return NextResponse.json(
        { error: "고화질 재렌더 응답이 비어있습니다", tokenConsumed: !refunded, refunded },
        { status: 502 },
      );
    }

    // ─── 이미지 생성 성공 계측 ──
    trackServerEventAsync({
      eventName: AnalyticsEvents.ImageGenerationCompleted,
      actorType: "consumer",
      userId: charge?.userId,
      source: "api",
      props: {
        endpoint: "refine-render",
        model: usedModel,
        costUsd: costMap[quality] ?? 0.04,
        from_cache: false,
        latency_ms: Date.now() - startedAt,
        credit_charged: charge?.charged ?? 0,
      },
    });

    // Cloudflare 502 회피 — 큰 base64 대신 Storage URL로 응답
    const publicUrl = await uploadBase64ToStorage(b64);
    const successPayload = {
      costUsd: costMap[quality] ?? 0.04,
      quality,
      model: usedModel,
      credits_charged: charge?.charged ?? 0,
      credits_remaining: charge && charge.balance >= 0 ? charge.balance : undefined,
    };
    if (publicUrl) {
      // 가이드 v2 §5-4 — Storage URL일 때만 캐싱 (base64 fallback은 캐시 부적합)
      if (await isRefineCacheReady()) {
        saveRefineCache(cacheKey, publicUrl, {
          room_name: body.roomName,
          material_name: body.materialName,
          region_category: body.regionCategoryEn,
          quality,
        }).catch(() => {});
      }
      return NextResponse.json({ imageUrl: publicUrl, ...successPayload, from_cache: false });
    }
    // Storage 실패 시 fallback — base64 직접 반환 (작은 응답 위해 압축)
    return NextResponse.json({
      imageUrl: `data:image/png;base64,${b64}`,
      ...successPayload,
      from_cache: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("Abort") || msg.includes("timeout");
    console.warn("[refine-render] error:", msg);
    // ─── v2 §4-2 실패 시 자동 환불 ──
    let refunded = false;
    if (charge && charge.charged > 0) {
      const r = await refundCredits(charge.userId, charge.charged, `refine-render-error:${isTimeout ? "timeout" : "unknown"}`);
      refunded = r.refunded;
    }
    // 차감 이후(=생성 시도) 실패만 계측
    if (charge) {
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge.userId,
        source: "api",
        props: {
          endpoint: "refine-render",
          model_status: isTimeout ? "timeout" : "unknown",
          error: msg.slice(0, 200),
          refunded,
          latency_ms: Date.now() - startedAt,
        },
      });
    }
    return NextResponse.json(
      {
        error: "고화질 재렌더에 실패했습니다",
        hint: isTimeout
          ? "응답 지연 — 잠시 후 재시도"
          : "이미지 편집 실패 (요금이 발생하지 않았습니다)",
        model_status: isTimeout ? "timeout" : "unknown",
        tokenConsumed: !refunded && (charge?.charged ?? 0) > 0,
        refunded,
      },
      { status: 500 },
    );
  }
}
