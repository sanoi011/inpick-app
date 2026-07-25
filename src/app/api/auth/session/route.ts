import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 브라우저 Supabase auth lock이 늦어지는 경우를 위한 동일-origin 복구 확인.
 * 요청 쿠키는 서버 Supabase가 검증하며, 현재 사용자 본인의 세션만 반환한다.
 */
export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { authenticated: true, user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
