"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { buildConsumerAuthHref } from "@/lib/auth/access-policy";
import {
  AUTH_SESSION_RESTORE_TIMEOUT_MS,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { isNativeApp } from "@/lib/mobile/platform";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let done = false;
    // 로컬 세션 복원이나 서버 검증이 멈춰도 헤더를 무한 placeholder로 두지 않는다.
    void withAuthTimeout(
      supabase.auth.getSession(),
      AUTH_SESSION_RESTORE_TIMEOUT_MS,
      "use-auth-session",
    )
      .then(({ data: { session } }) => {
        if (done) return;
        setUser(session?.user ?? null);
        setLoading(false);

        if (!session?.user) return;
        void withAuthTimeout(
          supabase.auth.getUser(),
          AUTH_SESSION_RESTORE_TIMEOUT_MS,
          "use-auth-user",
        )
          .then(({ data: { user: verifiedUser } }) => {
            if (!done) setUser(verifiedUser);
          })
          .catch(() => {
            // 복원 세션은 유지한다. 서버 보호 API가 최종 권한을 검증한다.
          });
      })
      .catch(() => {
        if (done) return;
        setUser(null);
        setLoading(false);
      });

    // 상태 변경 감지 (로그인/로그아웃 즉시 반영)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
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
