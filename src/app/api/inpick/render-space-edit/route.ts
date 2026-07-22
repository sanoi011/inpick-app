/**
 * POST /api/inpick/render-space-edit
 *
 * 내 실제 공간 사진의 구조를 유지하면서 인테리어를 변경.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §5-2
 *
 * 입력:
 *  - sourceImage(base64 또는 URL) 필수 — 원본 공간 사진
 *  - editPrompt 필수 — 변경 지시 (영문/한글)
 *  - preserveGeometry: true (강제)
 *  - targetSurfaces?: SurfaceType[]
 *
 * 처리:
 *  1. validation (토큰 차감 전)
 *  2. 토큰 1개 차감
 *  3. OpenAI image edits API (gpt-image-2 고정)
 *  4. Supabase Storage 업로드
 *  5. editable_renders DB 생성 (옵션, projectId 있을 때만)
 *  6. analyze 비동기 트리거 — 백그라운드에서 layer 분석
 *
 * 출력: { imageUrl, prompt, model, editableRenderId? }
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
import { insertEditableRender } from "@/lib/inpick/editable-render/repository";
import type { SurfaceType } from "@/lib/inpick/editable-render/types";
import {
  completeLockedDelivery,
  prepareLockedDelivery,
  type LockedDeliveryRequest,
} from "@/lib/inpick/locked-design/delivery";
import { LockedDesignRequestError } from "@/lib/inpick/locked-design/service";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  SPACE_EDIT_PROMPT_VERSION,
  buildSpaceEditPrompt,
} from "@/lib/inpick/space-edit-prompt";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface SourceImage {
  dataUrl?: string; // data:image/...
  url?: string;     // remote URL
  base64?: string;  // raw base64
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
}

interface RenderSpaceEditBody {
  sourceImage: SourceImage;
  editPrompt: string;
  projectMode?: "photo_only" | "commercial" | string;
  preserveGeometry?: boolean; // 호환용, 항상 true로 강제
  targetSurfaces?: SurfaceType[];
  /** false면 구형 부위별 자재 분석 파이프라인을 실행하지 않음 */
  analyzeSurfaces?: boolean;
  budgetTier?: "basic" | "standard" | "premium";
  quality?: "low" | "medium" | "high";
  projectId?: string; // editable_renders 저장용
  targetId?: string;
  targetNameKo?: string;
  spaceType?: string;
  residentialType?: string;
  businessType?: string;
  zoneName?: string;
  /** 부분 AI 인테리어 전용 모드 — 서버에서 1실 5토큰을 강제 적용 */
  serviceMode?: "partial_ai_room";
  lockedDelivery?: LockedDeliveryRequest;
}

const OPENAI_BASE = "https://api.openai.com/v1";

async function fetchSourceBuffer(src: SourceImage): Promise<{ buf: Buffer; type: string }> {
  if (src.dataUrl) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(src.dataUrl);
    if (!m) throw new Error("invalid dataUrl");
    return { buf: Buffer.from(m[2], "base64"), type: m[1] };
  }
  if (src.base64) {
    return { buf: Buffer.from(src.base64, "base64"), type: src.mediaType || "image/png" };
  }
  if (src.url) {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`source fetch ${res.status}`);
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, type };
  }
  throw new Error("sourceImage가 비어있습니다");
}

