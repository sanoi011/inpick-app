"use client";

const COLORS = {
  light: {
    navBg: "rgba(255, 255, 255, 0.95)",
    navBorder: "rgba(0, 0, 0, 0.06)",
    text: "#111827",
    textMuted: "#6B7280",
    buttonPrimaryBg: "#0D0D0D",
    buttonPrimaryText: "#FFFFFF",
    buttonSecondaryBg: "#FFFFFF",
    buttonSecondaryBorder: "#E5E7EB",
    buttonSecondaryText: "#0D0D0D",
  },
} as const;

const NAV_LINKS = [
  { label: "서비스 소개", href: "#features" },
  { label: "업체 찾기", href: "/find-contractors" },
  { label: "커뮤니티", href: "/community" },
  { label: "이용 요금", href: "#pricing" },
  { label: "AIOD", href: "/aiod" },
];

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { isNativeApp } from "@/lib/mobile/platform";

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
  const [nativeApp, setNativeApp] = useState(false);
  const { user, loading: authLoading, signOut } = useAuth();
  const colors = COLORS.light;

  useEffect(() => {
    setNativeApp(isNativeApp());
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`${nativeApp ? "absolute" : "fixed"} left-0 right-0 top-0 z-50 bg-white/95 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl`}
    >
      <motion.nav
        initial={{ y: -20, opacity: 0, scale: 0.95 }}
        animate={{
          y: 0, opacity: 1, scale: 1,
          maxWidth: isScrolled ? "64rem" : "72rem",
          backgroundColor: isScrolled ? colors.navBg : "transparent",
          borderRadius: isScrolled ? "9999px" : "16px",
          boxShadow: isScrolled ? "0 4px 20px -4px rgb(0 0 0 / 0.1)" : "none",
          paddingLeft: isScrolled ? "20px" : "24px",
          paddingRight: isScrolled ? "20px" : "24px",
        }}
        transition={{ type: "spring", stiffness: 150, damping: 20, mass: 1 }}
        className="mx-auto flex items-center justify-between py-2.5 backdrop-blur-md"
        style={{ border: isScrolled ? `1px solid ${colors.navBorder}` : "1px solid transparent" }}
      >
        <a className="flex shrink-0 items-center gap-2" href="/" title={`${brandName} 홈`}>
          <span className="hex-mask h-6 w-6 text-[#f15b4a]" /><span className="text-[21px] font-bold tracking-[-0.055em] text-[#0d0d0d]">inpick</span>
        </a>

        <div className="hidden md:flex items-center gap-5">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="whitespace-nowrap text-sm font-medium text-black/65 transition-colors hover:text-black">
              {link.label}
              {link.label === "커뮤니티" && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 text-xs font-bold bg-violet-500 text-white rounded-full leading-none align-middle">NEW</span>
              )}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <LocaleSwitcher />
          {!authLoading && !user && (
            <motion.a href="/auth" className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={{ color: colors.textMuted }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              로그인
            </motion.a>
          )}
          {!authLoading && user && (
            <>
            <NotificationBell />
            <div className="relative">
              <motion.button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
                style={{ color: colors.text }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                <User className="w-4 h-4" />
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </motion.button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                  <a href="/mypage" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">마이페이지</a>
                  <a href="/find-contractors" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">업체 찾기</a>
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
          <motion.a href={contactButtonHref} className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: colors.buttonSecondaryBg,
              border: `1px solid ${colors.buttonSecondaryBorder}`,
              color: colors.buttonSecondaryText,
            }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {contactButtonText}
          </motion.a>
          <motion.a href={startButtonHref} className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
            style={{ backgroundColor: colors.buttonPrimaryBg, color: colors.buttonPrimaryText }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {startButtonText}
          </motion.a>
        </div>

        <button type="button" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-3 text-black/70 transition-colors md:hidden"
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
                <span className="inline-flex items-center gap-2.5"><span className="hex-mask h-6 w-6 text-[#f15b4a]" /><span className="text-[21px] font-bold tracking-[-0.055em]">inpick</span></span>
                <div className="flex items-center gap-2">
                  <LocaleSwitcher />
                  <button type="button" className="rounded-full p-3 min-w-[44px] min-h-[44px]" onClick={() => setMobileMenuOpen(false)} aria-label="메뉴 닫기">
                    <X className="h-5 w-5" style={{ color: colors.text }} />
                  </button>
                </div>
              </div>
              <div className="mt-8 flow-root">
                <div className="border-b pb-6" style={{ borderColor: colors.navBorder }}>
                  <div className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                      <a key={link.href} href={link.href} className="text-lg font-medium py-2 min-h-[44px] flex items-center" style={{ color: colors.text }} onClick={() => setMobileMenuOpen(false)}>
                        {link.label}
                        {link.label === "커뮤니티" && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-bold bg-violet-500 text-white rounded-full leading-none align-middle">NEW</span>
                        )}
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
                      <a href="/mypage" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        마이페이지
                      </a>
                      <a href="/find-contractors" className="rounded-full px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200"
                        onClick={() => setMobileMenuOpen(false)}>
                        업체 찾기
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

export { Header };
