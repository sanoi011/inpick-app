import { createClient } from "../inpick-source/src/lib/supabase/client";

const TOSS_API_ORIGIN = (
  import.meta.env.VITE_INPICK_TOSS_API_ORIGIN || "http://localhost:8788"
).replace(/\/$/, "");

/**
 * The shipped iOS/Android app calls the production Next API with same-origin
 * cookies. Apps in Toss runs the exact client UI from a packaged origin, so its
 * Supabase access token is forwarded as a Bearer token to the same API routes.
 */
export function installProductionApiBridge() {
  if (typeof window === "undefined") return;
  const marker = "__inpickProductionApiBridgeInstalled";
  const target = window as typeof window & { [marker]?: boolean };
  if (target[marker]) return;
  target[marker] = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const originalUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!originalUrl.startsWith("/api/")) return nativeFetch(input, init);

    const { data } = await createClient().auth.getSession();
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    if (data.session?.access_token) {
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    headers.set("X-InPick-Client", "apps-in-toss");

    return nativeFetch(`${TOSS_API_ORIGIN}${originalUrl}`, {
      ...(input instanceof Request
        ? {
            method: input.method,
            body: input.body,
            cache: input.cache,
            redirect: input.redirect,
            referrer: input.referrer,
            referrerPolicy: input.referrerPolicy,
            signal: input.signal,
          }
        : {}),
      ...init,
      headers,
      credentials: "omit",
    });
  };
}
