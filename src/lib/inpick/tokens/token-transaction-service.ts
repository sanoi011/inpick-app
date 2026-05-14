/**
 * Token Transaction Service — reserve / commit / release / refund lifecycle.
 * 가이드: inpick-payment-saas-flow-uiux-improvement-plan-20260514.md §5, §11
 *
 * 정책:
 *   * 모든 작업은 idempotency_key UNIQUE로 중복 차단
 *   * lifecycle:
 *       reserveTokens() → token_charge_intents 'reserved' + locked_balance 증가
 *       commitReservedTokens() → 'committed' + balance 차감 + locked_balance 복원 + ledger 기록
 *       releaseReservedTokens() → 'released' + locked_balance 복원 (잔액 변경 X)
 *       refundTokens() → 'refunded' + balance 증가 + ledger 환불 기록
 *   * 잔액 검증: locked_balance 포함 = (balance - locked_balance) 가용
 *   * row lock: Postgres UPDATE는 자동 row-level lock 사용
 *
 * 기존 token_wallets / token_ledger 시스템 위에 lifecycle 레이어를 추가.
 * 기존 ledger.ts는 결제 충전·즉시 소비용으로 유지.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export class TokenError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export class InsufficientTokenError extends TokenError {
  constructor(public available: number, public required: number) {
    super("INSUFFICIENT_TOKENS", `available ${available} < required ${required}`);
  }
}

export type ChargeAction =
  | "image_generation"
  | "pdf_issue"
  | "estimate_regeneration"
  | "commercial_render";

interface ReserveInput {
  userId: string;
  projectId?: string;
  action: ChargeAction;
  tokenAmount: number;
  /** 호출자별 고유 base. 내부적으로 ":reserve" suffix가 붙음. */
  idempotencyBase: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

interface ChargeIntentRow {
  id: string;
  user_id: string;
  project_id: string | null;
  action: ChargeAction;
  token_amount: number;
  status: string;
  idempotency_key: string;
  reference_type: string | null;
  reference_id: string | null;
  reserved_at: string | null;
  committed_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
}

interface WalletRow {
  user_id: string;
  balance: number;
  paid_balance: number;
  promo_balance: number;
  locked_balance: number;
  total_purchased: number;
  total_consumed: number;
  total_refunded: number;
}

/** 가용 토큰 = balance - locked_balance */
function availableOf(w: WalletRow): number {
  return Math.max(0, w.balance - w.locked_balance);
}

async function ensureWallet(userId: string): Promise<WalletRow> {
  const admin = getAdmin();
  if (!admin) throw new TokenError("NO_ADMIN", "Supabase service role 미설정");
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
    throw new TokenError("WALLET_CREATE_FAILED", error?.message || "wallet insert failed");
  }
  return inserted as WalletRow;
}

/**
 * Reserve — 토큰을 일시 잠금 처리 (실제 차감 X).
 * lifecycle: created → reserved
 *
 * idempotency: `${idempotencyBase}:reserve`
 *   - 이미 reserved/committed/released/refunded 상태면 기존 intent 반환
 */