export async function POST(req: NextRequest) {
  let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;
  const startedAt = Date.now();
  let analyticsMode: "photo_only" | "commercial" = "photo_only";
  let providerRequestId: string | null = null;
  try {
    const body = (await req.json()) as RenderSpaceEditBody;
    const lockedDelivery = await prepareLockedDelivery(body.lockedDelivery);
    analyticsMode = body.projectMode === "commercial" ? "commercial" : "photo_only";

    // ─── validation (토큰 차감 전) ─────────────────────
    if (!body.sourceImage || (!body.sourceImage.dataUrl && !body.sourceImage.url && !body.sourceImage.base64)) {
      return NextResponse.json(
        { error: "missing_source_image", hint: "sourceImage가 필요합니다." },
        { status: 400 },
      );
    }
    if (!body.editPrompt || body.editPrompt.trim().length < 5) {
      return NextResponse.json(
        { error: "missing_edit_prompt", hint: "editPrompt가 5자 이상 필요합니다." },
        { status: 400 },
      );
    }
    if (body.editPrompt.length > 4_000) {
      return NextResponse.json(
        { error: "edit_prompt_too_long", hint: "editPrompt는 4,000자 이하여야 합니다." },
        { status: 400 },
      );
    }
    if (
      body.projectMode &&
      body.projectMode !== "photo_only" &&
      body.projectMode !== "commercial"
    ) {
      return NextResponse.json(
        { error: "mode_mismatch", hint: "사진 편집 모드는 photo_only 또는 commercial이어야 합니다." },
        { status: 400 },
      );
    }
    if (!hasOpenAIKey()) {
      return NextResponse.json(
        { error: "openai_not_configured", hint: "OPENAI_API_KEY 미설정" },
        { status: 500 },
      );
    }

    // ─── 토큰 차감 ─────────────────────
    try {
      const billingFeature = body.serviceMode === "partial_ai_room" ? "partial-ai-room" : "render-room";
      if (!lockedDelivery) charge = await enforceConsume(billingFeature, {
        feature: "render-space-edit",
        serviceMode: body.serviceMode ?? "material_preview",
        preserveGeometry: true,
        targetSurfaces: body.targetSurfaces,
        spaceType: body.spaceType,
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

    const actorUserId = lockedDelivery?.userId ?? charge!.userId;
    try {
      await enforceRateLimit(actorUserId, "render-room");
    } catch (e) {
      if (e instanceof RateLimitError) {
        if (charge) await refundCredits(charge.userId, charge.charged, "rate-limited:render-space-edit").catch(() => {});
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

    trackServerEventAsync({
      eventName: AnalyticsEvents.ImageGenerationRequested,
      actorType: "consumer",
      userId: actorUserId,
      projectId: body.projectId,
      projectMode: analyticsMode,
      source: "api",
      props: {
        endpoint: "render-space-edit",
        model: "gpt-image-2",
        prompt_version: SPACE_EDIT_PROMPT_VERSION,
        quality: body.quality ?? "low",
        businessType: body.businessType,
        zoneName: body.zoneName,
        credit_charged: charge?.charged ?? 0,
      },
    });

    // ─── source image 로드 ────────────────────
    const { buf, type } = await fetchSourceBuffer(body.sourceImage);
    const compiledPrompt = buildSpaceEditPrompt(body);
    const apiKey = getOpenAIKey()!;
    const size = "1024x1024";
    const quality = body.quality || "low";
    const costMap: Record<string, number> = { low: 0.01, medium: 0.04, high: 0.17 };

    // ─── OpenAI images/edits ─────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    let imageBase64: string | null = null;
    let usedModel = "";
    const errors: string[] = [];
    try {
      for (const modelName of ["gpt-image-2"]) {
        // 모델 혼잡(429/5xx)은 같은 모델을 한 번 재시도하되 구형 모델로 하향하지 않는다.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const form = new FormData();
          form.append("model", modelName);
          form.append("image[]", new Blob([new Uint8Array(buf)], { type }), "source.png");
          form.append("prompt", compiledPrompt);
          form.append("size", size);
          form.append("quality", quality);

          const res = await fetch(`${OPENAI_BASE}/images/edits`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: controller.signal,
          });
          providerRequestId = res.headers.get("x-request-id") || providerRequestId;
          if (res.ok) {
            const data = await res.json();
            const b64 = data.data?.[0]?.b64_json;
            if (b64) {
              imageBase64 = b64;
              usedModel = modelName;
              break;
            }
            errors.push(`${modelName}: no image data`);
            break;
          }

          const errText = await res.text();
          const lower = errText.toLowerCase();
          const capacityError =
            res.status === 429 ||
            res.status === 500 ||
            res.status === 502 ||
            res.status === 503 ||
            lower.includes("at capacity") ||
            lower.includes("overloaded");
          const recoverable =
            capacityError ||
            res.status === 404 ||
            lower.includes("model_not_found") ||
            lower.includes("does not have access") ||
            lower.includes("invalid_value");
          errors.push(`${modelName} ${res.status} attempt ${attempt + 1}: ${errText.slice(0, 200)}`);
          if (capacityError && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1_500));
            continue;
          }
          if (!recoverable) {
            throw new Error(`OpenAI edits 실패 (non-recoverable) — ${errors.join(" | ")}`);
          }
          break;
        }
        if (imageBase64) break;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!imageBase64) {
      const providerBusy = errors.some((message) => /capacity|overloaded| 429 | 500 | 502 | 503 /.test(message));
      if (charge) {
        await refundCredits(
          charge.userId,
          charge.charged,
          "openai-failed:render-space-edit",
        ).catch(() => {});
      }
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: actorUserId,
        projectId: body.projectId,
        projectMode: analyticsMode,
        source: "api",
        props: {
          endpoint: "render-space-edit",
          model: "gpt-image-2",
          model_status: providerBusy ? "provider_busy" : "provider_error",
          prompt_version: SPACE_EDIT_PROMPT_VERSION,
          provider_request_id: providerRequestId,
          latency_ms: Date.now() - startedAt,
        },
      });
      return NextResponse.json(
        {
          error: providerBusy ? "provider_busy" : "provider_error",
          hint: providerBusy
            ? "이미지 생성 서버가 혼잡합니다. 사용한 토큰은 자동 환불됐으며 잠시 후 다시 시도해주세요."
            : "이미지 생성에 실패했습니다. 사용한 토큰은 자동 환불됐습니다.",
          details: errors.join(" | "),
          providerRequestId,
          promptVersion: SPACE_EDIT_PROMPT_VERSION,
        },
        { status: 502 },
      );
    }

    // ─── Storage 업로드 ──────────────────
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    const trackCompleted = () => {
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationCompleted,
        actorType: "consumer",
        userId: actorUserId,
        projectId: body.projectId,
        projectMode: analyticsMode,
        source: "api",
        props: {
          endpoint: "render-space-edit",
          model: usedModel,
          prompt_version: SPACE_EDIT_PROMPT_VERSION,
          provider_request_id: providerRequestId,
          costUsd: costMap[quality] ?? 0.01,
          latency_ms: Date.now() - startedAt,
          credit_charged: charge?.charged ?? 0,
        },
      });
    };
    if (lockedDelivery) {
      const asset = await completeLockedDelivery(lockedDelivery, dataUrl, compiledPrompt);
      trackCompleted();
      return NextResponse.json({
        asset,
        prompt: compiledPrompt,
        model: usedModel,
        backend: "openai",
        promptVersion: SPACE_EDIT_PROMPT_VERSION,
        providerRequestId,
        costUsd: costMap[quality] ?? 0.01,
        mode: analyticsMode,
        preserveGeometry: true,
      });
    }
    let storedUrl = dataUrl;
    try {
      storedUrl = await ensureStorageUrl(dataUrl, {
        roomName: `space-edit-${(body.spaceType || "room").replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 24)}`,
      });
    } catch (err) {
      console.warn("[render-space-edit] storage upload failed, returning base64:", err);
    }

    // ─── editable_renders 저장 (옵션) ──────
    let editableRenderId: string | null = null;
    if (body.projectId && body.targetId) {
      editableRenderId = await insertEditableRender({
        projectId: body.projectId,
        targetId: body.targetId,
        targetNameKo: body.targetNameKo,
        projectMode: analyticsMode === "commercial" ? "commercial" : "residential",
        imageUrl: storedUrl,
        imageWidth: 1024,
        imageHeight: 1024,
        renderSpec: { source: "space_edit", spaceType: body.spaceType },
      });
    }

    // ─── analyze 비동기 트리거 — fire-and-forget ──
    if (body.analyzeSurfaces !== false && editableRenderId && body.projectId && body.targetId) {
      const origin = req.nextUrl.origin;
      fetch(`${origin}/api/inpick/editable-render/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: body.projectId,
          imageUrl: storedUrl,
          projectMode: analyticsMode === "commercial" ? "commercial" : "residential",
          targetId: body.targetId,
          targetNameKo: body.targetNameKo,
          targetSurfaceTypes: body.targetSurfaces ?? ["floor", "wall", "ceiling", "window", "door"],
        }),
      }).catch((err) => console.warn("[render-space-edit] analyze trigger failed:", err));
    }

    trackCompleted();
    return NextResponse.json({
      imageUrl: storedUrl,
      prompt: compiledPrompt,
      model: usedModel,
      backend: "openai",
      promptVersion: SPACE_EDIT_PROMPT_VERSION,
      providerRequestId,
      costUsd: costMap[quality] ?? 0.01,
      mode: analyticsMode,
      editableRenderId,
      preserveGeometry: true,
      creditsCharged: charge?.charged ?? 0,
    });
  } catch (e) {
    if (e instanceof LockedDesignRequestError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[render-space-edit] error:", msg);
    if (charge) {
      await refundCredits(
        charge.userId,
        charge.charged,
        `internal:render-space-edit:${msg.slice(0, 80)}`,
      ).catch(() => {});
      trackServerEventAsync({
        eventName: AnalyticsEvents.ImageGenerationFailed,
        actorType: "consumer",
        userId: charge.userId,
        projectMode: analyticsMode,
        source: "api",
        props: {
          endpoint: "render-space-edit",
          model: "gpt-image-2",
          prompt_version: SPACE_EDIT_PROMPT_VERSION,
          provider_request_id: providerRequestId,
          error: msg.slice(0, 200),
          latency_ms: Date.now() - startedAt,
        },
      });
    }
    return NextResponse.json(
      {
        error: "internal_error",
        hint: msg,
        providerRequestId,
        promptVersion: SPACE_EDIT_PROMPT_VERSION,
      },
      { status: 500 },
    );
  }
}
