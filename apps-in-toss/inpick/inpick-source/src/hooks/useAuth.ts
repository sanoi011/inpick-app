"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { buildConsumerAuthHref } from "@/lib/auth/access-policy";
import { isNativeApp } from "@/lib/mobile/platform";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let done = false;
    // 1) getSession — 로컬 저장소에서 즉시 복원(네트워크 X) → 로그인 UI 빠르게 반영
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (done) return;
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
      }
    });
    // 2) getUser — 서버 검증(느림)으로 세션 유효성 확정
    supabase.auth.getUser().then(({ data: { user } }) => {
      done = true;
      setUser(user);
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
  }, [supabase.auth]);

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
