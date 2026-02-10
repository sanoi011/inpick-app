import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  try {
    // 통계 집계
    const [estimatesRes, contractorsRes, materialsRes, crawlLogsRes, recentCrawlsRes] = await Promise.all([
      supabase.from("estimates").select("id", { count: "exact", head: true }),
      supabase.from("specialty_contractors").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("material_prices").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("crawl_logs").select("id", { count: "exact", head: true }),
      supabase.from("crawl_logs").select("id, source_name, status, records_updated, started_at").order("started_at", { ascending: false }).limit(10),
    ]);

    return NextResponse.json({
      stats: {
        estimates: estimatesRes.count || 0,
        contractors: contractorsRes.count || 0,
        materials: materialsRes.count || 0,
        crawlLogs: crawlLogsRes.count || 0,
      },
      recentCrawls: recentCrawlsRes.data || [],
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
