import {
  completeIapProductGrant,
  createIapOneTimePurchaseOrder,
  getCompletedOrRefundedIapOrders,
  getIapProductItemList,
  getPendingIapOrders,
  type IapProductListItem,
  type IapPurchaseSuccess,
} from "../toss-bridge.js";

type CatalogResponse = {
  pricing: { imageGenerationTokenCost: number } | null;
  products: Array<{
    productId: string;
    productType: string;
    displayName: string;
    description: string | null;
    amountKrw: number;
    tokenAmount: number;
    bonusTokenAmount: number;
    totalTokenAmount: number;
    isPopular: boolean;
    sku: string;
    iapProductType: string;
  }>;
  error?: string;
  hint?: string;
};

export type AppsInTossIapCatalogProduct = CatalogResponse["products"][number] & {
  displayName: string;
  description: string | null;
  displayAmount: string;
  iconUrl: string;
};

export type AppsInTossIapCatalog = {
  pricing: CatalogResponse["pricing"];
  products: AppsInTossIapCatalogProduct[];
};

type GrantResponse = {
  success?: boolean;
  provisioned?: boolean;
  duplicate?: boolean;
  paymentId?: string;
  kind?: "tokens" | "estimate_pdf";
  creditsAdded?: number;
  balanceAfter?: number;
  entitlementId?: string;
  error?: string;
  hint?: string;
};

export type AppsInTossIapPurchaseResult = {
  ok: boolean;
  cancelled?: boolean;
  paid?: boolean;
  provisioned?: boolean;
  creditsAdded?: number;
  balanceAfter?: number;
  entitlementId?: string;
  order?: IapPurchaseSuccess;
  message?: string;
  error?: string;
};

function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    for (const key of ["errorCode", "code", "name"] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return "";
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    for (const key of ["reason", "message"] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return String(error || "");
}

function messageForIapError(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case "INVALID_PRODUCT_ID":
      return "등록된 인앱 상품을 찾지 못했습니다. 콘솔 SKU를 확인해 주세요.";
    case "PAYMENT_PENDING":
      return "처리 중인 결제가 있습니다. 잠시 후 앱을 다시 열어 주세요.";
    case "NETWORK_ERROR":
      return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    case "INVALID_USER_ENVIRONMENT":
      return "현재 기기 또는 계정에서는 이 상품을 구매할 수 없습니다.";
    case "ITEM_ALREADY_OWNED":
      return "이미 처리 중인 상품입니다. 구매 복구를 진행해 주세요.";
    case "APP_MARKET_VERIFICATION_FAILED":
      return "앱마켓 결제 정보 확인에 실패했습니다.";
    case "TOSS_SERVER_VERIFICATION_FAILED":
      return "토스 서버에서 결제 정보를 저장하지 못했습니다.";
    case "KOREAN_ACCOUNT_ONLY":
      return "한국 앱마켓 계정에서만 구매할 수 있습니다.";
    case "PRODUCT_NOT_GRANTED_BY_PARTNER":
      return "결제는 완료됐지만 상품 지급이 지연되고 있습니다. 앱을 다시 열면 자동 복구합니다.";
    case "USER_CANCELED":
      return "결제가 취소되었습니다.";
    default:
      return errorText(error) || "인앱결제를 완료하지 못했습니다.";
  }
}

function isCancelled(error: unknown): boolean {
  return (
    errorCode(error) === "USER_CANCELED" ||
    /cancel|close|취소|닫/i.test(errorText(error))
  );
}

