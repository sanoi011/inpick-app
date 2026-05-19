/**
 * finalizePaymentProvisioning — 결제 성공 후 단일 권한 지급 함수.
 * 가이드: inpick-payment-saas-flow-uiux-improvement-plan-20260514.md §6-4, §11 P3
 *
 * 원칙:
 *   * confirm 라우트와 webhook 라우트가 모두 이 함수를 호출
 *   * 한 paymentIntent는 정확히 한 번만 provisioning됨 (idempotent)
 *   * product_type에 따라 분기:
 *       'token_pack' / 'ai_credit_pack' → token_wallets credit
 *       'pdf_entitlement' / 'pdf_estimate_single' → user_entitlements issue
 *   * 분기 실패 시 reconciliation_cases 생성
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { creditTokensAfterPayment } from "@/lib/inpick/tokens/ledger";
import { grantEstimatePdfSingleAfterPayment } from "@/lib/inpick/entitlements";

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

export interface FinalizeResult {
  status: "provisioned" | "already_provisioned" | "not_paid" | "missing_product" | "failed";
  paymentIntentId: string;
  productType?: string;
  productCode?: string;
  /** token_pack 결과 */
  creditsAdded?: number;
  balanceAfter?: number;
  /** pdf entitlement 결과 */
  entitlementId?: string;
  /** 실패 시 사유 */
  errorMessage?: string;
}

interface IntentRow {
  id: string;
  user_id: string;
  amount_krw: number;
  status: string;
  project_id: string | null;
  metadata: Record<string, unknown>;
  product_type?: string;
  // 20260519: checkout 시점의 고정 snapshot — finalize는 이 값 우선 사용
  product_snapshot?: {
    productId: string;
    productDbId?: string;
    productType: string;
    displayName: string;
    amountKrw: number;
    tokenAmount?: number | null;
    bonusTokenAmount?: number | null;
    totalTokenAmount?: number | null;
    pricingVersionId?: string | null;
    capturedAt?: string;
  } | null;
  pricing_version_id?: string | null;
  token_amount?: number | null;
  bonus_token_amount?: number | null;
  product:
    | {
        code: string;
        product_type: string;
        credit_amount: number;
        bonus_credit_amount: number;
        name_ko: string;
        amount_krw: number;
      }
    | Array<{
        code: string;
        product_type: string;
        credit_amount: number;
        bonus_credit_amount: number;
        name_ko: string;
        amount_krw: number;
      }>
    | null;
}

/**
 * 핵심 — paymentIntentId 기준 권한 지급 (confirm/webhook 공용).
 *
 * 호출 흐름:
 *   1. payment_intent 조회 (product join)
 *   2. status 검증 (paid 또는 confirming만)
 *   3. 이미 provisioned이면 idempotent 반환
 *   4. product_type 분기
 *   5. 실패 시 reconciliation_cases INSERT
 */
