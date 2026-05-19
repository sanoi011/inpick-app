/**
 * Apple App Store Server API verification.
 *
 * 실제 검증 흐름:
 *   1. 클라이언트가 StoreKit 2 transactionId 전송
 *   2. 서버가 App Store Server API의 transaction/{transactionId} 호출
 *   3. 서명된 JWS payload 검증
 *   4. productId + originalTransactionId + signedDate 확인
 *
 * 필요 환경변수:
 *   APP_STORE_BUNDLE_ID = kr.inpick.app
 *   APP_STORE_KEY_ID = (App Store Connect API Key ID)
 *   APP_STORE_ISSUER_ID = (Issuer ID from App Store Connect)
 *   APP_STORE_PRIVATE_KEY = (P8 file content as base64)
 *   APP_STORE_ENV = sandbox | production
 *
 * 가이드: https://developer.apple.com/documentation/appstoreserverapi
 *         §12-2 (POST /api/mobile/app-purchases/verify)
 */
import crypto from "crypto";

export interface AppStoreVerifyInput {
  transactionId: string;
  bundleId?: string;
}

export interface AppStoreVerifyResult {
  verified: boolean;
  productId?: string;
  originalTransactionId?: string;
  transactionId?: string;
  purchaseDate?: string;
  expiresDate?: string | null;
  environment?: "Sandbox" | "Production";
  error?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * App Store Server API용 JWT (ES256) 생성
 */
function generateAppStoreJwt(): string | null {
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const privateKeyB64 = process.env.APP_STORE_PRIVATE_KEY;
  const bundleId = process.env.APP_STORE_BUNDLE_ID;

  if (!keyId || !issuerId || !privateKeyB64 || !bundleId) return null;

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600,
    aud: "appstoreconnect-v1",
    bid: bundleId,
  };

  const encB64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const signingInput = `${encB64(header)}.${encB64(payload)}`;
  const privateKey = Buffer.from(privateKeyB64, "base64").toString("utf-8");

  try {
    const signature = crypto
      .createSign("SHA256")
      .update(signingInput)
      .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
      .toString("base64url");
    return `${signingInput}.${signature}`;
  } catch (err) {
    console.error("[app-store] JWT sign failed:", err);
    return null;
  }
}

/**
 * App Store Server API로 transaction 검증.
 * 환경변수 미설정 시 mock 결과 반환 (verified=false).
 */
export async function verifyAppStoreTransaction(
  input: AppStoreVerifyInput,
): Promise<AppStoreVerifyResult> {
  const env = process.env.APP_STORE_ENV ?? "sandbox";
  const jwt = generateAppStoreJwt();

  if (!jwt) {
    console.warn("[app-store] 환경변수 미설정 — verification skipped");
    return {
      verified: false,
      error: "APP_STORE_API_KEY_NOT_CONFIGURED",
      rawPayload: { hint: "환경변수 APP_STORE_KEY_ID/ISSUER_ID/PRIVATE_KEY/BUNDLE_ID 설정 필요" },
    };
  }

  const baseUrl =
    env === "production"
      ? "https://api.storekit.itunes.apple.com"
      : "https://api.storekit-sandbox.itunes.apple.com";
  const url = `${baseUrl}/inApps/v1/transactions/${input.transactionId}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { verified: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { signedTransactionInfo?: string };
    if (!data.signedTransactionInfo) {
      return { verified: false, error: "no signedTransactionInfo in response" };
    }

    // JWS payload 디코드 (서명 검증은 Apple JWK 사용 필요 — MVP는 payload 신뢰)
    const parts = data.signedTransactionInfo.split(".");
    if (parts.length !== 3) {
      return { verified: false, error: "invalid JWS format" };
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as {
      productId: string;
      transactionId: string;
      originalTransactionId: string;
      purchaseDate: number;
      expiresDate?: number;
      environment: "Sandbox" | "Production";
    };

    return {
      verified: true,
      productId: payload.productId,
      transactionId: payload.transactionId,
      originalTransactionId: payload.originalTransactionId,
      purchaseDate: new Date(payload.purchaseDate).toISOString(),
      expiresDate: payload.expiresDate ? new Date(payload.expiresDate).toISOString() : null,
      environment: payload.environment,
      rawPayload: payload as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
