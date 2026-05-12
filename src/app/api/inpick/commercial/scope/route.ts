/**
 * POST/PATCH/GET /api/inpick/commercial/scope
 *
 * CommercialScopeSpec 저장 / 수정 / 조회.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §3-6
 *
 * 정책:
 *  - 사용자 수정 시 version +1로 누적 저장 (감사 추적)
 *  - readiness validator 자동 실행
 *  - service_role + auth.uid 검증
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validateCommercialEstimateReadiness } from "@/lib/inpick/commercial/scope-validator";
import {
  createDefaultCommercialScope,
  type CreateDefaultScopeInput,
} from "@/lib/inpick/commercial/scope-templates";
import type { CommercialScopeSpec } from "@/lib/inpick/commercial/scope-spec";

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

/**
 * POST — scope 생성 (또는 기본 템플릿으로 초기화).
 * Body: { projectId, businessType, totalAreaM2, ceilingHeightM?, budgetTier?, siteCondition?, scope? }
 *   - scope가 있으면 그대로 저장
 *   - 없으면 createDefaultCommercialScope로 생성
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.projectId || !body?.businessType || !body?.totalAreaM2) {
    return NextResponse.json(
      { error: "missing_required", hint: "projectId, businessType, totalAreaM2 필수" },
      { status: 400 },
    );
  }

  // scope 입력이 있으면 사용, 없으면 기본 템플릿
  let scope: CommercialScopeSpec = body.scope
    ? (body.scope as CommercialScopeSpec)
    : createDefaultCommercialScope(body as CreateDefaultScopeInput);

  // readiness 자동 검증
  scope = { ...scope, estimateReadiness: validateCommercialEstimateReadiness(scope) };

  const { data, error } = await admin
    .from("commercial_scope_snapshots")
    .insert({
      project_id: body.projectId,
      user_id: userId,
      business_type: scope.businessType,
      version: 1,
      scope_json: scope,
      source: scope.source ?? "default_inferred",
      readiness_score: scope.estimateReadiness.score,
      can_build_estimate: scope.estimateReadiness.canBuildEstimate,
    })
    .select("id, version, created_at")
    .single();
  if (error) {
    console.error("[commercial/scope POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    id: (data as { id: string }).id,
    version: 1,
    scope,
  });
}

/**
 * PATCH — scope 수정. 새 version 생성.
 * Body: { projectId, scope: CommercialScopeSpec }
 */
export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.projectId || !body?.scope) {
    return NextResponse.json(
      { error: "missing_required", hint: "projectId, scope 필수" },
      { status: 400 },
    );
  }
  let scope = body.scope as CommercialScopeSpec;
  scope = { ...scope, estimateReadiness: validateCommercialEstimateReadiness(scope) };

  // 직전 version 조회
  const { data: prev } = await admin
    .from("commercial_scope_snapshots")
    .select("version")
    .eq("project_id", body.projectId)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((prev as { version: number } | null)?.version ?? 0) + 1;

  const { data, error } = await admin
    .from("commercial_scope_snapshots")
    .insert({
      project_id: body.projectId,
      user_id: userId,
      business_type: scope.businessType,
      version: nextVersion,
      scope_json: { ...scope, version: nextVersion },
      source: scope.source ?? "user_input",
      readiness_score: scope.estimateReadiness.score,
      can_build_estimate: scope.estimateReadiness.canBuildEstimate,
    })
    .select("id, version, created_at")
    .single();
  if (error) {
    console.error("[commercial/scope PATCH] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    id: (data as { id: string }).id,
    version: nextVersion,
    scope: { ...scope, version: nextVersion },
  });
}

/**
 * GET ?projectId=xxx — 최신 scope 조회.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const { data, error } = await admin
    .from("commercial_scope_snapshots")
    .select("id, version, scope_json, readiness_score, can_build_estimate, source, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[commercial/scope GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ scope: null }, { status: 404 });
  }
  return NextResponse.json({
    id: (data as Record<string, unknown>).id,
    version: (data as Record<string, unknown>).version,
    scope: (data as Record<string, unknown>).scope_json,
    readinessScore: (data as Record<string, unknown>).readiness_score,
    canBuildEstimate: (data as Record<string, unknown>).can_build_estimate,
    source: (data as Record<string, unknown>).source,
    createdAt: (data as Record<string, unknown>).created_at,
  });
}
