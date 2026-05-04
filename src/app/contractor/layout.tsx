"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
  Bell,
} from "lucide-react";

/**
 * 사업자 페이지 — 정부기관(나라장터) 스타일 상단 카테고리 + 메가메뉴
 * 8개 대분류 × 평균 4-5개 소분류
 */
const CATEGORIES: Array<{
  label: string;
  href?: string;
  sub: Array<{ label: string; href: string; badge?: string }>;
}> = [
  {
    label: "전자입찰",
    sub: [
      { label: "공고 검색", href: "/contractor/bids?tab=search" },
      { label: "참여 입찰 현황", href: "/contractor/bids?tab=mine" },
      { label: "낙찰/유찰 결과", href: "/contractor/bids?tab=result" },
      { label: "지역별 입찰 매칭", href: "/contractor/matching", badge: "NEW" },
      { label: "입찰 통계", href: "/contractor/bids?tab=stats" },
    ],
  },
  {
    label: "전자계약",
    sub: [
      { label: "계약 대기", href: "/contractor/projects?status=PENDING_SIGNATURE" },
      { label: "진행 중 계약", href: "/contractor/projects?status=IN_PROGRESS" },
      { label: "완료 계약", href: "/contractor/projects?status=COMPLETED" },
      { label: "표준계약서 양식", href: "/contractor/projects?tab=template" },
      { label: "계약 분쟁 처리", href: "/contractor/projects?tab=dispute" },
    ],
  },
  {
    label: "전자문서",
    sub: [
      { label: "발송함", href: "/contractor/projects?doc=outbox" },
      { label: "수신함", href: "/contractor/projects?doc=inbox" },
      { label: "도면·견적서 보관", href: "/contractor/projects?doc=archive" },
      { label: "전자결재 대기", href: "/contractor/projects?doc=approval" },
      { label: "공인인증 서명", href: "/contractor/projects?doc=sign" },
    ],
  },
  {
    label: "실적증명",
    sub: [
      { label: "공사실적 등록", href: "/contractor/profile?tab=record" },
      { label: "기술자 보유 현황", href: "/contractor/profile?tab=engineer" },
      { label: "면허·자격 관리", href: "/contractor/profile?tab=license" },
      { label: "실적증명서 발급", href: "/contractor/profile?tab=cert" },
      { label: "AI 신뢰도 점수", href: "/contractor/profile?tab=trust" },
    ],
  },
  {
    label: "통계/현황",
    sub: [
      { label: "월별 매출", href: "/contractor/finance?tab=monthly" },
      { label: "지역별 수주 현황", href: "/contractor/finance?tab=region" },
      { label: "공종별 실적", href: "/contractor/finance?tab=trade" },
      { label: "고객 만족도", href: "/contractor/finance?tab=csat" },
      { label: "동종업계 평균 비교", href: "/contractor/finance?tab=peer" },
    ],
  },
  {
    label: "거래처관리",
    sub: [
      { label: "거래처 목록", href: "/contractor/matching?tab=partners" },
      { label: "협력업체 매칭", href: "/contractor/matching" },
      { label: "공종별 풀(Pool)", href: "/contractor/matching?tab=pool" },
      { label: "신규 협력 등록", href: "/contractor/matching?tab=new" },
      { label: "평가·블랙리스트", href: "/contractor/matching?tab=eval" },
    ],
  },
  {
    label: "전자수발주",
    sub: [
      { label: "자재 발주", href: "/contractor/schedule?order=material" },
      { label: "외주 발주", href: "/contractor/schedule?order=sub" },
      { label: "수주 현황", href: "/contractor/schedule?tab=incoming" },
      { label: "발주 이력", href: "/contractor/schedule?tab=history" },
      { label: "물품 입고/검수", href: "/contractor/schedule?tab=delivery" },
    ],
  },
  {
    label: "고객센터",
    sub: [
      { label: "공지사항", href: "/contractor/ai?tab=notice" },
      { label: "FAQ", href: "/contractor/ai?tab=faq" },
      { label: "1:1 문의", href: "/contractor/ai?tab=inquiry" },
      { label: "법령·약관", href: "/contractor/ai?tab=law" },
      { label: "AI 상담봇", href: "/contractor/ai" },
    ],
  },
];

