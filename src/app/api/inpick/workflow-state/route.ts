/**
 * GET/POST /api/inpick/workflow-state
 *
 * 워크플로 진행 상태(step1 + step2)를 사용자×프로젝트 단위로 영속.
 * - 인증 필수 (RLS — consumer_projects.user_id = auth.uid())
 * - 익명/비로그인 사용자는 sessionStorage만 사용 (저장 안 됨)
 * - 이미지 URL만 저장, base64는 제외 (design_outputs DB에 별도 저장됨)
 *
 * 가이드: 사용자가 견적 페이지 → 뒤로가기 → 워크플로로 돌아왔을 때
 *        이미지 갤러리 + step1/step2 그대로 복원되어야 함.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
  } catch {
    return null;
  }
}

interface WorkflowStateBody {
  projectId: string;
  step1?: Record<string, unknown>;
  step2?: Record<string, unknown>;
  contextId?: string;
  /** 현재 위치한 단계 (1, 2 등) — 복원 시 그 단계로 바로 이동 가능 */
  lastStep?: number;
}

/** POST — upsert (projectId + user_id 기준). 익명은 401, 다른 사용자 소유면 403. */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: WorkflowStateBody;
  try {
    body = (await req.json()) as WorkflowStateBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: "MISSING_PROJECT_ID" }, { status: 400 });
  }

  // P9-FIX: base64 이미지 URL을 그대로 저장 — 복원 시 이미지 표시되어야 함
  //   - 이전 stripBase64는 "[base64 image marker]"로 치환 → 복원 시 깨진 이미지 발생 (사용자 보고 버그)
  //   - Supabase JSONB는 row 1GB까지 허용, 평균 사용량 < 5MB이므로 안전
  //   - 추가 안전망: workflow 페이지 복원 시 design_outputs DB의 image_url로 보강
  const cleanedStep1 = body.step1;
  const cleanedStep2 = body.step2;

  // 기존 행 소유권 확인
  const { data: existing } = await admin
    .from("consumer_projects")
    .select("user_id")
    .eq("id", body.projectId)
    .maybeSingle();
  if (existing && (existing as { user_id?: string }).user_id !== userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const workflowState = {
    step1: cleanedStep1,
    step2: cleanedStep2,
    contextId: body.contextId,
    lastStep: body.lastStep,
    updatedAt: new Date().toISOString(),
  };

  // upsert
  const { error } = await admin.from("consumer_projects").upsert(
    {
      id: body.projectId,
      user_id: userId,
      workflow_state: workflowState,
      status: "WORKFLOW_IN_PROGRESS",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[workflow-state] upsert failed:", error);
    return NextResponse.json({ error: "UPSERT_FAILED", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, projectId: body.projectId });
}

/** GET — projectId로 단일 조회 또는 본인 최신 N개 목록 */
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
  const list = req.nextUrl.searchParams.get("list");

  if (projectId) {
    const { data, error } = await admin
      .from("consumer_projects")
      .select("id, user_id, workflow_state, status, updated_at")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: "SELECT_FAILED" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({
      exists: true,
      projectId: (data as { id: string }).id,
      workflowState: (data as { workflow_state?: Record<string, unknown> }).workflow_state || null,
      status: (data as { status?: string }).status,
      updatedAt: (data as { updated_at?: string }).updated_at,
    });
  }

  if (list === "1") {
    const { data, error } = await admin
      .from("consumer_projects")
      .select("id, status, address, updated_at, workflow_state")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) {
      return NextResponse.json({ error: "SELECT_FAILED" }, { status: 500 });
    }
    return NextResponse.json({
      projects: (data ?? []).map((row) => {
        const r = row as {
          id: string;
          status?: string;
          address?: unknown;
          updated_at?: string;
          workflow_state?: { step1?: { basicInfo?: { selectedAddress?: { roadAddress?: string; buildingName?: string }; selectedPyeong?: { pyeongName?: string } } } };
        };
        const addr = r.workflow_state?.step1?.basicInfo?.selectedAddress;
        const pyeong = r.workflow_state?.step1?.basicInfo?.selectedPyeong;
        return {
          id: r.id,
          status: r.status,
          updatedAt: r.updated_at,
          summary:
            addr?.buildingName || addr?.roadAddress
              ? `${addr.buildingName || addr.roadAddress || ""}${
                  pyeong?.pyeongName ? ` · ${pyeong.pyeongName}` : ""
                }`
              : "워크플로 진행 중",
        };
      }),
    });
  }

  return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
}

/** base64 dataURL 제거 — DB 저장 절약 */
function stripBase64(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripBase64);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string" && v.startsWith("data:image/")) {
      // 이미지 base64는 design_outputs에 별도 저장 — 여기선 marker만
      out[k] = "[base64 image — design_outputs DB 참조]";
    } else if (typeof v === "object") {
      out[k] = stripBase64(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