export async function finalizePaymentProvisioning(
  paymentIntentId: string,
  paymentDbId?: string,
): Promise<FinalizeResult> {
  const admin = getAdmin();
  if (!admin) {
    return {
      status: "failed",
      paymentIntentId,
      errorMessage: "service role not configured",
    };
  }

  // 1) intent + product 조회
  const { data: intentData } = await admin
    .from("payment_intents")
    .select("*, product:payment_products(*)")
    .eq("id", paymentIntentId)
    .maybeSingle();
  if (!intentData) {
    return {
      status: "failed",
      paymentIntentId,
      errorMessage: "payment_intent not found",
    };
  }

  const raw = intentData as IntentRow;
  // 20260519: snapshot 우선 (가격 변경이 과거 결제에 영향 X)
  //   - product_snapshot 있으면 그 값을 신뢰
  //   - 없으면 payment_products 현재값 fallback (legacy intent)
  const snapshot = raw.product_snapshot ?? null;
  const productJoin = Array.isArray(raw.product) ? raw.product[0] ?? null : raw.product;

  // 통합 view — snapshot 우선, 없으면 join 값
  const product: {
    code: string;
    product_type: string;
    credit_amount: number;
    bonus_credit_amount: number;
    name_ko: string;
    amount_krw: number;
  } | null = snapshot
    ? {
        code: snapshot.productId,
        product_type: snapshot.productType,
        credit_amount: snapshot.tokenAmount ?? 0,
        bonus_credit_amount: snapshot.bonusTokenAmount ?? 0,
        name_ko: snapshot.displayName,
        amount_krw: snapshot.amountKrw,
      }
    : productJoin;

  if (!product) {
    await admin.from("reconciliation_cases").insert({
      case_type: "payment_paid_provision_failed",
      severity: "critical",
      user_id: raw.user_id,
      payment_intent_id: raw.id,
      description: "payment_intent에 product snapshot도 join도 없음 — 수동 확인 필요",
      detected_payload: { intent: raw },
    });
    return {
      status: "missing_product",
      paymentIntentId,
      errorMessage: "product missing on intent (no snapshot, no join)",
    };
  }

  // 2) status 검증
  // confirm 직후엔 status='confirming' 또는 'paid'
  // webhook DONE 도착 시점에 status='paid' 또는 'provisioned'
  if (raw.status === "provisioned") {
    // 3) 이미 provisioned
    return {
      status: "already_provisioned",
      paymentIntentId,
      productType: product.product_type,
      productCode: product.code,
    };
  }
  if (raw.status !== "paid" && raw.status !== "confirming") {
    return {
      status: "not_paid",
      paymentIntentId,
      errorMessage: `intent status=${raw.status}`,
    };
  }

  // 4) 사용할 payment_db_id 확보 (없으면 payments 테이블에서 조회)
  let paymentId = paymentDbId;
  if (!paymentId) {
    const { data: pay } = await admin
      .from("payments")
      .select("id")
      .eq("payment_intent_id", raw.id)
      .maybeSingle();
    paymentId = (pay as { id: string } | null)?.id;
  }
  if (!paymentId) {
    // payments row 없음 → 보정 필요
    await admin.from("reconciliation_cases").insert({
      case_type: "payment_paid_provision_failed",
      severity: "high",
      user_id: raw.user_id,
      payment_intent_id: raw.id,
      description: "payment_intent='paid' 인데 payments row 없음",
      detected_payload: { intent: raw },
    });
    return {
      status: "failed",
      paymentIntentId,
      errorMessage: "payments row missing",
    };
  }

  // 5) product_type 분기
  try {
    const ptype = product.product_type;
    if (
      ptype === "token_pack" ||
      ptype === "ai_credit_pack"
    ) {
      const credit = await creditTokensAfterPayment({
        userId: raw.user_id,
        paymentId,
        productCode: product.code,
        paidCredits: product.credit_amount,
        bonusCredits: product.bonus_credit_amount,
        reasonKo: `${product.name_ko} 구매`,
      });
      // intent 상태 → 'provisioned'
      await admin
        .from("payment_intents")
        .update({ status: "provisioned" })
        .eq("id", raw.id);
      return {
        status: "provisioned",
        paymentIntentId,
        productType: ptype,
        productCode: product.code,
        creditsAdded: product.credit_amount + product.bonus_credit_amount,
        balanceAfter: credit.balanceAfter,
      };
    }

    if (ptype === "pdf_entitlement" || ptype === "pdf_estimate_single") {
      const meta = (raw.metadata ?? {}) as {
        estimateId?: string;
        consumerProjectId?: string;
      };
      const grant = await grantEstimatePdfSingleAfterPayment({
        userId: raw.user_id,
        paymentId,
        estimateId: meta.estimateId ?? null,
        consumerProjectId: meta.consumerProjectId ?? raw.project_id ?? null,
      });
      await admin
        .from("payment_intents")
        .update({ status: "provisioned" })
        .eq("id", raw.id);
      return {
        status: "provisioned",
        paymentIntentId,
        productType: ptype,
        productCode: product.code,
        entitlementId: grant.entitlementId,
      };
    }

    // 알 수 없는 product_type
    await admin.from("reconciliation_cases").insert({
      case_type: "payment_paid_provision_failed",
      severity: "high",
      user_id: raw.user_id,
      payment_intent_id: raw.id,
      description: `알 수 없는 product_type=${ptype}`,
      detected_payload: { productType: ptype, productCode: product.code },
    });
    return {
      status: "failed",
      paymentIntentId,
      productType: ptype,
      productCode: product.code,
      errorMessage: `unknown product_type ${ptype}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await admin.from("reconciliation_cases").insert({
      case_type: "payment_paid_provision_failed",
      severity: "critical",
      user_id: raw.user_id,
      payment_intent_id: raw.id,
      description: `provisioning 실패: ${msg}`,
      detected_payload: { error: msg, productCode: product.code },
    });
    return {
      status: "failed",
      paymentIntentId,
      productType: product.product_type,
      productCode: product.code,
      errorMessage: msg,
    };
  }
}

/**
 * amount mismatch 시 reconciliation_cases 생성 + 차단.
 * confirm 라우트에서 server amount vs client amount 비교 시 사용.
 */
export async function recordAmountMismatch(input: {
  paymentIntentId: string;
  userId: string;
  serverAmount: number;
  clientAmount: number;
  orderId: string;
  paymentKey?: string;
}): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  await admin.from("reconciliation_cases").insert({
    case_type: "amount_mismatch_blocked",
    severity: "critical",
    user_id: input.userId,
    payment_intent_id: input.paymentIntentId,
    description: `클라이언트 amount=${input.clientAmount} vs 서버 amount=${input.serverAmount}`,
    detected_payload: {
      serverAmount: input.serverAmount,
      clientAmount: input.clientAmount,
      orderId: input.orderId,
      paymentKey: input.paymentKey,
    },
  });
}
