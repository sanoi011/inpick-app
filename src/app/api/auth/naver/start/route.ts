import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// 네이버 OAuth 시작 — state(CSRF) + next/account_type 쿠키 저장 후 nid.naver.com으로 리다이렉트
export async function GET(req: NextRequest) {
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/auth?error=naver_not_configured", req.url));
  }

  const { searchParams, origin } = new URL(req.url);
  const next = searchParams.get("next") || "/";
  const accountType = searchParams.get("account_type") === "contractor" ? "contractor" : "consumer";

  const state = crypto.randomBytes(24).toString("base64url");

  const naverAuthUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  naverAuthUrl.searchParams.set("response_type", "code");
  naverAuthUrl.searchParams.set("client_id", clientId);
  naverAuthUrl.searchParams.set("redirect_uri", `${origin}/api/auth/naver/callback`);
  naverAuthUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(naverAuthUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10, // 10분
  };
  res.cookies.set("naver_oauth_state", state, cookieOpts);
  res.cookies.set("naver_oauth_next", next, cookieOpts);
  res.cookies.set("naver_oauth_account_type", accountType, cookieOpts);
  return res;
}
