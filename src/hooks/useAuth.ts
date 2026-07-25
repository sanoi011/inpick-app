"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { buildConsumerAuthHref } from "@/lib/auth/access-policy";
import {
  AUTH_SESSION_RESTORE_TIMEOUT_MS,
  fetchServerAuthSession,
  getOAuthCookieHandoffState,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { isNativeApp } from "@/lib/mobile/platform";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let done = false;
    const restoreFromServer = async () => {
      try {
        const result = await fetchServerAuthSession<User>();
        if (done) return;
        setUser(result.authenticated ? result.user : null);
        setLoading(false);
      } catch {
        if (done) return;
        // 서버 복구까지 실패해도 헤더를 영구 로딩으로 남기지 않는다.
        // 늦게 도착하는 SIGNED_IN/INITIAL_SESSION 이벤트는 아래 listener가 반영한다.
        setLoading(false);
      }
    };

    // 로컬 세션 복원이나 서버 검증이 멈춰도 헤더를 무한 placeholder로 두지 않는다.
    void withAuthTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_RESTORE_TIMEOUT_MS,
      "use-auth-session",
    )
      .then(({ data: { session } }) => {
        if (done) return;
        if (!session?.user) {
          if (getOAuthCookieHandoffState(document.cookie).completed) {
            void restoreFromServer();
          } else {
            setUser(null);
            setLoading(false);
          }
          return;
        }
        setUser(session.user);
        setLoading(false);

        void withAuthTimeout(
          supabase.auth.getUser(),
          AUTH_SESSION_RESTORE_TIMEOUT_MS,
          "use-auth-user",
        )
          .then(({ data: { user: verifiedUser }, error }) => {
            // 이미 복원된 세션은 background 검증 오류로 null 처리하지 않는다.
            // 명시적인 SIGNED_OUT 이벤트만 로그인 UI로 되돌린다.
            if (!done && !error && verifiedUser) setUser(verifiedUser);
          })
          .catch(() => {
            // 복원 세션은 유지한다. 서버 보호 API가 최종 권한을 검증한다.
          });
      })
      .catch(() => {
        if (done) return;
        if (getOAuthCookieHandoffState(document.cookie).completed) {
          void restoreFromServer();
        } else {
          setUser(null);
          setLoading(false);
        }
      });

    // 상태 변경 감지 (로그인/로그아웃 즉시 반영)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        } else if (
          event === "INITIAL_SESSION" &&
          !getOAuthCookieHandoffState(document.cookie).completed
        ) {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      done = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.replace(
      isNativeApp()
        ? buildConsumerAuthHref("/", "native_logout")
        : "/",
    );
  };

  return { user, loading, signOut };
}
