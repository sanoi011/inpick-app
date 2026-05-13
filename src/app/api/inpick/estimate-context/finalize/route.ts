/**
 * POST /api/inpick/estimate-context/finalize
 *
 * 견적 페이지 진입 직전 호출 — Step1 + scope + designOutputs + materialEvidence + userMaterialEdits를
 * 하나의 estimate_contexts row로 묶어 contextId를 발급.
 *
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §6-4
 *
 * 중요:
 *   - canBuildEstimate는 전체 이미지 유무나 visionAnalysisByRoom 유무로 절대 판단하지 않음
 *   - projectMode별 최소 조건만 체크 (대부분 API가 폴백 처리하므로 false 케이스는 거의 없음)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { computeEstimateReadiness } from "@/lib/inpick/estimate-context/readiness";
import {
  mapDbDesignOutput,
  type DesignOutput,
  type EstimateReadiness,
  type ProjectMode,
} from "@/lib/inpick/estimate-context/types";

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

async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error("[estimate-context/finalize] auth check failed:", err);
    return null;
  }
}

interface FinalizeBody {
  projectId: string;
  projectMode: ProjectMode;
  /** 클라이언트가 보유한 sessionStorage step1 — 서버는 이를 신뢰하되 design_outputs는 DB에서 다시 조회 */
  step1Snapshot?: Record<string, unknown>;
  scopeSnapshot?: Record<string, unknown>;
  /** 옵션: 클라이언트가 직접 보낸 user material edits (편집기에서 누른 자재) */
  userMaterialEdits?: unknown[];
}

interface FinalizeResponse {
  contextId: string;
  canBuildEstimate: boolean;
  estimateLevel: EstimateReadiness["estimateLevel"];
  readinessScore: number;
  missingBlockingFields: string[];
  missingOptionalFields: string[];
  warnings: string[];
}

const VALID_MODES: ProjectMode[] = ["apartment", "photo_only", "commercial"];

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: "MISSING_PROJECT_ID" }, { status: 400 });
  }
  if (!VALID_MODES.includes(body.projectMode)) {
    return NextResponse.json({ error: "INVALID_PROJECT_MODE" }, { status: 400 });
  }

  // 1) design_outputs DB 조회 (소유 + 같은 projectId)
  const { data: designOutputRows, error: doErr } = await admin
    .from("design_outputs")
    .select("*")
    .eq("project_id", body.projectId)
    .eq("user_id", userId);
  if (doErr) {
    console.error("[estimate-context/finalize] design_outputs select failed:", doErr);
  }
  const designOutputs: DesignOutput[] = (designOutputRows ?? []).map(mapDbDesignOutput);

  // 2) material evidence 조회 — vision_material_observations / decisions 테이블 (있다면)
  //    P3에서 실제 분석 결과가 채워지면 의미 있어짐. 현재는 빈 배열 fallback.
  const materialEvidence = await fetchMaterialEvidence(admin, body.projectId, userId);

  // 3) commercial scope 조회
  const scopeSnapshot = await fetchScopeSnapshot(
    admin,
    body.projectId,
    body.projectMode,
    body.scopeSnapshot,
  );

  // 4) user_material_edits (편집기 자재 선택)
  const userMaterialEdits = Array.isArray(body.userMaterialEdits)
    ? body.userMaterialEdits
    : await fetchUserMaterialEdits(admin, body.projectId, userId);

  // 5) readiness 계산
  const readiness = computeEstimateReadiness({
    projectMode: body.projectMode,
    step1Snapshot: body.step1Snapshot ?? null,
    scopeSnapshot,
    designOutputs,
    materialEvidence,
    userMaterialEdits,
  });

  // 6) estimate_contexts insert
  const { data: ctxRow, error: insertErr } = await admin
    .from("estimate_contexts")
    .insert({
      project_id: body.projectId,
      user_id: userId,
      project_mode: body.projectMode,
      step1_snapshot: body.step1Snapshot ?? {},
      scope_snapshot: scopeSnapshot ?? {},
      design_outputs_snapshot: designOutputs,
      material_evidence_snapshot: materialEvidence,
      user_material_edits_snapshot: userMaterialEdits,
      estimate_level: readiness.estimateLevel,
      readiness_score: readiness.score,
      can_build_estimate: readiness.canBuildEstimate,
      missing_blocking_fields: readiness.missingBlockingFields,
      missing_optional_fields: readiness.missingOptionalFields,
      warnings: readiness.warnings,
    })
    .select("id")
    .single();

  if (insertErr || !ctxRow) {
    console.error("[estimate-context/finalize] insert failed:", insertErr);
    return NextResponse.json(
      { error: "INSERT_FAILED", details: insertErr?.message },
      { status: 500 },
    );
  }

  const response: FinalizeResponse = {
    contextId: String(ctxRow.id),
    canBuildEstimate: readiness.canBuildEstimate,
    estimateLevel: readiness.estimateLevel,
    readinessScore: readiness.score,
    missingBlockingFields: readiness.missingBlockingFields,
    missingOptionalFields: readiness.missingOptionalFields,
    warnings: readiness.warnings,
  };
  return NextResponse.json(response);
}

