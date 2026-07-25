const PRODUCTION_HOST = "www.interiorpick.co.kr";
const LEGACY_PRODUCTION_HOST = "interiorpick.co.kr";

function hasLikelyOAuthCode(url: URL): boolean {
  const code = url.searchParams.get("code")?.trim() ?? "";
  return code.length >= 20 && /^[A-Za-z0-9._~-]+$/.test(code);
}

/**
 * Move only a bare-domain OAuth Site URL fallback to the cookie-owning host.
 *
 * Supabase PKCE stores its verifier in a host cookie. Starting on `www` and
 * returning to the bare domain (or the reverse) makes the verifier invisible
 * during the code exchange. Normal pages and webhook requests are deliberately
 * left untouched.
 */
export function getCanonicalAuthUrl(requestUrl: string): URL | null {
  const url = new URL(requestUrl);
  if (url.hostname !== LEGACY_PRODUCTION_HOST) {
    return null;
  }

  const isRootCodeFallback =
    url.pathname === "/" && hasLikelyOAuthCode(url);
  const isOAuthSurface =
    url.pathname === "/auth" || url.pathname === "/auth/callback";
  if (!isRootCodeFallback && !isOAuthSurface) return null;

  url.hostname = PRODUCTION_HOST;
  return url;
}

/**
 * Supabase falls back to Auth's Site URL when a requested redirect URL is not
 * present in the allow-list. Preserve that successful OAuth result by moving a
 * root-level authorization code to the real callback route.
 */
export function getRootOAuthRecoveryUrl(requestUrl: string): URL | null {
  const url = new URL(requestUrl);
  if (url.pathname !== "/" || !hasLikelyOAuthCode(url)) return null;

  url.pathname = "/auth/callback";
  return url;
}
