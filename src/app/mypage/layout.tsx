"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileSignature,
  Bell,
  UserCircle,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Hexagon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTokens } from "@/hooks/useTokens";

const NAV_ITEMS = [
  { label: "대시보드", href: "/mypage", icon: LayoutDashboard },
  { label: "내 프로젝트", href: "/mypage/projects", icon: FolderKanban },
  { label: "계약 진행", href: "/mypage/contracts/progress", icon: FileSignature },
  { label: "알림", href: "/mypage/notifications", icon: Bell },
  { label: "내 계정", href: "/mypage/account", icon: UserCircle },
  { label: "고객센터", href: "/mypage/support", icon: HelpCircle },
];

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { balance } = useTokens();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth?returnUrl=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  const isActive = (href: string) => {
    if (href === "/mypage") return pathname === "/mypage";
    return pathname.startsWith(href);
  };

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#FDF7F4] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF7F4] text-primary-900 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-primary-900/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64
        bg-white border-r border-primary-100 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        {/* 로고 */}
        <div className="px-5 py-5 border-b border-primary-100 flex items-center justify-between">
          <Link
            href="/"
            className="text-[1.3rem] font-extrabold tracking-tightest text-primary-900"
          >
            In<span className="text-primary-500">Pick</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-primary-900/40 hover:text-primary-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 토큰 잔액 */}
        <Link
          href="/account/tokens"
          className="mx-3 mt-3 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 flex items-center justify-between hover:bg-amber-100 transition-colors"
        >
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-amber-700/70">
            보유 토큰
          </span>
          <span className="inline-flex items-center gap-1 text-base font-extrabold tabular text-amber-700">
            <Hexagon className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {balance}
          </span>
        </Link>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary-500 text-white shadow-cta"
                    : "text-primary-900/70 hover:bg-primary-50 hover:text-primary-900"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 ${active ? "text-white" : "text-primary-900/50"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 유저 정보 */}
        <div className="px-3 py-4 border-t border-primary-100">
          <div className="px-3 mb-2">
            <p className="text-sm font-bold text-primary-900 truncate">
              {displayName}
            </p>
            <p className="text-xs text-primary-900/50 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => {
              signOut();
              router.replace("/");
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-primary-900/60 hover:bg-primary-50 hover:text-primary-900 w-full transition-colors"
          >
            <LogOut className="w-4 h-4 text-primary-900/40" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* 모바일 헤더 */}
        <header className="lg:hidden bg-white border-b border-primary-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-primary-900/70 hover:text-primary-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link
            href="/"
            className="text-[1.1rem] font-extrabold tracking-tightest text-primary-900"
          >
            In<span className="text-primary-500">Pick</span>
          </Link>
          <Link
            href="/account/tokens"
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-bold tabular text-amber-700"
          >
            <Hexagon className="h-3 w-3 fill-amber-500" />
            {balance}
          </Link>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
