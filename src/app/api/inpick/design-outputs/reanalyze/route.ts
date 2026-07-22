/**
 * POST /api/inpick/design-outputs/reanalyze — 멈춘 자재 정밀 분석 재실행
 *
 * 과거 fire-and-forget 방식에서 Vercel 함수 동결로 generated/analysis_pending에
 * 영구히 멈춘 design_outputs를 찾아 분석을 다시 돌린다. analysis_failed도 1회 재시도.
 * (TestFlight 피드백 2026-07-02: "생성된 이미지 분석이 전부 완료되지 않음")
 *
 * 견적 페이지 진입 시 pending이 보이면 자동 호출됨. 직렬 처리, 호출당 최대 2건.
 * 서버리스 300초 안에서 끝나도록 작은 청크로 처리하고 클라이언트가 남은 건을 이어 호출한다.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { mapDbDesignOutput } from "@/lib/inpick/estimate-context/types";
import { runVisionAnalysisForOutput } from "@/lib/inpick/estimate-context/vision-analysis-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 생성된 지 이 시간이 안 된 pending은 원래 분석이 아직 도는 중일 수 있음 — 건드리지 않음
const STALE_MS = 90_000;
const MAX_PER_CALL = 2;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: { projectId?: string };
  try {
    body = (await req.json()) as { projectId?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: "MISSING_PROJECT_ID" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("design_outputs")
    .select("*")
    .eq("project_id", body.projectId)
    .eq("user_id", user.id)
    .in("status", ["generated", "analysis_pending", "analysis_failed"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[design-outputs/reanalyze] select failed:", error);
    return NextResponse.json({ error: "SELECT_FAILED", details: error.message }, { status: 500 });
  }

  const now = Date.now();
  const stuck = (data ?? [])
    .map(mapDbDesignOutput)
    .filter((o) => {
      if (o.status === "analysis_failed") return true;
      return now - new Date(o.createdAt).getTime() > STALE_MS;
    })
    .slice(0, MAX_PER_CALL);

  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") ?? "";
  let done = 0;
  let failed = 0;
  // 직렬 실행 — vision analyze 동시 호출로 인한 rate limit 방지
  for (const output of stuck) {
    const result = await runVisionAnalysisForOutput({ admin, output, origin, cookie });
    if (result === "done") done++;
    else failed++;
  }

  return NextResponse.json({ requested: stuck.length, done, failed });
}
