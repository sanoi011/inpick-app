/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Hexagon,
  Loader2,
  Lock,
  Check,
  User,
  Building2,
  Factory,
  Crown,
  Zap,
  ChevronRight,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import { useTokens } from "@/hooks/useTokens";

// ───── 사용자(소비자) 플랜 ─────
const CONSUMER_PLANS = [
  {
    id: "consumer-token",
    type: "token",
    title: "사용량 과금",
    badge: "사용한 만큼",
    price: 500,
    priceLabel: "/ 토큰",
    desc: "AI 디자인 생성 토큰 1개당 500원",
    features: [
      "토큰 단가 ₩500 / 개",
      "AI 디자인 1장당 1토큰",
      "자재 영역 분석 1토큰",
      "고화질 재렌더 2토큰",
      "유효기간 12개월",
    ],
    cta: "토큰 충전",
    highlight: false,
  },
  {
    id: "consumer-pro",
    type: "subscription",
    title: "프로",
    badge: "월 정액",
    price: 29000,
    priceLabel: "/ 월",
    desc: "무제한 AI 디자인 + 우선 처리",
    features: [
      "AI 디자인 무제한 생성",
      "고화질 재렌더 무제한",
      "자재 영역 분석 무제한",
      "우선 큐 처리 (대기 X)",
      "PDF 견적서 다운로드",
      "AR 시뮬레이션 무료",
    ],
    cta: "프로 가입",
    highlight: true,
  },
];

// ───── 사업자 플랜 (인테리어 사업자 3종 + 자재제조사 3종) ─────
type ContractorCategory = "interior" | "manufacturer";

const CONTRACTOR_PLANS: Array<{
  id: string;
  category: ContractorCategory;
  tier: "pro" | "max" | "business";
  title: string;
  price: number;
  priceLabel: string;
  desc: string;
  features: string[];
  highlight?: boolean;
}> = [
  // ── 일반 인테리어 사업자
  {
    id: "interior-pro",
    category: "interior",
    tier: "pro",
    title: "인테리어 프로",
    price: 49000,
    priceLabel: "/ 월",
    desc: "1인·소규모 인테리어 사업자",
    features: [
      "월 입찰 참여 30건",
      "지역 1개 (시·도)",
      "기본 견적 비교 도구",
      "표준계약서 자동 생성",
      "고객 채팅",
    ],
  },
  {
    id: "interior-max",
    category: "interior",
    tier: "max",
    title: "인테리어 맥스",
    price: 99000,
    priceLabel: "/ 월",
    desc: "중·소형 인테리어 회사",
    features: [
      "월 입찰 참여 무제한",
      "지역 3개 (시·도)",
      "AI 자재 단가 자동 최적화",
      "공정·기성지급 단계 관리",
      "사업자 인증 ★ 우선 노출",
      "통계·매출 대시보드",
    ],
    highlight: true,
  },
  {
    id: "interior-business",
    category: "interior",
    tier: "business",
    title: "인테리어 비즈니스",
    price: 199000,
    priceLabel: "/ 월",
    desc: "다지점·프랜차이즈 운영",
    features: [
      "월 입찰 참여 무제한",
      "전국 (모든 시·도)",
      "팀 계정 무제한 + 권한 관리",
      "전용 API 액세스",
      "프리미엄 매칭 + 광고 우대",
      "전담 매니저 (1:1 상담)",
      "법령·세무 자동 컨설팅",
    ],
  },
  // ── 자재 제조사
  {
    id: "manuf-pro",
    category: "manufacturer",
    tier: "pro",
    title: "제조사 프로",
    price: 99000,
    priceLabel: "/ 월",
    desc: "지역 자재 제조·유통사",
    features: [
      "자재 카탈로그 등록 100개",
      "지역 1개 노출",
      "사업자 풀 견적 매칭",
      "기본 광고 슬롯 1개",
    ],
  },
  {
    id: "manuf-max",
    category: "manufacturer",
    tier: "max",
    title: "제조사 맥스",
    price: 299000,
    priceLabel: "/ 월",
    desc: "전국 단위 자재 제조사",
    features: [
      "자재 카탈로그 무제한",
      "전국 노출",
      "AI 매칭 우선순위 (3배)",
      "광고 슬롯 5개 + 노출 통계",
      "사업자 직접 거래 채널",
      "월별 트렌드 리포트",
    ],
    highlight: true,
  },
  {
    id: "manuf-business",
    category: "manufacturer",
    tier: "business",
    title: "제조사 비즈니스",
    price: 599000,
    priceLabel: "/ 월",
    desc: "대형 제조사·종합 자재상",
    features: [
      "자재 카탈로그 무제한 + 자동 동기화 API",
      "전국 + 우선 노출 + 메인 배너",
      "광고 슬롯 무제한",
      "B2B 입찰 전용 채널",
      "팀 계정 무제한",
      "전담 매니저 + 분기 전략 미팅",
      "공동 마케팅 캠페인",
    ],
  },
];

