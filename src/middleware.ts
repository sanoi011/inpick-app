import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host")?.toLowerCase() ?? "";

  // ── aiod.kr 도메인이면 / → /aiod 컨텐츠로 rewrite (URL은 그대로 유지) ──
  // www.aiod.kr 또는 aiod.kr 모두 적용. /api, /aiod, _next 는 제외 (정상 작동)
  const isAiodHost = /(^|\.)aiod\.kr$/.test(host);
  if (
    isAiodHost &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/aiod") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/auth")
  ) {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/aiod";
      return NextResponse.rewrite(url);
    }
    // aiod 도메인에서 인픽 전용 라우트 접근 시 inpick으로 redirect
    if (
      pathname.startsWith("/workflow") ||
      pathname.startsWith("/project") ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/contract") ||
      pathname.startsWith("/contractor") ||
      pathname.startsWith("/mypage") ||
      pathname.startsWith("/community") ||
      pathname.startsWith("/find-contractors") ||
      pathname.startsWith("/admin")
    ) {
      const inpickUrl = new URL(
        pathname + (request.nextUrl.search || ""),
        process.env.NEXT_PUBLIC_SITE_URL || "https://inpick-app.vercel.app"
      );
      return NextResponse.redirect(inpickUrl);
    }
  }

  // Admin API 인증 (login 제외)
  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Contractor API 인증 (login/register 제외)
  if (
    pathname.startsWith("/api/contractor/") &&
    !pathname.startsWith("/api/contractor/login") &&
    !pathname.startsWith("/api/contractor/register")
  ) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
