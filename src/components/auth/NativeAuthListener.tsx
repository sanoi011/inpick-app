"use client";

/**
 * 네이티브 앱(iOS/Android) OAuth 딥링크 복귀 처리기.
 *
 * 흐름:
 *   1) startOAuth() 가 외부 브라우저(Custom Tab/SFSafariVC)로 로그인 페이지를 연다.
 *   2) 로그인 완료 → Supabase 가 kr.inpick.app://auth/callback?code=... 로 리다이렉트.
 *   3) OS 가 딥링크를 앱으로 전달 → Capacitor App 플러그인의 appUrlOpen 이벤트 발생.
 *   4) 여기서 code 를 받아 supabase.auth.exchangeCodeForSession() 으로 세션 확립 후 새로고침.
 *
 * ※ 웹/PWA 에서는 아무 것도 하지 않음(리스너 미등록). layout 에 마운트해 앱 전역에서 1회 등록.
 * ※ Supabase 대시보드 Redirect URLs 에 kr.inpick.app://auth/callback 등록 필요.
 */
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/mobile/platform";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

/** 딥링크 OAuth 복귀 로그인 완료 계측 — 실패해도 로그인 흐름 무영향 */
function trackNativeLoginCompleted(user: User | null | undefined) {
  try {
    const provider = (user?.app_metadata?.provider as string | undefined) ?? "unknown";
    // 신규 가입 판별 — 생성 시각 2분 이내면 이 OAuth 흐름에서 방금 생성된 계정
    const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
    const isNewUser = createdAt > 0 && Date.now() - createdAt < 2 * 60 * 1000;
    if (isNewUser) {
      trackClientEvent(AnalyticsEvents.SignupCompleted, {
        props: { provider, method: "native_deeplink" },
      });
    }
    trackClientEvent(AnalyticsEvents.LoginCompleted, {
      props: { provider, method: "native_deeplink", is_new_user: isNewUser },
    });
  } catch {
    /* silent */
  }
}

export default function NativeAuthListener() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appUrlOpen", async ({ url }) => {
          if (!url || url.indexOf("auth/callback") === -1) return;
          // 인앱 브라우저 닫기 (열려 있으면)
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch {
            /* 이미 닫혔거나 미지원 */
          }
          try {
            const supabase = createClient();
            const parsed = new URL(url);
            const code = parsed.searchParams.get("code");
            if (code) {
              // PKCE: code → 세션 교환 (verifier 는 로그인 시작 시 저장돼 있음)
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.error("[native-auth] exchangeCodeForSession 실패:", error.message);
                return;
              }
              trackNativeLoginCompleted(data?.user ?? data?.session?.user);
            } else {
              // implicit 폴백: #access_token=...&refresh_token=...
              const hash = url.split("#")[1];
              if (!hash) {
                console.warn("[native-auth] 콜백에 code/token 없음:", url);
                return;
              }
              const hp = new URLSearchParams(hash);
              const access_token = hp.get("access_token");
              const refresh_token = hp.get("refresh_token");
              if (!access_token || !refresh_token) return;
              const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
              if (error) {
                console.error("[native-auth] setSession 실패:", error.message);
                return;
              }
              trackNativeLoginCompleted(data?.user ?? data?.session?.user);
            }
            if (!cancelled) {
              // 세션 확립 후 홈으로 (로그인 상태 반영)
              window.location.replace("/");
            }
          } catch (e) {
            console.error("[native-auth] 콜백 처리 오류:", e);
          }
        });
        remove = () => handle.remove();
      } catch (e) {
        console.warn("[native-auth] @capacitor/app 로드 실패:", e);
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return null;
}
