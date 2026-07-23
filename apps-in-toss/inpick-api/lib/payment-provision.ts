import type { AdminClient } from "./supabase-admin.js";

export type ProvisionProduct = {
  code: string;
  productType: string;
  nameKo: string;
  paidCredits: number;
  bonusCredits: number;
};

type TokenProvisionRpcResult = {
  creditsAdded?: number;
  balanceAfter?: number;
  idempotent?: boolean;
};

type PdfProvisionRpcResult = {
  entitlementId?: string;
  idempotent?: boolean;
};

async function creditTokens(input: {
  admin: AdminClient;
  userId: string;
  paymentId: string;
  product: ProvisionProduct;
  channel?: "apps_in_toss_pay" | "apps_in_toss_iap";
}) {
  const channel = input.channel || "apps_in_toss_pay";
  const result = await input.admin.rpc("provision_apps_in_toss_tokens_v1", {
    p_user_id: input.userId,
    p_payment_id: input.paymentId,
    p_product_code: input.product.code,
    p_product_name_ko: input.product.nameKo,
    p_paid_credits: input.product.paidCredits,
    p_bonus_credits: input.product.bonusCredits,
    p_channel: channel,
  });
  if (result.error) throw result.error;

  const provisioned = result.data as TokenProvisionRpcResult | null;
  if (
    !provisioned ||
    !Number.isFinite(Number(provisioned.creditsAdded)) ||
    !Number.isFinite(Number(provisioned.balanceAfter))
  ) {
    throw new Error("INVALID_TOKEN_PROVISION_RESULT");
  }
  return {
    creditsAdded: Number(provisioned.creditsAdded),
    balanceAfter: Number(provisioned.balanceAfter),
    idempotent: provisioned.idempotent === true,
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
  const result = await input.admin.rpc("provision_apps_in_toss_pdf_v1", {
    p_user_id: input.userId,
    p_payment_id: input.paymentId,
    p_estimate_id: input.estimateId || null,
    p_consumer_project_id: input.consumerProjectId || null,
    p_channel: channel,
  });
  if (result.error) throw result.error;

  const provisioned = result.data as PdfProvisionRpcResult | null;
  if (!provisioned?.entitlementId) {
    throw new Error("INVALID_PDF_PROVISION_RESULT");
  }
  return {
    entitlementId: provisioned.entitlementId,
    idempotent: provisioned.idempotent === true,
  };
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
