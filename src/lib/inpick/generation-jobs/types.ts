/**
 * Image generation job — Phase 2 async tracking 타입.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md Prompt 2
 * 마이그레이션: supabase/migrations/20260510020000_image_generation_jobs.sql
 */

import type { RenderRoomRequest, RenderRoomResult } from "@/lib/inpick/image-backends/types";

export type ImageGenerationJobStatus = "queued" | "processing" | "completed" | "failed";

// ─── DB row (snake_case, Supabase 응답 그대로) ───
export interface ImageGenerationJobRow {
  id: string;
  user_id: string | null;
  contractor_id: string | null;
  status: ImageGenerationJobStatus;
  backend: "openai" | "runpod";
  model: string | null;
  external_job_id: string | null;
  request: Record<string, unknown>;
  result: Record<string, unknown> | null;
  result_url: string | null;
  cost_usd: number | null;
  elapsed_ms: number | null;
  error: string | null;
  hint: string | null;
  model_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ─── 클라이언트 DTO (camelCase) ───
export interface ImageGenerationJob {
  id: string;
  userId?: string;
  contractorId?: string;
  status: ImageGenerationJobStatus;
  backend: "openai" | "runpod";
  model?: string;
  externalJobId?: string;
  request: RenderRoomRequest;
  result?: RenderRoomResult;
  resultUrl?: string;
  costUsd?: number;
  elapsedMs?: number;
  error?: string;
  hint?: string;
  modelStatus?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export function mapDbJob(row: ImageGenerationJobRow): ImageGenerationJob {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    contractorId: row.contractor_id ?? undefined,
    status: row.status,
    backend: row.backend,
    model: row.model ?? undefined,
    externalJobId: row.external_job_id ?? undefined,
    request: row.request as unknown as RenderRoomRequest,
    result: row.result as unknown as RenderRoomResult | undefined,
    resultUrl: row.result_url ?? undefined,
    costUsd: row.cost_usd ? Number(row.cost_usd) : undefined,
    elapsedMs: row.elapsed_ms ?? undefined,
    error: row.error ?? undefined,
    hint: row.hint ?? undefined,
    modelStatus: row.model_status ?? undefined,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

// ─── Job creation input ───
export interface CreateJobInput {
  userId?: string;
  contractorId?: string;
  backend: "openai" | "runpod";
  model?: string;
  request: RenderRoomRequest;
  metadata?: Record<string, unknown>;
}

// ─── Job update input (partial) ───
export interface UpdateJobInput {
  status?: ImageGenerationJobStatus;
  externalJobId?: string;
  result?: RenderRoomResult;
  resultUrl?: string;
  costUsd?: number;
  elapsedMs?: number;
  error?: string;
  hint?: string;
  modelStatus?: string;
  metadata?: Record<string, unknown>;
}
