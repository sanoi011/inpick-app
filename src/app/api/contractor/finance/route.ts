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
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    // 이번 달 수입
    const { data: thisPayments } = await supabase
      .from("payment_records")
      .select("amount, payment_type")
      .eq("contractor_id", contractorId)
      .gte("paid_at", thisMonthStart)
      .lte("paid_at", thisMonthEnd);

    const monthlyRevenue = (thisPayments || [])
      .filter(p => p.payment_type === "income")
      .reduce((s, p) => s + (p.amount || 0), 0);

    // 이번 달 지출
    const { data: thisExpenses } = await supabase
      .from("expense_records")
      .select("amount")
      .eq("contractor_id", contractorId)
      .gte("expense_date", thisMonthStart.split("T")[0])
      .lte("expense_date", thisMonthEnd.split("T")[0]);

    const monthlyExpenses = (thisExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);

    // 전월 수입
    const { data: prevPayments } = await supabase
      .from("payment_records")
      .select("amount")
      .eq("contractor_id", contractorId)
      .eq("payment_type", "income")
      .gte("paid_at", prevMonthStart)
      .lte("paid_at", prevMonthEnd);

    const prevMonthRevenue = (prevPayments || []).reduce((s, p) => s + (p.amount || 0), 0);

    // 미수금 (sent + overdue 청구서)
    const { data: unpaid } = await supabase
      .from("invoices")
      .select("total, status, due_date")
      .eq("contractor_id", contractorId)
      .in("status", ["sent", "overdue"]);

    const today = now.toISOString().split("T")[0];
    const receivables = { total: 0, current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
    for (const inv of unpaid || []) {
      const t = inv.total || 0;
      receivables.total += t;
      if (!inv.due_date || inv.due_date >= today) {
        receivables.current += t;
      } else {
        const daysOverdue = Math.floor((new Date(today).getTime() - new Date(inv.due_date).getTime()) / 86400000);
        if (daysOverdue <= 30) receivables.overdue30 += t;
        else if (daysOverdue <= 60) receivables.overdue60 += t;
        else receivables.overdue90 += t;
      }
    }

    // 프로젝트별 수익성
    const { data: projects } = await supabase
      .from("contractor_projects")
      .select("id, name, total_budget")
      .eq("contractor_id", contractorId)
      .in("status", ["in_progress", "completed"])
      .limit(20);

    const projectProfits = [];
    for (const proj of projects || []) {
      const { data: pIncome } = await supabase
        .from("payment_records")
        .select("amount")
        .eq("contractor_id", contractorId)
        .eq("project_id", proj.id)
        .eq("payment_type", "income");

      const { data: pExpense } = await supabase
        .from("expense_records")
        .select("amount")
        .eq("contractor_id", contractorId)
        .eq("project_id", proj.id);

      const revenue = (pIncome || []).reduce((s, p) => s + (p.amount || 0), 0);
      const expenses = (pExpense || []).reduce((s, e) => s + (e.amount || 0), 0);
      const profit = revenue - expenses;

      projectProfits.push({
        projectId: proj.id,
        projectName: proj.name,
        revenue,
        expenses,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      });
    }

    const revenueChangeRate = prevMonthRevenue > 0
      ? Math.round(((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        monthlyRevenue,
        monthlyExpenses,
        monthlyProfit: monthlyRevenue - monthlyExpenses,
        prevMonthRevenue,
        revenueChangeRate,
        receivables,
        projectedBalance: monthlyRevenue - monthlyExpenses + receivables.current,
      },
      projectProfits,
    });
  } catch (err) {
    console.error("Finance GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
