"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildConsumerAuthHref,
  isNativePublicPath,
  requiresConsumerAuthOnWeb,
} from "@/lib/auth/access-policy";
import {
  AUTH_SESSION_RESTORE_TIMEOUT_MS,
  fetchServerAuthSession,
  getOAuthCookieHandoffState,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { isNativeApp } from "@/lib/mobile/platform";

type GateState = "checking" | "allowed" | "redirecting";

type GateSnapshot = {
  pathname: string;
  runtime: "web" | "native";
  state: GateState;
};

function AuthLoadingScreen({ loginHref }: { loginHref: string }) {
  return (
    <main
      className="min-h-screen bg-white"
      aria-live="polite"
      aria-busy="true"
      data-login-href={loginHref}
    />
  );
}

/**
 * One client-side gate covers both delivery surfaces:
 * - Capacitor iOS/Android: every service screen requires a valid user.
 * - Web/PWA: the free AI workflow requires a valid user.
 *
 * The auth and legal screens remain public so OAuth callbacks, signup, terms and
 * account-deletion guidance cannot be trapped in a redirect loop.
 */
export default function AuthFlowGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const supabase = useMemo(() => createClient(), []);
  const [snapshot, setSnapshot] = useState<GateSnapshot>(() => ({
    pathname,
    runtime: "web",
    state: requiresConsumerAuthOnWeb(pathname) ? "checking" : "allowed",
  }));

  useEffect(() => {
    const native = isNativeApp();
    const requiresAuth = native
      ? !isNativePublicPath(pathname)
      : requiresConsumerAuthOnWeb(pathname);

    if (!requiresAuth) {
      setSnapshot({
        pathname,
        runtime: native ? "native" : "web",
        state: "allowed",
      });
      return;
    }

    let cancelled = false;
    let redirectStarted = false;
    let sessionRestored = false;
    const initialCookieState = getOAuthCookieHandoffState(document.cookie);

    const redirectToLogin = () => {
      if (cancelled || redirectStarted) return;
      redirectStarted = true;
      setSnapshot({
        pathname,
        runtime: native ? "native" : "web",
        state: "redirecting",
      });
      const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(
        buildConsumerAuthHref(
          returnPath,
          native ? "native_app_launch" : "protected_route",
        ),
      );
    };

    const allow = () => {
      if (cancelled) return;
      sessionRestored = true;
      setSnapshot({
        pathname,
        runtime: native ? "native" : "web",
        state: "allowed",
      });
    };

    const reportRecovery = (
      stage: string,
      errorCode: string,
      errorMessage: string,
    ) => {
      void fetch("/api/auth/oauth-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, errorCode, errorMessage }),
        keepalive: true,
      }).catch(() => {});
    };

    const confirmWithServer = async (
      clientFailureStage: string,
    ): Promise<"authenticated" | "signed_out" | "transient_failure"> => {
      try {
        const result = await fetchServerAuthSession();
        if (cancelled) return "transient_failure";
        if (result.authenticated) {
          allow();
          return "authenticated";
        }
        reportRecovery(
          "auth_gate_server_rejected",
          "UNAUTHENTICATED",
          clientFailureStage,
        );
        return "signed_out";
      } catch (error) {
        reportRecovery(
          "auth_gate_server_recovery_failed",
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "unknown",
          error instanceof Error ? error.message : String(error),
        );
        return "transient_failure";
      }
    };

    setSnapshot({
      pathname,
      runtime: native ? "native" : "web",
      state: "checking",
    });

    // OAuth callback이 이미 세션 쿠키 저장을 완료했다면 화면을 즉시 연다.
    // 동일 쿠키는 아래 서버 복구 요청에서 검증되며 보호 API도 각각 재검증한다.
    if (initialCookieState.completed) allow();

    // 배포 직후 오래된 탭의 세션 잠금·토큰 갱신 요청이 멈춰도 로딩 화면에
    // 영구 체류하거나 성공한 OAuth를 로그아웃으로 오판하지 않는다.
    void withAuthTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_RESTORE_TIMEOUT_MS,
      "auth-session-restore",
    )
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.session?.user) {
          const cookieState = getOAuthCookieHandoffState(document.cookie);
          if (!cookieState.completed) {
            redirectToLogin();
            return;
          }
          void confirmWithServer("CLIENT_SESSION_MISSING").then((result) => {
            if (cancelled) return;
            if (result === "signed_out") redirectToLogin();
            // 5xx/timeout은 이미 확인한 쿠키 세션을 폐기하지 않는다.
          });
          return;
        }

        allow();
        void withAuthTimeout(
          supabase.auth.getUser(),
          AUTH_SESSION_RESTORE_TIMEOUT_MS,
          "auth-user-validation",
        )
          .then(({ data: userData, error }) => {
            if (cancelled) return;
            if (!error && userData.user) {
              allow();
              return;
            }
            // getSession으로 복원한 세션을 일시적인 네트워크/getUser 오류
            // 하나로 폐기하지 않는다. 보호 API는 서버에서 다시 검증한다.
            console.warn("[auth-gate] background user validation failed", {
              code:
                error && typeof error === "object" && "code" in error
                  ? error.code
                  : "unknown",
            });
          })
          .catch(() => {
            // 네트워크 검증이 timeout이어도 복원된 세션으로 화면은 연다.
            // 보호 API는 서버에서 세션을 다시 검증하므로 권한이 확대되지 않는다.
          });
      })
      .catch((error) => {
        const cookieState = getOAuthCookieHandoffState(document.cookie);
        if (!cookieState.completed) {
          if (!sessionRestored) redirectToLogin();
          return;
        }
        void confirmWithServer(
          error instanceof Error ? error.message : "CLIENT_SESSION_TIMEOUT",
        ).then((result) => {
          if (cancelled) return;
          if (result === "signed_out") redirectToLogin();
        });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session?.user) {
        allow();
      } else if (event === "SIGNED_OUT") {
        redirectToLogin();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  // A client-side route change renders before its effect runs. Never reuse an
  // "allowed" decision from the previous path for a newly protected path.
  const routeChanged = snapshot.pathname !== pathname;
  const nextPathRequiresAuth =
    snapshot.runtime === "native"
      ? !isNativePublicPath(pathname)
      : requiresConsumerAuthOnWeb(pathname);
  const state = routeChanged && nextPathRequiresAuth ? "checking" : snapshot.state;

  if (state !== "allowed") {
    return (
      <AuthLoadingScreen
        loginHref={buildConsumerAuthHref(
          pathname,
          snapshot.runtime === "native"
            ? "native_app_launch"
            : "protected_route",
        )}
      />
    );
  }
  return <>{children}</>;
}
