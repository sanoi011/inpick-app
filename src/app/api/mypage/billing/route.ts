/**
 * GET /api/mypage/billing
 *
 * 사용자 결제·토큰·PDF·생성 job 통합 조회 (My Billing 포털).
 * 가이드: pricing-saas-flow §4-7, §10
 *
 * 조회는 service_role(admin)로 수행 — RLS 정책 유무와 무관하게 본인 데이터가
 * 항상 보이도록. 인증은 세션으로 확인하고 모든 쿼리를 user.id로 고정한다.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = createAdminClient();

  // 1) 지갑 잔액 (신 시스템) + user_credits (라이브 잔액 — 표시·차감이 실제로 쓰는 값)
  const { data: wallet } = await admin
    .from("token_wallets")
    .select("balance, paid_balance, promo_balance, locked_balance")
    .eq("user_id", user.id)
    .maybeSingle();
  let userCreditsBalance: number | null = null;
  const { data: cred } = await admin
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cred) userCreditsBalance = (cred as { balance: number }).balance;

  // 2) 최근 결제 50건
  const { data: payments } = await admin
    .from("payment_intents")
    .select(
      "id, order_id, amount_krw, status, provider, created_at, product:payment_products(name_ko, code, product_type)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // 3) 토큰 내역 — 신 원장(token_ledger) + 구 사용로그(credit_transactions) 병합
  const [{ data: ledgerNew }, { data: ledgerLegacy }] = await Promise.all([
    admin
      .from("token_ledger")
      .select("id, entry_type, delta, balance_after, reason_ko, source_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("credit_transactions")
      .select("id, type, amount, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  type LedgerRow = {
    id: string;
    entry_type: string;
    delta: number;
    balance_after: number | null;
    reason_ko: string | null;
    source_type: string;
    created_at: string;
  };
  const merged: LedgerRow[] = [
    ...((ledgerNew ?? []) as LedgerRow[]),
    ...((ledgerLegacy ?? []) as Array<{
      id: string; type: string; amount: number; description: string | null; created_at: string;
    }>)
      // 결제 미러링 항목은 token_ledger에 이미 있으므로 중복 표시 제외
      .filter((t) => !(t.description ?? "").includes("(payment:"))
      .map((t) => ({
        id: `legacy-${t.id}`,
        entry_type: t.type === "USE" ? "consume" : "credit",
        delta: t.amount,
        balance_after: null,
        reason_ko: t.description,
        source_type: "legacy",
        created_at: t.created_at,
      })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 50);

  // 4) PDF entitlements
  const { data: entitlements } = await admin
    .from("user_entitlements")
    .select(
      "id, entitlement_type, source, scope_type, scope_id, estimate_id, estimate_version, asset_url, granted_at, consumed_at, expires_at, revoked_at",
    )
    .eq("user_id", user.id)
    .order("granted_at", { ascending: false })
    .limit(30);

  // 5) 이미지 생성 job 30건
  const { data: genJobs } = await admin
    .from("generation_jobs")
    .select(
      "id, project_id, target_name, status, image_url, error_message, created_at, completed_at, failed_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // 6) 본인 reconciliation cases (severity high 이상)
  const { data: cases } = await admin
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
    ledger: merged,
    entitlements: entitlements ?? [],
    generationJobs: genJobs ?? [],
    recoveryCases: cases ?? [],
  });
}
