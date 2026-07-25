import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthReturnPath(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 웹 OAuth 로그인 완료 계측 (fire-and-forget, 실패해도 로그인 흐름 무영향)
      const user = data?.user ?? data?.session?.user ?? null;
      if (user) {
        const provider =
          (user.app_metadata?.provider as string | undefined) ?? "unknown";
        const accountType =
          (user.user_metadata?.account_type as string | undefined) ?? "consumer";
        const actorType = accountType === "contractor" ? "contractor" : "consumer";
        // 신규 가입 판별 — 생성 시각이 2분 이내면 이 OAuth 흐름에서 방금 생성된 계정
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isNewUser = createdAt > 0 && Date.now() - createdAt < 2 * 60 * 1000;
        if (isNewUser) {
          trackServerEventAsync({
            eventName: AnalyticsEvents.SignupCompleted,
            actorType,
            userId: user.id,
            source: "api",
            props: { provider, method: "oauth_web" },
          });
        }
        trackServerEventAsync({
          eventName: AnalyticsEvents.LoginCompleted,
          actorType,
          userId: user.id,
          source: "api",
          props: { provider, method: "oauth_web", is_new_user: isNewUser },
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] code exchange failed", {
      code: error.code,
      message: error.message,
    });
  }

  // 에러 시 auth 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
}
