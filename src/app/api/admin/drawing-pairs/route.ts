import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createServiceClient(url, key);
  return createClient();
}

// GET /api/admin/drawing-pairs
//   ?has_elevation=true&min_elevation=2  — 다면 전개 포스트만
//   ?has_render=true                     — 렌더 포함
//   ?trade=ARCH_ELEV&space=욕실           — 특정 공종·공간
//   ?limit=50
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const sp = req.nextUrl.searchParams;
  const hasRender    = sp.get("has_render");
  const hasElevation = sp.get("has_elevation");
  const minElev      = parseInt(sp.get("min_elevation") || "0", 10);
  const trade        = sp.get("trade");
  const space        = sp.get("space");
  const limit        = Math.min(parseInt(sp.get("limit") || "50", 10) || 50, 200);

  try {
    let q = supabase.from("drawing_render_pairs").select("*", { count: "exact" });
    if (hasRender === "true")    q = q.eq("has_render", true);
    if (hasElevation === "true") q = q.eq("has_elevation", true);
    if (minElev > 0)             q = q.gte("elevation_count", minElev);
    if (trade)                   q = q.contains("trade_codes", [trade]);
    if (space)                   q = q.contains("spaces", [space]);
    q = q.order("elevation_count", { ascending: false }).limit(limit);

    const { data, count, error } = await q;
    if (error) throw error;

    // 통계 집계
    const { data: allRows } = await supabase
      .from("drawing_render_pairs")
      .select("has_plan, has_elevation, has_render, elevation_count, spaces, trade_codes");

    const summary = {
      total:            allRows?.length || 0,
      hasPlan:          (allRows || []).filter((r) => r.has_plan).length,
      hasElevation:     (allRows || []).filter((r) => r.has_elevation).length,
      hasRender:        (allRows || []).filter((r) => r.has_render).length,
      multiElevation:   (allRows || []).filter((r) => (r.elevation_count || 0) >= 2).length,
      planAndRender:    (allRows || []).filter((r) => r.has_plan && r.has_render).length,
      elevAndRender:    (allRows || []).filter((r) => r.has_elevation && r.has_render).length,
    };

    return NextResponse.json({
      total:   count ?? 0,
      summary,
      results: data || [],
    });
  } catch (err) {
    return NextResponse.json({
      error: "drawing-pairs 조회 실패",
      detail: (err as Error).message,
      total: 0, summary: null, results: [],
    });
  }
}
