/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Shield,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAVER_LOGIN_ENABLED } from "@/lib/auth/naver-login-flag";

type OAuthProvider = "google" | "kakao" | "apple" | "naver";

export default function ContractorLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  // 이미 로그인된 사업자면 dashboard로
  useEffect(() => {
    const token = localStorage.getItem("contractor_token");
    if (token) {
      router.replace("/contractor");
    }
  }, [router]);

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    if (provider === "naver") {
      setError("네이버 로그인은 곧 지원됩니다.");
      return;
    }
    setOauthLoading(provider);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/contractor")}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "kakao" | "apple",
        options: {
          redirectTo: callbackUrl,
          queryParams: { account_type: "contractor" },
        },
      });
      if (oauthError) {
        setError(`${provider} 로그인 실패: ${oauthError.message}`);
        setOauthLoading(null);
      }
    } catch {
      setError("소셜 로그인 중 오류가 발생했습니다.");
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col">
      {/* 정부기관 스타일 상단 바 */}
      <div className="bg-[#1B3556] text-white">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[0.7rem] py-1.5">
          <span className="opacity-80">대한민국 인테리어 사업자 종합 시스템</span>
          <span className="opacity-70">사업자 로그인</span>
        </div>
      </div>

      <header className="bg-white border-b-2 border-[#1B3556]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#1B3556]" />
            <span className="text-lg font-extrabold tracking-tight text-zinc-900">
              In<span className="text-primary-500">Pick</span>
              <span className="ml-2 text-[0.7rem] font-bold tracking-widest text-zinc-500 uppercase">
                사업자
              </span>
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-zinc-200 rounded shadow-sm">
            <div className="px-7 py-6 border-b border-zinc-200">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#1B3556]/10 text-[#1B3556] mb-3">
                <Building2 className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
                사업자 로그인
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                간편 소셜 로그인 후 사업자 정보를 등록할 수 있습니다.
              </p>
            </div>

            <div className="px-7 py-6 space-y-3">
              <button
                onClick={() => handleOAuth("google")}
                disabled={!!oauthLoading}
                className="w-full inline-flex items-center justify-center gap-3 h-12 rounded border border-zinc-300 bg-white text-sm font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Google로 로그인
              </button>
              <button
                onClick={() => handleOAuth("kakao")}
                disabled={!!oauthLoading}
                className="w-full inline-flex items-center justify-center gap-3 h-12 rounded bg-[#FEE500] text-sm font-bold text-[#3C1E1E] hover:bg-[#FDD800] disabled:opacity-50"
              >
                {oauthLoading === "kakao" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-base font-extrabold">K</span>
                )}
                카카오로 로그인
              </button>
              {NAVER_LOGIN_ENABLED && (
                <button
                  onClick={() => handleOAuth("naver")}
                  disabled={!!oauthLoading}
                  className="w-full inline-flex items-center justify-center gap-3 h-12 rounded bg-[#03C75A] text-sm font-bold text-white hover:bg-[#02b552] disabled:opacity-50"
                >
                  {oauthLoading === "naver" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-base font-extrabold">N</span>
                  )}
                  네이버로 로그인
                </button>
              )}
              <button
                onClick={() => handleOAuth("apple")}
                disabled={!!oauthLoading}
                className="w-full inline-flex items-center justify-center gap-3 h-12 rounded bg-black text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {oauthLoading === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-base"></span>
                )}
                Apple로 로그인
              </button>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="px-7 py-4 border-t border-zinc-200 bg-zinc-50 text-[0.7rem] text-zinc-600 leading-relaxed">
              로그인 후 첫 화면에서 <b>사업자등록번호</b> · <b>대표자명</b> · 사업장 주소
              등 입찰 조건 정보를 등록하면 즉시 입찰 참여 가능합니다.
            </div>
          </div>

          <p className="mt-4 text-center text-[0.7rem] text-zinc-500">
            소비자 회원이신가요? <a href="/auth?type=consumer" className="text-[#1B3556] font-semibold hover:underline">소비자 로그인 →</a>
          </p>
        </div>
      </main>
    </div>
  );
}
