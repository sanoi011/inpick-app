/**
 * GET /api/mypage/billing
 *
 * 사용자 결제·토큰·PDF·생성 job 통합 조회 (My Billing 포털).
 * 가이드: pricing-saas-flow §4-7, §10
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // 1) 지갑 잔액
  const { data: wallet } = await supabase
    .from("token_wallets")
    .select("balance, paid_balance, promo_balance, locked_balance")
    .eq("user_id", user.id)
    .maybeSingle();
  // user_credits fallback
  let userCreditsBalance: number | null = null;
  const { data: cred } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cred) userCreditsBalance = (cred as { balance: number }).balance;

  // 2) 최근 결제 50건
  const { data: payments } = await supabase
    .from("payment_intents")
    .select(
      "id, order_id, amount_krw, status, created_at, product:payment_products(name_ko, code, product_type)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // 3) 토큰 ledger 30건
  const { data: ledger } = await supabase
    .from("token_ledger")
    .select("id, entry_type, delta, balance_after, reason_ko, source_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // 4) PDF entitlements
  const { data: entitlements } = await supabase
    .from("user_entitlements")
    .select(
      "id, entitlement_type, source, scope_type, scope_id, estimate_id, estimate_version, asset_url, granted_at, consumed_at, expires_at, revoked_at",
    )
    .eq("user_id", user.id)
    .order("granted_at", { ascending: false })
    .limit(30);

  // 5) 이미지 생성 job 30건
  const { data: genJobs } = await supabase
    .from("generation_jobs")
    .select(
      "id, project_id, target_name, status, image_url, error_message, created_at, completed_at, failed_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // 6) 본인 reconciliation cases (severity high 이상)
  const { data: cases } = await supabase
    .from("reconciliation_cases")
    .select("id, case_type, severity, status, description, created_at")
    .eq("user_id", user.id)
    .in("severity", ["high", "critical"])
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    wallet: wallet ?? {
      balance: userCreditsBalance ?? 0,
      paid_balance: 0,
      promo_balance: userCreditsBalance ?? 0,
      locked_balance: 0,
    },
    userCreditsBalance,
    payments: payments ?? [],
    ledger: ledger ?? [],
    entitlements: entitlements ?? [],
    generationJobs: genJobs ?? [],
    recoveryCases: cases ?? [],
  });
}
