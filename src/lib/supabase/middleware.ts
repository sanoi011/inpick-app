import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(
  request: NextRequest,
  opts?: { requireUserForApi?: boolean },
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes("your_supabase")
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          // 보안: 세션 쿠키로 강제 (maxAge/expires 제거 → 브라우저 닫으면 자동 삭제)
          // 사용자가 브라우저 끄고 다시 켰을 때 자동 로그인 방지 → 다른 사람이 같은 컴퓨터로 진입 시 익명 시작
          cookiesToSet.forEach(({ name, value, options }) => {
            const sessionOptions = { ...options };
            delete sessionOptions.maxAge;
            delete sessionOptions.expires;
            supabaseResponse.cookies.set(name, value, sessionOptions);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 유료 AI 엔드포인트 보호 — 비로그인 요청 401 차단 (과금 어뷰징 방지)
  if (opts?.requireUserForApi && !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  return supabaseResponse;
}
