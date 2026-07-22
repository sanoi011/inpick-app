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

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

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
 * 정책 (2026-05-11 fix):
 *   - storage 업로드 성공 → production-storage URL
 *   - storage 미설정 또는 업로드 실패 (Bucket not found 등) → base64 fallback
 *   - IMAGE_STORAGE_STRICT=true 일 때만 production에서 실패 시 throw (운영 정책)
 *
 * 이전 정책 (Phase 3 0580a46):
 *   - production = storage 강제 → bucket 없으면 사용자에게 502 에러
 *   - bucket이 자동 생성 안 되니까 production 깨짐
 */

/** 버킷 자동 생성 시도 (한 번만) — 이미 존재하면 silent OK */
let _bucketEnsured = false;
async function ensureBucketExists(supa: ReturnType<typeof getSupabaseAdmin>): Promise<boolean> {
  if (_bucketEnsured) return true;
  try {
    const { data: list, error: listErr } = await supa.storage.listBuckets();
    if (listErr) {
      console.warn(`[image-storage] listBuckets error: ${listErr.message}`);
      return false;
    }
    const exists = (list || []).some((b: { name: string }) => b.name === BUCKET);
    if (exists) {
      _bucketEnsured = true;
      return true;
    }
    // 생성 시도 (public read)
    const { error: createErr } = await supa.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
    });
    if (createErr) {
      console.warn(`[image-storage] createBucket fail: ${createErr.message}`);
      return false;
    }
    _bucketEnsured = true;
    console.info(`[image-storage] bucket "${BUCKET}" auto-created`);
    return true;
  } catch (e) {
    console.warn(`[image-storage] ensureBucket error: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

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

  const dataUrl = `data:image/png;base64,${cleanB64}`;
  const strictMode = process.env.IMAGE_STORAGE_STRICT === "true";

  // ─── Storage 미설정 ───
  if (!isStorageReady()) {
    if (isProductionMode() && strictMode) {
      return {
        mode: "failed",
        error:
          "Production 모드에서 storage 미설정 — IMAGE_STORAGE_PROVIDER + IMAGE_STORAGE_BUCKET 필수",
      };
    }
    // 기본 — base64 fallback (production도 허용 — 사용자 흐름 우선)
    if (isProductionMode()) {
      console.warn(
        "[image-storage] storage 미설정 — base64 fallback 사용 중 (production). " +
          "Vercel/Supabase에 IMAGE_STORAGE_BUCKET=renders + bucket 생성 권장.",
      );
    }
    return { mode: "poc-base64", url: dataUrl };
  }

  // ─── Supabase 업로드 ───
  try {
    const supa = getSupabaseAdmin();
    // 버킷 자동 생성 시도 (한 번만)
    await ensureBucketExists(supa);

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
      // Bucket not found 등 — base64 fallback (strict 모드만 실패)
      if (strictMode && isProductionMode()) {
        return { mode: "failed", error: `Supabase upload: ${uploadError.message}` };
      }
      console.warn(
        `[image-storage] upload fail — base64 fallback: ${uploadError.message}`,
      );
      return { mode: "poc-base64", url: dataUrl };
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
      // Public URL 생성 실패 — base64 fallback (strict만 실패)
      if (strictMode && isProductionMode()) {
        return { mode: "failed", error: "Public URL 생성 실패" };
      }
      return { mode: "poc-base64", url: dataUrl };
    }

    return {
      mode: "production-storage",
      url: publicUrl,
      storedAt: `${BUCKET}/${path}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (process.env.IMAGE_STORAGE_STRICT === "true" && isProductionMode()) {
      return { mode: "failed", error: msg };
    }
    console.warn(`[image-storage] unexpected — base64 fallback: ${msg}`);
    return { mode: "poc-base64", url: dataUrl };
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

// Locked originals use a separate fail-closed path: never a public URL or base64 fallback.
export const LOCKED_DESIGN_BUCKET = "private-design-renders";
export const MAX_LOCKED_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REMOTE_REDIRECTS = 3;

export class ImageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageInputError";
  }
}

