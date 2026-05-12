/**
 * GET /api/payments/products
 *
 * 활성 결제 상품 목록 (Toss 결제 위젯에 표시할 패키지).
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 */
import { NextResponse } from "next/server";
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

export async function GET() {
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const { data, error } = await admin
    .from("payment_products")
    .select("id, code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, sort_order, metadata")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[payments/products] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const products = (data || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    code: p.code,
    productType: p.product_type,
    nameKo: p.name_ko,
    descriptionKo: p.description_ko,
    amountKrw: p.amount_krw,
    creditAmount: p.credit_amount,
    bonusCreditAmount: p.bonus_credit_amount,
    totalCredits: (p.credit_amount as number) + (p.bonus_credit_amount as number),
    sortOrder: p.sort_order,
  }));
  return NextResponse.json({ products });
}
