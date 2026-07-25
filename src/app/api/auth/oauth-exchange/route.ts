import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function jsonWithCookies(
  body: Record<string, unknown>,
  status: number,
  pendingCookies: PendingCookie[],
) {
  const response = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

/**
 * 브라우저 전역 Provider와 자동 PKCE lock을 우회하는 단일 OAuth 교환 지점.
 * verifier는 요청 쿠키에서 읽고, 세션 쿠키와 동일-origin 브라우저 fallback용
 * token을 한 응답으로 돌려준다. token/code 값은 서버 로그에 남기지 않는다.
 */
export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json(
      { ok: false, code: "INVALID_ORIGIN" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code.trim() : "";
  } catch {
    /* bounded invalid request below */
  }
  if (!code || code.length > 2_048) {
    return NextResponse.json(
      { ok: false, code: "INVALID_OAUTH_CODE" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const pendingCookies: PendingCookie[] = [];
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const session = data.session;
  if (error || !session?.access_token || !session.refresh_token) {
    console.error("[auth/oauth-exchange] exchange failed", {
      errorCode: error?.code || "SESSION_MISSING",
      hasVerifierCookie: request.cookies
        .getAll()
        .some(({ name }) => name.includes("auth-token-code-verifier")),
      pendingCookieCount: pendingCookies.length,
    });
    return jsonWithCookies(
      {
        ok: false,
        code: error?.code || "OAUTH_SESSION_MISSING",
        message: error?.message || "OAuth session was not returned",
      },
      400,
      pendingCookies,
    );
  }

  console.info("[auth/oauth-exchange] exchange succeeded", {
    userId: session.user.id,
    provider: session.user.app_metadata?.provider || "unknown",
    pendingCookieCount: pendingCookies.length,
  });
  return jsonWithCookies(
    {
      ok: true,
      provider: session.user.app_metadata?.provider || "unknown",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    },
    200,
    pendingCookies,
  );
}
