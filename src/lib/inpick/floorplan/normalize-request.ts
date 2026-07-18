export const FLOORPLAN_CLIENT_TIMEOUT_MS = 80_000;
export const FLOORPLAN_STALE_STATE_MS = 85_000;

export class FloorplanRequestError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "invalid-response",
  ) {
    super(message);
    this.name = "FloorplanRequestError";
  }
}

type FloorplanFetchResult<T> = {
  response: Response;
  data: T;
};

/**
 * 응답 헤더뿐 아니라 JSON 본문을 끝까지 읽을 때까지 제한시간을 유지한다.
 * 기존 구현은 fetch가 헤더를 받는 즉시 타이머를 해제해, 본문 전송이 멈추면
 * UI가 영구 로딩 상태에 남을 수 있었다.
 */
export async function fetchFloorplanJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FloorplanFetchResult<T>> {
  const timeoutMs = options.timeoutMs ?? FLOORPLAN_CLIENT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Floorplan request timed out", "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: T;
    try {
      data = JSON.parse(raw) as T;
    } catch {
      throw new FloorplanRequestError(
        "도면 서버의 응답을 읽지 못했습니다. 다시 시도해주세요.",
        "invalid-response",
      );
    }
    return { response, data };
  } catch (error) {
    if (timedOut) {
      throw new FloorplanRequestError(
        "도면 생성 시간이 초과되었습니다. 다시 시도해주세요.",
        "timeout",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}
