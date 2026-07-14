"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("유효하지 않은 링크입니다.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contractor/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "비밀번호 변경에 실패했습니다.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth?type=contractor"), 3000);
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-[#0d0d0d]">
      <header className="absolute inset-x-0 top-0 flex h-16 items-center px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="hex-mask h-[22px] w-[22px] text-primary-500" />
          <span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span>
          <span className="rounded-full border border-black/10 px-2 py-1 text-[9px] font-bold tracking-[0.08em] text-black/48">BUSINESS</span>
        </Link>
      </header>
      <section className="flex min-h-screen items-center justify-center px-5 pb-12 pt-24 sm:px-8">
        <div className="w-full max-w-[420px]">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-500">
            <Lock className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">Business account recovery</p>
          <h1 className="mt-2 text-[28px] font-medium tracking-[-0.055em] sm:text-[34px]">사업자 비밀번호 재설정</h1>

          <div className="mt-8">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto h-11 w-11 text-emerald-500" />
              <h2 className="text-[18px] font-semibold">비밀번호가 변경되었습니다</h2>
              <p className="text-[13px] text-black/45">잠시 후 로그인 페이지로 이동합니다...</p>
              <Link href="/auth?type=contractor" className="inline-flex rounded-full bg-black px-5 py-3 text-[13px] font-semibold text-white">
                바로 이동하기
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4">
              <AlertCircle className="mx-auto h-11 w-11 text-primary-500" />
              <p className="text-[13px] text-black/50">유효하지 않은 링크입니다.</p>
              <Link href="/auth?type=contractor" className="text-[13px] font-medium underline decoration-black/20 underline-offset-4">
                로그인 페이지로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-2xl bg-primary-50 px-4 py-3 text-[13px] font-medium text-primary-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[12px] font-semibold text-black/62">새 비밀번호</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6자 이상 입력"
                      className="h-[50px] w-full rounded-2xl border border-black/10 pl-11 pr-4 text-[14px] outline-none transition focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[12px] font-semibold text-black/62">비밀번호 확인</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호를 다시 입력"
                      className="h-[50px] w-full rounded-2xl border border-black/10 pl-11 pr-4 text-[14px] outline-none transition focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-black text-[14px] font-semibold text-white transition hover:bg-black/75 disabled:opacity-45"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  비밀번호 변경
                </button>
              </form>
            </>
          )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ContractorResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
