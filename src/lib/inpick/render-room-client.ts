/**
 * Client-side render-room helper — Phase 9.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
 *        Prompt 9 (Step2 polling 최소 반영)
 *
 * 책임:
 *   - /api/inpick/render-room POST 호출
 *   - 응답이 sync (imageUrl 즉시) 또는 async (jobId 반환) 둘 다 처리
 *   - async일 때 GET /api/inpick/render-room/jobs/[jobId] polling
 *   - 동일한 결과 shape 반환 → 호출자(Step2Designer) 변경 최소화
 *
 * 호환:
 *   - 기존 sync 응답: { imageUrl, revisedPrompt, model, costUsd, ... }
 *   - 신규 async 응답: { jobId, status: "queued" | "processing", imageUrl: undefined }
 *   - 두 케이스 모두 RenderRoomResult shape으로 통일.
 *
 * 정책:
 *   - polling 간격: 3초 (RunPod 통상 12~60초 ETA)
 *   - polling 최대 시간: 5분 (Vercel maxDuration 300초와 정렬)
 *   - 실패 시 에러 throw (호출자가 catch + 사용자 안내)
 *   - AbortSignal 지원 (호출자가 timeout/취소 가능)
 */

import type {
  LockedDeliveryRequest,
  SanitizedLockedAsset,
} from "@/lib/inpick/locked-design/contracts";

export interface RenderRoomBody {
  roomName: string;
  widthMm: number;
  depthMm: number;
  heightMm?: number;
  style?: string;
  expansion?: boolean;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "low" | "medium" | "high";
  windows?: number;
  doors?: number;
  isInteriorRoom?: boolean;
  windowWalls?: string[];
  doorWalls?: string[];
  adjacentRooms?: string[];
  wallLayout?: string;
  furnishingOptions?: string[];
  aspectRatio?: number;
  isFromFloorplan?: boolean;
  propertyId?: string;
  floorplanImageUrl?: string;
  previousReference?: string;
  // geometry-first (Phase 4+ optional)
  roomGeometry?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  lockedDelivery?: LockedDeliveryRequest;
}

export interface RenderRoomClientResult {
  /** 최종 imageUrl (sync 또는 async 완료 후) */
  imageUrl: string;
  revisedPrompt?: string;
  model?: string;
  backend?: string;
  costUsd?: number;
  promptVersion?: string;
  providerRequestId?: string;
  jobId?: string;
  /** sync 응답이면 false. async polling 후 완료면 true. */
  wasAsync: boolean;
  /** debug — 총 polling 시간 ms */
  pollingMs?: number;
  /** Launch-critical (2026-05-11) — RenderRoomSpec summary */
  renderSpec?: {
    confidence: number;
    targetRoom: string;
    attachedZones: Array<{ name: string; type: string; treatment: string }>;
    openings: Array<{ kind: string; from?: string; to?: string }>;
    explanationKo?: string;
    warnings: string[];
  };
  /** P6-4: 도면 기반 생성 메타 — render-room route가 채워서 응답 */
  metadata?: {
    floorplanUsed?: boolean;
    floorplanImageUrl?: string;
    propertyId?: string;
    referenceMode?: "floorplan" | "area_average";
    renderSpecKind?: "RenderRoomSpec_v1" | "text_only";
    renderSpecConfidence?: number;
    roomName?: string;
  };
  lockedAsset?: SanitizedLockedAsset;
}

export interface RenderRoomClientError {
  error: string;
  hint?: string;
  modelStatus?: string;
  jobId?: string;
  backend?: string;
}

export interface RenderRoomClientOptions {
  /** 진행 콜백 (async polling 시 호출) */
  onProgress?: (state: {
    status: string;
    jobId: string;
    elapsedMs: number;
  }) => void;
  /** AbortSignal — 호출자가 취소 가능 */
  signal?: AbortSignal;
  /** polling 간격 ms (default 3000) */
  pollIntervalMs?: number;
  /** polling 최대 시간 ms (default 300000 = 5분) */
  pollTimeoutMs?: number;
  /** POST 직접 timeout (default 320000 = 5분 20초) */
  postTimeoutMs?: number;
}

