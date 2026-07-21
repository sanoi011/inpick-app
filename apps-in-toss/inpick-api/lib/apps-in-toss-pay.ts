import type { VercelRequest } from "@vercel/node";
import { Agent, fetch as undiciFetch } from "undici";
import { openTossUserKey } from "./toss-user.js";
import { createAdminClient } from "./supabase-admin.js";

const TOSS_PAY_API_ORIGIN = "https://pay-apps-in-toss-api.toss.im";

type TossResult<T> =
  | { resultType: "SUCCESS"; success: T }
  | {
      resultType: "FAIL";
      error: { errorCode?: string; code?: string; reason?: string; message?: string };
    };

export class AppsInTossPayError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "AppsInTossPayError";
  }
}

function pem(name: string): string {
  return (process.env[name] || "").replace(/\\n/g, "\n").trim();
}

export async function getAppsInTossPaymentContext(request: VercelRequest) {
  const authorization = request.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    throw new AppsInTossPayError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const admin = createAdminClient();
  const result = await admin.auth.getUser(accessToken);
  if (result.error || !result.data.user) {
    throw new AppsInTossPayError("UNAUTHENTICATED", "로그인 세션이 만료됐습니다.", 401);
  }

  const user = result.data.user;
  const sealed = String(user.app_metadata?.toss_user_key_sealed || "");
  const secret =
    process.env.APPS_IN_TOSS_USER_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!sealed || !secret) {
    throw new AppsInTossPayError(
      "TOSS_PAYMENT_IDENTITY_MISSING",
      "토스 계정을 다시 연결해 주세요.",
      409,
    );
  }

  let tossUserKey: string;
  try {
    tossUserKey = openTossUserKey(sealed, secret);
  } catch {
    throw new AppsInTossPayError(
      "TOSS_PAYMENT_IDENTITY_INVALID",
      "토스 계정을 다시 연결해 주세요.",
      409,
    );
  }

  return {
    admin,
    user,
    tossUserKey,
    isTestPayment: user.app_metadata?.toss_login_referrer === "SANDBOX",
  };
}

export async function requestAppsInTossPay<T>(input: {
  path: string;
  tossUserKey: string;
  body: Record<string, unknown>;
}): Promise<T> {
  const cert = pem("APPS_IN_TOSS_MTLS_CERT");
  const key = pem("APPS_IN_TOSS_MTLS_KEY");
  const ca = pem("APPS_IN_TOSS_MTLS_CA");
  if (!cert || !key) {
    throw new AppsInTossPayError(
      "MTLS_NOT_CONFIGURED",
      "앱인토스 결제 서버 인증서가 설정되지 않았습니다.",
      503,
    );
  }

  const dispatcher = new Agent({
    connect: { cert, key, ...(ca ? { ca } : {}), rejectUnauthorized: true },
  });
  try {
    const response = await undiciFetch(`${TOSS_PAY_API_ORIGIN}${input.path}`, {
      method: "POST",
      dispatcher,
      headers: {
        "Content-Type": "application/json",
        "x-toss-user-key": input.tossUserKey,
      },
      body: JSON.stringify(input.body),
    });
    const payload = (await response.json().catch(() => null)) as TossResult<T> | null;
    if (!response.ok || !payload || payload.resultType !== "SUCCESS") {
      const error = payload?.resultType === "FAIL" ? payload.error : null;
      throw new AppsInTossPayError(
        error?.errorCode || error?.code || "TOSS_PAY_API_FAILED",
        error?.reason || error?.message || "앱인토스 페이 요청에 실패했습니다.",
        response.status >= 400 && response.status < 500 ? 400 : 502,
      );
    }
    return payload.success;
  } finally {
    await dispatcher.close().catch(() => undefined);
  }
}
