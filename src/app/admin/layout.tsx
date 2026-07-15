"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Users, FolderKanban, FileText, Hexagon,
  Bot, Package, RefreshCw, Settings, LogOut, Menu, X, Shield, FileImage,
  Library, ExternalLink, Rocket, Heart, Activity, CreditCard, AlertTriangle, MessagesSquare, Wrench, PieChart, Megaphone, Inbox,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "대시보드", href: "/admin", icon: BarChart3 },
  { label: "행동 분석", href: "/admin/analytics", icon: Activity },
  { label: "제공사별 유저 분석", href: "/admin/user-segments", icon: PieChart },
  { label: "사용자 관리", href: "/admin/users", icon: Users },
  { label: "회원 정합성·감사", href: "/admin/members", icon: Shield },
  { label: "프로젝트", href: "/admin/projects", icon: FolderKanban },
  { label: "계약·입찰", href: "/admin/contracts", icon: FileText },
  { label: "결제 관리", href: "/admin/payments", icon: CreditCard },
  { label: "결제 센트럴타워", href: "/admin/payment-center", icon: Activity },
  { label: "가격 정책", href: "/admin/pricing", icon: Hexagon },
  { label: "결제 보정 큐", href: "/admin/reconciliation", icon: AlertTriangle },
  { label: "토큰 충전·환급", href: "/admin/credits", icon: Hexagon },
  { label: "AI 호출 로그", href: "/admin/ai-logs", icon: Bot },
  { label: "감성 분석 (Vision)", href: "/admin/emotion-analytics", icon: Heart },
  { label: "도면 인식 로그", href: "/admin/drawing-logs", icon: FileImage },
  { label: "평면도 라이브러리", href: "/admin/floor-plans", icon: Library },
  { label: "자재 / 단가 DB", href: "/admin/materials", icon: Package },
  { label: "부분 적산 단가", href: "/admin/partial-rates", icon: Hexagon },
  { label: "부분시공 리드", href: "/admin/partial-leads", icon: Wrench },
  { label: "견적 품질 진단", href: "/admin/estimate-quality", icon: AlertTriangle },
  { label: "커뮤니티 관리", href: "/admin/community", icon: MessagesSquare },
  { label: "크롤러 운영", href: "/admin/crawlers", icon: RefreshCw },
  { label: "개발 로드맵", href: "/admin/roadmap", icon: Rocket },
  { label: "환경 설정", href: "/admin/settings", icon: Settings },
  { label: "비즈니스·광고 센터", href: "/admin/business-center", icon: Megaphone },
  { label: "비즈니스 문의 관리", href: "/admin/business-inquiries", icon: Inbox },
];

const NAV_GROUPS = [
  {
    label: "Overview",
    items: NAV_ITEMS.slice(0, 3),
  },
  {
    label: "Customer & Project",
    items: [NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[5], NAV_ITEMS[6], NAV_ITEMS[20], NAV_ITEMS[18]],
  },
  {
    label: "Finance",
    items: [NAV_ITEMS[7], NAV_ITEMS[8], NAV_ITEMS[9], NAV_ITEMS[10], NAV_ITEMS[11]],
  },
  {
    label: "AI & Data",
    items: [NAV_ITEMS[12], NAV_ITEMS[13], NAV_ITEMS[14], NAV_ITEMS[15], NAV_ITEMS[16], NAV_ITEMS[17], NAV_ITEMS[19], NAV_ITEMS[21]],
  },
  {
    label: "Business",
    items: [NAV_ITEMS[25], NAV_ITEMS[24]],
  },
  {
    label: "System",
    items: [NAV_ITEMS[22], NAV_ITEMS[23]],
  },
];

const EXCLUDE_LAYOUT = ["/admin/login"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminIdentity, setAdminIdentity] = useState({ name: "", email: "" });

  useEffect(() => {
    setAdminIdentity({
      name: localStorage.getItem("admin_name") || "",
      email: localStorage.getItem("admin_email") || "",
    });
  }, []);

  if (EXCLUDE_LAYOUT.includes(pathname)) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_role");
    router.replace("/admin/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const currentItem = NAV_ITEMS.find((item) => isActive(item.href));

  return (
    <div className="flex min-h-screen bg-[#f7f7f5] text-[#0d0d0d]">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside className={`
        fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col
        border-r border-black/[0.07] bg-white transition-transform duration-200 lg:sticky
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* 로고 */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="hex-mask h-5 w-5 text-primary-500" />
            <span className="text-[19px] font-bold tracking-[-0.05em]">inpick</span>
            <span className="rounded-full bg-primary-50 px-2 py-1 text-[9px] font-bold tracking-[0.08em] text-primary-600">ADMIN</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/50 transition hover:bg-black/[0.04] lg:hidden"
            aria-label="관리자 메뉴 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 overflow-y-auto px-3 pb-5 pt-3">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex === 0 ? "" : "mt-6"}>
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-black/28">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-primary-50 text-primary-700"
                          : "text-black/55 hover:bg-black/[0.035] hover:text-black"
                      }`}
                    >
                      <item.icon className={`h-[17px] w-[17px] ${active ? "text-primary-500" : "text-black/34"}`} strokeWidth={1.8} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 유저 정보 */}
        <div className="border-t border-black/[0.07] px-3 py-4">
          {(adminIdentity.name || adminIdentity.email) && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-[#f7f7f5] px-3 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white">
                <Shield className="h-4 w-4" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{adminIdentity.name || "Admin"}</p>
                <p className="mt-0.5 truncate text-[10px] text-black/38">{adminIdentity.email}</p>
              </div>
            </div>
          )}
          <Link
            href="/"
            target="_blank"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-black/48 transition hover:bg-black/[0.035] hover:text-black"
          >
            <ExternalLink className="h-4 w-4 text-black/30" />
            메인 웹사이트
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-black/48 transition hover:bg-black/[0.035] hover:text-black"
          >
            <LogOut className="h-4 w-4 text-black/30" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/60 lg:hidden"
              aria-label="관리자 메뉴 열기"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="hex-mask h-4 w-4 text-primary-500" />
              <span className="text-[17px] font-bold tracking-[-0.05em]">inpick</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/30">Operation console</p>
              <p className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.025em]">{currentItem?.label || "관리자 콘솔"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-[11px] font-medium text-black/42 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 시스템 정상
            </span>
            <span className="h-4 w-px bg-black/10" />
            <span className="max-w-[130px] truncate text-[11px] font-medium text-black/52">
              {adminIdentity.name || "Administrator"}
            </span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
