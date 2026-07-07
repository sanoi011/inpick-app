import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthorized } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // user_credits·consumer_projects는 RLS 때문에 anon으로 읽으면 항상 0 → service role (2026-07-07 수정)
  const supabase = createAdminClient();

  try {
    const [
      estimatesRes, contractorsRes, materialsRes,
      consumersRes, projectsRes, contractsRes, creditsRes, aiRes,
    ] = await Promise.all([
      supabase.from("estimates").select("id", { count: "exact", head: true }),
      supabase.from("specialty_contractors").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("material_options").select("id", { count: "exact", head: true }),
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
        crawlLogs: 0,
        consumers: consumersRes.count || 0,
        projects: projectsRes.count || 0,
        contracts: contractsRes.count || 0,
        totalCredits,
        aiConversations: aiRes.count || 0,
      },
      recentCrawls: [],
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
