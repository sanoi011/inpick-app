import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createServiceClient(url, key);
  return createClient();
}

// GET /api/admin/aihub-stats — AI Hub 239 건축도면 집계
export async function GET() {
  const supabase = getSupabase();

  try {
    const [countRes, byTypeRes, byAptRes, extractedRes, catRes] = await Promise.all([
      supabase.from("aihub_floorplans").select("id", { count: "exact", head: true }),
      supabase.from("aihub_floorplans").select("source_type"),
      supabase.from("aihub_floorplans").select("apt_type"),
      supabase.from("aihub_floorplans").select("image_extracted"),
      supabase.from("aihub_floorplans").select("category_counts").limit(5000),
    ]);

    const countBy = (rows: { [k: string]: unknown }[] | null, key: string) => {
      const m: Record<string, number> = {};
      for (const r of rows || []) {
        const v = (r[key] as string | boolean | null)?.toString() || "null";
        m[v] = (m[v] || 0) + 1;
      }
      return Object.entries(m).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
    };

    // 카테고리 총 주석 합산
    const catTotals: Record<string, number> = {};
    for (const r of catRes.data || []) {
      const cc = r.category_counts as Record<string, number> | null;
      if (!cc) continue;
      for (const [name, n] of Object.entries(cc)) {
        catTotals[name] = (catTotals[name] || 0) + n;
      }
    }
    const topCategories = Object.entries(catTotals)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const total = countRes.count ?? 0;
    const extracted = (extractedRes.data || []).filter((r) => r.image_extracted).length;
    const avgAnnPerImage = (catRes.data || [])
      .reduce((s, r) => s + Object.values((r.category_counts as Record<string, number>) || {}).reduce((a, b) => a + b, 0), 0)
      / Math.max(1, (catRes.data || []).length);

    return NextResponse.json({
      total,
      extracted,
      extractedPct: total > 0 ? Math.round((extracted / total) * 1000) / 10 : 0,
      bySourceType: countBy(byTypeRes.data, "source_type"),
      byAptType:    countBy(byAptRes.data, "apt_type"),
      topCategories,
      avgAnnotationsPerImage: Math.round(avgAnnPerImage * 10) / 10,
    });
  } catch (err) {
    return NextResponse.json({
      error: "aihub-stats 집계 실패",
      detail: (err as Error).message,
      total: 0, extracted: 0, extractedPct: 0,
      bySourceType: [], byAptType: [], topCategories: [], avgAnnotationsPerImage: 0,
    });
  }
}
