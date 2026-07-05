/**
 * INPICK 크레딧 ledger — 결제·소비·환불 idempotency 강제.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §8
 *
 * 핵심 원칙:
 *  - 모든 변동은 token_ledger.idempotency_key UNIQUE로 중복 차단
 *  - 결제·소비·환불 모두 같은 함수로 처리 (entry_type만 다름)
 *  - 절대 throw 안 함 (정책 위반/잔액 부족만 InsufficientBalanceError throw)
 *  - 잔액 = paid_balance + promo_balance
 *  - 소비 시 promo_balance 먼저 차감 (환불 단순화)
 */
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export class InsufficientBalanceError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient balance: ${balance} < ${required}`);
    this.name = "InsufficientBalanceError";
  }
}

export class LedgerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

type EntryType =
  | "purchase_credit"
  | "bonus_credit"
  | "ai_consume"
  | "ai_refund"
  | "admin_adjust"
  | "payment_refund_debit"
  | "expired";

type SourceType =
  | "payment"
  | "ai_action"
  | "admin_action"
  | "system"
  | "promo";

interface AppendLedgerInput {
  userId: string;
  entryType: EntryType;
  delta: number; // +면 충전, -면 차감
  paidDelta?: number;
  promoDelta?: number;
  sourceType: SourceType;
  sourceId?: string;
  idempotencyKey: string; // UNIQUE
  reasonKo?: string;
  metadata?: Record<string, unknown>;
}

interface WalletRow {
  user_id: string;
  balance: number;
  paid_balance: number;
  promo_balance: number;
  total_purchased: number;
  total_consumed: number;
  total_refunded: number;
}

async function ensureWallet(userId: string): Promise<WalletRow> {
  const admin = getAdmin();
  if (!admin) throw new LedgerError("NO_ADMIN", "Supabase service role 미설정");
  const { data: existing } = await admin
    .from("token_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as WalletRow;
  const { data: inserted, error } = await admin
    .from("token_wallets")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error || !inserted) {
    throw new LedgerError("WALLET_CREATE_FAILED", error?.message || "wallet insert fail");
  }
  return inserted as WalletRow;
}

/**
 * 핵심 함수 — ledger 1행 + wallet 갱신을 한 트랜잭션처럼 처리.
 *
 * idempotency_key UNIQUE 위반 시:
 *  - 이미 처리된 거래로 간주, 기존 ledger row 반환 (재시도 안전)
 */
export async function appendLedgerEntry(
  input: AppendLedgerInput,
): Promise<{ idempotent: boolean; balanceAfter: number; ledgerId: string }> {
  const admin = getAdmin();
  if (!admin) throw new LedgerError("NO_ADMIN", "Supabase service role 미설정");

  // 이미 처리된 idempotency_key 확인
  const { data: existing } = await admin
    .from("token_ledger")
    .select("id, balance_after")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      idempotent: true,
      balanceAfter: (existing as { balance_after: number }).balance_after,
      ledgerId: (existing as { id: string }).id,
    };
  }

  const wallet = await ensureWallet(input.userId);
  const paidDelta = input.paidDelta ?? 0;
  const promoDelta = input.promoDelta ?? 0;

  // 소비 (delta < 0) — promo 먼저 차감
  let adjustedPaidDelta = paidDelta;
  let adjustedPromoDelta = promoDelta;

  if (input.delta < 0 && paidDelta === 0 && promoDelta === 0) {
    // 자동 분배: promo 우선
    const need = -input.delta;
    if (wallet.balance < need) {
      throw new InsufficientBalanceError(wallet.balance, need);
    }
    const fromPromo = Math.min(wallet.promo_balance, need);
    const fromPaid = need - fromPromo;
    adjustedPromoDelta = -fromPromo;
    adjustedPaidDelta = -fromPaid;
  }

  const newPaidBalance = wallet.paid_balance + adjustedPaidDelta;
  const newPromoBalance = wallet.promo_balance + adjustedPromoDelta;
  const newBalance = newPaidBalance + newPromoBalance;

  if (newPaidBalance < 0 || newPromoBalance < 0) {
    throw new InsufficientBalanceError(wallet.balance, Math.abs(input.delta));
  }

  // 1. ledger insert (UNIQUE 위반 시 race condition으로 처리)
  const { data: ledgerData, error: ledgerErr } = await admin
    .from("token_ledger")
    .insert({
      user_id: input.userId,
      entry_type: input.entryType,
      delta: input.delta,
      paid_delta: adjustedPaidDelta,
      promo_delta: adjustedPromoDelta,
      balance_after: newBalance,
      source_type: input.sourceType,
      source_id: input.sourceId,
      idempotency_key: input.idempotencyKey,
      reason_ko: input.reasonKo,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (ledgerErr) {
    // UNIQUE 위반 = 동시 호출 처리됨
    if (ledgerErr.message?.includes("idempotency_key")) {
      const { data: race } = await admin
        .from("token_ledger")
        .select("id, balance_after")
        .eq("idempotency_key", input.idempotencyKey)
        .single();
      if (race) {
        return {
          idempotent: true,
          balanceAfter: (race as { balance_after: number }).balance_after,
          ledgerId: (race as { id: string }).id,
        };
      }
    }
    throw new LedgerError("LEDGER_INSERT_FAILED", ledgerErr.message);
  }

  // 2. wallet 갱신
  const totals = {
    total_purchased:
      input.entryType === "purchase_credit" || input.entryType === "bonus_credit"
        ? wallet.total_purchased + Math.max(input.delta, 0)
        : wallet.total_purchased,
    total_consumed:
      input.entryType === "ai_consume"
        ? wallet.total_consumed + Math.abs(Math.min(input.delta, 0))
        : wallet.total_consumed,
    total_refunded:
      input.entryType === "ai_refund" || input.entryType === "payment_refund_debit"
        ? wallet.total_refunded + Math.abs(input.delta)
        : wallet.total_refunded,
  };

  const { error: walletErr } = await admin
    .from("token_wallets")
    .update({
      paid_balance: newPaidBalance,
      promo_balance: newPromoBalance,
      balance: newBalance,
      ...totals,
    })
    .eq("user_id", input.userId);

  if (walletErr) {
    console.error("[ledger] wallet update fail:", walletErr.message);
    // ledger는 이미 들어갔지만 wallet 실패 → reconciliation 필요
    throw new LedgerError("WALLET_UPDATE_FAILED", walletErr.message);
  }

  return {
    idempotent: false,
    balanceAfter: newBalance,
    ledgerId: (ledgerData as { id: string }).id,
  };
}

/**
 * 결제 완료 시 크레딧 충전 (paid + bonus 분리).
 * idempotency: payment:{paymentId}:credit
 */
export async function creditTokensAfterPayment(input: {
  userId: string;
  paymentId: string;
  productCode: string;
  paidCredits: number;
  bonusCredits: number;
  reasonKo?: string;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  // 1) paid 충전
  const paidResult = await appendLedgerEntry({
    userId: input.userId,
    entryType: "purchase_credit",
    delta: input.paidCredits,
    paidDelta: input.paidCredits,
    sourceType: "payment",
    sourceId: input.paymentId,
    idempotencyKey: `payment:${input.paymentId}:credit`,
    reasonKo: input.reasonKo || `${input.productCode} 구매`,
    metadata: { productCode: input.productCode },
  });

  // 2) bonus 충전 (0이면 skip)
  if (input.bonusCredits > 0) {
    await appendLedgerEntry({
      userId: input.userId,
      entryType: "bonus_credit",
      delta: input.bonusCredits,
      promoDelta: input.bonusCredits,
      sourceType: "payment",
      sourceId: input.paymentId,
      idempotencyKey: `payment:${input.paymentId}:bonus`,
      reasonKo: `${input.productCode} 보너스`,
      metadata: { productCode: input.productCode },
    });
  }

  // 3) ⚠️ 라이브 잔액 미러링 — 잔액표시(user/balance)와 AI 차감(credit-policy)은
  //    token_wallets가 아니라 user_tokens를 본다. 결제로 산 토큰이 '안 보이고 못 쓰이는'
  //    문제(2026-07-05 버그헌트 C2) 해결: 신규 충전 시에만 user_tokens에도 반영.
  if (!paidResult.idempotent) {
    await mirrorCreditToLiveBalance(
      input.userId,
      input.paidCredits + Math.max(0, input.bonusCredits),
      input.paymentId,
    );
  }

  return { balanceAfter: paidResult.balanceAfter, idempotent: paidResult.idempotent };
}

/**
 * 결제 충전분을 라이브 잔액 원장(user_tokens)에 미러링.
 * user_tokens가 없으면 생성. 실패해도 throw 안 함(원장 기록은 이미 성공).
 */
async function mirrorCreditToLiveBalance(
  userId: string,
  amount: number,
  paymentId: string,
): Promise<void> {
  if (amount <= 0) return;
  const admin = getAdmin();
  if (!admin) return;
  try {
    // 같은 결제가 이미 미러링됐는지 확인 (webhook+confirm 이중 경로 멱등)
    const { data: dup } = await admin
      .from("token_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "purchase")
      .contains("metadata", { paymentId })
      .maybeSingle();
    if (dup) return;

    const { data: tok } = await admin
      .from("user_tokens")
      .select("balance, total_purchased")
      .eq("user_id", userId)
      .maybeSingle();
    const prev = (tok as { balance?: number; total_purchased?: number } | null) ?? null;
    const newBal = (prev?.balance ?? 0) + amount;
    if (prev) {
      await admin
        .from("user_tokens")
        .update({ balance: newBal, total_purchased: (prev.total_purchased ?? 0) + amount })
        .eq("user_id", userId);
    } else {
      await admin
        .from("user_tokens")
        .insert({ user_id: userId, balance: newBal, total_purchased: amount, total_used: 0 });
    }
    await admin.from("token_transactions").insert({
      user_id: userId,
      type: "purchase",
      amount,
      balance_after: newBal,
      metadata: { paymentId, mirrored: true },
    });
  } catch (e) {
    console.warn("[ledger] mirrorCreditToLiveBalance failed (non-fatal):", e);
  }
}

/**
 * AI 작업 시작 시 크레딧 차감.
 * idempotency: consume:{action}:{jobId}
 */
export async function consumeTokensForAction(input: {
  userId: string;
  action: string;
  jobId: string;
  amount: number;
  reasonKo?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ balanceAfter: number; idempotent: boolean; ledgerId: string }> {
  if (input.amount <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "amount must be > 0");
  }
  return appendLedgerEntry({
    userId: input.userId,
    entryType: "ai_consume",
    delta: -input.amount,
    sourceType: "ai_action",
    idempotencyKey: `consume:${input.action}:${input.jobId}`,
    reasonKo: input.reasonKo || `${input.action} AI 호출`,
    metadata: { action: input.action, jobId: input.jobId, ...(input.metadata || {}) },
  });
}

/**
 * AI 작업 실패 시 환불.
 * idempotency: refund:{action}:{jobId}
 */
export async function refundTokensForFailedAction(input: {
  userId: string;
  action: string;
  jobId: string;
  amount: number;
  reasonKo: string;
  metadata?: Record<string, unknown>;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  if (input.amount <= 0) return { balanceAfter: 0, idempotent: true };
  const result = await appendLedgerEntry({
    userId: input.userId,
    entryType: "ai_refund",
    delta: input.amount,
    // refund는 단순 promo로 환원 (회계 단순화)
    promoDelta: input.amount,
    sourceType: "ai_action",
    idempotencyKey: `refund:${input.action}:${input.jobId}`,
    reasonKo: input.reasonKo,
    metadata: { action: input.action, jobId: input.jobId, ...(input.metadata || {}) },
  });
  return { balanceAfter: result.balanceAfter, idempotent: result.idempotent };
}

/**
 * 결제 환불 시 크레딧 차감 (관리자 환불 처리 후 호출).
 * idempotency: refund_debit:{refundId}
 */
export async function debitTokensForPaymentRefund(input: {
  userId: string;
  refundId: string;
  paymentId: string;
  amount: number;
  reasonKo: string;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  const result = await appendLedgerEntry({
    userId: input.userId,
    entryType: "payment_refund_debit",
    delta: -input.amount,
    paidDelta: -input.amount,
    sourceType: "admin_action",
    sourceId: input.refundId,
    idempotencyKey: `refund_debit:${input.refundId}`,
    reasonKo: input.reasonKo,
    metadata: { paymentId: input.paymentId },
  });
  return { balanceAfter: result.balanceAfter, idempotent: result.idempotent };
}

/**
 * 관리자 수동 조정.
 * idempotency: admin:{adminId}:{requestId}
 */
export async function adminAdjustTokens(input: {
  userId: string;
  adminId: string;
  requestId: string;
  delta: number; // +/- 가능
  reasonKo: string;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  return appendLedgerEntry({
    userId: input.userId,
    entryType: "admin_adjust",
    delta: input.delta,
    paidDelta: input.delta > 0 ? input.delta : 0,
    promoDelta: input.delta < 0 ? input.delta : 0,
    sourceType: "admin_action",
    sourceId: input.adminId,
    idempotencyKey: `admin:${input.adminId}:${input.requestId}`,
    reasonKo: input.reasonKo,
    metadata: { adminId: input.adminId },
  });
}

/**
 * 잔액 조회.
 */
export async function getTokenWallet(userId: string): Promise<WalletRow | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("token_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as WalletRow) || null;
}
