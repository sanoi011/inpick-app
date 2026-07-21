import { checkoutTossPay } from "../toss-bridge.js";

type CreatePaymentResult = {
  payToken?: string;
  orderNo?: string;
  amount?: number;
  testMode?: boolean;
  error?: string;
  hint?: string;
};

export type AppsInTossPurchaseResult = {
  ok: boolean;
  cancelled?: boolean;
  paid?: boolean;
  testMode?: boolean;
  provisioned?: boolean;
  creditsAdded?: number;
  balanceAfter?: number;
  entitlementId?: string;
  message?: string;
  error?: string;
};

function messageOf(payload: { error?: string; hint?: string }, fallback: string) {
  if (payload.hint) return payload.hint;
  switch (payload.error) {
    case "TOSS_PAYMENT_IDENTITY_MISSING":
    case "TOSS_PAYMENT_IDENTITY_INVALID":
      return "토스 계정 연결을 갱신한 뒤 다시 결제해 주세요.";
    case "MTLS_NOT_CONFIGURED":
      return "앱인토스 결제 서버 인증서 설정이 필요합니다.";
    case "TOSS_PAY_API_FAILED":
      return "앱인토스 페이 청약 및 콘솔 키 설정을 확인해 주세요.";
    case "PRODUCT_NOT_AVAILABLE":
      return "현재 구매할 수 없는 상품입니다.";
    default:
      return payload.error || fallback;
  }
}

export async function purchaseWithAppsInTossPay(input: {
  productCode: string;
  projectId?: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
  returnPath?: string;
}): Promise<AppsInTossPurchaseResult> {
  const createdResponse = await fetch("/api/apps-in-toss/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const created = (await createdResponse.json().catch(() => ({}))) as CreatePaymentResult;
  if (!createdResponse.ok || !created.payToken || !created.orderNo) {
    throw new Error(messageOf(created, "앱인토스 페이 결제를 생성하지 못했습니다."));
  }

  const authenticated = await checkoutTossPay(created.payToken);
  if (!authenticated.success) {
    const reason = authenticated.reason || "결제 인증을 완료하지 못했습니다.";
    return {
      ok: false,
      cancelled: /cancel|close|취소|닫/i.test(reason),
      error: reason,
    };
  }

  const executedResponse = await fetch("/api/apps-in-toss/payments/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payToken: created.payToken, orderNo: created.orderNo }),
  });
  const executed = (await executedResponse.json().catch(() => ({}))) as {
    success?: boolean;
    provisioned?: boolean;
    testMode?: boolean;
    creditsAdded?: number;
    balanceAfter?: number;
    entitlementId?: string;
    message?: string;
    warning?: string;
    error?: string;
    hint?: string;
  };
  if (!executedResponse.ok || !executed.success) {
    throw new Error(messageOf(executed, "앱인토스 페이 결제 승인에 실패했습니다."));
  }

  if (executed.testMode) {
    return {
      ok: true,
      testMode: true,
      provisioned: false,
      message:
        executed.message ||
        "샌드박스 결제 인증 테스트가 완료됐습니다. 실제 결제와 상품 지급은 없습니다.",
    };
  }
  if (!executed.provisioned) {
    return {
      ok: false,
      paid: true,
      provisioned: false,
      error:
        executed.warning ||
        "결제는 완료됐지만 상품 지급 확인이 필요합니다. 고객센터에서 확인해 드립니다.",
    };
  }

  return {
    ok: true,
    paid: true,
    provisioned: true,
    creditsAdded: executed.creditsAdded,
    balanceAfter: executed.balanceAfter,
    entitlementId: executed.entitlementId,
  };
}