async function postGrant(input: {
  orderId: string;
  sku: string;
  projectId?: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
}): Promise<GrantResponse> {
  const response = await fetch("/api/apps-in-toss/iap/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as GrantResponse;
  if (!response.ok || !payload.success || !payload.provisioned) {
    return {
      ...payload,
      success: false,
      provisioned: false,
      error: payload.hint || payload.error || "IAP_PRODUCT_GRANT_FAILED",
    };
  }
  return payload;
}

export async function loadAppsInTossIapCatalog(): Promise<AppsInTossIapCatalog> {
  const [catalogResponse, consoleCatalog] = await Promise.all([
    fetch("/api/apps-in-toss/iap/catalog", { cache: "no-store" }),
    getIapProductItemList(),
  ]);
  const catalog = (await catalogResponse.json().catch(() => ({}))) as CatalogResponse;
  if (!catalogResponse.ok) {
    throw new Error(
      catalog.hint || catalog.error || "인앱결제 상품 정보를 불러오지 못했습니다.",
    );
  }
  if (!consoleCatalog) {
    throw new Error(
      "인앱결제를 지원하는 최신 토스 앱으로 업데이트한 뒤 다시 시도해 주세요.",
    );
  }

  const bySku = new Map<string, IapProductListItem>(
    consoleCatalog.products.map((product) => [product.sku, product]),
  );
  const products = catalog.products.flatMap((product) => {
    const consoleProduct = bySku.get(product.sku);
    if (
      !consoleProduct ||
      consoleProduct.type === "SUBSCRIPTION" ||
      consoleProduct.type !== product.iapProductType
    ) {
      return [];
    }
    return [
      {
        ...product,
        displayName: consoleProduct.displayName || product.displayName,
        description: consoleProduct.description || product.description,
        displayAmount:
          consoleProduct.displayAmount || `${product.amountKrw.toLocaleString()}원`,
        iconUrl: consoleProduct.iconUrl || "/iap/inpick-token-1024.png",
      },
    ];
  });
  if (catalog.products.length > 0 && products.length === 0) {
    throw new Error(
      "서버에 연결한 SKU가 앱인토스 콘솔의 노출 상품과 일치하지 않습니다.",
    );
  }

  return { pricing: catalog.pricing, products };
}

export async function purchaseWithAppsInTossIap(input: {
  productCode: string;
  sku: string;
  projectId?: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
}): Promise<AppsInTossIapPurchaseResult> {
  return new Promise((resolve) => {
    let cleanup: (() => void) | undefined;
    let settled = false;
    let grantResult: GrantResponse | null = null;

    const timeout = window.setTimeout(() => {
      finish({
        ok: false,
        error: "결제 응답 대기 시간이 길어졌습니다. 앱을 다시 열면 구매 내역을 자동 복구합니다.",
      });
    }, 10 * 60 * 1_000);

    const finish = (result: AppsInTossIapPurchaseResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      try {
        cleanup?.();
      } finally {
        resolve(result);
      }
    };

    try {
      cleanup = createIapOneTimePurchaseOrder({
        options: {
          sku: input.sku,
          processProductGrant: async ({ orderId }) => {
            grantResult = await postGrant({
              orderId,
              sku: input.sku,
              projectId: input.projectId,
              estimateId: input.estimateId,
              consumerProjectId: input.consumerProjectId,
            });
            return grantResult.success === true && grantResult.provisioned === true;
          },
        },
        onEvent: (event) => {
          if (grantResult?.success && grantResult.provisioned) {
            finish({
              ok: true,
              paid: true,
              provisioned: true,
              creditsAdded: grantResult.creditsAdded,
              balanceAfter: grantResult.balanceAfter,
              entitlementId: grantResult.entitlementId,
              order: event.data,
            });
            return;
          }
          finish({
            ok: false,
            paid: true,
            provisioned: false,
            order: event.data,
            error:
              grantResult?.error ||
              "결제는 완료됐지만 상품 지급이 지연되고 있습니다. 앱을 다시 열면 자동 복구합니다.",
          });
        },
        onError: (error) => {
          finish({
            ok: false,
            cancelled: isCancelled(error),
            paid:
              errorCode(error) === "PRODUCT_NOT_GRANTED_BY_PARTNER" ||
              grantResult?.provisioned === false,
            provisioned: grantResult?.provisioned,
            error: messageForIapError(error),
          });
        },
      });
    } catch (error) {
      finish({
        ok: false,
        cancelled: isCancelled(error),
        error: messageForIapError(error),
      });
    }
  });
}

type RestoreResult = {
  restored: number;
  failed: number;
  unsupported: boolean;
  refundsReported: number;
};

let restoreTask: Promise<RestoreResult> | null = null;

async function runPendingAppsInTossPurchaseRestore(): Promise<RestoreResult> {
  const pending = await getPendingIapOrders();
  if (!pending) {
    return { restored: 0, failed: 0, unsupported: true, refundsReported: 0 };
  }

  let restored = 0;
  let failed = 0;
  for (const order of pending.orders) {
    try {
      const result = await postGrant({
        orderId: order.orderId,
        sku: order.sku,
      });
      if (!result.success || !result.provisioned) {
        failed += 1;
        continue;
      }
      await completeIapProductGrant(order.orderId);
      restored += 1;
    } catch {
      failed += 1;
    }
  }
  let refundsReported = 0;
  try {
    const refundedOrderIds: string[] = [];
    let key: string | null | undefined = null;
    for (let page = 0; page < 10; page += 1) {
      const history = await getCompletedOrRefundedIapOrders(key);
      if (!history) break;
      refundedOrderIds.push(
        ...history.orders
          .filter((order) => order.status === "REFUNDED")
          .map((order) => order.orderId),
      );
      if (!history.hasNext || !history.nextKey) break;
      key = history.nextKey;
    }
    for (let offset = 0; offset < refundedOrderIds.length; offset += 50) {
      const orderIds = refundedOrderIds.slice(offset, offset + 50);
      const response = await fetch("/api/apps-in-toss/iap/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        refunded?: number;
      };
      if (response.ok) refundsReported += Number(payload.refunded || 0);
    }
  } catch {
    // 환불 정합성은 다음 앱 실행에서 다시 조회한다.
  }
  return { restored, failed, unsupported: false, refundsReported };
}

export function restorePendingAppsInTossPurchases(): Promise<RestoreResult> {
  restoreTask ||= runPendingAppsInTossPurchaseRestore();
  return restoreTask;
}
