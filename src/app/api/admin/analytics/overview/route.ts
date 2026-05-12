/**
 * GET /api/admin/analytics/overview
 *
 * 관리자 메인 대시보드 카드용 핵심 지표.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-8
 *
 * 쿼리:
 *  - period: "today" | "week" | "month" (default: "week")
 *
 * 응답: 카드 10종 + AI 엔드포인트 건강도 + 견적 누락 원인 TOP 10
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function periodStart(period: string): string {
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    now.setDate(now.getDate() - 30);
  } else {
    now.setDate(now.getDate() - 7);
  }
  return now.toISOString();
}

async function countEvents(
  admin: ReturnType<typeof getAdmin>,
  eventName: string,
  since: string,
): Promise<number> {
  if (!admin) return 0;
  const { count } = await admin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", eventName)
    .eq("internal_user", false)
    .gte("occurred_at", since);
  return count || 0;
}

async function distinctUserCount(
  admin: ReturnType<typeof getAdmin>,
  since: string,
): Promise<number> {
  if (!admin) return 0;
  const { data } = await admin
    .from("analytics_events")
    .select("user_id")
    .eq("internal_user", false)
    .not("user_id", "is", null)
    .gte("occurred_at", since)
    .limit(10000);
  const ids = new Set<string>();
  (data || []).forEach((r: { user_id: string }) => {
    if (r.user_id) ids.add(r.user_id);
  });
  return ids.size;
}

export async function GET(req: NextRequest) {
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "service not configured" },
      { status: 500 },
    );
  }
  const period = req.nextUrl.searchParams.get("period") || "week";
  const since = periodStart(period);

  const [
    activeUsers,
    signups,
    workflowStarts,
    chatSent,
    imageRequested,
    imageCompleted,
    imageFailed,
    estimateRequested,
    estimateGenerated,
    rfqCreated,
    bidSubmitted,
    contractsCreated,
  ] = await Promise.all([
    distinctUserCount(admin, since),
    countEvents(admin, "signup_completed", since),
    countEvents(admin, "workflow_started", since),
    countEvents(admin, "chat_message_sent", since),
    countEvents(admin, "image_generation_requested", since),
    countEvents(admin, "image_generation_completed", since),
    countEvents(admin, "image_generation_failed", since),
    countEvents(admin, "estimate_requested", since),
    countEvents(admin, "estimate_generated", since),
    countEvents(admin, "rfq_created", since),
    countEvents(admin, "contractor_bid_submitted", since),
    countEvents(admin, "contract_created", since),
  ]);

  // AI 엔드포인트 건강도 — image_generation_* 이벤트의 endpoint별 통계
  const { data: imgEvents } = await admin
    .from("analytics_events")
    .select("event_name, props, project_mode")
    .in("event_name", [
      "image_generation_requested",
      "image_generation_completed",
      "image_generation_failed",
    ])
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(5000);
  const aiHealth: Record<
    string,
    { requested: number; completed: number; failed: number }
  > = {};
  (imgEvents || []).forEach(
    (e: { event_name: string; props: Record<string, unknown> }) => {
      const endpoint = (e.props?.endpoint as string) || "unknown";
      if (!aiHealth[endpoint]) {
        aiHealth[endpoint] = { requested: 0, completed: 0, failed: 0 };
      }
      if (e.event_name === "image_generation_requested") {
        aiHealth[endpoint].requested++;
      } else if (e.event_name === "image_generation_completed") {
        aiHealth[endpoint].completed++;
      } else if (e.event_name === "image_generation_failed") {
        aiHealth[endpoint].failed++;
      }
    },
  );

  // 견적 누락 원인 TOP 10 — estimate_readiness_changed 의 missingFields
  const { data: readinessEvents } = await admin
    .from("analytics_events")
    .select("props")
    .eq("event_name", "estimate_readiness_changed")
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(1000);
  const missingFieldCounts: Record<string, number> = {};
  (readinessEvents || []).forEach((e: { props: Record<string, unknown> }) => {
    const missing = e.props?.required_missing_fields as string[] | undefined;
    if (Array.isArray(missing)) {
      missing.forEach((field) => {
        missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
      });
    }
  });
  const missingFieldsTop10 = Object.entries(missingFieldCounts)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 상가 readiness 평균
  const { data: scopeEvents } = await admin
    .from("analytics_events")
    .select("props")
    .in("event_name", ["commercial_scope_created", "commercial_scope_updated"])
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(1000);
  const readinessScores: number[] = [];
  (scopeEvents || []).forEach((e: { props: Record<string, unknown> }) => {
    const score = e.props?.readiness_score as number | undefined;
    if (typeof score === "number") readinessScores.push(score);
  });
  const avgReadiness =
    readinessScores.length > 0
      ? readinessScores.reduce((s, n) => s + n, 0) / readinessScores.length
      : 0;

  return NextResponse.json({
    period,
    since,
    cards: {
      activeUsers,
      signups,
      workflowStarts,
      chatSent,
      imageRequested,
      imageCompleted,
      imageFailed,
      imageSuccessRate: imageRequested
        ? imageCompleted / imageRequested
        : null,
      estimateRequested,
      estimateGenerated,
      rfqCreated,
      bidSubmitted,
      contractsCreated,
      avgReadiness: Math.round(avgReadiness * 100) / 100,
    },
    aiHealth: Object.entries(aiHealth).map(([endpoint, stats]) => ({
      endpoint,
      ...stats,
      failureRate: stats.requested ? stats.failed / stats.requested : 0,
    })),
    missingFieldsTop10,
  });
}
