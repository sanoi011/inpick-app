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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * OAuth 제공자 → callback → 메인으로 이어지는 연속 307 체인에서는 일부
 * 브라우저/WebView가 Set-Cookie를 다음 문서보다 늦게 반영했다. 콜백을 짧은
 * 200 완료 문서로 끝내 브라우저가 세션 쿠키를 먼저 확정한 뒤 이동하게 한다.
 */
function completionWithCookies(
  url: URL,
  pendingCookies: PendingCookie[],
) {
  const destination = `${url.pathname}${url.search}${url.hash}`;
  const scriptDestination = JSON.stringify(destination).replace(
    /</g,
    "\\u003c",
  );
  const response = new NextResponse(
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="refresh" content="1;url=${escapeHtml(destination)}" />
    <title>로그인 완료 · INPICK</title>
    <style>
      html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fff;color:#0d0d0d;font-family:system-ui,-apple-system,sans-serif}
      main{text-align:center}.mark{width:38px;height:38px;margin:0 auto 16px;border-radius:14px;background:linear-gradient(135deg,#4f8cff,#2457d6);animation:pulse 1s ease-in-out infinite alternate}
      p{margin:0;font-size:14px;font-weight:700}@keyframes pulse{to{opacity:.45;transform:scale(.92)}}
    </style>
  </head>
  <body>
    <main><div class="mark"></div><p>로그인이 완료되었습니다.</p></main>
    <script>window.location.replace(${scriptDestination});</script>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "text/html; charset=utf-8",
        "referrer-policy": "no-referrer",
        "x-inpick-auth-completion": "session-established",
      },
    },
  );
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
        sessionCookieCount: pendingCookies.filter(
          ({ name, value }) =>
            name.includes("auth-token") &&
            !name.includes("code-verifier") &&
            value.length > 0,
        ).length,
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
      return completionWithCookies(new URL(next, origin), pendingCookies);
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
