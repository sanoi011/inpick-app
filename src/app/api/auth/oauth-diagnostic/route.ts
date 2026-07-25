import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\r\n]/g, " ").slice(0, 240);
}

/**
 * OAuth 교환과 보호 경로 세션 복구의 실패 지점만 기록한다.
 * 인증 code·token·cookie 값은 받거나 기록하지 않는다.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* malformed diagnostics still return a bounded response */
  }

  const authCookies = request.cookies
    .getAll()
    .filter(({ name }) => name.includes("auth-token"));
  console.error("[auth/diagnostic] auth flow recovery event", {
    stage: clean(body.stage, "unknown"),
    errorCode: clean(body.errorCode, "unknown"),
    errorMessage: clean(body.errorMessage, "unknown"),
    host: request.nextUrl.host,
    hasVerifierCookie: authCookies.some(({ name }) =>
      name.includes("code-verifier"),
    ),
    sessionCookieCount: authCookies.filter(
      ({ name, value }) =>
        !name.includes("code-verifier") && value.length > 0,
    ).length,
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
