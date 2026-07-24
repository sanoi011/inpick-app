"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Camera,
  ChevronDown,
  ImagePlus,
  Layers3,
  Menu,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppDownloadSection from "@/components/landing/AppDownloadSection";
import BusinessDropdown from "@/components/business/BusinessDropdown";
import PromotionalBannerSlot from "@/components/business/PromotionalBannerSlot";
import { BUSINESS_MENU_ITEMS } from "@/lib/business-center";
import { buildConsumerAuthHref } from "@/lib/auth/access-policy";

const NAV_ITEMS = [
  { label: "AI 디자인", href: "/workflow" },
  { label: "부분 AI 인테리어", href: "/partial-ai" },
  { label: "부분시공", href: "/partial-install" },
  { label: "시공사", href: "/find-contractors" },
  { label: "커뮤니티", href: "/community" },
];

const QUICK_ACTIONS = [
  {
    label: "무료 AI 인테리어",
    prompt: "우리 집 사진으로 새로운 인테리어 시안을 만들어줘",
    icon: Sparkles,
  },
  {
    label: "사진으로 디자인",
    prompt: "현재 공간 사진을 바탕으로 분위기를 바꿔줘",
    icon: Camera,
  },
  {
    label: "도면으로 시작",
    prompt: "아파트 도면을 바탕으로 공간별 인테리어를 설계해줘",
    icon: Layers3,
  },
  {
    label: "견적 바로보기",
    prompt: "원하는 디자인과 예산에 맞는 인테리어 견적을 알려줘",
    icon: Calculator,
  },
];

const TREND_PROMPTS = [
  "웜 어스 팔레트와 자연스러운 질감",
  "드라마틱 천연석과 깊은 우드 톤",
  "컬러 드렌칭과 포인트 천장",
  "웰니스 룸과 바이오필릭 디자인",
  "빈티지 믹스와 장인 디테일",
  "톤온톤 뉴트럴과 에스프레소 브라운",
];

const SHOWCASES = [
  {
    image: "/images/feature-fireplace.jpg",
    eyebrow: "AI LIVING",
    title: "빛과 소재가 살아 있는 거실",
    desc: "내추럴 스톤 · 월넛 · 웜 그레이",
    href: "/workflow",
    className: "lg:col-span-7 lg:row-span-2 min-h-[520px] lg:min-h-[760px]",
    position: "center",
  },
  {
    image: "/images/hero-kitchen.jpg",
    eyebrow: "AI KITCHEN",
    title: "열린 주방과 다이닝",
    desc: "화이트 스톤 · 우드 루버",
    href: "/workflow",
    className: "lg:col-span-5 min-h-[360px]",
    position: "center 58%",
  },
  {
    image: "/images/feature-staircase.jpg",
    eyebrow: "AI HOUSE",
    title: "구조를 살린 라운지",
    desc: "콘크리트 · 오크 · 간접 조명",
    href: "/workflow",
    className: "lg:col-span-5 min-h-[360px]",
    position: "center 55%",
  },
  {
    image: "/images/feature-living.jpg",
    eyebrow: "AI HOME",
    title: "따뜻한 오후의 집",
    desc: "크림 패브릭 · 내추럴 우드",
    href: "/workflow",
    className: "lg:col-span-5 min-h-[540px]",
    position: "center 43%",
  },
  {
    image: "/mode-cards/photo-commercial.jpg",
    eyebrow: "AI COMMERCIAL",
    title: "브랜드가 보이는 상업 공간",
    desc: "카페 · 식당 · 오피스",
    href: "/workflow",
    className: "lg:col-span-7 min-h-[540px]",
    position: "center",
  },
];

