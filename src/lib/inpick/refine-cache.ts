/**
 * 자재 교체 결과 캐싱.
 *
 * 가이드: InPick_Pipeline_Validation_v2.md §5-4
 * 인용: Spacely AI (renders 80% cache hit), Finout SaaS Cost Guide
 *
 * 캐시 키: MD5(imageHash | maskHash | materialSku)
 * 결정론적 — 같은 (이미지, 마스크, 자재) 조합은 항상 같은 결과여야 함.
 * Hit 시: gpt-image-2 호출 skip + 토큰 0 (호출자가 결정).
 */
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RefineCacheKeyInput {
  /** 원본 이미지 식별자 — public URL 또는 hash */
  imageRef: string;
  /** 마스크 PNG base64 또는 폴리곤 JSON */
  maskRef: string;
  /** 자재 SKU 또는 자재명+컬러 조합 */
  materialKey: string;
}

export interface CachedRefine {
  result_url: string;
  hit_count: number;
  metadata: Record<string, unknown>;
}

const TABLE = "refine_cache";

/** 결정론적 캐시 키 — 같은 입력은 항상 같은 키. */
export function buildRefineCacheKey(input: RefineCacheKeyInput): string {
  // image: URL의 경우 path 부분만 — 임시 토큰 무시. base64면 그대로.
  const normalizedImage = input.imageRef.length > 256
    ? crypto.createHash("md5").update(input.imageRef).digest("hex")
    : input.imageRef;
  const normalizedMask =
    input.maskRef.length > 256
      ? crypto.createHash("md5").update(input.maskRef).digest("hex")
      : input.maskRef;
  const raw = `${normalizedImage}|${normalizedMask}|${input.materialKey}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

export async function getCachedRefine(cacheKey: string): Promise<CachedRefine | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("result_url, hit_count, metadata")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    // hit_count 비동기 증가 (응답 차단 X)
    admin.rpc("increment_refine_cache_hit", { p_cache_key: cacheKey }).then(
      () => {},
      (e: unknown) => console.warn("[refine-cache] hit increment failed:", e),
    );
    return {
      result_url: data.result_url,
      hit_count: data.hit_count ?? 0,
      metadata: (data.metadata as Record<string, unknown>) ?? {},
    };
  } catch (e) {
    console.warn("[refine-cache] get failed:", e);
    return null;
  }
}

export async function saveRefineCache(
  cacheKey: string,
  resultUrl: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from(TABLE).upsert({
      cache_key: cacheKey,
      result_url: resultUrl,
      metadata,
      hit_count: 0,
    });
  } catch (e) {
    console.warn("[refine-cache] save failed:", e);
  }
}

/**
 * 캐시 사용 가능 여부 — 마이그레이션 미적용 환경에서는 silent skip.
 * 첫 호출 시 한 번만 검사하고 결과를 메모이즈.
 */
let cacheReady: boolean | null = null;
export async function isRefineCacheReady(): Promise<boolean> {
  if (cacheReady !== null) return cacheReady;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from(TABLE).select("cache_key").limit(1);
    cacheReady = !error;
    if (!cacheReady) {
      console.log("[refine-cache] table not ready — caching disabled until migration applied");
    }
    return cacheReady;
  } catch {
    cacheReady = false;
    return false;
  }
}
