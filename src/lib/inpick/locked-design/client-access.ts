export interface LockedDesignView {
  url: string;
  expiresAt?: string;
}

export class LockedDesignViewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "LockedDesignViewError";
  }
}

export function shouldRefreshLockedDesignView(
  expiresAt: string | undefined,
  nowMs = Date.now(),
  refreshBufferMs = 60_000,
): boolean {
  if (!expiresAt) return true;
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return true;
  return expiresAtMs - nowMs <= refreshBufferMs;
}

/**
 * 이미 access grant가 있는 자산은 RPC가 charged=false로 처리한다.
 * 같은 idempotency key를 사용해도 매 호출마다 새 signed URL은 발급된다.
 */
export async function requestLockedDesignView(
  assetId: string,
  fetcher: typeof fetch = fetch,
): Promise<LockedDesignView> {
  const response = await fetcher(
    `/api/inpick/locked-design/assets/${encodeURIComponent(assetId)}/unlock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `unlock:${assetId}` }),
      cache: "no-store",
    },
  );
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    expiresAt?: string;
    error?: string;
    hint?: string;
  };
  if (!response.ok || !data.url) {
    throw new LockedDesignViewError(
      data.hint || data.error || "결제한 이미지의 열람 주소를 갱신하지 못했습니다.",
      response.status,
      data.error,
    );
  }
  return { url: data.url, expiresAt: data.expiresAt };
}
