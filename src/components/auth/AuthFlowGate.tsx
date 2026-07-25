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
      className="flex min-h-screen items-center justify-center bg-white px-6 text-[#0d0d0d]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-center">
        <span className="hex-mask mx-auto block h-10 w-10 animate-pulse text-primary-500" />
        <p className="mt-5 text-[18px] font-bold tracking-[-0.055em]">inpick</p>
        <p className="mt-2 text-xs text-black/45">로그인 상태를 확인하고 있어요.</p>
        <a
          href={loginHref}
          className="mt-5 inline-flex rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-black/65 transition hover:bg-black/[0.04]"
        >
          로그인 화면 바로 열기
        </a>
      </div>
    </main>
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

    setSnapshot({
      pathname,
      runtime: native ? "native" : "web",
      state: "checking",
    });

    // 배포 직후 오래된 탭의 세션 잠금·토큰 갱신 요청이 멈춰도 로딩 화면에
    // 영구 체류하지 않는다. 로컬 세션은 먼저 복원하고 서버 검증은 뒤에서 수행한다.
    void withAuthTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_RESTORE_TIMEOUT_MS,
      "auth-session-restore",
    )
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.session?.user) {
          redirectToLogin();
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
      .catch(() => {
        if (!sessionRestored) redirectToLogin();
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
