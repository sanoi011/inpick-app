/**
 * Image storage abstraction — Phase 3.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md Prompt 3
 *
 * 책임:
 *   - production에서 base64 data URL 직접 반환 X — storage URL 사용
 *   - PoC 모드에서는 base64 허용 (metadata/debug)
 *   - 이미지 파일명: {jobId}/{roomName}/{seed}/{modelVersion}.png — 추적 가능
 *
 * 현재 구현:
 *   - Provider: Supabase Storage (기본). R2/S3는 추후 Phase에서 추가.
 *   - Bucket: env IMAGE_STORAGE_BUCKET (default "renders")
 *   - Public access: bucket에 public 권한 설정 필요 (Supabase 대시보드 또는 별도 SQL)
 *
 * 기존 패턴 재사용:
 *   - floorplan-storage.ts와 같은 createAdminClient + storage.from(bucket).upload 패턴
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";

// ─── 환경설정 ───
const PROVIDER = (process.env.IMAGE_STORAGE_PROVIDER || "supabase").toLowerCase() as
  | "supabase"
  | "r2"
  | "s3";
const BUCKET = process.env.IMAGE_STORAGE_BUCKET || "renders";
const PUBLIC_BASE_URL = process.env.IMAGE_PUBLIC_BASE_URL; // 옵션 — CDN 등

// ─── PoC 모드 — base64 허용 여부 ───
function isProductionMode(): boolean {
  // production이면 base64 응답 금지
  return process.env.NODE_ENV === "production";
}

function isStorageReady(): boolean {
  if (PROVIDER === "supabase") {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  // R2/S3는 별도 검증 (추후 추가)
  return false;
}

// ─── Supabase admin client (storage 작업용) ───
function getSupabaseAdmin() {
  if (PROVIDER !== "supabase") {
    throw new Error(`[image-storage] PROVIDER=${PROVIDER} 미지원 (supabase만 구현)`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[image-storage] Supabase 환경변수 미설정");
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── 파일명 생성 ───
export interface FilenameInput {
  jobId?: string;
  roomName?: string;
  seed?: number;
  modelVersion?: string;
  ext?: "png" | "jpg" | "webp";
}

export function generateRenderFilename(input: FilenameInput): string {
  const ext = input.ext || "png";
  const safeRoom = (input.roomName || "room")
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
    .slice(0, 32);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const segments = [
    stamp,
    input.jobId ? input.jobId.slice(0, 8) : Math.random().toString(36).slice(2, 10),
    safeRoom,
    input.seed != null ? `seed${input.seed}` : null,
    input.modelVersion ? input.modelVersion.replace(/[^a-zA-Z0-9_-]/g, "") : null,
  ].filter(Boolean);
  return `${segments.join("_")}.${ext}`;
}

// ─── 업로드 결과 타입 ───
export interface UploadRenderResult {
  url?: string; // 성공 시 public URL
  storedAt?: string; // bucket/path
  error?: string;
  mode: "production-storage" | "poc-base64" | "failed";
}

/**
 * base64 PNG → Supabase Storage 업로드 → public URL 반환.
 *
 * production 모드에서 storage 미설정 시 에러.
 * PoC 모드(non-production)에서 storage 미설정 시 base64 그대로 반환 (data URL).
 */
export async function uploadRenderImage(
  imageBase64: string,
  options: FilenameInput = {},
): Promise<UploadRenderResult> {
  // base64 prefix 제거 (data:image/png;base64,)
  const cleanB64 = imageBase64.startsWith("data:")
    ? imageBase64.split(",")[1] || imageBase64
    : imageBase64;

  if (!cleanB64) {
    return { mode: "failed", error: "base64 입력 없음" };
  }

  // ─── Storage 미설정 ───
  if (!isStorageReady()) {
    if (isProductionMode()) {
      return {
        mode: "failed",
        error:
          "Production 모드에서 storage 미설정 — IMAGE_STORAGE_PROVIDER + IMAGE_STORAGE_BUCKET 필수",
      };
    }
    // PoC — base64 그대로 반환
    return {
      mode: "poc-base64",
      url: `data:image/png;base64,${cleanB64}`,
    };
  }

  // ─── Supabase 업로드 ───
  try {
    const supa = getSupabaseAdmin();
    const buffer = Buffer.from(cleanB64, "base64");
    const filename = generateRenderFilename(options);
    const path = filename;

    const { error: uploadError } = await supa.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: `image/${options.ext || "png"}`,
        upsert: false,
        cacheControl: "31536000", // 1 year — 이미지 immutable
      });

    if (uploadError) {
      return { mode: "failed", error: `Supabase upload: ${uploadError.message}` };
    }

    // Public URL
    const { data: urlData } = supa.storage.from(BUCKET).getPublicUrl(path);
    let publicUrl = urlData?.publicUrl;
    if (PUBLIC_BASE_URL && publicUrl) {
      // CDN override 옵션
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      publicUrl = publicUrl.replace(supaUrl, PUBLIC_BASE_URL);
    }
    if (!publicUrl) {
      return { mode: "failed", error: "Public URL 생성 실패" };
    }

    return {
      mode: "production-storage",
      url: publicUrl,
      storedAt: `${BUCKET}/${path}`,
    };
  } catch (e) {
    return {
      mode: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * data URL → 일반 URL로 변환 (PoC base64 → production storage 마이그레이션 헬퍼).
 * 이미 storage URL이면 그대로 반환.
 */
export async function ensureStorageUrl(
  imageRef: string,
  options: FilenameInput = {},
): Promise<string> {
  if (!imageRef.startsWith("data:")) return imageRef; // 이미 URL
  const result = await uploadRenderImage(imageRef, options);
  if (result.mode === "production-storage" && result.url) return result.url;
  if (result.mode === "poc-base64" && result.url) return result.url; // PoC: base64 유지
  throw new Error(`[image-storage] 변환 실패: ${result.error}`);
}

/** 정보 조회 (디버그/관리자) */
export function getStorageConfig() {
  return {
    provider: PROVIDER,
    bucket: BUCKET,
    publicBaseUrl: PUBLIC_BASE_URL,
    ready: isStorageReady(),
    productionMode: isProductionMode(),
  };
}