interface DecodedApiResponse {
  data: Record<string, unknown>;
  decodeError?: RenderRoomClientError;
}

function nonJsonResponseError(response: Response, bodyText: string): RenderRoomClientError {
  const payloadTooLarge =
    response.status === 413 || /request entity too large|payload too large/i.test(bodyText);
  if (payloadTooLarge) {
    return {
      error: `요청 데이터가 너무 큽니다 (HTTP ${response.status || 413})`,
      hint: "도면 이미지를 다시 업로드하거나 저장이 완료된 뒤 이미지 생성을 다시 시도해주세요.",
    };
  }
  return {
    error: response.ok
      ? `이미지 생성 서버 응답 형식 오류 (HTTP ${response.status})`
      : `이미지 생성 서버 응답 오류 (HTTP ${response.status})`,
    hint: "잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의해주세요.",
  };
}

async function decodeApiResponse(response: Response): Promise<DecodedApiResponse> {
  const bodyText = await response.text();
  if (!bodyText.trim()) {
    return {
      data: {},
      decodeError: {
        error: `이미지 생성 서버가 빈 응답을 반환했습니다 (HTTP ${response.status})`,
        hint: "잠시 후 다시 시도해주세요.",
      },
    };
  }
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown> };
    }
  } catch {
    // Vercel/proxy 오류는 text 또는 HTML일 수 있다. 원문을 노출하지 않고 정규화한다.
  }
  return { data: {}, decodeError: nonJsonResponseError(response, bodyText) };
}

function prepareRequestBody(body: RenderRoomBody): RenderRoomBody {
  const floorplanImageUrl = body.floorplanImageUrl?.trim();
  const browserLocalReference =
    floorplanImageUrl?.startsWith("data:") || floorplanImageUrl?.startsWith("blob:");
  if (!browserLocalReference) return body;

  // Base64 도면을 JSON에 넣으면 Vercel request-body 제한을 넘어 413 text 응답이 난다.
  // propertyId가 있으면 서버가 Storage URL을 복구하고, 없으면 실 치수 기반 생성으로 안전하게 폴백한다.
  const requestBody = { ...body };
  delete requestBody.floorplanImageUrl;
  return {
    ...requestBody,
    isFromFloorplan: Boolean(body.propertyId),
  };
}

/**
 * /api/inpick/render-room 호출 + 필요 시 polling.
 *
 * 사용:
 *   const result = await renderRoomViaClient(body, { signal: abortCtrl.signal });
 *   if ("error" in result) throw new Error(result.error);
 *   setImageUrl(result.imageUrl);
 */
