/** RunPod Serverless SAM 3.1 + SAM 2.1 client. */

const RUNPOD_RUNSYNC_TIMEOUT_MS = 90_000;
const RUNPOD_ASYNC_MAX_WAIT_MS = 240_000;
const RUNPOD_POLL_INTERVAL_MS = 1_500;
const RUNPOD_TRANSIENT_RETRIES = 2;
const SAM31_CIRCUIT_FAILURE_THRESHOLD = 3;
const SAM31_CIRCUIT_COOLDOWN_MS = 60_000;

let sam31CircuitFailures = 0;
let sam31CircuitOpenedUntil = 0;

export interface SamPoint {
  x: number;
  y: number;
}

export interface AutoSegmentResult {
  task: "auto_segment";
  regions: Array<{
    id: string;
    polygon: number[][];
    bbox: number[];
    area_pixels: number;
    predicted_iou: number;
    stability_score: number;
    mask_b64: string;
  }>;
  image_size: [number, number];
  total_regions: number;
}

export interface ClickCandidate {
  polygon: number[][];
  confidence: number;
  area_pixels: number;
  mask_b64: string;
}

export interface ClickSegmentResult {
  task: "click_segment";
  polygon: number[][];
  confidence: number;
  area_pixels: number;
  mask_b64: string;
  image_size: [number, number];
  engine?: "sam3.1" | "sam3" | "sam2.1";
  model_version?: string;
  candidates?: ClickCandidate[];
}

interface RunPodEnv {
  apiKey: string;
  endpointId: string;
  endpointVariable: string;
}

type EndpointSelector = string | readonly string[];

function endpointNames(selector: EndpointSelector): readonly string[] {
  return typeof selector === "string" ? [selector] : selector;
}

function getEnv(selector: EndpointSelector = "RUNPOD_SAM_ENDPOINT_ID"): RunPodEnv {
  const apiKey = process.env.RUNPOD_API_KEY;
  const variables = endpointNames(selector);
  const endpointVariable = variables.find((name) => Boolean(process.env[name])) || variables[0];
  const endpointId = process.env[endpointVariable];
  if (!apiKey || !endpointId) {
    throw new Error(
      `RUNPOD_API_KEY 또는 ${variables.join("/")} 미설정 — Vercel 환경변수 등록 필요`,
    );
  }
  return { apiKey, endpointId, endpointVariable };
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

interface WorkerErrorShape {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export class SamRunPodError extends Error {
  constructor(
    message: string,
    public readonly code = "RUNPOD_ERROR",
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "SamRunPodError";
  }
}

function outputError(output: unknown): SamRunPodError | null {
  if (!output || typeof output !== "object" || !("error" in output)) return null;
  const raw = (output as { error: string | WorkerErrorShape }).error;
  if (typeof raw === "string") return new SamRunPodError(raw, "WORKER_ERROR");
  return new SamRunPodError(
    raw.message || "RunPod worker error",
    raw.code || "WORKER_ERROR",
    Boolean(raw.retryable),
  );
}

function transientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

async function retryDelay(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt));
}

