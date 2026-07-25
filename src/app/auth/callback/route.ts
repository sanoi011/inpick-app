import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function redirectWithCookies(
  url: URL,
  pendingCookies: PendingCookie[],
) {
  const response = NextResponse.redirect(url);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthReturnPath(searchParams.get("next"));
  const pendingCookies: PendingCookie[] = [];

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      },
    );
    const hasCodeVerifierCookie = request.cookies
      .getAll()
      .some(({ name }) => name.includes("auth-token-code-verifier"));
    console.info("[auth/callback] code exchange started", {
      hasCodeVerifierCookie,
      host: request.nextUrl.host,
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.info("[auth/callback] code exchange succeeded", {
        pendingCookieCount: pendingCookies.length,
      });
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
      return redirectWithCookies(new URL(next, origin), pendingCookies);
    }
    console.error("[auth/callback] code exchange failed", {
      code: error.code,
      message: error.message,
      hasCodeVerifierCookie,
    });
  }

  // 에러 시 auth 페이지로 리다이렉트
  return redirectWithCookies(
    new URL("/auth?error=auth_failed", origin),
    pendingCookies,
  );
}
