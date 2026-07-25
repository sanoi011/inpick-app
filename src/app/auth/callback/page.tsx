"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import {
  buildConsumerAuthHref,
  WEB_AUTH_RETURN_STORAGE_KEY,
} from "@/lib/auth/access-policy";
import {
  AUTH_REQUEST_TIMEOUT_MS,
  getOAuthSessionCookieFingerprint,
  isAuthOperationTimeoutError,
  waitForOAuthCookieHandoff,
  WEB_OAUTH_SESSION_FINGERPRINT_STORAGE_KEY,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

/**
 * OAuth PKCE 교환을 브라우저에서 완료한다.
 *
 * 전역 browser client의 자동 PKCE가 기존 세션 lock에 막히는 운영 사례가
 * 있어 callback 전용 동일-origin API가 code를 한 번만 교환한다. 서버 응답
 * 쿠키를 우선 사용하고, 브라우저가 이를 반영하지 못한 경우에만 setSession
 * fallback으로 직접 저장한다.
 */
export default function OAuthCallbackPage() {
  const startedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [retryHref, setRetryHref] = useState("/auth?type=consumer");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const complete = async () => {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");
      let storedReturnPath: string | null = null;
      try {
        storedReturnPath = sessionStorage.getItem(WEB_AUTH_RETURN_STORAGE_KEY);
      } catch {
        /* private mode: safe root fallback */
      }
      const next = sanitizeAuthReturnPath(
        currentUrl.searchParams.get("next") || storedReturnPath,
      );
      let previousSessionFingerprint: string | undefined;
      try {
        previousSessionFingerprint =
          sessionStorage.getItem(
            WEB_OAUTH_SESSION_FINGERPRINT_STORAGE_KEY,
          ) || undefined;
      } catch {
        /* private mode */
      }
      setRetryHref(buildConsumerAuthHref(next));
      const providerError =
        currentUrl.searchParams.get("error_description") ||
        currentUrl.searchParams.get("error");

      if (!code || providerError) {
        setFailed(true);
        setMessage(
          providerError
            ? "소셜 로그인 제공자가 인증을 완료하지 못했습니다."
            : "로그인 인증 코드가 없습니다.",
        );
        return;
      }

      try {
        const response = await withAuthTimeout(
          fetch("/api/auth/oauth-exchange", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({ code }),
          }),
          AUTH_REQUEST_TIMEOUT_MS,
          "server-oauth-code-exchange",
        );
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          message?: string;
          provider?: string;
          session?: {
            access_token?: string;
            refresh_token?: string;
          };
        };
        if (
          !response.ok ||
          !payload.ok ||
          !payload.session?.access_token ||
          !payload.session.refresh_token
        ) {
          const exchangeError = new Error(
            payload.message || `OAUTH_EXCHANGE_${response.status}`,
          ) as Error & { code?: string };
          exchangeError.code = payload.code || `HTTP_${response.status}`;
          throw exchangeError;
        }

        // 서버가 code를 소비했으므로 browser client를 만들기 전에 URL에서
        // 제거한다. 이후 client 초기화가 같은 code를 자동 재교환할 수 없다.
        window.history.replaceState(null, "", "/auth/callback");

        const sessionFingerprint =
          getOAuthSessionCookieFingerprint(document.cookie);
        const serverCookiesApplied =
          previousSessionFingerprint !== undefined &&
          sessionFingerprint !== previousSessionFingerprint;

        if (!serverCookiesApplied) {
          const supabase = createClient();
          const { data, error } = await withAuthTimeout(
            supabase.auth.setSession({
              access_token: payload.session.access_token,
              refresh_token: payload.session.refresh_token,
            }),
            AUTH_REQUEST_TIMEOUT_MS,
            "browser-oauth-session-persist",
          );
          if (error || !data.session?.user) {
            throw error || new Error("OAUTH_SESSION_PERSIST_FAILED");
          }
          await waitForOAuthCookieHandoff(
            () => document.cookie,
            AUTH_REQUEST_TIMEOUT_MS,
            undefined,
            previousSessionFingerprint,
          );
        }

        try {
          sessionStorage.removeItem(WEB_AUTH_RETURN_STORAGE_KEY);
          sessionStorage.removeItem(
            WEB_OAUTH_SESSION_FINGERPRINT_STORAGE_KEY,
          );
        } catch {
          /* private mode */
        }
        trackClientEvent(AnalyticsEvents.LoginCompleted, {
          props: {
            provider: payload.provider || "unknown",
            method: "oauth_web_server_exchange",
          },
        });

        window.location.replace(next);
      } catch (error) {
        console.error("[auth/callback] browser exchange failed", error);
        const errorCode =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "unknown";
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        void fetch("/api/auth/oauth-diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: "server_oauth_exchange_and_persist",
            errorCode,
            errorMessage,
          }),
          keepalive: true,
        }).catch(() => {});
        setFailed(true);
        setMessage(
          isAuthOperationTimeoutError(error)
            ? "로그인 서버 응답이 지연되고 있습니다. 다시 시도해주세요."
            : "로그인 세션을 저장하지 못했습니다. 다시 시도해주세요.",
        );
      }
    };

    void complete();
  }, []);

  // 정상 OAuth 교환 동안 별도 로딩 화면을 표시하지 않는다. 교환은 백그라운드로
  // 완료되고 즉시 목적지로 이동하며, 실제 실패 때만 복구 UI를 보여준다.
  if (!failed) {
    return (
      <main
        className="min-h-screen bg-white"
        aria-label="로그인 처리 중"
        aria-busy="true"
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-6 text-[#0d0d0d]">
      <div className="text-center">
        <span
          className="mx-auto block h-10 w-10 rounded-[14px] bg-gradient-to-br from-blue-400 to-blue-700"
        />
        <p className="mt-5 text-[18px] font-bold tracking-[-0.04em]">
          로그인을 완료하지 못했습니다
        </p>
        <p className="mt-2 text-xs text-black/50">{message}</p>
        <a
          href={retryHref}
          className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-xs font-bold text-white"
        >
          로그인 다시 시도
        </a>
      </div>
    </main>
  );
}
