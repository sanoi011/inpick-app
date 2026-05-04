/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Hexagon,
  CreditCard,
  Loader2,
  Lock,
  Check,
  Building2,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import { useTokens } from "@/hooks/useTokens";

const PACKAGES = [
  { id: "p10", tokens: 10, price: 5000, discount: 0, hot: false },
  { id: "p30", tokens: 30, price: 14000, discount: 7, hot: false },
  { id: "p50", tokens: 50, price: 22000, discount: 12, hot: true },
  { id: "p100", tokens: 100, price: 40000, discount: 20, hot: false },
];

type PayMethod = "card" | "kakao" | "toss" | "bank";

export default function TokensPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return");
  const tokens = useTokens();
  const goBack = () => {
    if (returnUrl) router.push(returnUrl);
    else router.back();
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ amount: number } | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const pkg = PACKAGES.find((p) => p.id === selected);

  const handlePay = async () => {
    if (!pkg) return;
    setPaying(true);
    try {
      // 토스/카카오/카드 시뮬레이션 — 실제 PG 통합 자리
      await new Promise((r) => setTimeout(r, 1200));
      const fakePaymentId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ok = await tokens.purchase(pkg.tokens, fakePaymentId, {
        package_id: pkg.id,
        price: pkg.price,
        method: payMethod,
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
      <main className="relative min-h-screen bg-[#FDF7F4] text-primary-900">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.85),transparent_60%)]" />
        </div>

        <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 pt-10 lg:px-8">
          <button
            onClick={goBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-900 hover:bg-primary-50"
            aria-label="이전"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <a href="/" className="text-[1.3rem] font-extrabold tracking-tightest text-primary-900">
            In<span className="text-primary-500">Pick</span>
          </a>
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-primary-100 px-3 py-1.5">
            <Hexagon className="h-3.5 w-3.5 fill-token-400 text-token-400" />
            <span className="font-bold tabular text-primary-900">
              {tokens.balance}
            </span>
          </div>
        </header>

        <section className="relative z-20 mx-auto max-w-6xl px-6 py-12 lg:px-8">
          <h1 className="text-[2.2rem] lg:text-[2.8rem] font-extrabold tracking-tightest leading-none text-primary-900">
            토큰 충전
          </h1>
          <p className="mt-3 text-sm text-primary-900/60">
            AI 디자인 1장 = 1토큰. 패키지가 클수록 단가가 저렴합니다.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            {/* ── 좌: 패키지 선택 + 결제 카드 (Stripe 스타일) ── */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white border border-primary-100 shadow-card overflow-hidden">
                {/* 상단 — 브랜드 + 금액 */}
                <div className="border-b border-primary-100 px-7 py-6">
                  <div className="flex items-center gap-2 text-primary-900/70">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold tracking-tight text-primary-900">
                      InPick
                    </span>
                  </div>
                  <p className="mt-3 text-[2.6rem] font-extrabold tabular leading-none tracking-tight text-primary-900">
                    ₩ {pkg ? pkg.price.toLocaleString() : "0"}
                  </p>
                  <p className="mt-1 text-[0.78rem] text-primary-900/50">
                    {pkg ? `토큰 ${pkg.tokens}개 충전` : "패키지를 선택해주세요"}
                  </p>

                  <div className="mt-5 space-y-1 text-[0.78rem]">
                    <Row label="To" value={tokens.authenticated ? "로그인 사용자" : "게스트"} />
                    <Row label="From" value="InPick" />
                    <Row
                      label="Memo"
                      value={pkg ? `토큰 ${pkg.tokens}개 (${pkg.discount > 0 ? `${pkg.discount}% 할인` : "기본가"})` : "—"}
                    />
                  </div>
                </div>

                {/* 결제 수단 — 큰 메인 버튼 (간편결제) */}
                <div className="px-7 py-5">
                  <button
                    disabled={!pkg || paying}
                    onClick={() => setPayMethod("toss")}
                    className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold tracking-tight transition-all ${
                      payMethod === "toss"
                        ? "bg-[#0064FF] text-white"
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    } disabled:opacity-50`}
                  >
                    <span className="text-lg">⚡</span>
                    토스페이로 결제
                    {payMethod === "toss" && (
                      <span className="absolute right-3"><Check className="h-3.5 w-3.5" /></span>
                    )}
                  </button>

                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-primary-100" />
                    <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/40">
                      Or pay another way
                    </span>
                    <div className="h-px flex-1 bg-primary-100" />
                  </div>

                  {/* 결제 수단 탭 */}
                  <div className="grid grid-cols-3 gap-2">
                    <PayTab
                      active={payMethod === "card"}
                      icon={CreditCard}
                      label="Card"
                      onClick={() => setPayMethod("card")}
                    />
                    <PayTab
                      active={payMethod === "kakao"}
                      label="카카오페이"
                      onClick={() => setPayMethod("kakao")}
                      kakao
                    />
                    <PayTab
                      active={payMethod === "bank"}
                      icon={Building2}
                      label="계좌이체"
                      onClick={() => setPayMethod("bank")}
                    />
                  </div>

                  {/* Card Information (Card 선택 시) */}
                  {payMethod === "card" && (
                    <div className="mt-5">
                      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/50">
                        Card Information
                      </p>
                      <div className="mt-2 rounded-xl border border-primary-200 overflow-hidden">
                        <div className="relative flex items-center border-b border-primary-100 px-3 py-3">
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="1234 1234 1234 1234"
                            maxLength={19}
                            className="flex-1 bg-transparent text-sm tabular outline-none placeholder:text-primary-900/30"
                          />
                          <div className="flex gap-1">
                            <CardLogo brand="visa" />
                            <CardLogo brand="master" />
                            <CardLogo brand="amex" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2">
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM / YY"
                            maxLength={7}
                            className="border-r border-primary-100 px-3 py-3 text-sm tabular outline-none placeholder:text-primary-900/30"
                          />
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              placeholder="CVC"
                              maxLength={4}
                              className="flex-1 px-3 py-3 text-sm tabular outline-none placeholder:text-primary-900/30"
                            />
                            <span className="pr-3 text-[0.65rem] text-primary-900/40">⊟</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {payMethod === "kakao" && (
                    <p className="mt-4 rounded-lg bg-[#FEE500]/30 border border-[#FEE500] px-3 py-2 text-[0.78rem] text-primary-900">
                      카카오페이 앱으로 인증하여 결제합니다 (시뮬레이션 모드)
                    </p>
                  )}

                  {payMethod === "bank" && (
                    <p className="mt-4 rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 text-[0.78rem] text-primary-900/70">
                      계좌이체 가상계좌가 발급됩니다 (시뮬레이션 모드)
                    </p>
                  )}

                  <button
                    onClick={handlePay}
                    disabled={!pkg || paying}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3.5 text-base font-bold tracking-tight text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        결제 중…
                      </>
                    ) : (
                      <>Pay ₩ {pkg ? pkg.price.toLocaleString() : "—"}</>
                    )}
                  </button>

                  <p className="mt-4 text-center text-[0.7rem] text-primary-900/40">
                    Powered by <span className="font-bold text-primary-900/60">InPick · 토스페이먼츠</span>
                    <br />
                    <a className="underline hover:text-primary-900/70" href="#terms">Terms</a>
                    {" · "}
                    <a className="underline hover:text-primary-900/70" href="#privacy">Privacy</a>
                  </p>
                </div>
              </div>
            </div>

            {/* ── 우: 패키지 + 영수증 (Invoice from InPick) ── */}
            <div className="lg:col-span-7">
              {/* Invoice 헤더 */}
              <div className="mb-3 px-1 flex items-center gap-2 text-[0.78rem] text-primary-900/60">
                <span>New invoice from InPick</span>
                <span className="text-primary-900/30">✉</span>
              </div>
              <div className="mb-1 px-1 flex items-center justify-between text-[0.7rem] text-primary-900/40">
                <span>InPick &lt;billing@inpick.kr&gt;</span>
                <span className="tabular">방금</span>
              </div>
              <div className="mb-4 px-1 text-[0.7rem] text-primary-900/40">
                To: {tokens.authenticated ? "회원" : "게스트"}
              </div>

              {/* Invoice 카드 */}
              <div className="rounded-2xl bg-white border border-primary-100 shadow-card overflow-hidden">
                <div className="px-7 py-6 border-b border-primary-100">
                  <div className="flex items-center gap-2 text-primary-900/70">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold tracking-tight text-primary-900">
                      InPick
                    </span>
                  </div>
                  <p className="mt-2 text-[0.78rem] text-primary-900/50">
                    Invoice from InPick
                  </p>
                  <p className="mt-2 text-[2.2rem] font-extrabold tabular leading-none tracking-tight text-primary-900">
                    ₩ {pkg ? pkg.price.toLocaleString() : "0"}
                  </p>
                  <p className="mt-1 text-[0.78rem] text-primary-900/50">
                    {pkg ? `토큰 ${pkg.tokens}개` : "패키지 미선택"}
                  </p>
                </div>

                {/* 패키지 그리드 */}
                <div className="px-7 py-5">
                  <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40 mb-3">
                    토큰 패키지
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PACKAGES.map((p) => {
                      const sel = selected === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          onClick={() => setSelected(p.id)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`relative rounded-xl border p-4 text-left transition-all ${
                            sel
                              ? "border-primary-500 bg-primary-50/70 shadow-card"
                              : "border-primary-100 bg-white hover:border-primary-300"
                          }`}
                        >
                          {p.hot && (
                            <span className="absolute -top-2 -right-2 rounded-full bg-primary-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                              HOT
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-extrabold tabular text-primary-900">
                              {p.tokens}
                            </span>
                            <Hexagon className={`h-5 w-5 ${sel ? "fill-primary-500 text-primary-500" : "fill-token-400 text-token-400"}`} />
                          </div>
                          <p className="mt-2 text-base font-bold tabular text-primary-900">
                            ₩ {p.price.toLocaleString()}
                          </p>
                          {p.discount > 0 ? (
                            <p className="mt-0.5 text-[0.7rem] font-semibold text-emerald-600">
                              {p.discount}% 할인
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[0.7rem] text-primary-900/40">기본가</p>
                          )}
                          {sel && (
                            <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* 영수증 상세 */}
                {pkg && (
                  <div className="border-t border-primary-100 px-7 py-5">
                    <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                      Invoice #INPICK-{Date.now().toString().slice(-6)}
                    </p>
                    <div className="mt-3 space-y-2 text-[0.85rem]">
                      <div className="flex items-center justify-between">
                        <span className="text-primary-900/70">{pkg.tokens} 토큰 패키지</span>
                        <span className="tabular text-primary-900">₩ {Math.round(pkg.price / 1.1).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-primary-900/70">VAT 10%</span>
                        <span className="tabular text-primary-900">₩ {Math.round(pkg.price - pkg.price / 1.1).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-primary-100 pt-2">
                        <span className="font-bold text-primary-900">Total due</span>
                        <span className="text-lg font-extrabold tabular text-primary-900">
                          ₩ {pkg.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-primary-100 px-7 py-3 text-center text-[0.7rem] text-primary-900/40">
                  Powered by <span className="font-bold text-primary-900/60">토스페이먼츠</span>
                  {" | "}
                  <a className="underline hover:text-primary-900/70" href="#terms">Terms</a>
                  {" "}
                  <a className="underline hover:text-primary-900/70" href="#privacy">Privacy</a>
                </div>
              </div>
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
                className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-primary-100 bg-white p-7 shadow-card-hover text-center"
              >
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-primary-900">
                  결제 완료
                </h3>
                <p className="mt-2 text-sm text-primary-900/70">
                  <span className="font-bold text-primary-700">+{successInfo.amount} 토큰</span>이 충전되었습니다.
                </p>
                <p className="mt-1 text-[0.78rem] text-primary-900/50">
                  현재 잔액: <span className="font-bold tabular">{tokens.balance}</span>
                </p>
                <button
                  onClick={() => {
                    setSuccessInfo(null);
                    goBack();
                  }}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
                >
                  {returnUrl ? "워크플로 계속하기" : "계속하기"}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </LenisProvider>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-12 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/40">
        {label}
      </span>
      <span className="text-primary-900/80">{value}</span>
    </div>
  );
}

function PayTab({
  active,
  icon: Icon,
  label,
  onClick,
  kakao,
}: {
  active: boolean;
  icon?: typeof CreditCard;
  label: string;
  onClick: () => void;
  kakao?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-bold transition-all ${
        active
          ? "border-primary-500 bg-primary-50/50 shadow-sm"
          : "border-primary-100 bg-white hover:border-primary-300"
      }`}
    >
      {kakao ? (
        <span className="text-base font-bold text-[#3C1E1E]">K</span>
      ) : (
        Icon && <Icon className="h-4 w-4 text-primary-900/70" />
      )}
      <span className="text-primary-900">{label}</span>
      {active && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-500" />
      )}
    </button>
  );
}

function CardLogo({ brand }: { brand: "visa" | "master" | "amex" | "jcb" }) {
  const labels: Record<typeof brand, string> = {
    visa: "VISA",
    master: "MC",
    amex: "AMEX",
    jcb: "JCB",
  } as const;
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.55rem] font-extrabold tracking-tight text-zinc-700">
      {labels[brand]}
    </span>
  );
}

function formatCardNumber(s: string): string {
  return s
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(s: string): string {
  const digits = s.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}