export async function renderRoomViaClient(
  body: RenderRoomBody,
  opts: RenderRoomClientOptions = {},
): Promise<RenderRoomClientResult | RenderRoomClientError> {
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 300_000;
  const postTimeoutMs = opts.postTimeoutMs ?? 320_000;

  // ─── 1. POST /api/inpick/render-room ───
  const postCtrl = new AbortController();
  const onAbort = () => postCtrl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) postCtrl.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }
  const postTimeoutId = setTimeout(() => postCtrl.abort(), postTimeoutMs);

  let postRes: Response;
  let postData: Record<string, unknown>;
  try {
    postRes = await fetch("/api/inpick/render-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: postCtrl.signal,
      body: JSON.stringify(prepareRequestBody(body)),
    });
    const decoded = await decodeApiResponse(postRes);
    if (decoded.decodeError) return decoded.decodeError;
    postData = decoded.data;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(postTimeoutId);
    if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
  }

  // 명시적 에러 응답
  if (!postRes.ok) {
    return {
      error: (postData.error as string) || `HTTP ${postRes.status}`,
      hint: postData.hint as string | undefined,
      modelStatus: postData.model_status as string | undefined,
      jobId: postData.jobId as string | undefined,
      backend: postData.backend as string | undefined,
    };
  }

  if (postData.asset && typeof postData.asset === "object") {
    return {
      imageUrl: "",
      lockedAsset: postData.asset as SanitizedLockedAsset,
      revisedPrompt: postData.revisedPrompt as string | undefined,
      model: postData.model as string | undefined,
      backend: postData.backend as string | undefined,
      costUsd: postData.costUsd as number | undefined,
      promptVersion: postData.promptVersion as string | undefined,
      providerRequestId: postData.providerRequestId as string | undefined,
      wasAsync: false,
      metadata: postData.metadata as RenderRoomClientResult["metadata"],
    };
  }

  // ─── 2a. Sync 응답 (imageUrl 즉시) ───
  if (postData.imageUrl && typeof postData.imageUrl === "string") {
    return {
      imageUrl: postData.imageUrl,
      revisedPrompt: postData.revisedPrompt as string | undefined,
      model: postData.model as string | undefined,
      backend: postData.backend as string | undefined,
      costUsd: postData.costUsd as number | undefined,
      promptVersion: postData.promptVersion as string | undefined,
      providerRequestId: postData.providerRequestId as string | undefined,
      jobId: postData.jobId as string | undefined,
      wasAsync: false,
      renderSpec: postData.renderSpec as RenderRoomClientResult["renderSpec"],
      metadata: postData.metadata as RenderRoomClientResult["metadata"],
    };
  }

  // ─── 2b. Async 응답 (jobId만) — polling ───
  const jobId = postData.jobId as string | undefined;
  if (!jobId) {
    return {
      error: "이미지 URL 없음 (응답에 imageUrl도 jobId도 없음)",
    };
  }

  const t0 = Date.now();
  while (true) {
    if (opts.signal?.aborted) {
      return { error: "사용자 취소", jobId };
    }
    const elapsedMs = Date.now() - t0;
    if (elapsedMs > pollTimeoutMs) {
      return {
        error: `Polling timeout (${Math.round(elapsedMs / 1000)}초)`,
        jobId,
        hint: "RunPod cold start 가능 — 잠시 후 다시 시도",
      };
    }

    // wait
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    let pollRes: Response;
    let pollData: Record<string, unknown>;
    try {
      pollRes = await fetch(`/api/inpick/render-room/jobs/${jobId}`, {
        signal: opts.signal,
      });
      const decoded = await decodeApiResponse(pollRes);
      if (decoded.decodeError) {
        return { ...decoded.decodeError, jobId };
      }
      pollData = decoded.data;
    } catch (e) {
      // network 에러 — 한번 더 재시도 가능, 일단 polling 종료
      return {
        error: e instanceof Error ? e.message : String(e),
        jobId,
      };
    }
    if (!pollRes.ok) {
      return {
        error: (pollData.error as string) || `Job poll HTTP ${pollRes.status}`,
        hint: pollData.hint as string | undefined,
        jobId,
      };
    }

    const status = pollData.status as string | undefined;
    opts.onProgress?.({ status: status || "unknown", jobId, elapsedMs });

    if (status === "completed" && pollData.imageUrl) {
      return {
        imageUrl: pollData.imageUrl as string,
        revisedPrompt: pollData.revisedPrompt as string | undefined,
        model: pollData.model as string | undefined,
        backend: pollData.backend as string | undefined,
        costUsd: pollData.costUsd as number | undefined,
        promptVersion: pollData.promptVersion as string | undefined,
        providerRequestId: pollData.providerRequestId as string | undefined,
        jobId,
        wasAsync: true,
        pollingMs: Date.now() - t0,
      };
    }
    if (status === "failed") {
      return {
        error: (pollData.error as string) || "Job failed",
        hint: pollData.hint as string | undefined,
        modelStatus: pollData.modelStatus as string | undefined,
        jobId,
        backend: pollData.backend as string | undefined,
      };
    }
    // 그 외 (queued, processing) — 계속 polling
  }
}