const EXCLUDE_LAYOUT = ["/contractor/login", "/contractor/register"];

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [contractorName, setContractorName] = useState<string | null>(null);

  useEffect(() => {
    setContractorName(localStorage.getItem("contractor_name"));
  }, []);

  if (EXCLUDE_LAYOUT.includes(pathname)) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem("contractor_token");
    localStorage.removeItem("contractor_id");
    localStorage.removeItem("contractor_name");
    router.replace("/contractor/login");
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA]" onMouseLeave={() => setOpenMenu(null)}>
      {/* 정부기관 스타일 상단 바 */}
      <div className="bg-[#1B3556] text-white">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[0.7rem] py-1.5">
          <span className="opacity-80">대한민국 인테리어 사업자 종합 시스템</span>
          <div className="flex items-center gap-3">
            {contractorName && (
              <span className="opacity-90">{contractorName}님 환영합니다</span>
            )}
            <button
              onClick={handleLogout}
              className="hover:underline inline-flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 헤더 — 로고 + 검색 + 알림 */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-zinc-700 hover:text-zinc-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/contractor" className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#1B3556]" />
              <span className="text-xl font-extrabold tracking-tight text-zinc-900">
                In<span className="text-primary-500">Pick</span>
                <span className="ml-2 text-[0.7rem] font-bold tracking-widest text-zinc-500 uppercase">
                  사업자
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="알림"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 카테고리 메가메뉴 — 정부기관 스타일 */}
        <nav className="bg-[#1B3556] hidden lg:block relative">
          <div className="max-w-7xl mx-auto px-6 flex items-center">
            {CATEGORIES.map((cat) => {
              const isOpen = openMenu === cat.label;
              return (
                <div
                  key={cat.label}
                  onMouseEnter={() => setOpenMenu(cat.label)}
                  className="relative"
                >
                  <button
                    className={`px-5 py-3 text-sm font-bold tracking-tight transition-colors inline-flex items-center gap-1 ${
                      isOpen
                        ? "bg-[#0F2640] text-white"
                        : "text-white/90 hover:bg-[#2a4870]"
                    }`}
                  >
                    {cat.label}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 메가메뉴 panel — hover 시 전체 폭 dropdown */}
          {openMenu && (
            <div className="absolute top-full left-0 right-0 bg-white border-b-2 border-[#1B3556] shadow-lg z-40">
              <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-8 gap-x-6 gap-y-2">
                {CATEGORIES.map((cat) => {
                  const active = openMenu === cat.label;
                  return (
                    <div
                      key={cat.label}
                      className={`${active ? "" : "opacity-30"} transition-opacity`}
                    >
                      <p className="text-sm font-bold text-[#1B3556] mb-3 pb-2 border-b border-zinc-200">
                        {cat.label}
                      </p>
                      <ul className="space-y-1.5">
                        {cat.sub.map((s) => (
                          <li key={s.href}>
                            <Link
                              href={s.href}
                              onClick={() => setOpenMenu(null)}
                              className={`text-[0.78rem] text-zinc-700 hover:text-[#1B3556] hover:font-semibold transition-colors block py-0.5 ${
                                pathname.startsWith(s.href.split("?")[0])
                                  ? "font-bold text-[#1B3556]"
                                  : ""
                              }`}
                            >
                              · {s.label}
                              {s.badge && (
                                <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[0.55rem] font-bold text-white align-middle">
                                  {s.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* 모바일 사이드바 */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 z-50 h-screen w-72 bg-white shadow-xl flex flex-col lg:hidden overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-lg font-extrabold text-zinc-900">사업자 메뉴</span>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4">
              {CATEGORIES.map((cat) => (
                <div key={cat.label} className="mb-3">
                  <p className="text-xs font-bold text-[#1B3556] uppercase tracking-widest px-2 py-1.5 border-b border-zinc-100">
                    {cat.label}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {cat.sub.map((s) => (
                      <li key={s.href}>
                        <Link
                          href={s.href}
                          onClick={() => setMobileOpen(false)}
                          className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                        >
                          {s.label}
                          {s.badge && (
                            <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[0.55rem] font-bold text-white">
                              {s.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
