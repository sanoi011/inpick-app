/**
 * 평면도 영구 저장 시스템 — 가이드(InPick_Floorplan_Pipeline_Refactor §1) 준수.
 *
 * 환경변수:
 *   FLOORPLAN_STORAGE_MODE = "supabase" | "local"  (기본: supabase)
 *   FLOORPLAN_LOCAL_ROOT = "E:/inpick-storage"     (로컬 모드 전용)
 *
 * 저장 구조:
 *   {store_root}/floorplans/{property_id}/
 *     ├── original.png         네이버 크롤링 원본
 *     ├── normalized.png       워터마크 제거 + 1024×1024 정규화 (gpt-image-2 input용)
 *     └── metadata.json        주소·평형·출처·캐시일자
 *
 * property_id = MD5(address|aptName|areaSqm).slice(0, 16)
 *   동일 단지·동일 평형은 한 번만 저장, 모든 사용자 공유 (CDN 캐시).
 */
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════
type StorageMode = "supabase" | "local";

const STORAGE_MODE: StorageMode =
  (process.env.FLOORPLAN_STORAGE_MODE as StorageMode) || "supabase";
const LOCAL_ROOT = process.env.FLOORPLAN_LOCAL_ROOT || "E:/inpick-storage";
const SUPABASE_BUCKET = "floorplans";

let floorplanBucketPromise: Promise<boolean> | null = null;

/** 배포 환경에 floorplans 버킷이 빠져 있어도 서비스 요청 시 한 번만 자동 복구한다. */
export function ensureFloorplanBucketExists(): Promise<boolean> {
  if (floorplanBucketPromise) return floorplanBucketPromise;
  floorplanBucketPromise = (async () => {
    try {
      const supa = createAdminClient();
      const { data: buckets, error: listError } = await supa.storage.listBuckets();
      if (listError) throw listError;
      if ((buckets || []).some((bucket) => bucket.name === SUPABASE_BUCKET)) return true;
      const { error: createError } = await supa.storage.createBucket(SUPABASE_BUCKET, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024,
      });
      if (createError) throw createError;
      console.info(`[FLOORPLAN] bucket "${SUPABASE_BUCKET}" auto-created`);
      return true;
    } catch (error) {
      console.warn(
        "[FLOORPLAN] bucket ensure failed:",
        error instanceof Error ? error.message : String(error),
      );
      floorplanBucketPromise = null;
      return false;
    }
  })();
  return floorplanBucketPromise;
}

export type FloorplanFileType = "original" | "normalized";

export interface FloorplanData {
  buffer: Buffer;
  contentType: string;
}

export interface FloorplanMetadata {
  property_id: string;
  address: string;
  apt_name: string;
  area_sqm: number;
  source_url: string;
  cached_at: string;
  /** 추가 정보 (정형화 결과) */
  rooms?: Array<{ name: string; widthMm: number; depthMm: number }>;
  total_width_mm?: number;
  total_depth_mm?: number;
  pyeong?: string;
}

// ═══════════════════════════════════════════════════
// property_id — 캐싱 키
// ═══════════════════════════════════════════════════
/**
 * 알고리즘 버전 — 변경 시 모든 기존 캐시 자동 무효화.
 * v2 (2026-05-09): 워터마크 제거 + 확장/비확장 분기 + 매핑 강화 prompt 적용.
 *                  v1 캐시는 옛 prompt 결과라 모두 폐기.
 */
const PROPERTY_ID_ALGO_VERSION = "v2";

export function getPropertyId(
  address: string,
  aptName: string,
  areaSqm: number,
): string {
  const key = `${PROPERTY_ID_ALGO_VERSION}:${address}|${aptName}|${areaSqm.toFixed(2)}`;
  return crypto.createHash("md5").update(key).digest("hex").slice(0, 16);
}

export function getCurrentAlgoVersion(): string {
  return PROPERTY_ID_ALGO_VERSION;
}

// ═══════════════════════════════════════════════════
// Public API — 저장/로드
// ═══════════════════════════════════════════════════

/**
 * 평면도 저장. 반환값은 호출자가 참고할 수 있는 URL 또는 path (storage 모드별 다름).
 */
