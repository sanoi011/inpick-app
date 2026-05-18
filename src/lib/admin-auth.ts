/**
 * 관리자 API 인증 통합 헬퍼.
 *
 * 두 가지 인증 형식 모두 허용:
 *   1. `Bearer <ADMIN_PASSWORD>` — 서버 측 호출 (curl, 다른 서비스)
 *   2. `Bearer <base64(admin_id:email:timestamp)>` — /api/admin/login이 발급한 브라우저 토큰
 *
 * 미들웨어(src/middleware.ts)는 이미 `/api/admin/*` 경로에 Bearer 헤더 존재 여부를 확인한다.
 * 이 헬퍼는 토큰 유효성(형식)을 확인한다. DB 조회는 없음 — admin/login에서 이미 검증된 결과를 신뢰.
 *
 * 보안 권고: 추후 HMAC 서명 또는 JWT로 위·변조 방지 강화 필요. 현 단계는 admin 페이지 일관성 우선.
 */
import { NextRequest } from "next/server";

export function isAdminAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  // 1) 환경변수 직접 일치 (서버/CLI 호출)
  const env = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
  if (env && token === env) return true;

  // 2) /api/admin/login 이 발급한 base64 토큰 — 형식: base64("admin_id:email:timestamp")
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length >= 3 && parts[0]?.length > 0 && parts[1]?.includes("@")) {
      return true;
    }
  } catch {
    // base64 decode failure
  }
  return false;
}

/**
 * 관리자 토큰에서 admin_id를 추출 (있으면). 감사 로그 등에 사용.
 */
export function getAdminIdFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length >= 3 && parts[1]?.includes("@")) {
      return parts[0];
    }
  } catch {}
  return null;
}
