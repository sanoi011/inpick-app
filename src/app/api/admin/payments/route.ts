/**
 * GET /api/admin/payments
 *
 * 관리자용 결제 전체 모니터링.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";

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
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
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

  // 통계 — IAP 성공 인텐트는 최종 status가 'provisioned'(지급 완료)이므로 paid와 함께 집계
  const SUCCESS_STATUSES = ["paid", "provisioned"];
  const [
    { count: paidCount },
    { count: pendingCount },
    { count: failedCount },
    { count: refundedCount },
  ] = await Promise.all([
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", SUCCESS_STATUSES),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["created", "confirming"]),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["confirm_failed", "needs_manual_review"]),
    admin.from("payment_intents").select("id", { count: "exact", head: true }).in("status", ["refunded", "partial_refunded"]),
  ]);

  // 총 매출 — Toss 전용 payments(DONE)만 합산하면 App Store/Google Play IAP 매출이 빠짐
  // → 성공 인텐트(payment_intents) 기준으로 합산 (2026-07-07)
  const { data: revenueData } = await admin
    .from("payment_intents")
    .select("amount_krw")
    .in("status", SUCCESS_STATUSES);
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
