"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";
import {
  buildConsumerAuthHref,
  WEB_AUTH_RETURN_STORAGE_KEY,
} from "@/lib/auth/access-policy";
import {
  isAuthOperationTimeoutError,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

type CallbackState = "exchanging" | "failed";

/**
 * OAuth PKCE 교환을 브라우저에서 완료한다.
 *
 * 서버 Route Handler가 만든 다중 Set-Cookie가 Arc/WebView의 다음 문서에서
 * 누락되는 사례가 있어, @supabase/ssr 브라우저 클라이언트의 자동 PKCE
 * 교환과 세션 쿠키 저장을 사용한다. 여기서 수동으로 코드를 다시 교환하면
 * verifier와 일회용 code가 중복 소비되므로 완료된 세션만 확인한다.
 */
export default function OAuthCallbackPage() {
  const startedRef = useRef(false);
  const [state, setState] = useState<CallbackState>("exchanging");
  const [showProgress, setShowProgress] = useState(false);
  const [message, setMessage] = useState("로그인 정보를 안전하게 연결하고 있습니다.");
  const [retryHref, setRetryHref] = useState("/auth?type=consumer");

  useEffect(() => {
    if (state !== "exchanging") return;
    // 정상 OAuth 교환은 짧게 끝난다. 일반 성공 흐름에서는 별도 중간
    // 화면을 노출하지 않고, 실제 네트워크 지연일 때만 상태를 안내한다.
    const timer = window.setTimeout(() => setShowProgress(true), 2_000);
    return () => window.clearTimeout(timer);
  }, [state]);

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
      setRetryHref(buildConsumerAuthHref(next));
      const providerError =
        currentUrl.searchParams.get("error_description") ||
        currentUrl.searchParams.get("error");

      if (!code || providerError) {
        setState("failed");
        setMessage(
          providerError
            ? "소셜 로그인 제공자가 인증을 완료하지 못했습니다."
            : "로그인 인증 코드가 없습니다.",
        );
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await withAuthTimeout(
          supabase.auth.getSession(),
          undefined,
          "browser-oauth-session-restore",
        );
        if (error || !data.session?.user) {
          throw error || new Error("OAUTH_SESSION_MISSING");
        }

        try {
          sessionStorage.removeItem(WEB_AUTH_RETURN_STORAGE_KEY);
        } catch {
          /* private mode */
        }
        trackClientEvent(AnalyticsEvents.LoginCompleted, {
          props: {
            provider:
              (data.session.user.app_metadata?.provider as string | undefined) ||
              "unknown",
            method: "oauth_web_browser",
          },
        });

        // 교환에 사용한 code를 히스토리에서 먼저 제거한다. 사용자가 뒤로
        // 이동해 이미 소비된 code를 다시 교환하는 반복 실패를 방지한다.
        window.history.replaceState(null, "", "/auth/callback");
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
            stage: "browser_session_restore",
            errorCode,
            errorMessage,
          }),
          keepalive: true,
        }).catch(() => {});
        setState("failed");
        setMessage(
          isAuthOperationTimeoutError(error)
            ? "로그인 서버 응답이 지연되고 있습니다. 다시 시도해주세요."
            : "로그인 세션을 저장하지 못했습니다. 다시 시도해주세요.",
        );
      }
    };

    void complete();
  }, []);

  if (state === "exchanging" && !showProgress) {
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
          className={`mx-auto block h-10 w-10 rounded-[14px] bg-gradient-to-br from-blue-400 to-blue-700 ${
            state === "exchanging" ? "animate-pulse" : ""
          }`}
        />
        <p className="mt-5 text-[18px] font-bold tracking-[-0.04em]">
          {state === "exchanging" ? "로그인 완료 중" : "로그인을 완료하지 못했습니다"}
        </p>
        <p className="mt-2 text-xs text-black/50">{message}</p>
        {state === "failed" ? (
          <a
            href={retryHref}
            className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-xs font-bold text-white"
          >
            로그인 다시 시도
          </a>
        ) : null}
      </div>
    </main>
  );
}
