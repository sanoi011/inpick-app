import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  try {
    const [
      estimatesRes, contractorsRes, materialsRes, crawlLogsRes, recentCrawlsRes,
      consumersRes, projectsRes, contractsRes, creditsRes, aiRes,
    ] = await Promise.all([
      supabase.from("estimates").select("id", { count: "exact", head: true }),
      supabase.from("specialty_contractors").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("material_prices").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("crawl_logs").select("id", { count: "exact", head: true }),
      supabase.from("crawl_logs").select("id, source_name, status, records_updated, started_at").order("started_at", { ascending: false }).limit(10),
      supabase.from("user_credits").select("id", { count: "exact", head: true }),
      supabase.from("consumer_projects").select("id", { count: "exact", head: true }),
      supabase.from("contracts").select("id", { count: "exact", head: true }),
      supabase.from("user_credits").select("balance"),
      supabase.from("ai_conversations").select("id", { count: "exact", head: true }),
    ]);

    const totalCredits = (creditsRes.data || []).reduce((sum: number, r: { balance: number }) => sum + (r.balance || 0), 0);

    return NextResponse.json({
      stats: {
        estimates: estimatesRes.count || 0,
        contractors: contractorsRes.count || 0,
        materials: materialsRes.count || 0,
        crawlLogs: crawlLogsRes.count || 0,
        consumers: consumersRes.count || 0,
        projects: projectsRes.count || 0,
        contracts: contractsRes.count || 0,
        totalCredits,
        aiConversations: aiRes.count || 0,
      },
      recentCrawls: recentCrawlsRes.data || [],
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
