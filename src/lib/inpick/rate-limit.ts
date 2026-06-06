/**
 * 사용자별 sliding-window rate limit.
 *
 * 가이드: InPick_Pipeline_Validation_v2.md §5-5
 * 인용: Vercel KB — Securing AI Apps + Upstash + Vercel KV examples
 *
 * 환경변수:
 *  - KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV 또는 Upstash Redis)
 * 미설정 시 fail-open (rate limit 미적용) — 인증된 환경에서만 작동.
 *
 * NOTE: @vercel/kv@3 deprecated (2026-05). Vercel Marketplace의 Upstash Redis
 *       integration으로 옮기되, 환경변수는 동일하게 KV_REST_API_URL/TOKEN
 *       제공되므로 코드는 그대로 작동. 추후 @upstash/redis로 직접 마이그레이션 검토.
 *
 * 정책 (가이드 v2 §4-1-1):
 *  - render-room: 20 / 1h
 *  - refine-render: 50 / 1h
 *  - design-chat: 30 / 5m
 *  - sam-click: 30 / 1m
 */

type RateLimitKey = "render-room" | "refine-render" | "design-chat" | "sam-click";

interface RateLimitConfig {
  windowSec: number;
  limit: number;
  description: string;
}

const POLICIES: Record<RateLimitKey, RateLimitConfig> = {
  "render-room": { windowSec: 3600, limit: 20, description: "1시간 20회" },
  "refine-render": { windowSec: 3600, limit: 50, description: "1시간 50회" },
  "design-chat": { windowSec: 300, limit: 30, description: "5분 30회" },
  "sam-click": { windowSec: 60, limit: 30, description: "1분 30회" },
};

export class RateLimitError extends Error {
  constructor(
    public key: RateLimitKey,
    public retryAfterSec: number,
    public limit: number,
  ) {
    super("RATE_LIMIT_EXCEEDED");
  }
}

interface KvLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: string | number, opts?: { ex?: number; nx?: boolean }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, sec: number): Promise<unknown>;
}

let kvClient: KvLike | null | undefined;

/**
 * @vercel/kv 또는 호환 클라이언트 lazy load.
 * 환경변수 미설정 시 null — fail-open.
 */
async function getKv(): Promise<KvLike | null> {
  if (kvClient !== undefined) return kvClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    kvClient = null;
    console.log("[rate-limit] KV not configured — rate limiting disabled (fail-open)");
    return null;
  }
  try {
    const mod = await import("@vercel/kv");
    kvClient = mod.kv as unknown as KvLike;
    return kvClient;
  } catch (e) {
    console.warn("[rate-limit] @vercel/kv import failed:", e);
    kvClient = null;
    return null;
  }
}

/**
 * 사용자별 + endpoint별 sliding window 제한 검사.
 * 초과 시 RateLimitError throw.
 *
 * 구현: 단순 window counter (정확한 sliding window보다 가벼움, 가이드 §5-5 KISS).
 *  - 키: `rl:{key}:{userId}:{windowEpoch}`
 *  - INCR + EXPIRE
 *  - 카운트 > limit이면 throw
 *
 * KV 미설정 시 silent skip (fail-open) — 외부 서비스 장애 시에도 사용자 차단 X.
 */
export async function enforceRateLimit(
  userId: string,
  key: RateLimitKey,
): Promise<{ remaining: number; limit: number }> {
  const policy = POLICIES[key];
  if (!policy) throw new Error(`Unknown rate limit key: ${key}`);

  const kv = await getKv();
  if (!kv) {
    return { remaining: policy.limit, limit: policy.limit };
  }

  const windowEpoch = Math.floor(Date.now() / 1000 / policy.windowSec);
  const redisKey = `rl:${key}:${userId}:${windowEpoch}`;
  try {
    const count = await kv.incr(redisKey);
    if (count === 1) {
      // 첫 요청 — TTL 설정
      await kv.expire(redisKey, policy.windowSec).catch(() => {});
    }
    if (count > policy.limit) {
      const retryAfter =
        (windowEpoch + 1) * policy.windowSec - Math.floor(Date.now() / 1000);
      throw new RateLimitError(key, Math.max(retryAfter, 1), policy.limit);
    }
    return { remaining: Math.max(0, policy.limit - count), limit: policy.limit };
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    // KV 에러 시 fail-open
    console.warn("[rate-limit] kv error (fail-open):", e);
    return { remaining: policy.limit, limit: policy.limit };
  }
}

export function isRateLimitConfigured(): boolean {
  return !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
}
