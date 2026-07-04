"use client";

/**
 * 네이티브 앱 OAuth 복귀 브릿지 페이지.
 *
 * 왜 필요한가 (iOS 제약):
 *   SFSafariViewController(인앱 브라우저)는 HTTP 302 리다이렉트로 커스텀 스킴
 *   (kr.inpick.app://...)을 열 수 없음 → "주소가 유효하지 않아 Safari를 열 수 없습니다".
 *   Supabase가 이 HTTPS 페이지로 리다이렉트 → 여기서 딥링크 자동 시도 + 버튼(사용자 제스처)으로
 *   앱 복귀 → 앱의 appUrlOpen 리스너(NativeAuthListener)가 code 교환.
 *
 * Supabase 대시보드 Auth → URL Configuration → Redirect URLs에
 * https://www.interiorpick.co.kr/auth/app-return 등록 필요.
 */
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { NATIVE_OAUTH_REDIRECT } from "@/lib/auth/oauth-start";

function buildDeepLink(): { link: string; hasPayload: boolean; errorDesc: string | null } {
  if (typeof window === "undefined") {
    return { link: NATIVE_OAUTH_REDIRECT, hasPayload: false, errorDesc: null };
  }
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const qs = new URLSearchParams(search);
  // error_description 없이 error 코드만 오는 케이스(동의 거부 등)도 에러로 처리
  const errorDesc = qs.get("error_description") || (qs.get("error") ? `로그인이 완료되지 않았습니다 (${qs.get("error")})` : null);
  const hasPayload = !!(qs.get("code") || hash.includes("access_token") || qs.get("error"));
  return { link: `${NATIVE_OAUTH_REDIRECT}${search}${hash}`, hasPayload, errorDesc };
}

export default function AppReturnPage() {
  const [{ link, hasPayload, errorDesc }, setState] = useState(() => ({
    link: NATIVE_OAUTH_REDIRECT,
    hasPayload: true,
    errorDesc: null as string | null,
  }));
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const built = buildDeepLink();
    setState(built);
    if (built.hasPayload && !built.errorDesc) {
      // 자동 복귀 시도 — 제스처 없는 커스텀 스킴 이동은 iOS에서 조용히 무시될 수 있어
      // 아래 버튼이 항상 폴백으로 존재
      window.location.href = built.link;
      const t = setTimeout(() => setAttempted(true), 1200);
      return () => clearTimeout(t);
    }
    setAttempted(true);
  }, []);

  const openApp = () => {
    window.location.href = link;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50/60 to-white px-6">
      <div className="w-full max-w-sm rounded-[28px] border border-primary-100 bg-white p-8 text-center shadow-card">
        <img src="/icons/icon-192x192.png" alt="INPICK" className="mx-auto h-16 w-16 rounded-2xl shadow" />

        {errorDesc ? (
          <>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              <AlertCircle className="h-3.5 w-3.5" /> 로그인 실패
            </div>
            <p className="mt-3 text-sm leading-relaxed text-primary-900/70">{errorDesc}</p>
            <button
              onClick={openApp}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
            >
              앱으로 돌아가기 <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : !hasPayload ? (
          <>
            <h1 className="mt-5 text-lg font-extrabold text-primary-900">잘못된 접근입니다</h1>
            <p className="mt-2 text-sm text-primary-900/60">
              이 페이지는 앱 로그인 과정에서만 사용됩니다.
            </p>
            <a
              href="/"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
            >
              홈으로 가기
            </a>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-lg font-extrabold text-primary-900">로그인 완료!</h1>
            <p className="mt-2 text-sm leading-relaxed text-primary-900/60">
              {attempted
                ? "아래 버튼을 눌러 INPICK 앱으로 돌아가세요."
                : "INPICK 앱으로 돌아가는 중…"}
            </p>
            {!attempted && (
              <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-primary-500" />
            )}
            <button
              onClick={openApp}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
            >
              앱으로 돌아가기 <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-[0.7rem] text-primary-900/40">
              &ldquo;INPICK에서 열기&rdquo; 확인창이 뜨면 열기를 눌러주세요
            </p>
          </>
        )}
      </div>
    </main>
  );
}
