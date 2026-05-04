import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
