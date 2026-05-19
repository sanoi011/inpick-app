/**
 * Google Play Developer API verification.
 *
 * 실제 검증 흐름:
 *   1. 클라이언트가 Play Billing purchaseToken + productId 전송
 *   2. 서버가 Google Play Developer API의 purchases.products.get 호출
 *   3. purchaseState + acknowledgementState 확인
 *   4. 검증 성공 시 purchases.products.acknowledge 호출 (3일 내 ack 필수)
 *
 * 필요 환경변수:
 *   GOOGLE_PLAY_PACKAGE_NAME = kr.inpick.app
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = (Service Account JSON 전체를 base64)
 *
 * 가이드: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
 */
import crypto from "crypto";

export interface GooglePlayVerifyInput {
  productId: string;
  purchaseToken: string;
}

export interface GooglePlayVerifyResult {
  verified: boolean;
  productId?: string;
  purchaseTime?: string;
  purchaseState?: number; // 0=purchased, 1=canceled, 2=pending
  acknowledgementState?: number; // 0=unacknowledged, 1=acknowledged
  orderId?: string;
  error?: string;
  rawPayload?: Record<string, unknown>;
}

interface ServiceAccountJson {
  private_key: string;
  client_email: string;
  token_uri: string;
}

function getServiceAccount(): ServiceAccountJson | null {
  const b64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    return JSON.parse(decoded) as ServiceAccountJson;
  } catch (err) {
    console.error("[google-play] SA JSON parse failed:", err);
    return null;
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Service Account JSON으로 OAuth 2.0 access_token 획득 (JWT bearer)
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const sa = getServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const encB64 = (o: Record<string, unknown>) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${encB64(header)}.${encB64(payload)}`;

  try {
    const signature = crypto
      .createSign("SHA256")
      .update(signingInput)
      .sign(sa.private_key)
      .toString("base64url");
    const jwt = `${signingInput}.${signature}`;

    const tokenRes = await fetch(sa.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!tokenRes.ok) {
      console.error("[google-play] token fetch failed:", await tokenRes.text());
      return null;
    }
    const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };
    return tokenData.access_token;
  } catch (err) {
    console.error("[google-play] JWT sign failed:", err);
    return null;
  }
}

export async function verifyGooglePlayPurchase(
  input: GooglePlayVerifyInput,
): Promise<GooglePlayVerifyResult> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) {
    return { verified: false, error: "GOOGLE_PLAY_PACKAGE_NAME_NOT_SET" };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      verified: false,
      error: "GOOGLE_PLAY_SERVICE_ACCOUNT_NOT_CONFIGURED",
      rawPayload: { hint: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 환경변수 설정 필요 (base64)" },
    };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${input.productId}/tokens/${input.purchaseToken}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { verified: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      purchaseTimeMillis: string;
      purchaseState: number;
      acknowledgementState: number;
      orderId: string;
    };
    return {
      verified: data.purchaseState === 0, // 0 = purchased
      productId: input.productId,
      purchaseTime: new Date(parseInt(data.purchaseTimeMillis, 10)).toISOString(),
      purchaseState: data.purchaseState,
      acknowledgementState: data.acknowledgementState,
      orderId: data.orderId,
      rawPayload: data as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return { verified: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Google Play 구매 acknowledge (3일 내 호출 필수)
 */
export async function acknowledgeGooglePlayPurchase(input: GooglePlayVerifyInput): Promise<boolean> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) return false;
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${input.productId}/tokens/${input.purchaseToken}:acknowledge`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    return res.ok;
  } catch (err) {
    console.error("[google-play] acknowledge failed:", err);
    return false;
  }
}
