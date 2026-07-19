const RETURN_PATH_BASE = "https://inpick.local";

/**
 * 로그인 뒤 이동할 경로를 동일 사이트의 내부 경로로만 제한한다.
 * /auth로 다시 보내는 값도 제거해 성공한 로그인이 로그인 화면을 반복하지 않게 한다.
 */
export function sanitizeAuthReturnPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, RETURN_PATH_BASE);
    if (parsed.origin !== RETURN_PATH_BASE) return fallback;
    if (parsed.pathname === "/auth" || parsed.pathname.startsWith("/auth/callback")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
