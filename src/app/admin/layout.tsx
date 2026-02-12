"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Users, FolderKanban, FileText, DollarSign,
  Bot, Package, RefreshCw, Settings, LogOut, Menu, X, Shield,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "대시보드", href: "/admin", icon: BarChart3 },
  { label: "사용자 관리", href: "/admin/users", icon: Users },
  { label: "프로젝트", href: "/admin/projects", icon: FolderKanban },
  { label: "계약/입찰", href: "/admin/contracts", icon: FileText },
  { label: "크레딧", href: "/admin/credits", icon: DollarSign },
  { label: "AI 로그", href: "/admin/ai-logs", icon: Bot },
  { label: "자재/단가", href: "/admin/materials", icon: Package },
  { label: "크롤러", href: "/admin/crawlers", icon: RefreshCw },
  { label: "설정", href: "/admin/settings", icon: Settings },
];

const EXCLUDE_LAYOUT = ["/admin/login"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (EXCLUDE_LAYOUT.includes(pathname)) {
    return <>{children}</>;
  }

  const adminName = typeof window !== "undefined" ? localStorage.getItem("admin_name") : null;
  const adminEmail = typeof window !== "undefined" ? localStorage.getItem("admin_email") : null;

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
        bg-gray-900 border-r border-gray-800 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* 로고 */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            <Link href="/admin" className="text-lg font-bold text-white">INPICK</Link>
            <span className="text-xs text-red-400 font-medium">Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
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
                    ? "bg-red-600/20 text-red-300"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-red-400" : "text-gray-500"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 유저 정보 */}
        <div className="px-3 py-4 border-t border-gray-800">
          {(adminName || adminEmail) && (
            <div className="px-3 mb-2">
              <p className="text-xs text-gray-400 truncate">{adminName || "Admin"}</p>
              <p className="text-[10px] text-gray-500 truncate">{adminEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 w-full transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 모바일 헤더 */}
        <header className="lg:hidden bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-lg font-bold text-white">INPICK</span>
            <span className="text-xs text-red-400">Admin</span>
          </div>
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