async function callRunPod<T>(
  payload: Record<string, unknown>,
  selector: EndpointSelector = "RUNPOD_SAM_ENDPOINT_ID",
): Promise<T> {
  const env = getEnv(selector);

  for (let attempt = 0; attempt <= RUNPOD_TRANSIENT_RETRIES; attempt += 1) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), RUNPOD_RUNSYNC_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl(env)}/runsync`, {
        method: "POST",
        headers: authHeaders(env),
        body: JSON.stringify({ input: payload }),
        signal: ctrl.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        if (transientHttpStatus(response.status) && attempt < RUNPOD_TRANSIENT_RETRIES) {
          await retryDelay(attempt);
          continue;
        }
        throw new SamRunPodError(
          `RunPod runsync ${response.status}: ${body.slice(0, 300)}`,
          response.status === 401 || response.status === 403
            ? "RUNPOD_AUTH_FAILED"
            : "RUNPOD_HTTP_ERROR",
          transientHttpStatus(response.status),
        );
      }

      const data = await response.json();
      if (data.status === "FAILED") {
        throw new SamRunPodError(
          `RunPod job failed: ${JSON.stringify(data.error || data)}`,
          "RUNPOD_JOB_FAILED",
        );
      }
      const output = data.output;
      const workerError = outputError(output);
      if (workerError) {
        if (workerError.retryable && attempt < RUNPOD_TRANSIENT_RETRIES) {
          await retryDelay(attempt);
          continue;
        }
        throw workerError;
      }
      return output as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return callRunPodAsync<T>(payload, selector);
      }
      if (
        attempt < RUNPOD_TRANSIENT_RETRIES &&
        error instanceof SamRunPodError &&
        error.retryable
      ) {
        await retryDelay(attempt);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new SamRunPodError("RunPod retry exhausted", "RUNPOD_RETRY_EXHAUSTED", true);
}

async function callRunPodAsync<T>(
  payload: Record<string, unknown>,
  selector: EndpointSelector = "RUNPOD_SAM_ENDPOINT_ID",
): Promise<T> {
  const env = getEnv(selector);
  const startResponse = await fetch(`${baseUrl(env)}/run`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify({ input: payload }),
  });
  if (!startResponse.ok) {
    const body = await startResponse.text();
    throw new SamRunPodError(
      `RunPod run start ${startResponse.status}: ${body.slice(0, 300)}`,
      "RUNPOD_START_FAILED",
      transientHttpStatus(startResponse.status),
    );
  }
  const startData = await startResponse.json();
  const jobId = startData.id as string;
  if (!jobId) throw new SamRunPodError("RunPod /run 응답에 id 없음", "RUNPOD_INVALID_RESPONSE");

  const deadline = Date.now() + RUNPOD_ASYNC_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, RUNPOD_POLL_INTERVAL_MS));
    const statusResponse = await fetch(`${baseUrl(env)}/status/${jobId}`, {
      headers: authHeaders(env),
    });
    if (!statusResponse.ok) {
      const body = await statusResponse.text();
      throw new SamRunPodError(
        `RunPod status ${statusResponse.status}: ${body.slice(0, 200)}`,
        "RUNPOD_STATUS_FAILED",
        transientHttpStatus(statusResponse.status),
      );
    }
    const statusData = await statusResponse.json();
    const status = statusData.status as string | undefined;
    if (status === "COMPLETED") {
      const workerError = outputError(statusData.output);
      if (workerError) throw workerError;
      return statusData.output as T;
    }
    if (status === "FAILED" || status === "CANCELLED") {
      throw new SamRunPodError(
        `RunPod job ${status}: ${JSON.stringify(statusData.error || statusData)}`,
        `RUNPOD_JOB_${status}`,
      );
    }
  }
  throw new SamRunPodError(
    `RunPod job ${jobId} timeout (${RUNPOD_ASYNC_MAX_WAIT_MS / 1000}s)`,
    "RUNPOD_TIMEOUT",
    true,
  );
}

export async function samAutoSegment(imageB64: string): Promise<AutoSegmentResult> {
  return callRunPod<AutoSegmentResult>({ task: "auto_segment", image_b64: imageB64 });
}

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

export async function sam31ConceptSegment(
  imageB64: string,
  concept: string,
  x: number,
  y: number,
): Promise<ClickSegmentResult> {
  if (Date.now() < sam31CircuitOpenedUntil) {
    throw new SamRunPodError(
      "SAM 3.1 circuit temporarily open; use SAM 2.1 fallback",
      "SAM31_CIRCUIT_OPEN",
      true,
    );
  }
  try {
    const result = await callRunPod<ClickSegmentResult>(
      {
        task: "concept_segment",
        image_b64: imageB64,
        concept,
        click_point: [x, y],
        score_threshold: 0.35,
      },
      ["RUNPOD_SAM31_ENDPOINT_ID", "RUNPOD_SAM3_ENDPOINT_ID"],
    );
    sam31CircuitFailures = 0;
    sam31CircuitOpenedUntil = 0;
    return result;
  } catch (error) {
    sam31CircuitFailures += 1;
    if (sam31CircuitFailures >= SAM31_CIRCUIT_FAILURE_THRESHOLD) {
      sam31CircuitOpenedUntil = Date.now() + SAM31_CIRCUIT_COOLDOWN_MS;
    }
    throw error;
  }
}

export async function samRefineSegment(
  imageB64: string,
  positive: SamPoint[],
  negative: SamPoint[],
): Promise<ClickSegmentResult> {
  const points = [
    ...positive.map((point) => [point.x, point.y]),
    ...negative.map((point) => [point.x, point.y]),
  ];
  const labels = [...positive.map(() => 1), ...negative.map(() => 0)];
  return callRunPod<ClickSegmentResult>({
    task: "click_segment",
    image_b64: imageB64,
    points,
    labels,
  });
}

export async function samWarmup(): Promise<boolean> {
  try {
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAIADDsFL/nocIHlyjIGcbZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncf4OvLpyqgN9ZSiDcwAAAABJRU5ErkJggg==";
    await callRunPod({ task: "auto_segment", image_b64: tinyPng });
    return true;
  } catch (error) {
    console.warn("[sam21-runpod] warmup failed:", error);
    return false;
  }
}

export function isSamRunPodConfigured(): boolean {
  return Boolean(process.env.RUNPOD_API_KEY && process.env.RUNPOD_SAM_ENDPOINT_ID);
}

export async function sam31Warmup(): Promise<boolean> {
  try {
    const result = await callRunPod<{ ok: boolean }>({ task: "warmup" }, [
      "RUNPOD_SAM31_ENDPOINT_ID",
      "RUNPOD_SAM3_ENDPOINT_ID",
    ]);
    return result.ok;
  } catch (error) {
    console.warn("[sam31-runpod] warmup failed:", error);
    return false;
  }
}

export function isSam31RunPodConfigured(): boolean {
  return Boolean(
    process.env.RUNPOD_API_KEY &&
      (process.env.RUNPOD_SAM31_ENDPOINT_ID || process.env.RUNPOD_SAM3_ENDPOINT_ID),
  );
}

export function getSamServiceStatus() {
  return {
    sam3_1_configured: isSam31RunPodConfigured(),
    sam2_1_configured: isSamRunPodConfigured(),
    sam3_1_circuit_open: Date.now() < sam31CircuitOpenedUntil,
    sam3_1_failures: sam31CircuitFailures,
    sam3_1_retry_after_ms: Math.max(0, sam31CircuitOpenedUntil - Date.now()),
  };
}
