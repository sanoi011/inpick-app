"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, FileText, FolderKanban, Bot, Users,
  Calendar, DollarSign, UserCircle, LogOut, Menu, X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "대시보드", href: "/contractor", icon: BarChart3 },
  { label: "입찰 관리", href: "/contractor/bids", icon: FileText },
  { label: "프로젝트", href: "/contractor/projects", icon: FolderKanban },
  { label: "AI 비서", href: "/contractor/ai", icon: Bot },
  { label: "전문업체 매칭", href: "/contractor/matching", icon: Users },
  { label: "일정 관리", href: "/contractor/schedule", icon: Calendar },
  { label: "재무 관리", href: "/contractor/finance", icon: DollarSign },
  { label: "프로필", href: "/contractor/profile", icon: UserCircle },
];

// 로그인/등록 페이지는 레이아웃 제외
const EXCLUDE_LAYOUT = ["/contractor/login", "/contractor/register"];

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 로그인/등록 페이지는 레이아웃 없이 렌더링
  if (EXCLUDE_LAYOUT.includes(pathname)) {
    return <>{children}</>;
  }

  const contractorName = typeof window !== "undefined" ? localStorage.getItem("contractor_name") : null;

  const handleLogout = () => {
    localStorage.removeItem("contractor_token");
    localStorage.removeItem("contractor_id");
    localStorage.removeItem("contractor_name");
    router.replace("/contractor/login");
  };

  const isActive = (href: string) => {
    if (href === "/contractor") return pathname === "/contractor";
    return pathname.startsWith(href);
  };

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
          {contractorName && (
            <p className="text-xs text-gray-500 px-3 mb-2 truncate">{contractorName}</p>
          )}
          <button
            onClick={handleLogout}
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
