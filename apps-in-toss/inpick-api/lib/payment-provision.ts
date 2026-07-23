import type { AdminClient } from "./supabase-admin.js";

export type ProvisionProduct = {
  code: string;
  productType: string;
  nameKo: string;
  paidCredits: number;
  bonusCredits: number;
};

type WalletRow = {
  balance: number;
  paid_balance: number;
  promo_balance: number;
  total_purchased: number;
};

async function creditTokens(input: {
  admin: AdminClient;
  userId: string;
  paymentId: string;
  product: ProvisionProduct;
  channel?: "apps_in_toss_pay" | "apps_in_toss_iap";
}) {
  const channel = input.channel || "apps_in_toss_pay";
  const channelLabel =
    channel === "apps_in_toss_iap" ? "앱인토스 인앱결제" : "앱인토스 페이";
  const marker = `payment:${input.paymentId}:credit`;
  const existing = await input.admin
    .from("token_ledger")
    .select("balance_after")
    .eq("idempotency_key", marker)
    .maybeSingle();
  if (existing.data) {
    return {
      creditsAdded: 0,
      balanceAfter: Number(existing.data.balance_after || 0),
      idempotent: true,
    };
  }

  let walletResult = await input.admin
    .from("token_wallets")
    .select("balance, paid_balance, promo_balance, total_purchased")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (walletResult.error) throw walletResult.error;
  if (!walletResult.data) {
    const inserted = await input.admin
      .from("token_wallets")
      .insert({ user_id: input.userId })
      .select("balance, paid_balance, promo_balance, total_purchased")
      .single();
    if (inserted.error || !inserted.data) {
      throw inserted.error || new Error("WALLET_CREATE_FAILED");
    }
    walletResult = inserted;
  }

  const wallet = walletResult.data as WalletRow;
  const paidCredits = Math.max(0, input.product.paidCredits);
  const bonusCredits = Math.max(0, input.product.bonusCredits);
  const paidBalance = wallet.paid_balance + paidCredits;
  const promoBalance = wallet.promo_balance + bonusCredits;
  const balance = paidBalance + promoBalance;

  const paidLedger = await input.admin
    .from("token_ledger")
    .insert({
      user_id: input.userId,
      entry_type: "purchase_credit",
      delta: paidCredits,
      paid_delta: paidCredits,
      promo_delta: 0,
      balance_after: wallet.balance + paidCredits,
      source_type: "payment",
      source_id: input.paymentId,
      idempotency_key: marker,
      reason_ko: `${input.product.nameKo} 구매 (${channelLabel})`,
      metadata: { productCode: input.product.code, channel },
    })
    .select("id")
    .single();
  if (paidLedger.error) {
    if (/idempotency_key|duplicate/i.test(paidLedger.error.message)) {
      const duplicate = await input.admin
        .from("token_ledger")
        .select("balance_after")
        .eq("idempotency_key", marker)
        .single();
      return {
        creditsAdded: 0,
        balanceAfter: Number(duplicate.data?.balance_after || wallet.balance),
        idempotent: true,
      };
    }
    throw paidLedger.error;
  }

  if (bonusCredits > 0) {
    const bonusLedger = await input.admin.from("token_ledger").insert({
      user_id: input.userId,
      entry_type: "bonus_credit",
      delta: bonusCredits,
      paid_delta: 0,
      promo_delta: bonusCredits,
      balance_after: balance,
      source_type: "payment",
      source_id: input.paymentId,
      idempotency_key: `payment:${input.paymentId}:bonus`,
      reason_ko: `${input.product.code} 보너스`,
      metadata: { productCode: input.product.code, channel },
    });
    if (bonusLedger.error && !/idempotency_key|duplicate/i.test(bonusLedger.error.message)) {
      throw bonusLedger.error;
    }
  }

  const walletUpdate = await input.admin
    .from("token_wallets")
    .update({
      balance,
      paid_balance: paidBalance,
      promo_balance: promoBalance,
      total_purchased: wallet.total_purchased + paidCredits + bonusCredits,
    })
    .eq("user_id", input.userId);
  if (walletUpdate.error) throw walletUpdate.error;

  const liveMarker = `payment:${input.paymentId}`;
  const mirrored = await input.admin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", input.userId)
    .like("description", `%${liveMarker}%`)
    .limit(1);
  if (!mirrored.data?.length) {
    const current = await input.admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", input.userId)
      .maybeSingle();
    const nextBalance = Number(current.data?.balance || 0) + paidCredits + bonusCredits;
    const creditWrite = current.data
      ? await input.admin
          .from("user_credits")
          .update({ balance: nextBalance })
          .eq("user_id", input.userId)
      : await input.admin
          .from("user_credits")
          .insert({ user_id: input.userId, balance: nextBalance });
    if (creditWrite.error) throw creditWrite.error;
    const transaction = await input.admin.from("credit_transactions").insert({
      user_id: input.userId,
      type: "CHARGE",
      amount: paidCredits + bonusCredits,
      description: `토큰 충전 (${liveMarker}, ${channel.replaceAll("_", "-")})`,
    });
    if (transaction.error) throw transaction.error;
  }

  return {
    creditsAdded: paidCredits + bonusCredits,
    balanceAfter: balance,
    idempotent: false,
  };
}

async function grantEstimatePdf(input: {
  admin: AdminClient;
  userId: string;
  paymentId: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
  channel?: "apps_in_toss_pay" | "apps_in_toss_iap";
}) {
  const channel = input.channel || "apps_in_toss_pay";
  const existing = await input.admin
    .from("user_entitlements")
    .select("id")
    .eq("source", "payment")
    .eq("source_id", input.paymentId)
    .eq("entitlement_type", "estimate_pdf_single")
    .maybeSingle();
  if (existing.data) return { entitlementId: existing.data.id };

  const scopeType = input.estimateId
    ? "estimate"
    : input.consumerProjectId
      ? "project"
      : null;
  const scopeId = input.estimateId || input.consumerProjectId || null;
  const inserted = await input.admin
    .from("user_entitlements")
    .insert({
      user_id: input.userId,
      entitlement_type: "estimate_pdf_single",
      source: "payment",
      source_id: input.paymentId,
      scope_type: scopeType,
      scope_id: scopeId,
      metadata: {
        granted_via: "estimate_pdf_purchase",
        channel,
      },
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) {
    throw inserted.error || new Error("ENTITLEMENT_CREATE_FAILED");
  }
  return { entitlementId: inserted.data.id };
}

export async function provisionAppsInTossPayment(input: {
  admin: AdminClient;
  userId: string;
  paymentId: string;
  product: ProvisionProduct;
  estimateId?: string | null;
  consumerProjectId?: string | null;
  channel?: "apps_in_toss_pay" | "apps_in_toss_iap";
}) {
  if (["token_pack", "ai_credit_pack"].includes(input.product.productType)) {
    return {
      kind: "tokens" as const,
      ...(await creditTokens(input)),
    };
  }
  if (["pdf_estimate_single", "pdf_entitlement"].includes(input.product.productType)) {
    return {
      kind: "estimate_pdf" as const,
      ...(await grantEstimatePdf(input)),
    };
  }
  throw new Error(`UNSUPPORTED_PRODUCT_TYPE:${input.product.productType}`);
}
