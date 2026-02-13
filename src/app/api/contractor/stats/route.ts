import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // 병렬 쿼리
    const [
      projectsRes,
      bidsRes,
      invoicesRes,
      paymentsRes,
      contractorRes,
    ] = await Promise.all([
      // 활성 프로젝트 수
      supabase
        .from("contractor_projects")
        .select("id, status", { count: "exact", head: false })
        .eq("contractor_id", contractorId),
      // 대기 입찰 수 (confirmed 상태 견적)
      supabase
        .from("bids")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", contractorId)
        .eq("status", "pending"),
      // 미수금 (sent + overdue 청구서)
      supabase
        .from("invoices")
        .select("total, status")
        .eq("contractor_id", contractorId)
        .in("status", ["sent", "overdue"]),
      // 이번 달 매출
      supabase
        .from("payment_records")
        .select("amount")
        .eq("contractor_id", contractorId)
        .eq("payment_type", "income")
        .gte("paid_at", thisMonthStart)
        .lte("paid_at", thisMonthEnd),
      // 사업자 정보 (평점)
      supabase
        .from("specialty_contractors")
        .select("rating, total_reviews")
        .eq("id", contractorId)
        .single(),
    ]);

    const projects = projectsRes.data || [];
    const activeProjects = projects.filter(
      (p) => p.status === "preparing" || p.status === "in_progress"
    ).length;
    const completedProjects = projects.filter(
      (p) => p.status === "completed"
    ).length;

    const pendingBids = bidsRes.count || 0;

    const receivableTotal = (invoicesRes.data || []).reduce(
      (s: number, inv: { total: number }) => s + (inv.total || 0),
      0
    );

    const monthlyRevenue = (paymentsRes.data || []).reduce(
      (s: number, p: { amount: number }) => s + (p.amount || 0),
      0
    );

    const rating = contractorRes.data?.rating;
    const avgRating = rating ? rating.toFixed(1) : "-";

    return NextResponse.json({
      activeProjects,
      pendingBids,
      completedProjects,
      receivableTotal,
      monthlyRevenue,
      avgRating,
    });
  } catch (err) {
    console.error("Contractor stats error:", err);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
