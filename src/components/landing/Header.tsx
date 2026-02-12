"use client";

const COLORS = {
  light: {
    navBg: "rgba(255, 255, 255, 0.95)",
    navBorder: "rgba(0, 0, 0, 0.06)",
    text: "#111827",
    textMuted: "#6B7280",
    buttonPrimaryBg: "#2563EB",
    buttonPrimaryText: "#FFFFFF",
    buttonSecondaryBg: "#FFFFFF",
    buttonSecondaryBorder: "#E5E7EB",
    buttonSecondaryText: "#111827",
  },
} as const;

const NAV_LINKS = [
  { label: "서비스 소개", href: "#features" },
  { label: "이용 요금", href: "#pricing" },
  { label: "이용 후기", href: "#testimonials" },
  { label: "자주 묻는 질문", href: "#faq" },
];

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";

interface HeaderProps {
  brandName?: string;
  navLinks?: { label: string; href: string }[];
  startButtonText?: string;
  startButtonHref?: string;
  contactButtonText?: string;
  contactButtonHref?: string;
}

export default function Header({
  brandName = "INPICK",
  navLinks = NAV_LINKS,
  startButtonText = "무료 견적 받기",
  startButtonHref = "/project/new",
  contactButtonText = "사업자 등록",
  contactButtonHref = "/contractor/register",
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();
  const colors = COLORS.light;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
      <motion.nav
        initial={{ y: -20, opacity: 0, scale: 0.95 }}
        animate={{
          y: 0, opacity: 1, scale: 1,
          maxWidth: isScrolled ? "48rem" : "72rem",
          backgroundColor: isScrolled ? colors.navBg : "transparent",
          borderRadius: isScrolled ? "9999px" : "16px",
          boxShadow: isScrolled ? "0 4px 20px -4px rgb(0 0 0 / 0.1)" : "none",
          paddingLeft: isScrolled ? "16px" : "24px",
          paddingRight: isScrolled ? "16px" : "24px",
        }}
        transition={{ type: "spring", stiffness: 150, damping: 20, mass: 1 }}
        className="mx-auto flex items-center justify-between py-2.5 backdrop-blur-md"
        style={{ border: isScrolled ? `1px solid ${colors.navBorder}` : "1px solid transparent" }}
      >
        <a className="flex shrink-0 items-center gap-2" href="/" title={`${brandName} 홈`}>
          <span className="text-xl font-bold text-blue-600">INPICK</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: colors.text }}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {!authLoading && !user && (
            <motion.a href="/auth" className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{ color: colors.textMuted }}
              whileHover={{ scale: 1.02, color: colors.text }} whileTap={{ scale: 0.98 }}>
              로그인
            </motion.a>
          )}
          {!authLoading && user && (
            <>
            <NotificationBell />
            <div className="relative">
              <motion.button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ color: colors.text }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                <User className="w-4 h-4" />
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </motion.button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                  <a href="/projects" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">내 프로젝트</a>
                  <a href="/contracts" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">내 계약</a>
                  <a href="/notifications" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">알림</a>
                  <a href="/account" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">내 계정</a>
                  <button
                    onClick={() => { setShowUserMenu(false); signOut(); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> 로그아웃
                  </button>
                </div>
              )}
            </div>
            </>
          )}
          <motion.a href={contactButtonHref} className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: colors.buttonSecondaryBg, border: `1px solid ${colors.buttonSecondaryBorder}`, color: colors.buttonSecondaryText }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {contactButtonText}
          </motion.a>
          <motion.a href={startButtonHref} className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: colors.buttonPrimaryBg, color: colors.buttonPrimaryText }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {startButtonText}
          </motion.a>
        </div>

        <button type="button" className="md:hidden inline-flex items-center justify-center rounded-full p-2" style={{ color: colors.text }}
          onClick={() => setMobileMenuOpen(true)} aria-label="메뉴 열기">
          <Menu className="h-5 w-5" />
        </button>
      </motion.nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[99998] bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-y-0 right-0 z-[99999] w-full max-w-sm overflow-y-auto bg-white px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-blue-600">INPICK</span>
                <button type="button" className="rounded-full p-2" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기">
                  <X className="h-5 w-5" style={{ color: colors.text }} />
                </button>
              </div>
              <div className="mt-8 flow-root">
                <div className="border-b pb-6" style={{ borderColor: colors.navBorder }}>
                  <div className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                      <a key={link.href} href={link.href} className="text-lg font-medium" style={{ color: colors.text }} onClick={() => setMobileMenuOpen(false)}>
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  {!authLoading && !user && (
                    <a href="/auth" className="rounded-full px-4 py-3 text-center text-sm font-medium"
                      style={{ color: colors.textMuted }} onClick={() => setMobileMenuOpen(false)}>
                      로그인 / 회원가입
                    </a>
                  )}
                  {!authLoading && user && (
                    <>
                      <div className="px-4 py-2 text-sm text-gray-700 text-center">
                        <User className="w-4 h-4 inline mr-1" />
                        {user.user_metadata?.full_name || user.email?.split("@")[0]}
                      </div>
                      <a href="/projects" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        내 프로젝트
                      </a>
                      <a href="/contracts" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        내 계약
                      </a>
                      <a href="/notifications" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        알림
                      </a>
                      <a href="/account" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        내 계정
                      </a>
                      <button
                        onClick={() => { setMobileMenuOpen(false); signOut(); }}
                        className="rounded-full px-4 py-3 text-center text-sm font-medium text-red-600 border border-red-200"
                      >
                        로그아웃
                      </button>
                    </>
                  )}
                  <a href={contactButtonHref} className="rounded-full px-4 py-3 text-center text-sm font-medium"
                    style={{ border: `1px solid ${colors.buttonSecondaryBorder}`, color: colors.buttonSecondaryText }} onClick={() => setMobileMenuOpen(false)}>
                    {contactButtonText}
                  </a>
                  <a href={startButtonHref} className="rounded-full px-4 py-3 text-center text-sm font-medium"
                    style={{ backgroundColor: colors.buttonPrimaryBg, color: colors.buttonPrimaryText }} onClick={() => setMobileMenuOpen(false)}>
                    {startButtonText}
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
