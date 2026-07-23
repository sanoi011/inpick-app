import { Agent, fetch as undiciFetch } from "undici";

const APPS_IN_TOSS_API_ORIGIN = "https://apps-in-toss-api.toss.im";
const ORDER_STATUS_PATH =
  "/api-partner/v1/apps-in-toss/order/get-order-status";

type TossResult<T> =
  | { resultType: "SUCCESS"; success: T }
  | {
      resultType:
        | "FAIL"
        | "HTTP_TIMEOUT"
        | "NETWORK_ERROR"
        | "EXECUTION_FAIL"
        | "INTERRUPTED"
        | "INTERNAL_ERROR";
      error?: {
        errorCode?: string;
        code?: string;
        reason?: string;
        message?: string;
      };
    };

export type AppsInTossIapOrderStatus =
  | "PURCHASED"
  | "PAYMENT_COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "ORDER_IN_PROGRESS"
  | "NOT_FOUND"
  | "MINIAPP_MISMATCH"
  | "ERROR";

export type AppsInTossIapOrder = {
  orderId: string;
  sku: string;
  statusDeterminedAt: string;
  status: AppsInTossIapOrderStatus;
  reason?: string;
};

export class AppsInTossIapError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "AppsInTossIapError";
  }
}

function pem(name: string): string {
  return (process.env[name] || "").replace(/\\n/g, "\n").trim();
}

export function isAppsInTossOrderId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isAppsInTossSku(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,200}$/.test(value);
}

export function isGrantableAppsInTossIapStatus(
  status: AppsInTossIapOrderStatus,
): boolean {
  return status === "PAYMENT_COMPLETED" || status === "PURCHASED";
}

export async function getAppsInTossIapOrderStatus(input: {
  orderId: string;
  tossUserKey: string;
}): Promise<AppsInTossIapOrder> {
  const cert = pem("APPS_IN_TOSS_MTLS_CERT");
  const key = pem("APPS_IN_TOSS_MTLS_KEY");
  const ca = pem("APPS_IN_TOSS_MTLS_CA");
  if (!cert || !key) {
    throw new AppsInTossIapError(
      "IAP_MTLS_NOT_CONFIGURED",
      "앱인토스 인앱결제 서버 인증서가 설정되지 않았습니다.",
      503,
    );
  }

  const dispatcher = new Agent({
    connect: { cert, key, ...(ca ? { ca } : {}), rejectUnauthorized: true },
  });
  try {
    const response = await undiciFetch(
      `${APPS_IN_TOSS_API_ORIGIN}${ORDER_STATUS_PATH}`,
      {
        method: "POST",
        dispatcher,
        signal: AbortSignal.timeout(10_000),
        headers: {
          "Content-Type": "application/json",
          "x-toss-user-key": input.tossUserKey,
        },
        body: JSON.stringify({ orderId: input.orderId }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TossResult<AppsInTossIapOrder>
      | null;
    if (!response.ok || !payload || payload.resultType !== "SUCCESS") {
      const error = payload && "error" in payload ? payload.error : null;
      throw new AppsInTossIapError(
        error?.errorCode || error?.code || "IAP_ORDER_STATUS_FAILED",
        error?.reason ||
          error?.message ||
          "앱인토스 인앱결제 주문 상태를 확인하지 못했습니다.",
        response.status >= 400 && response.status < 500 ? 400 : 502,
      );
    }

    const order = payload.success;
    if (
      !order ||
      !isAppsInTossOrderId(String(order.orderId || "")) ||
      !isAppsInTossSku(String(order.sku || "")) ||
      typeof order.status !== "string"
    ) {
      throw new AppsInTossIapError(
        "IAP_ORDER_STATUS_INVALID",
        "앱인토스 주문 상태 응답 형식이 올바르지 않습니다.",
      );
    }
    return order;
  } finally {
    await dispatcher.close().catch(() => undefined);
  }
}
