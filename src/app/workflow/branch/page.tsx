"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Boxes,
  ScrollText,
  ArrowRight,
  Hexagon,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import { useTokens } from "@/hooks/useTokens";

const AR_COST = 3;

export default function BranchPage() {
  const router = useRouter();
  const { balance } = useTokens();
  const [helpOpen, setHelpOpen] = useState(false);
  const arAffordable = balance >= AR_COST;

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-[#FFF6F5] text-primary-900">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.9),transparent_60%)]" />
          <div className="absolute -right-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.16),transparent_70%)] blur-3xl" />
          <div className="absolute -left-[15%] top-[40%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.16),transparent_70%)] blur-3xl" />
        </div>

        <Notch step={3} total={5} />

        <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 pt-12 lg:px-8 lg:pt-14">
          <a href="/" className="text-[1.3rem] font-extrabold tracking-tightest text-primary-900">
            In<span className="text-primary-500">Pick</span>
          </a>
          <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
        </header>

        <section className="relative z-20 mx-auto max-w-5xl px-6 py-14 text-center lg:px-8 lg:py-20">
          <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-600">
            STEP 03
          </p>
          <h1 className="mt-3 text-[2.4rem] font-extrabold leading-[1.02] tracking-tightest text-primary-900 sm:text-[3.6rem] lg:text-[4.2rem]">
            계약 전에 한 번 더
            <br />
            <span className="text-gradient-primary">눈으로 확인할까요?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[0.98rem] leading-relaxed text-primary-900/70">
            바로 견적으로 가도 됩니다. AR로 마감재를 한 번 더 바꿔보고 결정해도 됩니다.
          </p>

          <div className="mx-auto mt-12 grid max-w-4xl gap-5 lg:grid-cols-2">
            {/* AR */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`relative overflow-hidden rounded-[28px] border bg-white/80 p-7 text-left shadow-card backdrop-blur-2xl transition-all ${
                arAffordable ? "border-primary-200 hover:border-primary-400 hover:shadow-card-hover" : "border-neutral-200 opacity-80"
              }`}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
              />
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-cta">
                  <Boxes className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-success-bg px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-success-text">
                  추천
                </span>
              </div>
              <h2 className="mt-6 text-[1.6rem] font-extrabold leading-tight tracking-tighter">
                AR로 디자인 확인
              </h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-primary-900/70">
                실측 도면 위에서 마감재를 직접 바꿔보며, 시공 후 후회 없이 결정합니다.
              </p>

              <div className="mt-5 flex items-center justify-between rounded-2xl bg-primary-50/70 px-4 py-3 ring-1 ring-primary-100">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">사용 토큰</p>
                  <p className="mt-1 text-2xl font-extrabold tabular tracking-tighter text-primary-700">
                    <Hexagon className="mr-1 inline h-4 w-4 fill-token-400 text-token-400" />
                    {AR_COST}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">잔액</p>
                  <p className={`mt-1 text-2xl font-extrabold tabular tracking-tighter ${arAffordable ? "text-primary-900" : "text-danger-text"}`}>
                    {balance}
                  </p>
                </div>
              </div>

              {!arAffordable && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-danger-bg px-3 py-2.5 text-[0.78rem] text-danger-text">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>AR 확인에 {AR_COST}토큰이 필요하지만 현재 보유 토큰은 {balance}개입니다.</span>
                </div>
              )}

              <div className="mt-6 flex items-center gap-2">
                {arAffordable ? (
                  <button
                    onClick={() => router.push("/workflow/ar")}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold tracking-tight text-white shadow-cta transition-colors hover:bg-primary-600"
                  >
                    AR로 확인하기 <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <a
                    href="/account/tokens"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
                  >
                    토큰 충전하기
                  </a>
                )}
                <button
                  onClick={() => setHelpOpen(true)}
                  aria-label="AR 도움말"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-900/70 hover:bg-primary-50"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            </motion.div>

            {/* 바로 견적 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/80 p-7 text-left shadow-card backdrop-blur-2xl transition-all hover:border-primary-300 hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <ScrollText className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-primary-700">
                  무료
                </span>
              </div>
              <h2 className="mt-6 text-[1.6rem] font-extrabold leading-tight tracking-tighter">
                바로 견적으로
              </h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-primary-900/70">
                AR 없이 곧장 공식 단가 견적으로 갑니다. 토큰을 쓰지 않습니다.
              </p>

              <div className="mt-5 rounded-2xl bg-neutral-100 px-4 py-3">
                <p className="text-[0.78rem] text-primary-900/70">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary-600" />
                  근거·규격·출처 모두 공개되는 투명한 견적
                </p>
              </div>

              <button
                onClick={() => router.push("/workflow/estimate")}
                className="mt-9 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-primary-300 bg-white px-5 py-3 text-sm font-semibold tracking-tight text-primary-900 transition-colors hover:bg-primary-50"
              >
                견적 보러 가기 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          </div>
        </section>

        <AnimatePresence>
          {helpOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHelpOpen(false)}
                className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover"
              >
                <h3 className="text-lg font-extrabold tracking-tight text-primary-900">
                  💡 AR 확인의 장점
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-primary-900/70">
                  실제 시공된 부위에 직접 다른 자재를 넣어보며, 계약 전 한 번 더 확인할 수 있습니다. 시공 후 후회를 미리 방지하세요.
                </p>
                <div className="mt-5 rounded-2xl bg-primary-50 p-4 text-[0.85rem]">
                  <p className="font-bold text-primary-700">
                    <Hexagon className="mr-1 inline h-3.5 w-3.5 fill-token-400 text-token-400" />
                    사용 토큰: {AR_COST}개 (= 1,500원 상당)
                  </p>
                  <p className="mt-1 text-primary-900/70">한 번 진입한 AR 세션은 종료 후 재진입 시 다시 토큰이 필요합니다.</p>
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  알겠어요
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </LenisProvider>
  );
}
