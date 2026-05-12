/**
 * GET /api/admin/payments
 *
 * 관리자용 결제 전체 모니터링.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status"); // payment_intents.status
  const userId = sp.get("userId");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
  const offset = (page - 1) * limit;

  let query = admin
    .from("payment_intents")
    .select(
      `id, user_id, order_id, order_name, amount_krw, product_type, status, provider, customer_key, created_at,
      product:payment_products(code, name_ko, credit_amount, bonus_credit_amount),
      payment:payments!payment_intent_id(id, payment_key, method, status, approved_at)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (userId) query = query.eq("user_id", userId);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 통계
  const [
    { count: paidCount },
    { count: pendingCount },
    { count: failedCount },
    { count: refundedCount },
  ] = await Promise.all([
    admin.from("payment_intents").select("id", { count: "exact", head: true }).eq("status", "paid"),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["created", "confirming"]),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["confirm_failed", "needs_manual_review"]),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["refunded", "partial_refunded"]),
  ]);

  // 총 매출
  const { data: revenueData } = await admin
    .from("payments")
    .select("amount_krw")
    .eq("status", "DONE");
  const totalRevenue = (revenueData || []).reduce(
    (s: number, p: { amount_krw: number }) => s + (p.amount_krw || 0),
    0,
  );

  return NextResponse.json({
    items: data || [],
    total: count || 0,
    page,
    limit,
    stats: {
      paidCount: paidCount || 0,
      pendingCount: pendingCount || 0,
      failedCount: failedCount || 0,
      refundedCount: refundedCount || 0,
      totalRevenueWon: totalRevenue,
    },
  });
}
