/**
 * GET /api/admin/vision-materials/eval
 *
 * 가이드: Phase 8 — eval 결과 조회
 *
 * 최근 vision_eval_results를 dataset/run 기준으로 집계.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase 미설정", runs: [] }, { status: 503 });
  }

  // 최근 run_id별 집계
  const { data: runs, error } = await admin
    .from("vision_eval_results")
    .select("run_id, model_versions, metrics, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message, runs: [] }, { status: 500 });
  }

  // run_id별 그룹화
  const byRun = new Map<
    string,
    {
      runId: string;
      caseCount: number;
      avgMetrics: Record<string, number>;
      modelVersions: Record<string, string>;
      latestAt: string;
    }
  >();
  for (const r of (runs || []) as Array<{
    run_id: string;
    model_versions?: Record<string, string>;
    metrics?: Record<string, number>;
    created_at: string;
  }>) {
    const existing = byRun.get(r.run_id);
    if (!existing) {
      byRun.set(r.run_id, {
        runId: r.run_id,
        caseCount: 1,
        avgMetrics: { ...(r.metrics || {}) },
        modelVersions: r.model_versions || {},
        latestAt: r.created_at,
      });
    } else {
      existing.caseCount++;
      // 평균 누적 (단순 sum/count는 별도 — 빠른 평균 추정)
      for (const [k, v] of Object.entries(r.metrics || {})) {
        if (typeof v === "number") {
          existing.avgMetrics[k] = (existing.avgMetrics[k] || 0) + v;
        }
      }
    }
  }
  // 평균 마감
  const aggregated = Array.from(byRun.values()).map((r) => {
    const avgMetrics: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.avgMetrics)) {
      avgMetrics[k] = Number((v / r.caseCount).toFixed(3));
    }
    return { ...r, avgMetrics };
  });

  return NextResponse.json({
    runs: aggregated,
    timestamp: new Date().toISOString(),
  });
}
