/**
 * RunPod Serverless SAM 2.1 클라이언트.
 *
 * 가이드(InPick_RunPod_Serverless_Migration.md §2) Python 클라이언트의 TS 포팅.
 *
 * 환경변수:
 *   - RUNPOD_API_KEY (필수)
 *   - RUNPOD_SAM_ENDPOINT_ID (필수)
 *
 * 호출 패턴:
 *   - runsync (즉시 응답, ≤90s) → timeout 시 비동기 polling 자동 fallback
 *   - run + status polling (cold start 또는 무거운 auto_segment용)
 */

const RUNPOD_RUNSYNC_TIMEOUT_MS = 90_000;
const RUNPOD_ASYNC_MAX_WAIT_MS = 240_000;
const RUNPOD_POLL_INTERVAL_MS = 1_500;

export interface SamPoint {
  x: number;
  y: number;
}

export interface AutoSegmentResult {
  task: "auto_segment";
  regions: Array<{
    id: string;
    polygon: number[][]; // [[x, y], ...] (픽셀 좌표)
    bbox: number[];
    area_pixels: number;
    predicted_iou: number;
    stability_score: number;
    mask_b64: string;
  }>;
  image_size: [number, number];
  total_regions: number;
}

export interface ClickSegmentResult {
  task: "click_segment";
  polygon: number[][];
  confidence: number;
  area_pixels: number;
  mask_b64: string;
  image_size: [number, number];
}

interface RunPodEnv {
  apiKey: string;
  endpointId: string;
}

function getEnv(): RunPodEnv {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_SAM_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw new Error(
      "RUNPOD_API_KEY 또는 RUNPOD_SAM_ENDPOINT_ID 미설정 — Vercel 환경변수 등록 필요",
    );
  }
  return { apiKey, endpointId };
}

function baseUrl(env: RunPodEnv): string {
  return `https://api.runpod.ai/v2/${env.endpointId}`;
}

function authHeaders(env: RunPodEnv): Record<string, string> {
  return {
    Authorization: `Bearer ${env.apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * runsync 호출 + timeout 시 비동기 fallback.
 * RunPod runsync는 60초 한계 (가이드 §2-2). 우리는 90초 timeout 후 async fallback.
 */
async function callRunPod<T>(payload: Record<string, unknown>): Promise<T> {
  const env = getEnv();

  // 1) runsync 시도
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), RUNPOD_RUNSYNC_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl(env)}/runsync`, {
      method: "POST",
      headers: authHeaders(env),
      body: JSON.stringify({ input: payload }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`RunPod runsync ${res.status}: ${txt.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.status === "FAILED") {
      throw new Error(`RunPod job failed: ${JSON.stringify(data.error || data)}`);
    }
    const output = data.output;
    if (output && typeof output === "object" && "error" in output) {
      throw new Error(`RunPod worker error: ${(output as { error: string }).error}`);
    }
    return output as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      // runsync timeout → async fallback
      return callRunPodAsync<T>(payload);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** /run + /status polling */
async function callRunPodAsync<T>(payload: Record<string, unknown>): Promise<T> {
  const env = getEnv();

  // 1) 작업 시작
  const startRes = await fetch(`${baseUrl(env)}/run`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify({ input: payload }),
  });
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(`RunPod run start ${startRes.status}: ${t.slice(0, 300)}`);
  }
  const startData = await startRes.json();
  const jobId = startData.id as string;
  if (!jobId) throw new Error("RunPod /run 응답에 id 없음");

  // 2) status polling
  const deadline = Date.now() + RUNPOD_ASYNC_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, RUNPOD_POLL_INTERVAL_MS));
    const stRes = await fetch(`${baseUrl(env)}/status/${jobId}`, {
      headers: authHeaders(env),
    });
    if (!stRes.ok) {
      const t = await stRes.text();
      throw new Error(`RunPod status ${stRes.status}: ${t.slice(0, 200)}`);
    }
    const st = await stRes.json();
    const status = st.status as string | undefined;
    if (status === "COMPLETED") {
      const output = st.output;
      if (output && typeof output === "object" && "error" in output) {
        throw new Error(`RunPod worker error: ${(output as { error: string }).error}`);
      }
      return output as T;
    }
    if (status === "FAILED" || status === "CANCELLED") {
      throw new Error(`RunPod job ${status}: ${JSON.stringify(st.error || st)}`);
    }
  }
  throw new Error(`RunPod job ${jobId} timeout (${RUNPOD_ASYNC_MAX_WAIT_MS / 1000}s)`);
}

/** ───────── 공개 API ───────── */

/**
 * 이미지 전체 자동 분할.
 * 일반적으로 5~15초 소요 (cold start 첫 호출은 30~60초).
 */
export async function samAutoSegment(imageB64: string): Promise<AutoSegmentResult> {
  return callRunPod<AutoSegmentResult>({
    task: "auto_segment",
    image_b64: imageB64,
  });
}

/**
 * 클릭 좌표 기반 단일 영역 분할.
 * 일반적으로 1~3초.
 */
export async function samClickSegment(
  imageB64: string,
  x: number,
  y: number,
): Promise<ClickSegmentResult> {
  return callRunPod<ClickSegmentResult>({
    task: "click_segment",
    image_b64: imageB64,
    points: [[x, y]],
    labels: [1],
  });
}

/**
 * 영역 미세 조정 — positive(포함할 점) + negative(제외할 점).
 * 가이드 §3-2 refine_selection 동등.
 */
export async function samRefineSegment(
  imageB64: string,
  positive: SamPoint[],
  negative: SamPoint[],
): Promise<ClickSegmentResult> {
  const points = [
    ...positive.map((p) => [p.x, p.y]),
    ...negative.map((p) => [p.x, p.y]),
  ];
  const labels = [
    ...positive.map(() => 1),
    ...negative.map(() => 0),
  ];
  return callRunPod<ClickSegmentResult>({
    task: "click_segment",
    image_b64: imageB64,
    points,
    labels,
  });
}

/**
 * Cold start 방지용 warmup.
 * 사용자가 Step2 진입 시 호출하면 실제 클릭 시 cold start 회피.
 * 1×1 더미 이미지로 빠른 호출.
 */
export async function samWarmup(): Promise<boolean> {
  try {
    // 64×64 white PNG (1x1은 SAM/PIL에서 "broken data stream" 거부)
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAIADDsFL/nocIHlyjIGcbZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncf4OvLpyqgN9ZSiDcwAAAABJRU5ErkJggg==";
    await callRunPod({
      task: "auto_segment",
      image_b64: tinyPng,
    });
    return true;
  } catch (e) {
    console.warn("[sam-runpod] warmup failed:", e);
    return false;
  }
}

/** 환경 설정 여부 — 클라이언트가 호출 가능한지 사전 확인용 */
export function isSamRunPodConfigured(): boolean {
  return !!process.env.RUNPOD_API_KEY && !!process.env.RUNPOD_SAM_ENDPOINT_ID;
}
