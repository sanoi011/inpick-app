import { sanitizeAuthReturnPath } from "./return-path";

const NATIVE_PUBLIC_PATHS = [
  "/auth",
  "/privacy",
  "/terms",
  "/account-deletion",
] as const;

export const NATIVE_AUTH_RETURN_STORAGE_KEY = "inpick_native_auth_return_to";

/** Web visitors must authenticate before entering the free AI workflow. */
export function requiresConsumerAuthOnWeb(pathname: string): boolean {
  return pathname === "/workflow" || pathname.startsWith("/workflow/");
}

/** Legal and authentication screens remain reachable before native app sign-in. */
export function isNativePublicPath(pathname: string): boolean {
  return NATIVE_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function buildConsumerAuthHref(
  returnPath: string | null | undefined,
  source?: "free_ai" | "native_app_launch" | "native_logout" | "protected_route",
): string {
  const params = new URLSearchParams({
    type: "consumer",
    returnUrl: sanitizeAuthReturnPath(returnPath),
  });
  if (source) params.set("source", source);
  return `/auth?${params.toString()}`;
}

/** Recover a safe post-login path from a normal web callback URL. */
export function getReturnPathFromOAuthRedirect(redirectTo: string): string {
  try {
    const parsed = new URL(redirectTo);
    return sanitizeAuthReturnPath(parsed.searchParams.get("next"));
  } catch {
    return "/";
  }
}
