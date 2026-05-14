/**
 * /api/inpick/generation-jobs
 *
 * GET  ?projectId= → Step2 mount 복구용 (사용자의 최근 generation_jobs 조회)
 * POST              → 이미지 생성 시작 시 job row INSERT (status='created')
 *
 * 가이드: inpick-payment-saas-flow-uiux-improvement-plan-20260514.md §6-5, §6-6
 *
 * v1 정책:
 *   * generation_jobs lifecycle만 추적 (token reserve/commit은 P4-2 분리)
 *   * 기존 render API의 enforceConsume은 그대로 유지
 *   * 이 wrapper는 design_outputs 영속성 + Step2 복구 + reconciliation 가능성 제공
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

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "missing_projectId" }, { status: 400 });
  }

  // RLS로 본인 row만 조회됨
  const { data, error } = await supabase
    .from("generation_jobs")
    .select(
      "id, project_id, project_mode, generation_base, target_type, target_id, target_name, provider, status, image_url, prompt_used, error_message, started_at, completed_at, failed_at, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[generation-jobs] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

interface CreateBody {
  projectId?: string;
  projectMode?: "apartment" | "photo_only" | "commercial";
  generationBase?: string;
  targetType?: "whole" | "room" | "zone" | "surface";
  targetId?: string;
  targetName?: string;
  provider?: "openai" | "runpod";
  model?: string;
  prompt?: string;
  inputPayload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.projectId || !body.projectMode || !body.targetType || !body.targetId || !body.targetName) {
    return NextResponse.json(
      {
        error: "missing_fields",
        hint: "projectId, projectMode, targetType, targetId, targetName 필수",
      },
      { status: 400 },
    );
  }

  // idempotency_key 자동 생성 (project + target + timestamp)
  // 클라이언트에서도 보낼 수 있게 옵션 (재시도 안전)
  const idempotencyKey = `gen:${body.projectId}:${body.targetId}:${Date.now()}:${crypto.randomUUID().slice(0, 6)}`;

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  const { data: inserted, error } = await admin
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      project_id: body.projectId,
      project_mode: body.projectMode,
      generation_base: body.generationBase ?? null,
      target_type: body.targetType,
      target_id: body.targetId,
      target_name: body.targetName,
      provider: body.provider ?? "openai",
      model: body.model ?? null,
      status: "created",
      idempotency_key: idempotencyKey,
      prompt_used: body.prompt ?? null,
      input_payload: body.inputPayload ?? {},
      started_at: new Date().toISOString(),
    })
    .select("id, status, idempotency_key")
    .single();

  if (error || !inserted) {
    console.error("[generation-jobs] POST error:", error?.message);
    return NextResponse.json(
      { error: "insert_failed", hint: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    jobId: (inserted as { id: string }).id,
    status: (inserted as { status: string }).status,
    idempotencyKey: (inserted as { idempotency_key: string }).idempotency_key,
  });
}
