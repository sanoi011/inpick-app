/**
 * PATCH /api/inpick/generation-jobs/[jobId]
 *
 * 이미지 생성 결과 보고 (성공 또는 실패).
 * 가이드: §6-5, §11 P3
 *
 * 처리:
 *   성공: status='completed' + image_url + design_output_id + completed_at
 *   실패: status='failed' + error_message + failed_at
 *
 * 정책:
 *   * 본인 job만 수정 가능 (RLS + ownership check)
 *   * design_outputs 저장 실패 시 reconciliation_cases 자동 생성
 *   * 같은 jobId에 대한 중복 호출은 status 검증으로 차단
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface PatchBody {
  action?: "complete" | "fail";
  imageUrl?: string;
  designOutputId?: string;
  imageGenerationJobId?: string;
  promptUsed?: string;
  resultPayload?: Record<string, unknown>;
  errorMessage?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.action || (body.action !== "complete" && body.action !== "fail")) {
    return NextResponse.json(
      { error: "missing_action", hint: "action: 'complete' | 'fail'" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  // 1) ownership 확인
  const { data: existing } = await admin
    .from("generation_jobs")
    .select("id, user_id, status, project_id")
    .eq("id", params.jobId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  const row = existing as { id: string; user_id: string; status: string; project_id: string };
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2) 이미 종료 상태면 idempotent 반환
  if (row.status === "completed" || row.status === "failed") {
    return NextResponse.json({ ok: true, idempotent: true, status: row.status });
  }

  const now = new Date().toISOString();
  if (body.action === "complete") {
    if (!body.imageUrl) {
      return NextResponse.json({ error: "missing_imageUrl" }, { status: 400 });
    }

    // design_outputs 저장이 안 됐으면 reconciliation case 생성 + status='reconciliation_required'
    let finalStatus = "completed";
    if (!body.designOutputId) {
      await admin.from("reconciliation_cases").insert({
        case_type: "output_saved_no_token_commit",
        severity: "high",
        user_id: user.id,
        project_id: row.project_id,
        generation_job_id: row.id,
        description: "generation_job 완료 보고에 designOutputId 없음 — design_outputs 미저장 의심",
        detected_payload: {
          imageUrl: body.imageUrl,
          jobId: row.id,
        },
      });
      finalStatus = "reconciliation_required";
    }

    const { error } = await admin
      .from("generation_jobs")
      .update({
        status: finalStatus,
        image_url: body.imageUrl,
        design_output_id: body.designOutputId ?? null,
        image_generation_job_id: body.imageGenerationJobId ?? null,
        prompt_used: body.promptUsed ?? null,
        result_payload: body.resultPayload ?? {},
        completed_at: now,
      })
      .eq("id", row.id);
    if (error) {
      console.error("[generation-jobs PATCH] complete error:", error.message);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      requiresReconciliation: finalStatus === "reconciliation_required",
    });
  }

  // action === 'fail'
  const { error } = await admin
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: body.errorMessage ?? "unknown",
      failed_at: now,
    })
    .eq("id", row.id);
  if (error) {
    console.error("[generation-jobs PATCH] fail error:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "failed" });
}
