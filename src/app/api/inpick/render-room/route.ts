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
  createJob,
  updateJob,
  isJobsRepoReady,
} from "@/lib/inpick/generation-jobs/repository";
import { ensureStorageUrl } from "@/lib/inpick/storage/image-storage";
import {
  buildRenderRoomSpec,
  type ParsedFloorPlanLike,
} from "@/lib/inpick/floorplan/render-room-spec-builder";
import { validateRenderRoomSpec } from "@/lib/inpick/floorplan/render-spec-validator";
import {
  compileRenderPrompt,
  renderSpecToBriefSummary,
} from "@/lib/inpick/image-backends/prompt-compiler";
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

    // ─── Launch-critical: RenderRoomSpec build (2026-05-11) ───
    // RENDER_ROOM_SPEC_ENABLED=true이면 도면 구조를 spec으로 변환 → prompt에 강제
    // 가이드: docs/launch/LAUNCH_ERROR_AUDIT_20260511.md
    const renderSpecEnabled = process.env.RENDER_ROOM_SPEC_ENABLED !== "false";
    let renderRoomSpec: ReturnType<typeof buildRenderRoomSpec> | null = null;
    let renderSpecWarnings: string[] = [];
    let compiledPrompt: string | undefined;
    if (renderSpecEnabled) {
      try {
        // body.normalizedFloorplan 또는 body.parsedFloorPlan에 ParsedFloorPlan이 있으면 사용
        // 없으면 minimal spec (heuristic + room name만)
        const fp: ParsedFloorPlanLike =
          (body as unknown as { normalizedFloorplan?: ParsedFloorPlanLike })
            .normalizedFloorplan ||
          (body as unknown as { parsedFloorPlan?: ParsedFloorPlanLike })
            .parsedFloorPlan || {
            rooms: [
              { id: "target", name: body.roomName, areaM2: undefined },
              // adjacentRooms를 fallback 방으로 등록
              ...(body.adjacentRooms || []).map((n, i) => ({
                id: `adj_${i}`,
                name: n,
              })),
            ],
          };
        renderRoomSpec = buildRenderRoomSpec({
          parsedFloorPlan: fp,
          targetRoomName: body.roomName,
          extensionOptions: (body as unknown as { extensionOptions?: import("@/lib/inpick/floorplan/render-room-spec").ExtensionOptions })
            .extensionOptions,
          expansion: body.expansion,
        });
        const validation = validateRenderRoomSpec(renderRoomSpec);
        renderSpecWarnings = [...validation.errors, ...validation.warnings];
        // prompt compile
        compiledPrompt = compileRenderPrompt({
          userPrompt: body.style,
          stylePrompt: (body as unknown as { stylePreset?: string }).stylePreset,
          roomName: body.roomName,
          renderRoomSpec,
          wallLayout: body.wallLayout,
        });
        console.info(
          `[render-room] spec built: ${renderSpecToBriefSummary(renderRoomSpec)} (warnings=${renderSpecWarnings.length})`,
        );
      } catch (specErr) {
        // RenderRoomSpec 생성 실패 — 기존 path 그대로 진행 (절대 차단 X)
        console.warn(
          `[render-room] spec build failed: ${specErr instanceof Error ? specErr.message : String(specErr)}`,
        );
        renderSpecWarnings.push(
          `RENDER_SPEC_BUILD_FAILED: ${specErr instanceof Error ? specErr.message : String(specErr)}`,
        );
      }
    }

    // ─── Backend adapter 호출 (Phase 1) ───
    // IMAGE_GEN_BACKEND 환경변수로 분기 (default: "openai" — 기존 path 100% 보존)
    const renderInput = {
      ...(body as RenderRoomInput & { roomName: string }),
      prompt: body.style || "modern minimal",
      heightMm: body.heightMm || 2400,
      floorplanImageUrl,
      // launch-critical: RenderRoomSpec + compiled prompt 전달
      renderRoomSpec: renderRoomSpec ?? undefined,
      compiledPrompt,
      extensionOptions: (body as unknown as { extensionOptions?: import("@/lib/inpick/floorplan/render-room-spec").ExtensionOptions })
        .extensionOptions,
    };

    // ─── Async mode (Phase 2) ───
    // IMAGE_GEN_MODE=async일 때만 활성. 기본값 sync.
    // RunPod backend는 async 권장, OpenAI backend는 sync only (즉시 반환).
    const asyncMode = process.env.IMAGE_GEN_MODE === "async";
    const preferredBackend = (process.env.IMAGE_GEN_BACKEND || "openai").toLowerCase();
    if (asyncMode && preferredBackend !== "openai" && isJobsRepoReady()) {
      // Job 생성 + backend submit (즉시 반환)
      const job = await createJob({
        userId: charge?.userId,
        backend: "runpod",
        request: renderInput,
        metadata: { mode: "async", chargedCredits: charge?.charged ?? 0 },
      });
      // backend.renderRoom 호출은 RunPod async submit (Phase 5에서 실제 구현)
      // 현재는 placeholder — 즉시 결과 또는 externalJobId 반환
      const result = await renderRoomViaBackend(renderInput);
      // job 갱신 (status 반영)
      await updateJob(job.id, {
        status:
          result.status === "completed"
            ? "completed"
            : result.status === "failed"
              ? "failed"
              : "processing",
        externalJobId: result.jobId,
        result,
        resultUrl: result.imageUrl,
        costUsd: result.costUsd,
        elapsedMs: result.elapsedMs,
        error: result.error,
        hint: result.hint,
        modelStatus: result.modelStatus,
      });

      return NextResponse.json({
        jobId: job.id,
        status: result.status,
        imageUrl: result.imageUrl,
        backend: result.backend,
        model: result.model,
        costUsd: result.costUsd,
        // 호환 — Step2Designer가 imageUrl만 보면 sync 응답으로 처리
        credits_charged: charge?.charged ?? 0,
        credits_remaining: charge && charge.balance >= 0 ? charge.balance : undefined,
      });
    }

    // ─── Sync mode (기본 — 기존 OpenAI path 유지) ───
    const result = await renderRoomViaBackend(renderInput);

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

    // ─── Phase 3: base64 → storage URL 자동 변환 ───
    // production 모드에서 data: URL 그대로 응답 X (storage URL로 변환)
    // PoC 모드에서는 base64 fallback 허용 (ensureStorageUrl이 처리)
    let finalImageUrl = result.imageUrl || "";
    if (finalImageUrl.startsWith("data:")) {
      try {
        finalImageUrl = await ensureStorageUrl(finalImageUrl, {
          jobId: result.jobId,
          roomName: body.roomName,
          seed: (body as { seed?: number }).seed,
          modelVersion: result.model,
        });
      } catch (storageErr) {
        // storage 실패 — production에서는 에러로 응답, PoC면 base64 그대로
        if (process.env.NODE_ENV === "production") {
          console.error("[render-room] storage upload failed:", storageErr);
          return NextResponse.json(
            {
              error: "이미지 저장 실패",
              hint:
                storageErr instanceof Error ? storageErr.message : String(storageErr),
              backend: result.backend,
              model: result.model,
            },
            { status: 502 },
          );
        }
        // PoC: base64 그대로 진행 (warning만)
        console.warn("[render-room] storage failed, falling back to base64:", storageErr);
      }
    }

    // ─── 성공 응답 (기존 shape 보존 + backend/jobId/renderSpec 추가) ───
    return NextResponse.json({
      imageUrl: finalImageUrl,
      revisedPrompt: result.revisedPrompt,
      model: result.model,
      backend: result.backend,
      costUsd: result.costUsd,
      jobId: result.jobId,
      credits_charged: charge?.charged ?? 0,
      credits_remaining: charge && charge.balance >= 0 ? charge.balance : undefined,
      // Launch-critical: render spec 요약 (UI 표시용)
      renderSpec: renderRoomSpec
        ? {
            confidence: renderRoomSpec.confidence,
            targetRoom: renderRoomSpec.targetRoom.name,
            attachedZones: renderRoomSpec.attachedZones.map((z) => ({
              name: z.name,
              type: z.type,
              treatment: z.treatment,
            })),
            openings: renderRoomSpec.openings.map((o) => ({
              kind: o.kind,
              from: renderRoomSpec!.rooms.find((r) => r.id === o.fromRoomId)?.name,
              to: renderRoomSpec!.rooms.find((r) => r.id === o.toRoomId)?.name,
            })),
            explanationKo: renderRoomSpec.renderConstraints.explanationKo,
            warnings: renderSpecWarnings,
          }
        : undefined,
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