const FOOTER_LINKS = [
  {
    title: "서비스",
    links: [
      { label: "AI 인테리어", href: "/workflow" },
      { label: "부분 AI 인테리어", href: "/partial-ai" },
      { label: "부분시공", href: "/partial-install" },
      { label: "시공사 찾기", href: "/find-contractors" },
    ],
  },
  {
    title: "고객",
    links: [
      { label: "커뮤니티", href: "/community" },
      { label: "인테리어 후기", href: "/reviews" },
      { label: "토큰 충전", href: "/account/tokens" },
      { label: "고객센터", href: "/mypage/support" },
    ],
  },
  {
    title: "비즈니스",
    links: [
      { label: "사업자 서비스", href: "/contractor" },
      { label: "비즈니스 문의", href: "/business" },
      { label: "사업자 등록", href: "/contractor/register" },
      { label: "사업자 로그인", href: "/auth?type=contractor" },
      { label: "AIOD 소개", href: "/aiod" },
    ],
  },
  {
    title: "운영 안내",
    links: [
      { label: "이용약관", href: "/terms" },
      { label: "개인정보처리방침", href: "/privacy" },
      { label: "계정 삭제 안내", href: "/account-deletion" },
      { label: "관리자 페이지", href: "/admin/login" },
    ],
  },
];

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [businessMobileOpen, setBusinessMobileOpen] = useState(false);
  const [trendIndex, setTrendIndex] = useState(0);
  const designHref = authLoading || user
    ? "/workflow"
    : buildConsumerAuthHref("/workflow", "free_ai");
  const resolveServiceHref = (href: string) =>
    href === "/workflow" ? designHref : href;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTrendIndex((current) => (current + 1) % TREND_PROMPTS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  const startDesign = (value?: string) => {
    const nextPrompt = value?.trim();
    if (typeof window !== "undefined" && nextPrompt) {
      sessionStorage.setItem("inpick_home_prompt", nextPrompt);
    }
    router.push(designHref);
  };

  return (
    <main className="min-h-screen bg-white font-sans text-[#0d0d0d]">
      {/*
        모바일 Capacitor WebView에서 sticky top-0을 쓰면 스크롤 시
        헤더가 iOS 상태바 뒤로 올라간다. 모바일은 첫 화면 로고로
        남겨 스크롤과 함께 사라지게 하고, 데스크톱에서만 sticky를 유지한다.
      */}
      <header className="relative z-50 bg-white/95 backdrop-blur-xl lg:sticky lg:top-0">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-8 px-5 sm:px-7 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="InPick 홈">
            <span className="hex-mask h-[22px] w-[22px] text-primary-500" />
            <span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span>
          </Link>

          <nav className="hidden items-center gap-6 text-[14px] font-medium tracking-[-0.02em] lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.label} href={resolveServiceHref(item.href)} className="transition-opacity hover:opacity-55">
                {item.label}
              </Link>
            ))}
            <BusinessDropdown />
          </nav>

          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {authLoading ? (
              <span className="h-10 w-10 animate-pulse rounded-full bg-black/[0.05]" aria-hidden />
            ) : user ? (
              <Link
                href="/mypage"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/65 transition hover:bg-black/[0.04] hover:text-black"
                aria-label="내 프로필"
                title={user.user_metadata?.full_name || user.email || "마이페이지"}
              >
                <UserRound className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </Link>
            ) : (
              <Link href="/auth?type=consumer" className="px-2 py-2 text-[14px] font-medium hover:opacity-55">
                로그인
              </Link>
            )}
            <Link
              href={designHref}
              className="rounded-full bg-black px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black/75"
            >
              무료로 시작하기
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 sm:hidden"
            aria-label="메뉴"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-black/[0.06] bg-white px-5 py-5 sm:hidden"
          >
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={resolveServiceHref(item.href)}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-black/[0.04]"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => setBusinessMobileOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-medium hover:bg-black/[0.04]"
                aria-expanded={businessMobileOpen}
              >
                비즈니스 <ChevronDown className={`h-4 w-4 transition-transform ${businessMobileOpen ? "rotate-180" : ""}`} />
              </button>
              {businessMobileOpen && (
                <div className="grid gap-1 rounded-2xl bg-[#f5f5f3] p-2">
                  {BUSINESS_MENU_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl bg-white px-3 py-3">
                      <span className="block text-[13px] font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] text-black/42">{item.description}</span>
                    </Link>
                  ))}
                </div>
              )}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/[0.06] pt-4">
              {authLoading ? (
                <span className="h-10 animate-pulse rounded-full bg-black/[0.05]" />
              ) : user ? (
                <Link href="/mypage" onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-center text-sm font-semibold">
                  <UserRound className="h-4 w-4" />내 프로필
                </Link>
              ) : (
                <Link href="/auth?type=consumer" className="rounded-full border border-black/15 px-4 py-2.5 text-center text-sm font-semibold">
                  로그인
                </Link>
              )}
              <Link href={designHref} className="rounded-full bg-black px-4 py-2.5 text-center text-sm font-semibold text-white">
                무료 시작
              </Link>
            </div>
          </motion.div>
        )}
      </header>

      <section className="flex min-h-[690px] items-center justify-center px-5 pb-24 pt-20 sm:min-h-[760px] sm:px-8 sm:pb-28">
        <div className="w-full max-w-[820px] text-center">
          <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-black/45">
            AI Interior Design & Estimate
          </p>
          <h1 className="text-[22px] font-medium leading-[1.15] tracking-[-0.045em] sm:text-[24px]">
            무엇을 도와드릴까요?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[13px] leading-6 tracking-[-0.02em] text-black/55 sm:text-[15px]">
            사진이나 주소만 알려주세요. AI 인테리어 디자인부터 자재와 견적까지 무료로 시작할 수 있어요.
          </p>

          <div className="mx-auto mt-8 max-w-[760px] text-left">
            <div className="rounded-[26px] border border-black/[0.08] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.055)] sm:px-5 sm:py-4">
              <div className="flex min-h-8 items-center gap-2.5 overflow-hidden px-1">
                <span className="shrink-0 rounded-full bg-[#f4f4f2] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-black/42">
                  2026 trend
                </span>
                <div className="relative h-6 min-w-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={trendIndex}
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                      className="absolute inset-x-0 top-0 truncate text-[13px] font-medium leading-6 tracking-[-0.025em] text-black/58 sm:text-[14px]"
                    >
                      {TREND_PROMPTS[trendIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => startDesign()}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-4 text-[12px] font-semibold text-white transition hover:bg-black/72 sm:px-5 sm:text-[13px]"
                >
                  무료 인테리어 디자인
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.1} />
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-4 flex max-w-[800px] flex-wrap justify-center gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    startDesign(action.prompt);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.09] bg-white px-3.5 py-2 text-[12px] font-medium tracking-[-0.02em] transition hover:bg-black/[0.04] sm:text-[13px]"
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {action.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => router.push("/partial-install")}
              className="inline-flex items-center gap-1 rounded-full border border-black/[0.09] bg-white px-3.5 py-2 text-[12px] font-medium transition hover:bg-black/[0.04] sm:text-[13px]"
            >
              더 보기 <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <AppDownloadSection />

      <PromotionalBannerSlot placement="home_mid" className="bg-[#f7f7f5] px-5 pb-14 sm:px-8 sm:pb-20" />

      <section id="showcase" className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="mx-auto mb-8 flex max-w-[1560px] items-end justify-between gap-5 px-2 sm:mb-10">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black/40">Created with InPick</p>
            <h2 className="mt-2 text-[30px] font-medium leading-tight tracking-[-0.055em] sm:text-[44px]">
              상상한 공간을, 실제처럼.
            </h2>
          </div>
          <Link href={designHref} className="hidden items-center gap-1.5 text-sm font-semibold hover:opacity-55 sm:inline-flex">
            내 공간 만들기 <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mx-auto grid max-w-[1560px] gap-3 lg:grid-cols-12 lg:auto-rows-auto">
          {SHOWCASES.map((item, index) => (
            <article
              key={item.title}
              className={`group relative overflow-hidden rounded-[22px] bg-[#ececea] ${item.className}`}
            >
              <Link href={resolveServiceHref(item.href)} className="absolute inset-0">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes={index === 0 ? "(max-width: 1024px) 100vw, 58vw" : "(max-width: 1024px) 100vw, 42vw"}
                  priority={index < 2}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  style={{ objectPosition: item.position }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold tracking-[-0.01em] text-black shadow-sm">
                  InPick AI
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-6 text-white sm:p-8">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.17em] text-white/65 sm:text-[11px]">{item.eyebrow}</p>
                    <h3 className="mt-2 text-[24px] font-medium leading-tight tracking-[-0.045em] sm:text-[32px]">{item.title}</h3>
                    <p className="mt-2 text-[13px] text-white/70 sm:text-[14px]">{item.desc}</p>
                  </div>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-black/[0.07] bg-white px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black/40">From idea to estimate</p>
              <h2 className="mt-3 max-w-md text-[34px] font-medium leading-[1.1] tracking-[-0.055em] sm:text-[48px]">
                디자인에서 견적까지 한 번에.
              </h2>
            </div>
            <div className="grid gap-0 border-t border-black/10">
              {[
                ["01", "공간 알려주기", "주소·도면·사진 중 편한 방법으로 시작하세요."],
                ["02", "AI 디자인 만들기", "원하는 분위기를 대화로 정하고 고화질 시안을 만드세요."],
                ["03", "자재와 견적 확인", "선택한 디자인을 실제 자재와 공사 견적으로 연결합니다."],
              ].map(([number, title, desc]) => (
                <Link
                  key={number}
                  href={designHref}
                  className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-black/10 py-6 sm:grid-cols-[72px_1fr_auto] sm:py-8"
                >
                  <span className="text-xs font-semibold text-black/35">{number}</span>
                  <span>
                    <strong className="block text-[18px] font-medium tracking-[-0.035em] sm:text-[21px]">{title}</strong>
                    <span className="mt-1 block text-[13px] leading-6 text-black/48 sm:text-[14px]">{desc}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.07] bg-white px-5 py-24 text-center sm:px-8 sm:py-32">
        <ImagePlus className="mx-auto h-7 w-7" strokeWidth={1.5} />
        <h2 className="mx-auto mt-7 w-full whitespace-nowrap text-[clamp(13px,4.3vw,58px)] font-medium leading-[1.08] tracking-[-0.06em]">
          오늘, 내 공간을 새롭게 만들어보세요.
        </h2>
        <Link href={designHref} className="mt-8 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-black/75">
          무료 인테리어 시작하기 <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-black/[0.07] bg-white px-5 pb-8 pt-14 sm:px-8 sm:pb-10 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-[1500px]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 lg:grid-cols-[1.35fr_repeat(4,1fr)] lg:gap-10">
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <span className="hex-mask h-5 w-5 text-primary-500" />
                <span className="text-[19px] font-bold tracking-[-0.05em]">inpick</span>
              </div>
              <p className="mt-4 max-w-[270px] text-[13px] leading-6 text-black/48">
                사진 한 장으로 시작하는 무료 AI 인테리어 디자인과 견적 플랫폼
              </p>
              <a
                href="mailto:lookingseon@aiod.kr"
                className="mt-4 inline-block text-[13px] font-medium underline decoration-black/25 underline-offset-4 transition hover:decoration-black"
              >
                lookingseon@aiod.kr
              </a>
            </div>

            {FOOTER_LINKS.map((group) => (
              <div key={group.title}>
                <h3 className="text-[12px] font-semibold text-black/40">{group.title}</h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className={`text-[13px] font-medium transition hover:text-black ${
                          link.href === "/admin/login"
                            ? "inline-flex rounded-full border border-black/12 px-3 py-1.5 text-black/72"
                            : "text-black/62"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 border-t border-black/[0.08] pt-7 sm:mt-16 sm:pt-8">
            <div className="flex flex-col gap-5 text-[11px] leading-[1.85] text-black/43 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[1000px] break-keep">
                <p>
                  <span className="font-semibold text-black/60">주식회사 아이오드 (AIOD)</span>
                  <span className="mx-2 text-black/15">|</span>서비스명 INPICK
                  <span className="mx-2 text-black/15">|</span>대표 김선본
                </p>
                <p>
                  사업자등록번호 384-81-04107
                  <span className="mx-2 text-black/15">|</span>통신판매업신고번호 제2026-대전유성-1245호
                </p>
                <p>
                  대전광역시 유성구 대덕대로512번길 20, 대전정보문화산업진흥원 1인창조기업지원센터 B동 2층 (도룡동)
                </p>
                <p>
                  대표 이메일{" "}
                  <a href="mailto:lookingseon@aiod.kr" className="underline decoration-black/20 underline-offset-2 hover:text-black">
                    lookingseon@aiod.kr
                  </a>
                </p>
              </div>
              <p className="shrink-0 font-medium text-black/50">© 2026 AIOD Co., Ltd. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
