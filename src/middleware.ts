import { NextResponse, type NextRequest } from "next/server";
import {
  getCanonicalAuthUrl,
  getRootOAuthRecoveryUrl,
} from "@/lib/auth/oauth-recovery";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OAuth PKCE 쿠키가 www/비-www 사이에서 유실되지 않도록 운영 호스트를 하나로 고정한다.
  const canonicalUrl = getCanonicalAuthUrl(request.url);
  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl, 307);
  }

  // Supabase Redirect URL 허용 목록이 어긋나 Site URL(/)로 폴백해도 code를 교환한다.
  const recoveredCallbackUrl = getRootOAuthRecoveryUrl(request.url);
  if (recoveredCallbackUrl) {
    return NextResponse.redirect(recoveredCallbackUrl, 307);
  }

  // Admin API 인증 (login 제외)
  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/login")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Contractor API 인증 (login/register/test-accounts 제외)
  if (
    pathname.startsWith("/api/contractor/") &&
    !pathname.startsWith("/api/contractor/login") &&
    !pathname.startsWith("/api/contractor/register") &&
    !pathname.startsWith("/api/contractor/test-accounts")
  ) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 유료 AI 엔드포인트 — 로그인 세션 필수 (익명 과금 어뷰징 차단)
  // 유료 외부 API(Claude/OpenAI/RunPod GPU)를 호출하는 경로만 게이트.
  // 조회·저장 성격(design-outputs 등)은 각 라우트에서 자체 인증하므로 제외.
  const AI_PROTECTED_PREFIXES = [
    "/api/inpick/design-chat/",
    "/api/inpick/analyze-floorplan",
    "/api/inpick/normalize-floorplan",
    "/api/inpick/vision-materials/",
    "/api/inpick/editable-render/",
    "/api/inpick/sam/",
  ];
  const requireUserForApi =
    pathname !== "/api/inpick/sam/health" &&
    AI_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  return await updateSession(request, { requireUserForApi });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
