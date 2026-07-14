/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Building2,
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
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
    <main className="min-h-screen bg-white text-[#0d0d0d]">
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 sm:px-8 lg:h-20 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="InPick 홈">
          <span className="hex-mask h-[22px] w-[22px] text-primary-500" />
          <span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span>
          <span className="rounded-full border border-black/10 px-2 py-1 text-[9px] font-bold tracking-[0.08em] text-black/48">BUSINESS</span>
        </Link>
        <Link href="/" className="hidden items-center gap-1.5 text-[13px] font-medium text-black/55 transition hover:text-black sm:inline-flex">
          메인으로 <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden min-h-screen overflow-hidden p-5 lg:block">
          <div className="relative h-full min-h-[700px] overflow-hidden rounded-[28px] bg-[#eee]">
            <Image
              src="/mode-cards/photo-commercial.jpg"
              alt="InPick 사업자 서비스"
              fill
              priority
              sizes="54vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/10 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">InPick for business</p>
              <h1 className="mt-4 max-w-xl break-keep text-[44px] font-medium leading-[1.04] tracking-[-0.06em] xl:text-[56px]">
                좋은 시공사와 좋은 고객이 만나는 곳.
              </h1>
              <p className="mt-5 max-w-lg break-keep text-[14px] leading-7 text-white/68">
                검증된 프로젝트와 투명한 견적을 기반으로 새로운 시공 기회를 만나보세요.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 pb-12 pt-24 sm:px-8 lg:py-24">
          <div className="w-full max-w-[420px]">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-500">
              <Building2 className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">Partner access</p>
            <h2 className="mt-2 text-[28px] font-medium tracking-[-0.055em] sm:text-[34px]">사업자 로그인</h2>
            <p className="mt-3 text-[13px] leading-6 text-black/48">간편 소셜 로그인 후 사업자 정보를 등록할 수 있습니다.</p>

            <div className="mt-8 space-y-2.5">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={!!oauthLoading}
                className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold text-black transition hover:bg-black/[0.035] disabled:opacity-45"
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
                type="button"
                onClick={() => handleOAuth("kakao")}
                disabled={!!oauthLoading}
                className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold text-black transition hover:bg-black/[0.035] disabled:opacity-45"
              >
                {oauthLoading === "kakao" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#FEE500] text-[10px] font-extrabold text-[#3C1E1E]">K</span>
                )}
                카카오로 로그인
              </button>
              {NAVER_LOGIN_ENABLED && (
                <button
                  type="button"
                  onClick={() => handleOAuth("naver")}
                  disabled={!!oauthLoading}
                  className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold text-black transition hover:bg-black/[0.035] disabled:opacity-45"
                >
                  {oauthLoading === "naver" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="inline-flex h-4 w-4 items-center justify-center bg-[#03C75A] text-[10px] font-extrabold text-white">N</span>
                  )}
                  네이버로 로그인
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOAuth("apple")}
                disabled={!!oauthLoading}
                className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold text-black transition hover:bg-black/[0.035] disabled:opacity-45"
              >
                {oauthLoading === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.7c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
                  </svg>
                )}
                Apple로 로그인
              </button>
              {error && (
                <p role="alert" className="rounded-2xl bg-primary-50 px-4 py-3 text-[12px] font-medium text-primary-700">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-start gap-2.5 border-t border-black/[0.07] pt-5 text-[11px] leading-5 text-black/42">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>로그인 후 사업자등록번호·대표자명·사업장 주소를 등록하면 입찰에 참여할 수 있습니다.</p>
            </div>

            <p className="mt-6 text-center text-[11px] text-black/42">
              소비자 회원이신가요?{" "}
              <Link href="/auth?type=consumer" className="font-semibold text-black underline decoration-black/20 underline-offset-4">소비자 로그인</Link>
            </p>
            <Link href="/" className="mt-7 inline-flex items-center gap-1.5 text-[12px] font-medium text-black/42 transition hover:text-black lg:hidden">
              <ArrowLeft className="h-3.5 w-3.5" /> 홈으로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