type SelectedPlan = (typeof CONSUMER_PLANS)[number] | (typeof CONTRACTOR_PLANS)[number];

export default function TokensPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDF7F4] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      }
    >
      <TokensPage />
    </Suspense>
  );
}

function TokensPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return");
  const tokens = useTokens();
  const goBack = () => {
    if (returnUrl) router.push(returnUrl);
    else router.back();
  };

  const [audience, setAudience] = useState<"consumer" | "contractor">("consumer");
  const [contractorCategory, setContractorCategory] =
    useState<ContractorCategory>("interior");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [paying, setPaying] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ title: string } | null>(null);

  const handlePay = async () => {
    if (!selectedPlan) return;
    setPaying(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const fakePaymentId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      // 토큰 구매 시 50개씩 충전 (간단 처리), 구독은 별도 처리
      if (selectedPlan.id === "consumer-token") {
        await tokens.purchase(50, fakePaymentId, {
          plan: selectedPlan.id,
          price: 50 * 500,
          simulated: true,
        });
        setSuccessInfo({ title: "토큰 50개 충전 완료" });
      } else {
        setSuccessInfo({ title: `${selectedPlan.title} 가입 완료 (시뮬레이션)` });
      }
      setSelectedPlan(null);
    } finally {
      setPaying(false);
    }
  };

  const visiblePlans =
    audience === "consumer"
      ? CONSUMER_PLANS
      : CONTRACTOR_PLANS.filter((p) => p.category === contractorCategory);

  return (
    <LenisProvider>
      <main className="relative min-h-screen bg-[#FDF7F4] text-primary-900">
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
            <span className="font-bold tabular text-primary-900">{tokens.balance}</span>
          </div>
        </header>

        <section className="relative z-20 mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
          <h1 className="text-[2rem] lg:text-[2.6rem] font-extrabold tracking-tightest leading-tight text-primary-900">
            요금제
          </h1>
          <p className="mt-2 text-sm text-primary-900/60">
            사용 목적에 맞는 플랜을 선택하세요. 언제든 변경 가능합니다.
          </p>

          {/* 청중 토글 (소비자 / 사업자) */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white p-1">
            <button
              onClick={() => setAudience("consumer")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                audience === "consumer"
                  ? "bg-primary-500 text-white shadow-cta"
                  : "text-primary-900/60 hover:bg-primary-50"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              사용자
            </button>
            <button
              onClick={() => setAudience("contractor")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                audience === "contractor"
                  ? "bg-primary-500 text-white shadow-cta"
                  : "text-primary-900/60 hover:bg-primary-50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              사업자
            </button>
          </div>

          {/* 사업자 카테고리 (인테리어 / 자재제조사) */}
          {audience === "contractor" && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setContractorCategory("interior")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                  contractorCategory === "interior"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-primary-100 bg-white text-primary-900/60"
                }`}
              >
                <Building2 className="h-3 w-3" />
                일반 인테리어 사업자
              </button>
              <button
                onClick={() => setContractorCategory("manufacturer")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                  contractorCategory === "manufacturer"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-primary-100 bg-white text-primary-900/60"
                }`}
              >
                <Factory className="h-3 w-3" />
                자재 제조사
              </button>
            </div>
          )}

          {/* 플랜 그리드 */}
          <div
            className={`mt-8 grid gap-5 ${
              audience === "consumer" ? "lg:grid-cols-2" : "lg:grid-cols-3"
            }`}
          >
            {visiblePlans.map((plan) => {
              const highlight =
                "highlight" in plan ? plan.highlight : false;
              return (
                <motion.div
                  key={plan.id}
                  whileHover={{ scale: 1.01 }}
                  className={`relative overflow-hidden rounded-3xl border p-6 transition-all ${
                    highlight
                      ? "border-primary-500 bg-gradient-to-br from-primary-50 to-amber-50 shadow-card-hover"
                      : "border-primary-100 bg-white shadow-card hover:shadow-card-hover"
                  }`}
                >
                  {highlight && (
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary-500 px-2.5 py-0.5 text-[0.65rem] font-bold text-white">
                      <Crown className="h-3 w-3" />
                      추천
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {"badge" in plan && plan.badge && (
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-primary-600">
                        {plan.badge}
                      </span>
                    )}
                    {"tier" in plan && (
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-widest ${
                          plan.tier === "business"
                            ? "text-amber-700"
                            : plan.tier === "max"
                              ? "text-primary-600"
                              : "text-primary-500"
                        }`}
                      >
                        {plan.tier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-primary-900">
                    {plan.title}
                  </h3>
                  <p className="mt-1 text-[0.85rem] text-primary-900/60">
                    {plan.desc}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-[2.4rem] font-extrabold tabular leading-none tracking-tight text-primary-900">
                      ₩{plan.price.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-primary-900/60">
                      {plan.priceLabel}
                    </span>
                  </div>

                  <ul className="mt-5 space-y-2">
                    {plan.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[0.85rem] text-primary-900/80"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold transition-colors ${
                      highlight
                        ? "bg-primary-500 text-white shadow-cta hover:bg-primary-600"
                        : "border border-primary-200 bg-white text-primary-900 hover:bg-primary-50"
                    }`}
                  >
                    {"cta" in plan && plan.cta ? plan.cta : "선택"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* 안내 */}
          <div className="mt-8 rounded-2xl border border-primary-100 bg-white p-5 text-[0.78rem] text-primary-900/70 leading-relaxed">
            <p className="flex items-center gap-2 font-bold text-primary-900 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              플랜 비교
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>사용자 — 가끔 사용하면 토큰 과금, 자주 사용하면 프로 (29,000원/월) 추천</li>
              <li>인테리어 사업자 — 입찰 건수 + 지역 + 팀 규모로 선택</li>
              <li>자재 제조사 — 카탈로그 노출 범위 + 광고 + B2B 채널로 선택</li>
              <li>모든 플랜 언제든 업그레이드·다운그레이드 가능</li>
            </ul>
          </div>
        </section>

        {/* 결제 모달 */}
        <AnimatePresence>
          {selectedPlan && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPlan(null)}
                className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="fixed left-1/2 top-1/2 z-[81] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-primary-100 bg-white p-7 shadow-card-hover"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-primary-900/60" />
                  <span className="text-sm font-bold tracking-tight text-primary-900">
                    InPick 결제
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight text-primary-900">
                  {selectedPlan.title}
                </h3>
                <p className="mt-0.5 text-sm text-primary-900/60">{selectedPlan.desc}</p>

                <p className="mt-5 text-[2.4rem] font-extrabold tabular leading-none text-primary-900">
                  ₩{selectedPlan.price.toLocaleString()}
                  <span className="text-sm font-bold text-primary-900/60 ml-1">
                    {selectedPlan.priceLabel}
                  </span>
                </p>

                <div className="mt-5 rounded-xl bg-primary-50/70 p-3 text-[0.78rem] text-primary-900/70">
                  결제 시뮬레이션 — 실제 PG 연동 전 단계입니다. 토스페이먼츠 통합 후 실제 결제됩니다.
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> 결제 중…
                      </>
                    ) : (
                      <>결제하기</>
                    )}
                  </button>
                </div>
              </motion.div>
            </>
          )}

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
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="fixed left-1/2 top-1/2 z-[81] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-emerald-100 bg-white p-7 shadow-card-hover text-center"
              >
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-primary-900">
                  {successInfo.title}
                </h3>
                <p className="mt-2 text-sm text-primary-900/70">
                  현재 잔액: <span className="font-bold tabular">{tokens.balance}</span>
                </p>
                <button
                  onClick={() => {
                    setSuccessInfo(null);
                    goBack();
                  }}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
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
