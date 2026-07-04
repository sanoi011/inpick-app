/**
 * POST /api/inpick/design-outputs — Step2 이미지 생성 결과 evidence 저장
 * GET  /api/inpick/design-outputs?projectId=... — 견적 페이지/재진입 시 조회
 * PATCH /api/inpick/design-outputs — status/materialHints/analysisJobId 업데이트
 *
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §6-1~6-3
 *
 * 정책:
 *   - 인증 필수 (RLS 적용)
 *   - POST 성공 직후 자재 분석 백그라운드 시작 시도 (실패해도 저장 성공 유지)
 *   - 자재 분석 실패는 design_output 저장 성공을 막지 않음
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractMaterialHintsFromPrompt } from "@/lib/inpick/estimate-context/prompt-hints";
import { runVisionAnalysisForOutput } from "@/lib/inpick/estimate-context/vision-analysis-runner";
import {
  mapDbDesignOutput,
  type DesignOutput,
  type DesignOutputStatus,
  type DesignTargetType,
  type MaterialHint,
  type ProjectMode,
  type RenderKind,
} from "@/lib/inpick/estimate-context/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 자재 분석을 응답 전에 완료해야 하므로 분석 시간만큼 함수 수명 필요
export const maxDuration = 300;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error("[design-outputs] auth check failed:", err);
    return null;
  }
}

const VALID_PROJECT_MODES: ProjectMode[] = ["apartment", "photo_only", "commercial"];
const VALID_TARGET_TYPES: DesignTargetType[] = ["whole", "room", "zone", "surface"];
const VALID_RENDER_KINDS: RenderKind[] = [
  "full_render",
  "room_render",
  "zone_render",
  "surface_render",
  "space_edit",
];
const VALID_STATUSES: DesignOutputStatus[] = [
  "generated",
  "analysis_pending",
  "analysis_done",
  "analysis_failed",
];

interface PostBody {
  projectId: string;
  projectMode: ProjectMode;
  targetType: DesignTargetType;
  targetId: string;
  targetName: string;
  renderKind: RenderKind;
  imageUrl: string;
  prompt?: string;
  negativePrompt?: string;
  materialHints?: MaterialHint[];
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body.projectId || !body.imageUrl || !body.targetId || !body.targetName) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELDS", hint: "projectId/imageUrl/targetId/targetName 필수" },
      { status: 400 },
    );
  }
  if (!VALID_PROJECT_MODES.includes(body.projectMode)) {
    return NextResponse.json({ error: "INVALID_PROJECT_MODE" }, { status: 400 });
  }
  if (!VALID_TARGET_TYPES.includes(body.targetType)) {
    return NextResponse.json({ error: "INVALID_TARGET_TYPE" }, { status: 400 });
  }
  if (!VALID_RENDER_KINDS.includes(body.renderKind)) {
    return NextResponse.json({ error: "INVALID_RENDER_KIND" }, { status: 400 });
  }

  // P1: prompt에서 1차 materialHint 자동 추출 (없으면 vision 결과로 보강)
  const hintsFromInput = Array.isArray(body.materialHints) ? body.materialHints : [];
  const promptHints = extractMaterialHintsFromPrompt({
    prompt: body.prompt ?? null,
    projectMode: body.projectMode,
    targetName: body.targetName,
  });
  // 사용자가 입력한 hint 우선, 그 다음 prompt 추출
  const mergedHints: MaterialHint[] = [];
  const seen = new Set<string>();
  for (const h of [...hintsFromInput, ...promptHints]) {
    const key = `${h.surfaceType}::${h.materialCategory}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedHints.push(h);
  }

  const insertRow = {
    project_id: body.projectId,
    user_id: userId,
    project_mode: body.projectMode,
    target_type: body.targetType,
    target_id: body.targetId,
    target_name: body.targetName,
    render_kind: body.renderKind,
    image_url: body.imageUrl,
    prompt: body.prompt ?? null,
    negative_prompt: body.negativePrompt ?? null,
    material_hints: mergedHints,
    status: "generated" as DesignOutputStatus,
  };

  const { data, error } = await admin
    .from("design_outputs")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[design-outputs] insert failed:", error);
    return NextResponse.json(
      { error: "INSERT_FAILED", details: error?.message },
      { status: 500 },
    );
  }

  const output: DesignOutput = mapDbDesignOutput(data);

  // P3: 자재 정밀 분석 — 응답 전에 완료까지 대기.
  //   Vercel 서버리스는 응답 반환 직후 함수가 동결되므로 fire-and-forget으로 돌리면
  //   분석이 중간에 죽어 analysis_pending에 영구히 멈춤 (TestFlight 피드백 2026-07-02).
  //   클라이언트(saveDesignOutputAfterRender)는 이 POST를 void로 호출하므로 대기해도 UX 지연 없음.
  //   실패해도 저장 성공 응답은 유지 (runner 내부에서 analysis_failed 마킹).
  await runVisionAnalysisForOutput({
    admin,
    output,
    origin: req.nextUrl.origin,
    cookie: req.headers.get("cookie") ?? "",
  });

  return NextResponse.json({ output }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "MISSING_PROJECT_ID" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("design_outputs")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[design-outputs] select failed:", error);
    return NextResponse.json({ error: "SELECT_FAILED", details: error.message }, { status: 500 });
  }

  const outputs = (data ?? []).map(mapDbDesignOutput);
  return NextResponse.json({ outputs });
}

interface PatchBody {
  id: string;
  status?: DesignOutputStatus;
  materialHints?: MaterialHint[];
  analysisJobId?: string;
  analysisError?: string;
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }

  // 소유권 확인 (RLS도 보호하지만 명시적 체크)
  const { data: existing, error: fetchErr } = await admin
    .from("design_outputs")
    .select("user_id")
    .eq("id", body.id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.user_id !== userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (Array.isArray(body.materialHints)) {
    patch.material_hints = body.materialHints;
  }
  if (body.analysisJobId !== undefined) {
    patch.analysis_job_id = body.analysisJobId || null;
  }
  if (body.analysisError !== undefined) {
    patch.analysis_error = body.analysisError || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("design_outputs")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[design-outputs] update failed:", error);
    return NextResponse.json({ error: "UPDATE_FAILED", details: error?.message }, { status: 500 });
  }

  return NextResponse.json({ output: mapDbDesignOutput(data) });
}
