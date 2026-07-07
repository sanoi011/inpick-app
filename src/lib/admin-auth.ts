/**
 * 관리자 API 인증 통합 헬퍼.
 *
 * 두 가지 인증 형식 모두 허용:
 *   1. `Bearer <ADMIN_PASSWORD>` — 서버 측 호출 (curl, 다른 서비스)
 *   2. `Bearer <payloadB64url>.<sig>` — /api/admin/login이 발급한 HMAC-SHA256 서명 토큰
 *      - payload: `admin_id:email:timestamp` (base64url)
 *      - sig: HMAC-SHA256(secret, payload) (base64url)
 *      - secret: ADMIN_TOKEN_SECRET || ADMIN_PASSWORD
 *      - 만료: 발급 후 7일
 *
 * 미들웨어(src/middleware.ts)는 이미 `/api/admin/*` 경로에 Bearer 헤더 존재 여부를 확인한다.
 * 이 헬퍼는 토큰 위·변조 여부(서명)와 만료를 검증한다.
 *
 * ⚠️ 구 형식(무서명 base64("admin_id:email:timestamp"))은 더 이상 통과하지 않는다.
 *    기존 로그인 세션은 무효화되며 관리자 재로그인이 1회 필요하다.
 */
import crypto from "crypto";
import { NextRequest } from "next/server";

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

// /api/admin/login의 비밀번호 기본값과 동일한 폴백 (env 미설정 dev 환경 호환).
// 프로덕션에서는 ADMIN_TOKEN_SECRET 또는 ADMIN_PASSWORD 설정 필수.
function getTokenSecret(): string | null {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "inpick2026!";
}

/**
 * HMAC-SHA256 서명 관리자 토큰 발급. `/api/admin/login`에서 사용.
 * 형식: `${base64url(admin_id:email:timestamp)}.${base64url(HMAC-SHA256(secret, payload))}`
 */
export function signAdminToken(adminId: string, email: string): string {
  const secret = getTokenSecret() || "";
  const payload = `${adminId}:${email}:${Date.now()}`;
  const payloadB64 = Buffer.from(payload, "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payloadB64}.${sig}`;
}

/**
 * 서명 토큰 검증. 유효하면 payload 파트 배열([admin_id, email, timestamp]) 반환, 아니면 null.
 */
function verifySignedToken(token: string): string[] | null {
  const secret = getTokenSecret();
  if (!secret) return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  try {
    const payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const parts = payload.split(":");
    if (parts.length < 3 || !parts[0] || !parts[1]?.includes("@")) return null;

    // 만료 검사 (timestamp = 마지막 파트, ms epoch)
    const ts = Number(parts[parts.length - 1]);
    if (!Number.isFinite(ts)) return null;
    const age = Date.now() - ts;
    if (age < 0 || age > TOKEN_MAX_AGE_MS) return null;

    return parts;
  } catch {
    return null;
  }
}

export function isAdminAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  // 1) 환경변수 직접 일치 (서버/CLI 호출)
  const env = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (env && token === env) return true;

  // 2) /api/admin/login이 발급한 HMAC 서명 토큰
  return verifySignedToken(token) !== null;
}

/**
 * 관리자 토큰에서 admin_id를 추출 (서명 검증 통과 시에만). 감사 로그 등에 사용.
 */
export function getAdminIdFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const parts = verifySignedToken(token);
  return parts ? parts[0] : null;
}
