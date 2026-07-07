/**
 * GET /api/admin/analytics/events
 *
 * Event Explorer — 모든 행동 이벤트를 필터·검색.
 *
 * 쿼리:
 *  - eventName?: 특정 이벤트
 *  - actorType?: anonymous/consumer/contractor/admin/system
 *  - userId?: 특정 사용자
 *  - projectId?: 특정 프로젝트
 *  - projectMode?: apartment/photo_only/commercial
 *  - since?: ISO 시각
 *  - page, limit (default 50, max 200)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";

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
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "service not configured" },
      { status: 500 },
    );
  }
  const sp = req.nextUrl.searchParams;
  const eventName = sp.get("eventName");
  const actorType = sp.get("actorType");
  const userId = sp.get("userId");
  const projectId = sp.get("projectId");
  const projectMode = sp.get("projectMode");
  const since = sp.get("since");
  const internalOnly = sp.get("internalOnly") === "true";
  const includeInternal = sp.get("includeInternal") === "true";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  let query = admin
    .from("analytics_events")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeInternal && !internalOnly) {
    query = query.eq("internal_user", false);
  } else if (internalOnly) {
    query = query.eq("internal_user", true);
  }
  if (eventName) query = query.eq("event_name", eventName);
  if (actorType) query = query.eq("actor_type", actorType);
  if (userId) query = query.eq("user_id", userId);
  if (projectId) query = query.eq("project_id", projectId);
  if (projectMode) query = query.eq("project_mode", projectMode);
  if (since) query = query.gte("occurred_at", since);

  const { data, count, error } = await query;
  if (error) {
    console.error("[analytics/events] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 이벤트 종류별 상위 10 (이벤트명 distinct + count)
  const { data: nameStats } = await admin
    .from("analytics_events")
    .select("event_name")
    .eq("internal_user", false)
    .gte("occurred_at", since || "2000-01-01")
    .limit(5000);
  const eventCounts: Record<string, number> = {};
  (nameStats || []).forEach((e: { event_name: string }) => {
    eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
  });
  const topEvents = Object.entries(eventCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    events: data || [],
    total: count || 0,
    page,
    limit,
    topEvents,
  });
}