export interface NormalizedPrivateImage {
  bytes: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  sha256: string;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export async function assertSafeRemoteImageUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageInputError("INVALID_IMAGE_URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new ImageInputError("UNSAFE_IMAGE_URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new ImageInputError("UNSAFE_IMAGE_HOST");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new ImageInputError("UNSAFE_IMAGE_HOST");
    return url;
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ImageInputError("IMAGE_HOST_LOOKUP_FAILED");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ImageInputError("UNSAFE_IMAGE_HOST");
  }
  return url;
}

async function readBoundedBody(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_LOCKED_IMAGE_BYTES) throw new ImageInputError("IMAGE_TOO_LARGE");
  if (!response.body) throw new ImageInputError("EMPTY_IMAGE_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LOCKED_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageInputError("IMAGE_TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

async function downloadRemoteImage(source: string): Promise<Buffer> {
  let current = await assertSafeRemoteImageUrl(source);
  for (let redirect = 0; redirect <= MAX_REMOTE_REDIRECTS; redirect++) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "image/png,image/jpeg,image/webp" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REMOTE_REDIRECTS) {
        throw new ImageInputError("IMAGE_REDIRECT_REJECTED");
      }
      current = await assertSafeRemoteImageUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new ImageInputError("IMAGE_DOWNLOAD_FAILED");
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim();
    if (!contentType.startsWith("image/")) throw new ImageInputError("UNSUPPORTED_IMAGE_TYPE");
    return readBoundedBody(response);
  }
  throw new ImageInputError("IMAGE_REDIRECT_REJECTED");
}

function decodeImageDataUrl(source: string): Buffer {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) throw new ImageInputError("INVALID_IMAGE_DATA_URL");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_LOCKED_IMAGE_BYTES) {
    throw new ImageInputError(bytes.length === 0 ? "EMPTY_IMAGE" : "IMAGE_TOO_LARGE");
  }
  return bytes;
}

export async function normalizeImageSource(source: string): Promise<NormalizedPrivateImage> {
  if (typeof source !== "string" || source.length === 0) throw new ImageInputError("IMAGE_SOURCE_REQUIRED");
  const input = source.startsWith("data:") ? decodeImageDataUrl(source) : await downloadRemoteImage(source);
  try {
    const pipeline = sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) {
      throw new ImageInputError("INVALID_IMAGE_DIMENSIONS");
    }
    const bytes = await pipeline.webp({ quality: 92, effort: 4 }).toBuffer();
    return {
      bytes,
      mimeType: "image/webp",
      width: metadata.width,
      height: metadata.height,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError("INVALID_IMAGE_CONTENT");
  }
}

export async function uploadLockedDesignImage(
  admin: SupabaseClient,
  storagePath: string,
  image: NormalizedPrivateImage,
): Promise<void> {
  const { error } = await admin.storage.from(LOCKED_DESIGN_BUCKET).upload(storagePath, image.bytes, {
    contentType: image.mimeType,
    cacheControl: "0",
    upsert: false,
  });
  if (error) throw new Error(`LOCKED_IMAGE_UPLOAD_FAILED: ${error.message}`);
}

export async function removeLockedDesignImage(admin: SupabaseClient, storagePath: string): Promise<void> {
  await admin.storage.from(LOCKED_DESIGN_BUCKET).remove([storagePath]);
}

export async function createLockedDesignSignedUrl(
  admin: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 480,
): Promise<string> {
  if (expiresInSeconds < 300 || expiresInSeconds > 600) throw new Error("INVALID_SIGNED_URL_TTL");
  const { data, error } = await admin.storage
    .from(LOCKED_DESIGN_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(`SIGNED_URL_FAILED: ${error?.message ?? "missing URL"}`);
  return data.signedUrl;
}
