/**
 * Analytics props sanitizer.
 *
 * 가이드: c:\Users\user\Downloads\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-5
 *
 * 정책: 행동패턴 학습은 필요하지만 개인정보/시크릿 원문은 절대 저장 X.
 * 저장 금지 키: 비밀번호/토큰/주민번호/전체주소/이메일원문/전화원문/이미지base64 등
 */

import crypto from "crypto";

const BLOCKED_KEYS = new Set([
  "password",
  "passwd",
  "pwd",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "authToken",
  "phone",
  "phoneNumber",
  "phone_number",
  "tel",
  "mobile",
  "email",
  "emailAddress",
  "fullAddress",
  "address",
  "roadAddress",
  "jibunAddress",
  "detailAddress",
  "addressDetail",
  "promptRaw",
  "image",
  "imageBase64",
  "imageData",
  "paymentKey",
  "orderId",
  "ssn",
  "rrn",
  "residentNumber",
  "creditCard",
  "cardNumber",
  "cvv",
  "cvc",
]);

const HASHABLE_KEYS = new Set([
  "phoneHash",
  "phone_hash",
  "ipHash",
  "ip_hash",
  "ip",
]);

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * 객체에서 차단 키 제거 + IP/phone hash 변환.
 * nested 객체/배열 재귀 처리. 깊이 5 제한.
 */
export function sanitizeAnalyticsProps(
  input: unknown,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5) return { _truncated: true };
  if (!input || typeof input !== "object") return {};
  if (Array.isArray(input)) {
    return { _array: input.length };
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lc = key.toLowerCase();
    // 차단
    if (BLOCKED_KEYS.has(key) || BLOCKED_KEYS.has(lc)) continue;
    // 부분 매치 차단
    if (
      lc.includes("password") ||
      lc.includes("token") ||
      lc.includes("secret") ||
      lc.includes("apikey") ||
      lc.includes("authorization")
    )
      continue;

    // IP/Phone → 해시
    if (HASHABLE_KEYS.has(key) || HASHABLE_KEYS.has(lc)) {
      if (typeof value === "string" && value.length > 0) {
        out[`${key}_hash`] = shortHash(value);
      }
      continue;
    }

    // nested 객체
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeAnalyticsProps(value, depth + 1);
      continue;
    }
    // 배열은 길이만 보존
    if (Array.isArray(value)) {
      out[key] = { _array: value.length };
      continue;
    }
    // 긴 문자열은 200자로 자름
    if (typeof value === "string" && value.length > 200) {
      out[key] = value.slice(0, 200) + "…";
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * 단일 문자열 해시 (외부 사용용).
 */
export function hashForAnalytics(s: string): string {
  return shortHash(s);
}
