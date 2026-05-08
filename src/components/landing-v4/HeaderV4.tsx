"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Building2, Hexagon, Shield,
  LayoutDashboard, FolderOpen, FileSignature, Bell, CreditCard,
  Settings, HelpCircle, LogOut, ChevronDown,
} from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { useAuth } from "@/hooks/useAuth";

/**
 * 헤더 V4 — 좌측 로고 + 우측 로그인 버튼 (비로그인) 또는 마이페이지+토큰 (로그인)
 */
export default function HeaderV4() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { authenticated, balance, loading } = useTokens();
  const { user, signOut } = useAuth();

  // 외부 클릭 시 dropdown 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const sections = ["hero", "walkthrough", "demo", "mob", "test", "final"];
    const onScroll = () => {
      const y = window.scrollY + 36;
      const positions = sections.map((id) => {
        const el = document.getElementById(id);
        return { id, top: el?.offsetTop ?? Infinity };
      });
      let current = "hero";
      for (const p of positions) if (y >= p.top) current = p.id;
      if (current === "walkthrough" || current === "demo") setMode("light");
      else setMode("dark");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = mode === "dark";

  // 메인 카테고리 (홈 헤더 가운데)
  const MAIN_CATEGORIES: Array<{ label: string; href: string }> = [
    { label: "소개", href: "/#walkthrough" },
    { label: "요금제", href: "/account/tokens" },
    { label: "디자인 커뮤니티", href: "/community" },
    { label: "무료 인테리어 견적", href: "/workflow" },
    { label: "리소스", href: "/community/library" },
    { label: "비즈니스", href: "/contractor" },
    { label: "문의하기", href: "/mypage/support" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-[100] h-[72px]">
      <nav
        className={`mx-auto flex h-full max-w-[1400px] items-center justify-between gap-3 px-6 transition-colors duration-300 lg:px-10 ${
          isDark ? "text-offwhite" : "text-ink"
        }`}
      >
        <div className="flex items-end gap-2.5 shrink-0">
          <a href="/" className="flex items-center gap-2">
            <span
              className={`hex-mask h-5 w-5 transition-colors ${
                isDark ? "text-offwhite" : "text-primary-500"
              }`}
            />
            <span className="font-en text-[20px] font-extrabold tracking-[-0.04em]">
              inpick
            </span>
          </a>
          <a
            href="https://www.aiod.kr"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-en mb-[2px] hidden text-[13px] font-light tracking-[0.04em] opacity-80 transition-opacity hover:opacity-100 sm:inline ${
              isDark ? "text-offwhite" : "text-ink"
            }`}
            title="AIOD — 한국 건축의 디지털 표준"
          >
            AIOD
          </a>
        </div>

        {/* 메인 카테고리 nav (데스크탑) */}
        <div className="hidden xl:flex items-center gap-0.5 flex-1 justify-center">
          {MAIN_CATEGORIES.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={`px-3 py-2 text-[13px] font-semibold tracking-tight rounded-full transition-colors ${
                isDark
                  ? "text-offwhite/85 hover:bg-offwhite/10 hover:text-offwhite"
                  : "text-ink/75 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {c.label}
            </a>
          ))}
          {/* 사업자 페이지 — 강조 */}
          <a
            href="/contractor"
            className={`ml-2 px-3 py-2 text-[13px] font-bold tracking-tight rounded-full inline-flex items-center gap-1 transition-colors ${
              isDark
                ? "border border-offwhite/30 text-offwhite hover:bg-offwhite/10"
                : "border border-ink/20 text-ink hover:bg-ink/5"
            }`}
          >
            <Building2 className="h-3 w-3" />
            사업자페이지
          </a>
        </div>

        <div className="flex items-center gap-2 text-[13px] sm:gap-2.5 sm:text-[14px]">
          {!loading && authenticated ? (
            <>
              {/* 토큰 잔액 배지 */}
              <motion.a
                href="/account/tokens"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-bold tabular transition-colors sm:px-3.5 ${
                  isDark
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20"
                    : "border-amber-500/40 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <Hexagon
                  className={`h-3.5 w-3.5 ${isDark ? "fill-amber-300" : "fill-amber-500"}`}
                />
                <span>{balance}</span>
                <span className="hidden sm:inline text-[0.78rem] font-semibold opacity-70">
                  토큰
                </span>
              </motion.a>
              {/* 마이페이지 — 사람 아이콘 + dropdown */}
              <div ref={menuRef} className="relative">
                <motion.button
                  onClick={() => setMenuOpen((v) => !v)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label="마이페이지 메뉴"
                  aria-expanded={menuOpen}
                  className={`inline-flex h-10 items-center gap-1 rounded-full pl-1 pr-2 font-semibold transition-colors ${
                    isDark
                      ? "bg-offwhite text-primary-500 hover:bg-offwhite/90"
                      : "bg-ink text-offwhite hover:bg-ink/90"
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                      isDark ? "bg-primary-500/15" : "bg-offwhite/15"
                    }`}
                  >
                    <User className="h-4 w-4" />
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  />
                </motion.button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden z-50"
                    >
                      {/* 사용자 정보 헤더 */}
                      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                        <p className="text-xs text-zinc-500">로그인 됨</p>
                        <p className="text-sm font-bold text-zinc-900 truncate">
                          {user?.email || "사용자"}
                        </p>
                      </div>

                      <nav className="py-1.5">
                        <DropdownItem href="/mypage" icon={LayoutDashboard} onClick={() => setMenuOpen(false)}>
                          마이페이지
                        </DropdownItem>
                        <DropdownItem href="/mypage/projects" icon={FolderOpen} onClick={() => setMenuOpen(false)}>
                          내 프로젝트
                        </DropdownItem>
                        <DropdownItem href="/mypage/contracts" icon={FileSignature} onClick={() => setMenuOpen(false)}>
                          계약 진행
                        </DropdownItem>
                        <DropdownItem href="/mypage/notifications" icon={Bell} onClick={() => setMenuOpen(false)}>
                          알림
                        </DropdownItem>
                        <DropdownItem href="/account/tokens" icon={CreditCard} onClick={() => setMenuOpen(false)}>
                          토큰 / 요금제
                        </DropdownItem>
                        <DropdownItem href="/mypage/account" icon={Settings} onClick={() => setMenuOpen(false)}>
                          계정 설정
                        </DropdownItem>
                        <DropdownItem href="/mypage/support" icon={HelpCircle} onClick={() => setMenuOpen(false)}>
                          고객지원
                        </DropdownItem>
                      </nav>

                      <div className="border-t border-zinc-100 py-1.5">
                        <button
                          onClick={async () => {
                            setMenuOpen(false);
                            await signOut();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          로그아웃
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <motion.a
                href="/auth?type=consumer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-semibold transition-colors sm:px-4 ${
                  isDark
                    ? "border-offwhite/40 bg-transparent text-offwhite hover:bg-offwhite/10"
                    : "border-ink/15 bg-transparent text-ink hover:bg-ink/5"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">소비자 </span>로그인
              </motion.a>
              <motion.a
                href="/auth?type=contractor"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold transition-colors sm:px-4 ${
                  isDark
                    ? "bg-offwhite text-primary-500 hover:bg-offwhite/90"
                    : "bg-ink text-offwhite hover:bg-ink/90"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">사업자 </span>로그인
              </motion.a>
              {/* 관리자 진입점 (작은 아이콘만) */}
              <motion.a
                href="/admin/login"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="관리자"
                aria-label="관리자 로그인"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isDark
                    ? "border-offwhite/30 text-offwhite/70 hover:bg-offwhite/10 hover:text-offwhite"
                    : "border-ink/15 text-ink/60 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
              </motion.a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function DropdownItem({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: typeof User;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
    >
      <Icon className="h-4 w-4 text-zinc-500" />
      {children}
    </a>
  );
}
