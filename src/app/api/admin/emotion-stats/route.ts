import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// service role key가 있으면 RLS 우회하여 전체 조회. 없으면 일반 client 폴백.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return createServiceClient(url, serviceKey);
  return createClient();
}

// GET /api/admin/emotion-stats — 관리자 대시보드용 집계.
// 반환: {overview, byPalette, byEvent, avgDwellByEmotion, topSwaps, recentFeedback, emptyHint}
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = getSupabase();

  try {
    const [
      countAll,
      byEventRes,
      byPaletteRes,
      byMoodRes,
      dwellRes,
      swapsRes,
      feedbackRes,
    ] = await Promise.all([
      supabase.from("user_material_events").select("id", { count: "exact", head: true }),
      supabase.from("user_material_events").select("event_type"),
      supabase.from("user_material_events").select("palette_id").not("palette_id", "is", null),
      supabase.from("user_material_events").select("detected_moods").not("detected_moods", "is", null),
      supabase.from("user_material_events").select("dwell_ms, detected_moods").not("dwell_ms", "is", null),
      supabase.from("user_material_events").select("material_from, material_to, palette_id").eq("event_type", "swap").limit(500),
      supabase.from("user_material_events").select("feedback_text, emotion_signal, emotion_score, created_at").not("feedback_text", "is", null).order("created_at", { ascending: false }).limit(10),
    ]);

    const totalEvents = countAll.count ?? 0;

    const byEvent: Record<string, number> = {};
    for (const r of (byEventRes.data || [])) byEvent[r.event_type] = (byEvent[r.event_type] || 0) + 1;

    const byPalette: Record<string, number> = {};
    for (const r of (byPaletteRes.data || [])) byPalette[r.palette_id] = (byPalette[r.palette_id] || 0) + 1;

    const moodCounts: Record<string, number> = {};
    for (const r of (byMoodRes.data || [])) {
      for (const m of (r.detected_moods as string[] | null) || []) {
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      }
    }

    const avgDwellByEmotion: Record<string, { n: number; avgMs: number }> = {};
    for (const r of (dwellRes.data || [])) {
      const moods = (r.detected_moods as string[] | null) || [];
      for (const m of moods) {
        const slot = avgDwellByEmotion[m] || { n: 0, avgMs: 0 };
        const newN = slot.n + 1;
        avgDwellByEmotion[m] = { n: newN, avgMs: ((slot.avgMs * slot.n) + (r.dwell_ms || 0)) / newN };
      }
    }

    // top swap 패턴 (from → to 빈도)
    const swapCounts = new Map<string, { from: string; to: string; count: number; palette?: string }>();
    for (const r of (swapsRes.data || [])) {
      const from = (r.material_from as { name?: string } | null)?.name || "unknown";
      const to   = (r.material_to as { name?: string } | null)?.name   || "unknown";
      const key  = `${from}→${to}`;
      const slot = swapCounts.get(key);
      if (slot) slot.count += 1;
      else swapCounts.set(key, { from, to, count: 1, palette: r.palette_id || undefined });
    }
    const topSwaps = Array.from(swapCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);

    return NextResponse.json({
      overview: {
        totalEvents,
        distinctPalettes: Object.keys(byPalette).length,
        distinctMoods:    Object.keys(moodCounts).length,
        emptyHint:        totalEvents === 0 ? "아직 행동 이벤트가 수집되지 않았습니다. 사용자가 프로젝트 워크플로우에서 자재를 선택/교체하면 여기에 집계됩니다." : null,
      },
      byEvent,
      byPalette:     Object.entries(byPalette).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
      byMood:        Object.entries(moodCounts).map(([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count),
      avgDwellByEmotion: Object.entries(avgDwellByEmotion).map(([mood, v]) => ({ mood, n: v.n, avgMs: Math.round(v.avgMs) })).sort((a, b) => b.avgMs - a.avgMs),
      topSwaps,
      recentFeedback: feedbackRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({
      error: "집계 실패",
      detail: (err as Error).message,
      overview: { totalEvents: 0, distinctPalettes: 0, distinctMoods: 0, emptyHint: "user_material_events 테이블이 아직 없거나 접근 실패. 마이그레이션 필요." },
      byEvent: {}, byPalette: [], byMood: [], avgDwellByEmotion: [], topSwaps: [], recentFeedback: [],
    });
  }
}