export async function reserveTokens(input: ReserveInput): Promise<{
  intent: ChargeIntentRow;
  idempotent: boolean;
  walletAvailableAfter: number;
}> {
  const admin = getAdmin();
  if (!admin) throw new TokenError("NO_ADMIN", "Supabase service role 미설정");
  if (!Number.isFinite(input.tokenAmount) || input.tokenAmount <= 0) {
    throw new TokenError("INVALID_AMOUNT", "tokenAmount > 0 required");
  }

  const idempotencyKey = `${input.idempotencyBase}:reserve`;

  // 1) idempotent check
  const { data: existingIntent } = await admin
    .from("token_charge_intents")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingIntent) {
    const wallet = await ensureWallet(input.userId);
    return {
      intent: existingIntent as ChargeIntentRow,
      idempotent: true,
      walletAvailableAfter: availableOf(wallet),
    };
  }

  // 2) wallet 가용 검증
  const wallet = await ensureWallet(input.userId);
  if (availableOf(wallet) < input.tokenAmount) {
    throw new InsufficientTokenError(availableOf(wallet), input.tokenAmount);
  }

  // 3) intent INSERT (UNIQUE 위반 시 race 처리)
  const { data: intent, error: intentErr } = await admin
    .from("token_charge_intents")
    .insert({
      user_id: input.userId,
      project_id: input.projectId ?? null,
      action: input.action,
      token_amount: input.tokenAmount,
      status: "reserved",
      idempotency_key: idempotencyKey,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      reserved_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (intentErr || !intent) {
    // UNIQUE race
    if (intentErr?.message?.includes("idempotency_key")) {
      const { data: race } = await admin
        .from("token_charge_intents")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (race) {
        return {
          intent: race as ChargeIntentRow,
          idempotent: true,
          walletAvailableAfter: availableOf(wallet),
        };
      }
    }
    throw new TokenError("INTENT_INSERT_FAILED", intentErr?.message || "intent insert failed");
  }

  // 4) wallet locked_balance += amount (서버 동시성: SELECT 후 갱신 — 추후 RPC로 atomic 보강)
  const newLocked = wallet.locked_balance + input.tokenAmount;
  const { error: walletErr } = await admin
    .from("token_wallets")
    .update({ locked_balance: newLocked })
    .eq("user_id", input.userId);
  if (walletErr) {
    // intent는 들어갔으나 wallet 갱신 실패 → reconciliation 필요
    await admin.from("reconciliation_cases").insert({
      case_type: "token_charged_no_output",
      severity: "high",
      user_id: input.userId,
      token_charge_intent_id: (intent as ChargeIntentRow).id,
      description: "reserve 후 wallet locked_balance 갱신 실패",
      detected_payload: { error: walletErr.message },
    });
    throw new TokenError("WALLET_LOCK_FAILED", walletErr.message);
  }

  return {
    intent: intent as ChargeIntentRow,
    idempotent: false,
    walletAvailableAfter: availableOf({ ...wallet, locked_balance: newLocked }),
  };
}

/**
 * Commit — 예약된 토큰을 실제로 차감.
 * lifecycle: reserved → committed
 * 같은 idempotencyBase로 호출 가능 (`:commit` suffix).
 *
 * 처리:
 *   1. intent를 reserved 상태에서 가져옴
 *   2. balance -= amount, locked_balance -= amount
 *   3. token_ledger 차감 기록 (entry_type=ai_consume)
 *   4. intent.status = 'committed'
 */
export async function commitReservedTokens(input: {
  chargeIntentId: string;
  idempotencyBase: string;
  reasonKo?: string;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  const admin = getAdmin();
  if (!admin) throw new TokenError("NO_ADMIN", "Supabase service role 미설정");

  // 1) intent 조회
  const { data: intent } = await admin
    .from("token_charge_intents")
    .select("*")
    .eq("id", input.chargeIntentId)
    .maybeSingle();
  if (!intent) throw new TokenError("INTENT_NOT_FOUND", "intent missing");
  const row = intent as ChargeIntentRow;

  // 이미 committed면 idempotent
  if (row.status === "committed") {
    const wallet = await ensureWallet(row.user_id);
    return { balanceAfter: wallet.balance, idempotent: true };
  }
  if (row.status !== "reserved") {
    throw new TokenError(
      "INVALID_STATE",
      `commit requires status=reserved, current=${row.status}`,
    );
  }

  // 2) ledger UNIQUE 키 (commit 단계)
  const ledgerKey = `${input.idempotencyBase}:commit`;
  const { data: existingLedger } = await admin
    .from("token_ledger")
    .select("balance_after")
    .eq("idempotency_key", ledgerKey)
    .maybeSingle();
  if (existingLedger) {
    // 이미 ledger 들어갔지만 intent 갱신 실패한 케이스
    await admin
      .from("token_charge_intents")
      .update({ status: "committed", committed_at: new Date().toISOString() })
      .eq("id", row.id);
    return {
      balanceAfter: (existingLedger as { balance_after: number }).balance_after,
      idempotent: true,
    };
  }

  // 3) wallet 갱신 (balance -= amount, locked -= amount)
  const wallet = await ensureWallet(row.user_id);
  const newBalance = wallet.balance - row.token_amount;
  const newLocked = Math.max(0, wallet.locked_balance - row.token_amount);
  // promo 우선 차감
  const promoToConsume = Math.min(wallet.promo_balance, row.token_amount);
  const paidToConsume = row.token_amount - promoToConsume;
  const newPromo = wallet.promo_balance - promoToConsume;
  const newPaid = wallet.paid_balance - paidToConsume;

  if (newBalance < 0 || newPaid < 0 || newPromo < 0) {
    throw new TokenError("NEGATIVE_BALANCE", "commit would cause negative balance");
  }

  const { error: walletErr } = await admin
    .from("token_wallets")
    .update({
      balance: newBalance,
      locked_balance: newLocked,
      paid_balance: newPaid,
      promo_balance: newPromo,
      total_consumed: wallet.total_consumed + row.token_amount,
    })
    .eq("user_id", row.user_id);
  if (walletErr) throw new TokenError("WALLET_UPDATE_FAILED", walletErr.message);

  // 4) ledger 기록
  await admin.from("token_ledger").insert({
    user_id: row.user_id,
    entry_type: "ai_consume",
    delta: -row.token_amount,
    paid_delta: -paidToConsume,
    promo_delta: -promoToConsume,
    balance_after: newBalance,
    source_type: "ai_action",
    source_id: row.id,
    idempotency_key: ledgerKey,
    reason_ko: input.reasonKo || `${row.action} 토큰 commit`,
    metadata: { chargeIntentId: row.id, action: row.action },
  });

  // 5) intent 갱신
  await admin
    .from("token_charge_intents")
    .update({ status: "committed", committed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { balanceAfter: newBalance, idempotent: false };
}

/**
 * Release — 예약 해제 (실제 차감 없이 lock만 풀기).
 * lifecycle: reserved → released
 * 사용: 이미지 생성 실패/timeout/사용자 취소 등
 */
export async function releaseReservedTokens(input: {
  chargeIntentId: string;
  idempotencyBase: string;
  reason: string;
}): Promise<{ idempotent: boolean }> {
  const admin = getAdmin();
  if (!admin) throw new TokenError("NO_ADMIN", "Supabase service role 미설정");

  const { data: intent } = await admin
    .from("token_charge_intents")
    .select("*")
    .eq("id", input.chargeIntentId)
    .maybeSingle();
  if (!intent) throw new TokenError("INTENT_NOT_FOUND", "intent missing");
  const row = intent as ChargeIntentRow;

  if (row.status === "released") return { idempotent: true };
  if (row.status !== "reserved") {
    throw new TokenError("INVALID_STATE", `release requires reserved, current=${row.status}`);
  }

  // wallet locked_balance 복원
  const wallet = await ensureWallet(row.user_id);
  const newLocked = Math.max(0, wallet.locked_balance - row.token_amount);
  const { error: walletErr } = await admin
    .from("token_wallets")
    .update({ locked_balance: newLocked })
    .eq("user_id", row.user_id);
  if (walletErr) throw new TokenError("WALLET_UPDATE_FAILED", walletErr.message);

  await admin
    .from("token_charge_intents")
    .update({
      status: "released",
      released_at: new Date().toISOString(),
      failure_reason: input.reason,
    })
    .eq("id", row.id);

  return { idempotent: false };
}

/**
 * Refund — 이미 commit된 토큰을 환불.
 * lifecycle: committed → refunded (또는 별도 환불 ledger 1행)
 * 사용: 사용자 환불 요청, 관리자 보정 등.
 */
export async function refundTokens(input: {
  userId: string;
  tokenAmount: number;
  idempotencyKey: string;
  reasonKo: string;
  chargeIntentId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ balanceAfter: number; idempotent: boolean }> {
  const admin = getAdmin();
  if (!admin) throw new TokenError("NO_ADMIN", "Supabase service role 미설정");
  if (!Number.isFinite(input.tokenAmount) || input.tokenAmount <= 0) {
    throw new TokenError("INVALID_AMOUNT", "tokenAmount > 0 required");
  }

  // ledger UNIQUE
  const { data: existing } = await admin
    .from("token_ledger")
    .select("balance_after")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      balanceAfter: (existing as { balance_after: number }).balance_after,
      idempotent: true,
    };
  }

  const wallet = await ensureWallet(input.userId);
  const newBalance = wallet.balance + input.tokenAmount;
  const newPromo = wallet.promo_balance + input.tokenAmount; // 환불은 promo로 환원
  const { error: walletErr } = await admin
    .from("token_wallets")
    .update({
      balance: newBalance,
      promo_balance: newPromo,
      total_refunded: wallet.total_refunded + input.tokenAmount,
    })
    .eq("user_id", input.userId);
  if (walletErr) throw new TokenError("WALLET_UPDATE_FAILED", walletErr.message);

  await admin.from("token_ledger").insert({
    user_id: input.userId,
    entry_type: "ai_refund",
    delta: input.tokenAmount,
    paid_delta: 0,
    promo_delta: input.tokenAmount,
    balance_after: newBalance,
    source_type: "ai_action",
    source_id: input.chargeIntentId ?? null,
    idempotency_key: input.idempotencyKey,
    reason_ko: input.reasonKo,
    metadata: input.metadata ?? {},
  });

  // intent가 있으면 status 갱신
  if (input.chargeIntentId) {
    await admin
      .from("token_charge_intents")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", input.chargeIntentId);
  }

  return { balanceAfter: newBalance, idempotent: false };
}

/**
 * 현재 잔액 + 가용 + 잠금 조회.
 */
export async function getTokenBalance(userId: string): Promise<{
  balance: number;
  paidBalance: number;
  promoBalance: number;
  lockedBalance: number;
  available: number;
}> {
  const wallet = await ensureWallet(userId);
  return {
    balance: wallet.balance,
    paidBalance: wallet.paid_balance,
    promoBalance: wallet.promo_balance,
    lockedBalance: wallet.locked_balance,
    available: availableOf(wallet),
  };
}
