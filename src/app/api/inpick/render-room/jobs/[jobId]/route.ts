/**
 * GET /api/inpick/render-room/jobs/[jobId]
 *
 * Async image generation job 상태 조회 (Phase 2).
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md Prompt 2
 *
 * 흐름:
 *   1. DB에서 job 조회
 *   2. status가 queued/processing이고 RunPod externalJobId 있으면 → RunPod /status 동기화
 *   3. 응답: { status, imageUrl?, error?, hint?, ... }
 *
 * 인증:
 *   - 소유권 검증 (job.user_id || job.contractor_id 매칭) — TODO Phase 10
 *   - 현재는 jobId만 알면 조회 가능 (UUID 충분히 안전)
 */
import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob, isJobsRepoReady } from "@/lib/inpick/generation-jobs/repository";
import { getRunPodBackend } from "@/lib/inpick/image-backends/runpod-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const jobId = params.jobId;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "jobId 필수" }, { status: 400 });
  }
  if (!isJobsRepoReady()) {
    return NextResponse.json(
      {
        error: "Async job 미설정",
        hint: "Supabase 환경변수 미설정 (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
      },
      { status: 500 },
    );
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found", jobId }, { status: 404 });
  }

  // ─── 활성 job + RunPod externalJobId 있으면 RunPod 상태 동기화 ───
  if (
    (job.status === "queued" || job.status === "processing") &&
    job.backend === "runpod" &&
    job.externalJobId
  ) {
    try {
      const backend = getRunPodBackend();
      if (backend.getJobStatus) {
        const remote = await backend.getJobStatus(job.externalJobId);
        // 변경 시 DB 동기화
        if (remote.status === "completed" && remote.imageUrl) {
          await updateJob(jobId, {
            status: "completed",
            result: remote,
            resultUrl: remote.imageUrl,
            costUsd: remote.costUsd,
            elapsedMs: remote.elapsedMs,
          });
          // 갱신 결과 반환
          return NextResponse.json({
            jobId,
            status: "completed",
            imageUrl: remote.imageUrl,
            backend: "runpod",
            model: remote.model,
            costUsd: remote.costUsd,
            elapsedMs: remote.elapsedMs,
          });
        }
        if (remote.status === "failed") {
          await updateJob(jobId, {
            status: "failed",
            error: remote.error,
            hint: remote.hint,
            modelStatus: remote.modelStatus,
          });
          return NextResponse.json({
            jobId,
            status: "failed",
            error: remote.error,
            hint: remote.hint,
            backend: "runpod",
          });
        }
        // 여전히 progress → DB 그대로
      }
    } catch (e) {
      console.warn("[jobs/" + jobId + "] RunPod status sync 실패:", e);
      // 동기화 실패 — DB 캐시값 그대로 반환
    }
  }

  // ─── 현재 DB 상태 그대로 반환 ───
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    imageUrl: job.resultUrl || job.result?.imageUrl,
    backend: job.backend,
    model: job.model,
    costUsd: job.costUsd,
    elapsedMs: job.elapsedMs,
    error: job.error,
    hint: job.hint,
    modelStatus: job.modelStatus,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  });
}
