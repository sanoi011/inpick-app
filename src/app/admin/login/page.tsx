"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem("inpick_remembered_admin_email");
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberLogin(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인 실패");
      } else {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_id", data.id);
        localStorage.setItem("admin_email", data.email);
        localStorage.setItem("admin_name", data.name);
        localStorage.setItem("admin_role", data.role);
        if (rememberLogin) {
          localStorage.setItem("inpick_remembered_admin_email", data.email || email.trim());
        } else {
          localStorage.removeItem("inpick_remembered_admin_email");
        }
        router.push("/admin");
      }
    } catch {
      setError("서버 연결 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-[#0d0d0d]">
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 sm:px-8 lg:h-20 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="InPick 홈">
          <span className="hex-mask h-[22px] w-[22px] text-primary-500" />
          <span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span>
          <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-black/48">
            ADMIN
          </span>
        </Link>
        <Link href="/" className="hidden items-center gap-1.5 text-[13px] font-medium text-black/55 transition hover:text-black sm:inline-flex">
          메인으로 <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid min-h-screen lg:grid-cols-[1.06fr_0.94fr]">
        <section className="relative hidden min-h-screen overflow-hidden p-5 lg:block">
          <div className="relative h-full min-h-[680px] overflow-hidden rounded-[28px] bg-[#eee]">
            <Image
              src="/images/feature-fireplace.jpg"
              alt="InPick AI 인테리어"
              fill
              priority
              sizes="55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/5 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">InPick operation console</p>
              <h1 className="mt-4 max-w-xl break-keep text-[44px] font-medium leading-[1.04] tracking-[-0.06em] xl:text-[56px]">
                인픽의 모든 운영을 한눈에.
              </h1>
              <p className="mt-5 max-w-lg text-[14px] leading-7 text-white/68">
                사용자, 프로젝트, AI 렌더링, 견적과 결제 데이터를 하나의 운영 콘솔에서 관리하세요.
              </p>
              <div className="mt-8 flex flex-wrap gap-2 text-[11px] font-medium text-white/75">
                {['실시간 운영 지표', 'AI 시스템 모니터링', '견적·결제 관리'].map((item) => (
                  <span key={item} className="rounded-full border border-white/22 bg-white/10 px-3 py-2 backdrop-blur-md">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 pb-12 pt-24 sm:px-8 lg:pt-16">
          <div className="w-full max-w-[420px]">
            <div className="mb-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">Secure access</p>
              <h2 className="mt-2 text-[28px] font-medium tracking-[-0.055em] sm:text-[34px]">관리자 로그인</h2>
              <p className="mt-3 text-[13px] leading-6 text-black/48">승인된 인픽 관리자 계정으로 로그인해 주세요.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="mb-2 block text-[12px] font-semibold text-black/62">이메일</label>
                <input
                  id="admin-email"
                  type="email"
                  name="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@inpick.kr"
                  autoComplete="username"
                  required
                  className="h-[52px] w-full rounded-2xl border border-black/10 bg-white px-4 text-[14px] outline-none transition placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="mb-2 block text-[12px] font-semibold text-black/62">비밀번호</label>
                <input
                  id="admin-password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력해 주세요"
                  autoComplete="current-password"
                  required
                  className="h-[52px] w-full rounded-2xl border border-black/10 bg-white px-4 text-[14px] outline-none transition placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 px-0.5 py-0.5 text-left">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberLogin(checked);
                    if (!checked) {
                      try {
                        localStorage.removeItem("inpick_remembered_admin_email");
                      } catch {
                        /* private mode */
                      }
                    }
                  }}
                  className="h-4 w-4 rounded border-black/20 accent-black"
                />
                <span className="text-[12px] font-semibold text-black/62">로그인 저장</span>
              </label>

              {error && (
                <p role="alert" className="rounded-2xl bg-primary-50 px-4 py-3 text-[13px] font-medium text-primary-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[14px] font-semibold text-white transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>관리자 콘솔 시작하기 <ArrowUpRight className="h-4 w-4" /></>}
              </button>
            </form>

            <div className="mt-7 flex items-start gap-2.5 border-t border-black/[0.07] pt-5 text-[11px] leading-5 text-black/38">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>관리자 콘솔은 인가된 계정만 접근할 수 있으며 모든 주요 작업 기록이 보관됩니다.</p>
            </div>

            <Link href="/" className="mt-7 inline-flex items-center gap-1.5 text-[12px] font-medium text-black/42 transition hover:text-black lg:hidden">
              <ArrowLeft className="h-3.5 w-3.5" /> 홈으로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
