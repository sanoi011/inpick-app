"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, FileSignature, Bell,
  UserCircle, HelpCircle, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "대시보드", href: "/mypage", icon: LayoutDashboard },
  { label: "내 프로젝트", href: "/mypage/projects", icon: FolderKanban },
  { label: "내 계약", href: "/mypage/contracts", icon: FileSignature },
  { label: "알림", href: "/mypage/notifications", icon: Bell },
  { label: "내 계정", href: "/mypage/account", icon: UserCircle },
  { label: "고객센터", href: "/mypage/support", icon: HelpCircle },
];

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
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

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-60
        bg-white border-r border-gray-200 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* 로고 */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-blue-600" : "text-gray-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 유저 정보 */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 mb-2">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => { signOut(); router.replace("/"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 w-full transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-400" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 모바일 헤더 */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/" className="text-lg font-bold text-blue-600">INPICK</Link>
          <div className="w-6" />
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
