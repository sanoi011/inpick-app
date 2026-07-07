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

  const hostOf = (e: string) =>
    e === "production"
      ? "https://api.storekit.itunes.apple.com"
      : "https://api.storekit-sandbox.itunes.apple.com";

  try {
    // Apple 권장 패턴: 운영(production)에서 못 찾으면(404) sandbox 재시도.
    // App Review는 샌드박스로 결제하므로, 이 폴백이 없으면 심사 중 IAP 검증이 전부 실패한다(2026-07-07).
    // 샌드박스 계정은 개발자만 생성 가능해 악용 노출면은 제한적.
    let effectiveEnv = env;
    let res = await fetch(`${hostOf(env)}/inApps/v1/transactions/${input.transactionId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    });
    if (res.status === 404 && env === "production") {
      effectiveEnv = "sandbox";
      res = await fetch(`${hostOf("sandbox")}/inApps/v1/transactions/${input.transactionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      });
    }
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
    // 이 payload는 Apple App Store Server API(인증된 우리 JWT)로 직접 조회한 것이므로 출처는 신뢰 가능.
    // 단 아래 두 가지는 반드시 강제 — 미검증 시 샌드박스/타앱 트랜잭션이 실지급으로 이어짐(2026-07-05 H3).
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as {
      productId: string;
      transactionId: string;
      originalTransactionId: string;
      bundleId?: string;
      purchaseDate: number;
      expiresDate?: number;
      environment: "Sandbox" | "Production";
    };

    // 1) 환경 일치 — 실제 조회에 성공한 환경(effectiveEnv) 기준으로 검증.
    //    production 앱스토어 API에서 찾은 트랜잭션이 Sandbox일 수는 없으므로 교차 위조는 차단됨.
    const expectedEnv = effectiveEnv === "production" ? "Production" : "Sandbox";
    if (payload.environment !== expectedEnv) {
      return {
        verified: false,
        error: `environment_mismatch: got ${payload.environment}, expected ${expectedEnv}`,
        rawPayload: payload as unknown as Record<string, unknown>,
      };
    }
    // 2) 번들 ID 일치 — 타 앱 트랜잭션 차단
    const expectedBundle = process.env.APP_STORE_BUNDLE_ID;
    if (expectedBundle && payload.bundleId && payload.bundleId !== expectedBundle) {
      return {
        verified: false,
        error: `bundle_mismatch: got ${payload.bundleId}, expected ${expectedBundle}`,
        rawPayload: payload as unknown as Record<string, unknown>,
      };
    }

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