export async function saveFloorplan(
  propertyId: string,
  type: FloorplanFileType,
  data: FloorplanData,
): Promise<string> {
  const filename = `${type}.png`;
  const ref = STORAGE_MODE === "local"
    ? await saveToLocal(propertyId, filename, data)
    : await saveToSupabase(propertyId, filename, data);
  console.log(`[FLOORPLAN] saved ${propertyId}/${filename} → ${ref.slice(0, 80)}`);
  return ref;
}

/**
 * 평면도 Buffer 로드. 없으면 null.
 */
export async function loadFloorplan(
  propertyId: string,
  type: FloorplanFileType,
): Promise<Buffer | null> {
  const filename = `${type}.png`;
  return STORAGE_MODE === "local"
    ? loadFromLocal(propertyId, filename)
    : loadFromSupabase(propertyId, filename);
}

/**
 * 평면도 존재 여부.
 */
export async function hasFloorplan(
  propertyId: string,
  type: FloorplanFileType,
): Promise<boolean> {
  const buf = await loadFloorplan(propertyId, type);
  return buf !== null;
}

/**
 * 평면도 public URL (Supabase) 또는 file:// path (local).
 * gpt-image-2 edits API의 image input으로 fetch 가능한 URL 반환.
 */
export function getFloorplanUrl(
  propertyId: string,
  type: FloorplanFileType,
): string | null {
  const filename = `${type}.png`;
  if (STORAGE_MODE === "supabase") {
    try {
      const supa = createAdminClient();
      const { data } = supa.storage.from(SUPABASE_BUCKET).getPublicUrl(`${propertyId}/${filename}`);
      return data.publicUrl;
    } catch {
      return null;
    }
  }
  return path.join(LOCAL_ROOT, "floorplans", propertyId, filename);
}

/**
 * 메타데이터 JSON 저장.
 */
export async function saveMetadata(
  propertyId: string,
  metadata: FloorplanMetadata,
): Promise<void> {
  const json = JSON.stringify(metadata, null, 2);
  const data: FloorplanData = {
    buffer: Buffer.from(json, "utf-8"),
    contentType: "application/json",
  };
  if (STORAGE_MODE === "local") {
    await saveToLocal(propertyId, "metadata.json", data);
  } else {
    await saveToSupabase(propertyId, "metadata.json", data);
  }
}

/**
 * 메타데이터 로드 (선택).
 */
export async function loadMetadata(propertyId: string): Promise<FloorplanMetadata | null> {
  const buf = STORAGE_MODE === "local"
    ? await loadFromLocal(propertyId, "metadata.json")
    : await loadFromSupabase(propertyId, "metadata.json");
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf-8")) as FloorplanMetadata;
  } catch {
    return null;
  }
}

/**
 * 현재 storage 모드 + 설정 정보 (디버그/UI 표시용).
 */
export function getStorageInfo(): { mode: StorageMode; bucket?: string; localRoot?: string } {
  return STORAGE_MODE === "supabase"
    ? { mode: "supabase", bucket: SUPABASE_BUCKET }
    : { mode: "local", localRoot: LOCAL_ROOT };
}

// ═══════════════════════════════════════════════════
// Supabase 구현
// ═══════════════════════════════════════════════════
async function saveToSupabase(
  propertyId: string,
  filename: string,
  data: FloorplanData,
): Promise<string> {
  await ensureFloorplanBucketExists();
  const supa = createAdminClient();
  const filePath = `${propertyId}/${filename}`;
  const { error } = await supa.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, data.buffer, {
      contentType: data.contentType,
      upsert: true,
      cacheControl: "31536000", // 1년
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data: urlData } = supa.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

async function loadFromSupabase(
  propertyId: string,
  filename: string,
): Promise<Buffer | null> {
  try {
    const supa = createAdminClient();
    const { data, error } = await supa.storage
      .from(SUPABASE_BUCKET)
      .download(`${propertyId}/${filename}`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════
// 로컬 파일시스템 구현 (Windows E드라이브 또는 /tmp 등)
// ═══════════════════════════════════════════════════
async function saveToLocal(
  propertyId: string,
  filename: string,
  data: FloorplanData,
): Promise<string> {
  const dirPath = path.join(LOCAL_ROOT, "floorplans", propertyId);
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, filename);
  await fs.writeFile(filePath, data.buffer);
  return filePath;
}

async function loadFromLocal(
  propertyId: string,
  filename: string,
): Promise<Buffer | null> {
  try {
    const filePath = path.join(LOCAL_ROOT, "floorplans", propertyId, filename);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}
