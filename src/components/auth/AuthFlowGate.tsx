"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildConsumerAuthHref,
  isNativePublicPath,
  requiresConsumerAuthOnWeb,
} from "@/lib/auth/access-policy";
import { isNativeApp } from "@/lib/mobile/platform";

type GateState = "checking" | "allowed" | "redirecting";

type GateSnapshot = {
  pathname: string;
  runtime: "web" | "native";
  state: GateState;
};

function AuthLoadingScreen() {
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

    setSnapshot({
      pathname,
      runtime: native ? "native" : "web",
      state: "checking",
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data.user) {
        setSnapshot({
          pathname,
          runtime: native ? "native" : "web",
          state: "allowed",
        });
      } else redirectToLogin();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setSnapshot({
          pathname,
          runtime: native ? "native" : "web",
          state: "allowed",
        });
      } else redirectToLogin();
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

  if (state !== "allowed") return <AuthLoadingScreen />;
  return <>{children}</>;
}
