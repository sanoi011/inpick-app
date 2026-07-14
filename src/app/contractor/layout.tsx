"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  FileText,
  Hexagon,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CalculatorPopup from "@/components/contractor/CalculatorPopup";

const NAVIGATION = [
  { label: "대시보드", href: "/contractor", icon: LayoutDashboard },
  { label: "입찰공고", href: "/contractor/bids", icon: FileText },
  { label: "프로젝트", href: "/contractor/projects", icon: Home },
  { label: "일정", href: "/contractor/schedule", icon: CalendarDays },
  { label: "정산", href: "/contractor/finance", icon: ReceiptText },
  { label: "AI 비서", href: "/contractor/ai", icon: Bot },
  { label: "업체 정보", href: "/contractor/profile", icon: UserRound },
];

const EXCLUDE_LAYOUT = [
  "/contractor/login",
  "/contractor/register",
  "/contractor/reset-password",
];

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const bootstrapTried = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contractorName, setContractorName] = useState<string | null>(null);

  useEffect(() => {
    setContractorName(localStorage.getItem("contractor_name"));
    if (EXCLUDE_LAYOUT.includes(pathname) || bootstrapTried.current) return;
    bootstrapTried.current = true;
    if (localStorage.getItem("contractor_token")) return;

    void (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          router.replace("/contractor/login");
          return;
        }
        const response = await fetch("/api/contractor/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        });
        const data = await response.json();
        if (!response.ok || !data.token) {
          router.replace("/contractor/login");
          return;
        }
        localStorage.setItem("contractor_token", data.token);
        localStorage.setItem("contractor_id", data.contractor.id);
        localStorage.setItem("contractor_name", data.contractor.company_name);
        setContractorName(data.contractor.company_name);
      } catch {
        router.replace("/contractor/login");
      }
    })();
  }, [pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (EXCLUDE_LAYOUT.includes(pathname)) return <>{children}</>;

  const handleLogout = async () => {
    localStorage.removeItem("contractor_token");
    localStorage.removeItem("contractor_id");
    localStorage.removeItem("contractor_name");
    try {
      await createClient().auth.signOut();
    } catch {
      // 로컬 사업자 토큰 제거만으로도 로그아웃은 완료된다.
    }
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-black">
      <header className="sticky top-0 z-40 bg-[#f7f7f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white lg:hidden"
            aria-label="사업자 메뉴 열기"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link href="/contractor" className="flex shrink-0 items-center gap-2">
            <Hexagon className="h-5 w-5 fill-[#f15b4a] text-[#f15b4a]" />
            <span className="text-base font-black tracking-[-0.04em]">InPick</span>
            <span className="rounded-full bg-black px-2 py-1 text-[9px] font-black tracking-[0.08em] text-white">BUSINESS</span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {NAVIGATION.map((item) => {
              const active = item.href === "/contractor" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                    active ? "bg-black text-white" : "text-black/48 hover:bg-white hover:text-black"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {contractorName && (
              <span className="hidden max-w-32 truncate px-2 text-[11px] font-bold text-black/45 sm:block">{contractorName}</span>
            )}
            <CalculatorPopup />
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white transition hover:bg-black hover:text-white"
              aria-label="알림"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="hidden h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 text-[11px] font-bold transition hover:bg-black hover:text-white sm:inline-flex"
            >
              <LogOut className="h-3.5 w-3.5" /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,360px)] flex-col bg-[#f7f7f5] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Link href="/contractor" className="flex items-center gap-2">
                <Hexagon className="h-5 w-5 fill-[#f15b4a] text-[#f15b4a]" />
                <span className="font-black tracking-[-0.04em]">InPick Business</span>
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>

            {contractorName && (
              <div className="mt-6 rounded-2xl bg-white p-4">
                <p className="text-[10px] font-bold text-black/35">로그인 업체</p>
                <p className="mt-1 truncate text-sm font-black">{contractorName}</p>
              </div>
            )}

            <nav className="mt-5 space-y-1">
              {NAVIGATION.map((item) => {
                const active = item.href === "/contractor" ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${active ? "bg-black text-white" : "hover:bg-white"}`}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ChevronRight className="ml-auto h-4 w-4 opacity-30" />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-2">
              <Link href="/" className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold"><Home className="h-4 w-4" /> 인픽 메인</Link>
              <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-black/50 hover:bg-white hover:text-black"><LogOut className="h-4 w-4" /> 로그아웃</button>
            </div>
          </aside>
        </div>
      )}

      {children}
    </div>
  );
}
