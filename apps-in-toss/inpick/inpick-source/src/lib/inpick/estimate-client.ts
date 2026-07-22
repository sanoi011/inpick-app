const LOCAL_IMAGE_URL_PATTERN = /^(?:data:|blob:)/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 견적 API에는 브라우저에서만 유효한 data:/blob: URL을 보내지 않는다.
 * 도면 치수·공간·자재 같은 견적 사실은 유지하고, 서버가 읽을 수 없는 대용량 이미지 값만 제거한다.
 */
export function sanitizeEstimatePayload(value: unknown): unknown {
  if (typeof value === "string") {
    return LOCAL_IMAGE_URL_PATTERN.test(value.trim()) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeEstimatePayload(item))
      .filter((item) => item !== undefined);
  }
  if (!isPlainRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const next = sanitizeEstimatePayload(item);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

function responseFormatError(response: Response, bodyText: string): Error {
  if (response.status === 413 || /request entity too large|payload too large/i.test(bodyText)) {
    return new Error(
      "견적 요청 데이터가 너무 큽니다. 이미지 원본을 제외하고 다시 시도해주세요.",
    );
  }
  return new Error(
    response.ok
      ? `견적 서버 응답 형식 오류 (HTTP ${response.status})`
      : `견적 서버 응답 오류 (HTTP ${response.status})`,
  );
}

export async function postEstimateJson<T>(
  path: string,
  payload: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const response = await fetchImpl(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizeEstimatePayload(payload)),
  });
  const bodyText = await response.text();

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!isPlainRecord(parsed)) throw new Error("invalid envelope");
    data = parsed;
  } catch {
    throw responseFormatError(response, bodyText);
  }

  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : `견적 생성 실패 (HTTP ${response.status})`;
    const hint = typeof data.hint === "string" ? ` → ${data.hint}` : "";
    throw new Error(`${error}${hint}`);
  }

  return data as T;
}
