/**
 * Image generation job repository — Supabase persistence.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md Prompt 2
 *
 * 책임:
 *   - createJob: 신규 job INSERT (status='queued')
 *   - getJob: jobId로 단일 조회
 *   - updateJob: 상태/결과 갱신 (status='processing'|'completed'|'failed')
 *   - listRecentForUser: 사용자/사업자별 최근 job (디버그/UI)
 *
 * RLS는 service_role 전용 — admin client 사용 (인증/소유권은 호출자가 검증).
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";
import type {
  CreateJobInput,
  ImageGenerationJob,
  ImageGenerationJobRow,
  ImageGenerationJobStatus,
  UpdateJobInput,
} from "./types";
import { mapDbJob } from "./types";

const TABLE = "image_generation_jobs";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[generation-jobs] Supabase 환경변수 미설정 (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Async job 사용 가능 여부 (DB 연결 가능한지) */
export function isJobsRepoReady(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * 신규 job 생성 (status='queued').
 * 반환: 생성된 job (id 포함).
 */
export async function createJob(input: CreateJobInput): Promise<ImageGenerationJob> {
  const supa = getAdmin();
  const { data, error } = await supa
    .from(TABLE)
    .insert({
      user_id: input.userId ?? null,
      contractor_id: input.contractorId ?? null,
      status: "queued",
      backend: input.backend,
      model: input.model ?? null,
      request: input.request as unknown as Record<string, unknown>,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`[generation-jobs] createJob 실패: ${error?.message}`);
  }
  return mapDbJob(data as ImageGenerationJobRow);
}

/**
 * jobId로 단일 조회.
 * 미발견 시 null.
 */
export async function getJob(jobId: string): Promise<ImageGenerationJob | null> {
  const supa = getAdmin();
  const { data, error } = await supa
    .from(TABLE)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.warn("[generation-jobs] getJob 실패:", error.message);
    return null;
  }
  if (!data) return null;
  return mapDbJob(data as ImageGenerationJobRow);
}

/**
 * Job 상태/결과 갱신 (partial).
 * status가 completed/failed로 바뀌면 trigger가 completed_at 자동 set.
 */
export async function updateJob(
  jobId: string,
  patch: UpdateJobInput,
): Promise<ImageGenerationJob | null> {
  const supa = getAdmin();
  const updateData: Record<string, unknown> = {};
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.externalJobId !== undefined) updateData.external_job_id = patch.externalJobId;
  if (patch.result !== undefined) updateData.result = patch.result as unknown as Record<string, unknown>;
  if (patch.resultUrl !== undefined) updateData.result_url = patch.resultUrl;
  if (patch.costUsd !== undefined) updateData.cost_usd = patch.costUsd;
  if (patch.elapsedMs !== undefined) updateData.elapsed_ms = patch.elapsedMs;
  if (patch.error !== undefined) updateData.error = patch.error;
  if (patch.hint !== undefined) updateData.hint = patch.hint;
  if (patch.modelStatus !== undefined) updateData.model_status = patch.modelStatus;
  if (patch.metadata !== undefined) updateData.metadata = patch.metadata;

  const { data, error } = await supa
    .from(TABLE)
    .update(updateData)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) {
    console.warn("[generation-jobs] updateJob 실패:", error.message);
    return null;
  }
  return mapDbJob(data as ImageGenerationJobRow);
}

/**
 * 사용자별 최근 job 목록 (UI 디버그/이력).
 * limit 기본 20.
 */
export async function listRecentJobs(
  filter: { userId?: string; contractorId?: string; status?: ImageGenerationJobStatus },
  limit = 20,
): Promise<ImageGenerationJob[]> {
  const supa = getAdmin();
  let q = supa.from(TABLE).select("*").order("created_at", { ascending: false }).limit(limit);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.contractorId) q = q.eq("contractor_id", filter.contractorId);
  if (filter.status) q = q.eq("status", filter.status);

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((row) => mapDbJob(row as ImageGenerationJobRow));
}

/** Active jobs (queued/processing) — polling 대상 카운트 */
export async function countActiveJobs(): Promise<number> {
  const supa = getAdmin();
  const { count, error } = await supa
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "processing"]);
  if (error) return 0;
  return count ?? 0;
}
