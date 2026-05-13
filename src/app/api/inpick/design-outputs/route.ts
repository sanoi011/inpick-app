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

  // P3: 자재 정밀 분석 자동 백그라운드 시작 (fire-and-forget).
  //   - 즉시 status=analysis_pending으로 마킹
  //   - 별도 비동기로 vision-materials/analyze 호출 → 완료 시 PATCH로 design_output 갱신
  //   - 실패 시 status=analysis_failed로 마킹, 견적은 그래도 생성 가능
  //   - await 안 함 — POST 응답은 즉시 반환
  void startVisionAnalysisInBackground(admin, output, req).catch((e) =>
    console.warn("[design-outputs] background analyze failed (non-fatal):", e),
  );

  return NextResponse.json({ output }, { status: 201 });
}

/**
 * 백그라운드 자재 정밀 분석 시작.
 *
 * 흐름:
 *   1. status=analysis_pending 마킹
 *   2. vision-materials/analyze 호출 (서버-내부 호출)
 *   3. 결과 surfaces → MaterialHint 변환 + status=analysis_done PATCH
 *   4. 실패 시 status=analysis_failed + analysis_error PATCH
 *
 * 어느 단계에서 실패해도 throw 하지 않음 — design_output 저장 성공을 절대 막지 않음.
 */
async function startVisionAnalysisInBackground(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  output: DesignOutput,
  req: NextRequest,
): Promise<void> {
  // Step 1: pending 마킹
  await admin
    .from("design_outputs")
    .update({ status: "analysis_pending" })
    .eq("id", output.id);

  try {
    const origin = req.nextUrl.origin;
    // Step 2: vision-materials/analyze 호출
    //   - projectId는 design_outputs.project_id 사용
    //   - sourceImageKind는 render_kind에 따라 결정 (apt/photo render는 ai_render)
    const targetSurfaceTypes = inferTargetSurfaceTypes(output);
    const analyzeRes = await fetch(`${origin}/api/inpick/vision-materials/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 서버 내부 호출 — 인증 쿠키 그대로 전달 (RLS 통과)
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        projectId: output.projectId,
        roomId: output.targetId,
        roomName: output.targetName,
        imageUrl: output.imageUrl,
        sourceImageKind: "ai_render",
        targetSurfaceTypes,
        maxCandidates: 5,
      }),
    });

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text().catch(() => "");
      throw new Error(`analyze ${analyzeRes.status}: ${errText.slice(0, 200)}`);
    }

    const analyzeData = (await analyzeRes.json()) as {
      surfaces?: Array<{
        observation?: {
          surfaceType?: string;
        };
        candidates?: Array<{
          materialProductId?: string;
          brand?: string;
          productName?: string;
          sku?: string;
          confidence?: number;
        }>;
        recommendation?: {
          status?: string;
          confidence?: number;
        };
      }>;
    };

    // Step 3: 결과 → MaterialHint 변환 (기존 prompt hint와 병합)
    const visionHints: MaterialHint[] = [];
    for (const surface of analyzeData.surfaces ?? []) {
      const top = surface.candidates?.[0];
      if (!top || !top.materialProductId) continue;
      const status = surface.recommendation?.status;
      if (status === "fallback" || status === "rejected") continue;
      visionHints.push({
        surfaceType: mapSurfaceTypeForHint(surface.observation?.surfaceType),
        materialCategory: surface.observation?.surfaceType ?? "unknown",
        materialNameKo: top.productName,
        brand: top.brand,
        sku: top.sku,
        confidence: surface.recommendation?.confidence ?? top.confidence ?? 0.5,
        source: "vision_analysis",
        assumptions: status === "confirmed" ? ["vision 분석 confirmed"] : [],
      });
    }

    // 기존 prompt-extract hint와 vision hint 병합 (vision 우선)
    const seen = new Set<string>();
    const mergedHints: MaterialHint[] = [];
    for (const h of [...visionHints, ...(output.materialHints ?? [])]) {
      const key = `${h.surfaceType}::${h.materialCategory}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mergedHints.push(h);
    }

    await admin
      .from("design_outputs")
      .update({
        status: "analysis_done",
        material_hints: mergedHints,
      })
      .eq("id", output.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[design-outputs] vision analyze failed for ${output.id}:`, msg);
    await admin
      .from("design_outputs")
      .update({
        status: "analysis_failed",
        analysis_error: msg.slice(0, 500),
      })
      .eq("id", output.id);
  }
}

function inferTargetSurfaceTypes(output: DesignOutput): string[] {
  // surface_render는 좁게, room_render는 floor/wall/ceiling 기본,
  // commercial zone은 counter/signage 등 추가
  if (output.renderKind === "surface_render") return ["floor", "wall", "ceiling", "tile"];
  if (output.projectMode === "commercial") {
    return ["floor", "wall", "ceiling", "counter", "signage", "partition"];
  }
  return ["floor", "wall", "ceiling"];
}

function mapSurfaceTypeForHint(t?: string): MaterialHint["surfaceType"] {
  switch (t) {
    case "floor":
      return "floor";
    case "wall":
      return "wall";
    case "ceiling":
      return "ceiling";
    case "door":
      return "door";
    case "window":
      return "window";
    case "cabinet":
    case "countertop":
      return "counter";
    case "lighting":
      return "lighting";
    case "tile":
      return "wall"; // tile은 surface가 wall이거나 floor — 기본 wall
    default:
      return "unknown";
  }
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
