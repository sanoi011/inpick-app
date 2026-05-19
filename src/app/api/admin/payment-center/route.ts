/**
 * GET /api/admin/payment-center
 *
 * 결제 센트럴타워 통합 데이터.
 * 가이드: §12-5, §9
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
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
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [providers, productsRes, intentsRes, eventsRes, appPurchasesRes, casesRes, recentPayRes] = await Promise.all([
    admin.from("payment_provider_configs").select("*").order("provider", { ascending: true }),
    admin.from("payment_products").select("code, product_type, product_kind, name_ko, amount_krw, app_store_product_id, google_play_product_id, sale_channels, policy_risk_level, is_active, is_visible").order("sort_order", { ascending: true }),
    admin.from("payment_intents").select("id, user_id, order_id, channel, platform, provider, product_type, amount_krw, status, created_at").gte("created_at", since7d).order("created_at", { ascending: false }).limit(100),
    admin.from("payment_provider_events").select("*").order("received_at", { ascending: false }).limit(50),
    admin.from("app_purchase_transactions").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("reconciliation_cases").select("*").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(20),
    admin.from("payment_intents").select("amount_krw, status, created_at").gte("created_at", since24h),
  ]);

  // Overview
  const today = (recentPayRes.data ?? []) as Array<{ amount_krw: number; status: string }>;
  const overview = {
    today_total_krw: today.filter((p) => ["paid", "provisioned"].includes(p.status)).reduce((s, p) => s + p.amount_krw, 0),
    today_count: today.length,
    today_paid: today.filter((p) => p.status === "paid" || p.status === "provisioned").length,
    today_failed: today.filter((p) => p.status === "failed").length,
    open_cases: casesRes.data?.length ?? 0,
    unprocessed_events: (eventsRes.data ?? []).filter((e) => !e.processed).length,
  };

  // Policy warnings
  const policyWarnings: Array<{ severity: string; message: string; productId?: string }> = [];
  for (const p of (productsRes.data ?? []) as Array<{
    code: string; product_kind: string | null; sale_channels: Record<string, boolean>;
    app_store_product_id: string | null; google_play_product_id: string | null; policy_risk_level: string;
  }>) {
    if (!p.product_kind) {
      policyWarnings.push({ severity: "medium", message: `${p.code} — product_kind 미지정`, productId: p.code });
    }
    const isDigital = p.product_kind === "digital_token" || p.product_kind === "digital_entitlement";
    if (isDigital && !p.app_store_product_id) {
      policyWarnings.push({ severity: "low", message: `${p.code} — iOS app_store_product_id 미등록`, productId: p.code });
    }
    if (isDigital && !p.google_play_product_id) {
      policyWarnings.push({ severity: "low", message: `${p.code} — Android google_play_product_id 미등록`, productId: p.code });
    }
  }

  return NextResponse.json({
    overview,
    providers: providers.data ?? [],
    products: productsRes.data ?? [],
    paymentIntents: intentsRes.data ?? [],
    providerEvents: eventsRes.data ?? [],
    appPurchases: appPurchasesRes.data ?? [],
    reconciliationCases: casesRes.data ?? [],
    policyWarnings,
  });
}
