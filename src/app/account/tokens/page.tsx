"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Hexagon, Check, CreditCard, Loader2 } from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import { useTokens, TokenTransaction } from "@/hooks/useTokens";

const PACKAGES = [
  { id: "p10",  tokens: 10,  price: 5000,   discount: 0,  hot: false },
  { id: "p30",  tokens: 30,  price: 14000,  discount: 7,  hot: false },
  { id: "p50",  tokens: 50,  price: 22000,  discount: 12, hot: true  },
  { id: "p100", tokens: 100, price: 40000,  discount: 20, hot: false },
];

export default function TokensPage() {
  const router = useRouter();
  const tokens = useTokens();
  const [selected, setSelected] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ amount: number } | null>(null);

  const pkg = PACKAGES.find((p) => p.id === selected);

  // 토스페이먼츠 SDK 자리. 실제 가맹점 등록 후 client key 입력 시 즉시 작동.
  // 지금은 결제 시뮬레이션 (1.2초 후 성공) — purchase RPC 호출.
  const handlePay = async () => {
    if (!pkg) return;
    setPaying(true);
    try {
      // ── 토스페이먼츠 통합 자리 ──────────────────
      // const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      // await tossPayments.requestPayment("카드", { amount: pkg.price, orderId: ..., orderName: `InPick 토큰 ${pkg.tokens}개`, successUrl, failUrl });
      // 결제 성공 시 successUrl 페이지에서 paymentKey/orderId/amount 받아 백엔드 confirm → purchase_tokens RPC 호출.
      // ──────────────────────────────────────────────
      // 임시: 결제 시뮬레이션
      await new Promise((r) => setTimeout(r, 1200));
      const fakePaymentId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ok = await tokens.purchase(pkg.tokens, fakePaymentId, {
        package_id: pkg.id,
        price: pkg.price,
        simulated: true,
      });
      if (ok) {
        setSuccessInfo({ amount: pkg.tokens });
        setSelected(null);
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <LenisProvider>
      <main className="font-kr relative min-h-screen overflow-hidden bg-offwhite text-ink">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.85),transparent_60%)]" />
          <div className="absolute -right-[12%] top-[10%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.14),transparent_70%)] blur-3xl" />
        </div>

        <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 pt-10 lg:px-8">
          <button
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white/85 text-ink backdrop-blur hover:bg-white"
            aria-label="이전"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <a href="/" className="font-en text-[20px] font-extrabold tracking-tightest text-ink">
            in<span className="text-primary-500">pick</span>
          </a>
          <div className="w-10" />
        </header>

        <section className="relative z-20 mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
          {/* 헤드 */}
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-primary-500">
                ◇ INPICK TOKENS
              </p>
              <h1 className="mt-3 text-[2.4rem] font-extrabold leading-[1.02] tracking-tightest sm:text-[3.4rem] lg:text-[4rem]">
                토큰 충전
                <br />
                <span className="text-gradient-primary">필요한 만큼만.</span>
              </h1>
              <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-ink-60">
                AI 디자인 1세트 = ⬢ 1 · AR 진입 = ⬢ 3 · 추가 도면 옵션 = ⬢ 2~8.
                토큰은 환급되지 않으며 한 번 사용된 토큰은 복구되지 않습니다.
              </p>
            </div>

            {/* 잔액 카드 */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white p-7 shadow-card">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background: "linear-gradient(90deg,transparent,#F73B20,transparent)",
                  }}
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-40">
                  현재 잔액
                </p>
                <p className="mt-2 flex items-end gap-2 text-[3.4rem] font-extrabold tabular leading-none tracking-tightest">
                  <Hexagon className="h-8 w-8 fill-primary-500 text-primary-500" />
                  <span className="text-gradient-primary">
                    {tokens.loading ? "—" : tokens.balance}
                  </span>
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-[0.85rem]">
                  <div className="rounded-2xl bg-primary-50 p-3">
                    <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-700">
                      누적 충전
                    </p>
                    <p className="mt-1 font-bold tabular text-ink">
                      ⬢ {tokens.totalPurchased}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-40">
                      누적 사용
                    </p>
                    <p className="mt-1 font-bold tabular text-ink">
                      ⬢ {tokens.totalUsed}
                    </p>
                  </div>
                </div>
                {!tokens.authenticated && !tokens.loading && (
                  <p className="mt-4 rounded-xl bg-warning-bg px-3 py-2 text-[0.78rem] text-warning-text">
                    로그인 후 결제·이력이 영구 보관됩니다 (현재는 로컬 임시).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 패키지 4종 */}
          <div className="mt-12">
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-40">
              CHARGE PACKAGES
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PACKAGES.map((p) => {
                const sel = selected === p.id;
                return (
                  <motion.button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative overflow-hidden rounded-[28px] border-2 p-6 text-left transition-all ${
                      sel
                        ? "border-primary-500 bg-white shadow-card-hover"
                        : "border-primary-100 bg-white/85 hover:border-primary-300"
                    }`}
                  >
                    {p.hot && (
                      <span className="font-mono absolute right-4 top-4 rounded-full bg-primary-500 px-2 py-0.5 text-[0.65rem] font-bold tracking-widest text-white">
                        HOT
                      </span>
                    )}
                    <p className="font-mono text-[11px] uppercase tracking-widest text-primary-500">
                      ⬢ {p.tokens} 토큰
                    </p>
                    <p className="mt-3 text-[2rem] font-extrabold tabular leading-none tracking-tightest">
                      ₩ {p.price.toLocaleString()}
                    </p>
                    {p.discount > 0 ? (
                      <p className="mt-1 text-[0.78rem] font-bold text-success-text">
                        -{p.discount}% 할인
                      </p>
                    ) : (
                      <p className="mt-1 text-[0.78rem] text-ink-40">기본가</p>
                    )}
                    {sel && (
                      <span className="absolute bottom-5 right-5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-white">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* 결제 버튼 */}
          <div className="mt-8 flex items-center justify-between rounded-[28px] border border-primary-100 bg-white p-6 shadow-card">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-40">
                선택 패키지
              </p>
              <p className="mt-1 text-[1.2rem] font-bold tracking-tight text-ink">
                {pkg ? `⬢ ${pkg.tokens} 토큰 · ₩ ${pkg.price.toLocaleString()}` : "패키지를 선택해주세요"}
              </p>
              {pkg && (
                <p className="text-[0.78rem] text-ink-60">
                  결제 후 잔액 ⬢ {tokens.balance + pkg.tokens}
                </p>
              )}
            </div>
            <button
              onClick={handlePay}
              disabled={!pkg || paying}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary-500 px-6 text-[14px] font-semibold tracking-tight text-white shadow-cta transition-colors hover:bg-primary-600 disabled:bg-primary-100 disabled:text-ink-40 disabled:shadow-none"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 결제 중…
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" /> 결제하기
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-center text-[0.72rem] text-ink-40">
            결제 시스템 자리 (토스페이먼츠) — 가맹점 등록 후 즉시 활성화됩니다.
          </p>

          {/* 거래 이력 */}
          <div className="mt-14">
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-40">
              TRANSACTION HISTORY
            </p>
            <div className="mt-4 overflow-hidden rounded-[28px] border border-primary-100 bg-white shadow-card">
              {tokens.history.length === 0 ? (
                <p className="px-6 py-10 text-center text-[0.85rem] text-ink-40">
                  거래 이력이 없습니다
                </p>
              ) : (
                <ul className="divide-y divide-primary-100">
                  {tokens.history.slice(0, 30).map((t) => (
                    <HistoryRow key={t.id} tx={t} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* 결제 성공 모달 */}
        <AnimatePresence>
          {successInfo && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSuccessInfo(null)}
                className="fixed inset-0 z-[80] bg-burgundy/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 text-center shadow-card-hover"
              >
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success-text">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-ink">
                  결제 완료
                </h3>
                <p className="mt-2 text-[14px] text-ink-60">
                  ⬢ {successInfo.amount} 토큰이 충전되었습니다.
                  <br />
                  현재 잔액 <span className="font-bold tabular text-ink">⬢ {tokens.balance}</span>
                </p>
                <button
                  onClick={() => setSuccessInfo(null)}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-500 px-4 py-3 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
                >
                  확인
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </LenisProvider>
  );
}

function HistoryRow({ tx }: { tx: TokenTransaction }) {
  const date = new Date(tx.created_at);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
  const isPlus = tx.amount > 0;
  const labelMap: Record<string, string> = {
    signup_bonus: "가입 증정",
    purchase: "충전",
    use: "사용",
    refund: "환불",
    admin_adjust: "관리자 조정",
  };
  const featureMap: Record<string, string> = {
    ai_render: "AI 디자인",
    ar_session: "AR 세션",
    drawing_option: "도면 옵션",
    welcome: "환영 보너스",
    manual: "결제",
  };
  return (
    <li className="flex items-center justify-between px-5 py-4 text-[0.88rem]">
      <div>
        <p className="font-bold tracking-tight text-ink">
          {labelMap[tx.type] ?? tx.type}
          {tx.feature && (
            <span className="ml-2 text-[0.78rem] font-normal text-ink-40">
              {featureMap[tx.feature] ?? tx.feature}
            </span>
          )}
        </p>
        <p className="font-mono text-[0.7rem] text-ink-40">{dateStr}</p>
      </div>
      <div className="text-right">
        <p
          className={`tabular text-[1rem] font-extrabold tracking-tighter ${
            isPlus ? "text-success-text" : "text-ink"
          }`}
        >
          {isPlus ? "+" : ""}
          {tx.amount} ⬢
        </p>
        <p className="font-mono text-[0.7rem] text-ink-40">잔액 {tx.balance_after}</p>
      </div>
    </li>
  );
}
