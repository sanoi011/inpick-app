/**
 * GET /api/payments/history
 *
 * 결제 및 크레딧 이력 통합 조회.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 *
 * 쿼리:
 *  - type: all | payments | tokens (default all)
 *  - page, limit
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTokenWallet } from "@/lib/inpick/tokens/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "all";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    const wallet = await getTokenWallet(user.id);

    let payments: unknown[] = [];
    let ledger: unknown[] = [];

    if (type === "all" || type === "payments") {
      const { data } = await supabase
        .from("payments")
        .select(
          "id, order_id, payment_key, method, easy_pay_provider, amount_krw, status, approved_at, created_at, payment_intent:payment_intents(order_name, product:payment_products(name_ko, code))",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      payments = data || [];
    }

    if (type === "all" || type === "tokens") {
      const { data } = await supabase
        .from("token_ledger")
        .select(
          "id, entry_type, delta, paid_delta, promo_delta, balance_after, source_type, reason_ko, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      ledger = data || [];
    }

    return NextResponse.json({
      wallet: wallet
        ? {
            balance: wallet.balance,
            paidBalance: wallet.paid_balance,
            promoBalance: wallet.promo_balance,
            totalPurchased: wallet.total_purchased,
            totalConsumed: wallet.total_consumed,
            totalRefunded: wallet.total_refunded,
          }
        : null,
      payments,
      ledger,
      page,
      limit,
    });
  } catch (err) {
    console.error("[payments/history] error:", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
