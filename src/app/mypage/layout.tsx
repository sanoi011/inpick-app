"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  FileSignature,
  Bell,
  UserCircle,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Hexagon,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTokens } from "@/hooks/useTokens";

const NAV_ITEMS = [
  { label: "대시보드", href: "/mypage", icon: LayoutDashboard, exact: true },
  { label: "내 프로젝트", href: "/mypage/projects", icon: FolderKanban },
  { label: "내 계약서", href: "/mypage/contracts", icon: FileText, exact: true },
  { label: "입찰·계약 진행", href: "/mypage/contracts/progress", icon: FileSignature },
  { label: "알림", href: "/mypage/notifications", icon: Bell },
  { label: "결제·토큰", href: "/mypage/billing", icon: Receipt },
  { label: "내 계정", href: "/mypage/account", icon: UserCircle },
  { label: "고객센터", href: "/mypage/support", icon: HelpCircle },
];

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-[#0d0d0d]">
      <span className="hex-mask h-6 w-6 shrink-0 text-[#f15b4a]" />
      <span className="text-[21px] font-bold leading-none tracking-[-0.055em]">inpick</span>
    </span>
  );
}

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { balance } = useTokens();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push(`/auth?returnUrl=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  useEffect(() => setSidebarOpen(false), [pathname]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/15 border-t-[#0d0d0d]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f7f7f5] text-[#0d0d0d]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 z-50 flex h-dvh w-[276px] flex-col border-r border-black/[0.06] bg-white transition-transform duration-300 lg:sticky ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-[72px] items-center justify-between px-6">
          <Link href="/" aria-label="인픽 홈"><Brand /></Link>
          <button type="button" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} className="rounded-full p-2 text-black/45 hover:bg-black/[0.05] hover:text-black lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Link href="/account/tokens" className="group mx-4 mb-3 flex items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f7f7f5] px-4 py-3.5 transition hover:bg-[#efefec]">
          <div>
            <p className="text-[11px] font-medium text-black/45">사용 가능 토큰</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums tracking-[-0.04em]">
              <Hexagon className="h-3.5 w-3.5 fill-[#f15b4a] text-[#f15b4a]" />{balance.toLocaleString()}
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-black/25 transition group-hover:text-black/65" />
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2" aria-label="마이페이지 메뉴">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition ${active ? "bg-[#0d0d0d] text-white" : "text-black/62 hover:bg-black/[0.045] hover:text-black"}`}>
                <item.icon className="h-[17px] w-[17px]" strokeWidth={1.8} />{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/[0.06] p-4">
          <div className="mb-2 px-3 py-2">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-black/42">{user.email}</p>
          </div>
          <button type="button" onClick={async () => { await signOut(); router.replace("/"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-black/55 transition hover:bg-black/[0.045] hover:text-black">
            <LogOut className="h-4 w-4" strokeWidth={1.8} />로그아웃
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white/90 px-4 backdrop-blur-xl lg:hidden">
          <button type="button" aria-label="마이페이지 메뉴 열기" onClick={() => setSidebarOpen(true)} className="rounded-full p-2 text-black/65 hover:bg-black/[0.05]">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" aria-label="인픽 홈"><Brand /></Link>
          <Link href="/account/tokens" aria-label={`보유 토큰 ${balance}개`} className="inline-flex min-w-10 items-center justify-center gap-1 rounded-full bg-[#f4f4f2] px-2.5 py-1.5 text-xs font-semibold tabular-nums">
            <Hexagon className="h-3 w-3 fill-[#f15b4a] text-[#f15b4a]" />{balance}
          </Link>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