/**
 * vision_material_observations + match_decisions 조회.
 * 테이블이 없거나 에러 시 빈 배열 — finalize는 절대 실패하지 않음.
 */
async function fetchMaterialEvidence(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  userId: string,
): Promise<unknown[]> {
  try {
    const { data, error } = await admin
      .from("vision_material_observations")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * commercial_scope_snapshots 또는 클라이언트가 보낸 scope 조회.
 */
async function fetchScopeSnapshot(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  mode: ProjectMode,
  fromClient?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (fromClient && Object.keys(fromClient).length > 0) return fromClient;
  if (mode !== "commercial") return fromClient ?? null;
  try {
    const { data, error } = await admin
      .from("commercial_scope_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * render_material_edits 조회 (없으면 빈 배열).
 */
async function fetchUserMaterialEdits(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  userId: string,
): Promise<unknown[]> {
  try {
    const { data, error } = await admin
      .from("render_material_edits")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

interface ContextGetResponse {
  context: {
    id: string;
    projectId: string;
    projectMode: ProjectMode;
    step1Snapshot: Record<string, unknown>;
    scopeSnapshot: Record<string, unknown>;
    designOutputs: DesignOutput[];
    materialEvidence: unknown[];
    userMaterialEdits: unknown[];
    estimateLevel: EstimateReadiness["estimateLevel"];
    readinessScore: number;
    canBuildEstimate: boolean;
    warnings: string[];
    missingOptionalFields: string[];
    missingBlockingFields: string[];
    createdAt: string;
  };
}

/**
 * GET /api/inpick/estimate-context/finalize?contextId=... — 단일 context 조회 (견적 페이지 새로고침용)
 */
export async function GET(req: NextRequest): Promise<NextResponse<ContextGetResponse | { error: string }>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }
  const contextId = req.nextUrl.searchParams.get("contextId");
  if (!contextId) {
    return NextResponse.json({ error: "MISSING_CONTEXT_ID" }, { status: 400 });
  }
  const { data, error } = await admin
    .from("estimate_contexts")
    .select("*")
    .eq("id", contextId)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const designOutputs = Array.isArray(data.design_outputs_snapshot)
    ? (data.design_outputs_snapshot as DesignOutput[])
    : [];
  return NextResponse.json({
    context: {
      id: String(data.id),
      projectId: String(data.project_id),
      projectMode: data.project_mode as ProjectMode,
      step1Snapshot: (data.step1_snapshot as Record<string, unknown>) ?? {},
      scopeSnapshot: (data.scope_snapshot as Record<string, unknown>) ?? {},
      designOutputs,
      materialEvidence: Array.isArray(data.material_evidence_snapshot)
        ? (data.material_evidence_snapshot as unknown[])
        : [],
      userMaterialEdits: Array.isArray(data.user_material_edits_snapshot)
        ? (data.user_material_edits_snapshot as unknown[])
        : [],
      estimateLevel: data.estimate_level as EstimateReadiness["estimateLevel"],
      readinessScore: Number(data.readiness_score) || 0,
      canBuildEstimate: Boolean(data.can_build_estimate),
      warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
      missingOptionalFields: Array.isArray(data.missing_optional_fields)
        ? (data.missing_optional_fields as string[])
        : [],
      missingBlockingFields: Array.isArray(data.missing_blocking_fields)
        ? (data.missing_blocking_fields as string[])
        : [],
      createdAt: String(data.created_at),
    },
  });
}
