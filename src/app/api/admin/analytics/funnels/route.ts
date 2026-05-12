/**
 * GET /api/admin/analytics/funnels
 *
 * 전환 퍼널 분석. 모드별/업종별 비교.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-8
 *
 * 쿼리:
 *  - period: today/week/month (default week)
 *  - projectMode?: apartment | photo_only | commercial
 *
 * 응답: 전체 퍼널 + 모드별 퍼널 + 상가 업종별 퍼널 (commercial 한정)
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
  if (period === "today") now.setHours(0, 0, 0, 0);
  else if (period === "month") now.setDate(now.getDate() - 30);
  else now.setDate(now.getDate() - 7);
  return now.toISOString();
}

// 퍼널 단계 (소비자 핵심)
const FUNNEL_STEPS = [
  { name: "방문", event: "session_started" },
  { name: "모드 선택", event: "project_mode_selected" },
  { name: "AI 상담", event: "chat_message_sent" },
  { name: "이미지 생성", event: "image_generation_completed" },
  { name: "견적 생성", event: "estimate_generated" },
  { name: "RFQ 발송", event: "rfq_created" },
  { name: "계약", event: "contract_created" },
];

async function countDistinctUsersWithEvent(
  admin: ReturnType<typeof getAdmin>,
  eventName: string,
  since: string,
  projectMode?: string | null,
): Promise<number> {
  if (!admin) return 0;
  let query = admin
    .from("analytics_events")
    .select("user_id, anonymous_id")
    .eq("event_name", eventName)
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(5000);
  if (projectMode) query = query.eq("project_mode", projectMode);

  const { data } = await query;
  const ids = new Set<string>();
  (data || []).forEach((r: { user_id?: string; anonymous_id?: string }) => {
    const id = r.user_id || r.anonymous_id;
    if (id) ids.add(id);
  });
  return ids.size;
}

async function buildFunnel(
  admin: ReturnType<typeof getAdmin>,
  since: string,
  projectMode?: string | null,
) {
  const counts = await Promise.all(
    FUNNEL_STEPS.map((s) =>
      countDistinctUsersWithEvent(admin, s.event, since, projectMode),
    ),
  );
  return FUNNEL_STEPS.map((s, i) => {
    const count = counts[i];
    const prev = i === 0 ? count : counts[0];
    return {
      name: s.name,
      event: s.event,
      users: count,
      conversionFromStart: prev ? count / prev : 0,
    };
  });
}

async function buildCommercialFunnelByBusiness(
  admin: ReturnType<typeof getAdmin>,
  since: string,
) {
  if (!admin) return [];
  // commercial_spec_submitted 이벤트의 business_type 집계
  const { data } = await admin
    .from("analytics_events")
    .select("props")
    .eq("event_name", "commercial_spec_submitted")
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(2000);
  const byBusiness: Record<string, number> = {};
  (data || []).forEach((e: { props: Record<string, unknown> }) => {
    const bt = e.props?.business_type as string | undefined;
    if (bt) byBusiness[bt] = (byBusiness[bt] || 0) + 1;
  });
  return Object.entries(byBusiness)
    .map(([businessType, count]) => ({ businessType, count }))
    .sort((a, b) => b.count - a.count);
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

  const [overall, apartment, photoOnly, commercial, commercialByBiz] =
    await Promise.all([
      buildFunnel(admin, since),
      buildFunnel(admin, since, "apartment"),
      buildFunnel(admin, since, "photo_only"),
      buildFunnel(admin, since, "commercial"),
      buildCommercialFunnelByBusiness(admin, since),
    ]);

  return NextResponse.json({
    period,
    since,
    overall,
    byMode: {
      apartment,
      photo_only: photoOnly,
      commercial,
    },
    commercialByBusiness: commercialByBiz,
  });
}
