import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createServiceClient(url, key);
  return createClient();
}

// GET /api/admin/vision-stats — emotion_reference_images 집계
export async function GET() {
  const supabase = getSupabase();

  try {
    const [countRes, spaceRes, styleRes, qualityRes, emotionRes, materialRes, recentRes, pairsRes] = await Promise.all([
      supabase.from("emotion_reference_images").select("id", { count: "exact", head: true }),
      supabase.from("emotion_reference_images").select("space"),
      supabase.from("emotion_reference_images").select("style"),
      supabase.from("emotion_reference_images").select("quality"),
      supabase.from("emotion_reference_images").select("emotion_tags"),
      supabase.from("emotion_reference_images").select("materials"),
      supabase.from("emotion_reference_images")
        .select("id, source, track, space, style, quality, emotion_tags, dominant_colors, labeled_at")
        .order("labeled_at", { ascending: false })
        .limit(12),
      supabase.from("drawing_render_pairs").select("trade_codes, has_plan, has_elevation, has_render, elevation_count, spaces"),
    ]);

    const countOf = (rows: { [k: string]: unknown }[] | null, key: string) => {
      const m: Record<string, number> = {};
      for (const r of rows || []) {
        const v = (r[key] as string | null) || "(null)";
        m[v] = (m[v] || 0) + 1;
      }
      return Object.entries(m).map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count);
    };

    const arrayCountOf = (rows: { [k: string]: unknown }[] | null, key: string) => {
      const m: Record<string, number> = {};
      for (const r of rows || []) {
        for (const v of (r[key] as string[] | null) || []) {
          m[v] = (m[v] || 0) + 1;
        }
      }
      return Object.entries(m).map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count);
    };

    // Loom drawing_render_pairs 집계
    const pairsData = pairsRes.data || [];
    const tradeCounts: Record<string, number> = {};
    const pairSpaceCounts: Record<string, number> = {};
    for (const r of pairsData) {
      for (const t of (r.trade_codes as string[] | null) || []) tradeCounts[t] = (tradeCounts[t] || 0) + 1;
      for (const sp of (r.spaces as string[] | null) || []) pairSpaceCounts[sp] = (pairSpaceCounts[sp] || 0) + 1;
    }
    const loomSummary = {
      totalPosts:    pairsData.length,
      hasPlan:       pairsData.filter((r) => r.has_plan).length,
      hasElevation:  pairsData.filter((r) => r.has_elevation).length,
      hasRender:     pairsData.filter((r) => r.has_render).length,
      multiElev:     pairsData.filter((r) => (r.elevation_count || 0) >= 2).length,
      byTrade:       Object.entries(tradeCounts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      bySpace:       Object.entries(pairSpaceCounts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    };

    return NextResponse.json({
      total:        countRes.count ?? 0,
      bySpace:      countOf(spaceRes.data, "space").slice(0, 12),
      byStyle:      countOf(styleRes.data, "style").slice(0, 12),
      byQuality:    countOf(qualityRes.data, "quality"),
      topEmotions:  arrayCountOf(emotionRes.data, "emotion_tags").slice(0, 12),
      topMaterials: arrayCountOf(materialRes.data, "materials").slice(0, 12),
      recent:       recentRes.data || [],
      loomPairs:    loomSummary,
    });
  } catch (err) {
    return NextResponse.json({
      error: "vision-stats 집계 실패",
      detail: (err as Error).message,
      total: 0, bySpace: [], byStyle: [], byQuality: [], topEmotions: [], topMaterials: [], recent: [],
    });
  }
}
