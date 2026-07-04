"use client";

/**
 * 웹 첫 접속 공지 팝업 — 토큰 충전은 INPICK 앱에서 진행 안내.
 * - 웹 브라우저에서만 표시 (네이티브 앱 WebView에서는 숨김 — App Store 3.1.1 외부결제 유도 금지)
 * - 닫기: 세션 동안 숨김 · "오늘 하루 보지 않기": 24시간 숨김 (localStorage)
 * - 스토어 URL은 StoreFloatingBadges와 동일하게 NEXT_PUBLIC_* env 사용
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Hexagon, X } from "lucide-react";
import { isNativeApp, isProbablyEmbeddedWebView } from "@/lib/mobile/platform";

const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL || "https://www.apple.com/app-store/";
const GOOGLE_PLAY_URL =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || "https://play.google.com/store";

const SESSION_KEY = "inpick_token_notice_dismissed";
const HIDE_UNTIL_KEY = "inpick_token_notice_hide_until";

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.7c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
    </svg>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path fill="#00C3FF" d="M3.6 2.3C3.2 2.5 3 2.9 3 3.5v17c0 .6.2 1 .6 1.2l9.4-9.6V12L3.6 2.3z" />
      <path fill="#FFCE00" d="M16 15.3l-3-3v-.2l3-3 3.7 2.1c1 .6 1 1.6 0 2.2L16 15.3z" />
      <path fill="#00F076" d="M16.1 15.2L13 12 3.6 21.7c.3.3.9.4 1.5.1l11-6.6z" />
      <path fill="#FF3A44" d="M16.1 8.8L5.1 2.2c-.6-.3-1.2-.3-1.5.1L13 12l3.1-3.2z" />
    </svg>
  );
}

export default function TokenNoticeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 앱(WebView) 안에서는 절대 미표시 — Capacitor 감지 + WebView UA 이중 차단
    const hiddenInApp = () => isNativeApp() || isProbablyEmbeddedWebView();
    if (hiddenInApp()) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      const hideUntil = Number(localStorage.getItem(HIDE_UNTIL_KEY) || 0);
      if (hideUntil > Date.now()) return;
    } catch {
      /* ignore */
    }
    // 첫 페인트 직후 잠깐 여유를 두고 표시 — Capacitor 주입이 늦는 케이스 대비 표시 직전 재확인
    const t = setTimeout(() => {
      if (hiddenInApp()) return;
      setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const hideToday = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(HIDE_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[90] bg-zinc-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="공지사항"
            className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            {/* 상단 브랜드 밴드 */}
            <div className="relative bg-gradient-to-br from-primary-500 via-primary-500 to-amber-500 px-6 pb-10 pt-6 text-white">
              <button
                type="button"
                onClick={close}
                aria-label="공지 닫기"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-[0.65rem] font-bold tracking-widest">
                공지사항
              </span>
              <h2 className="mt-3 text-xl font-extrabold leading-snug tracking-tight">
                토큰 충전은
                <br />
                INPICK 앱에서 진행해주세요
              </h2>
            </div>

            {/* 토큰 아이콘 — 밴드와 본문 사이에 걸치게 */}
            <div className="-mt-7 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-primary-100">
                <Hexagon className="h-7 w-7 fill-amber-400 text-amber-500" />
              </div>
            </div>

            <div className="px-6 pb-6 pt-3">
              <p className="text-center text-sm leading-relaxed text-zinc-600">
                웹에서의 토큰 충전은 현재 준비 중이에요.
                <br />
                <strong className="font-bold text-zinc-900">INPICK 앱</strong>에서 충전하시면
                웹과 앱 어디서든
                <br />
                동일하게 사용하실 수 있습니다.
              </p>

              {/* 스토어 버튼 */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-white transition hover:bg-zinc-800"
                >
                  <AppleGlyph />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] font-medium text-white/70">Download on the</span>
                    <span className="-mt-0.5 text-[13px] font-semibold tracking-tight">App Store</span>
                  </span>
                </a>
                <a
                  href={GOOGLE_PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-white transition hover:bg-zinc-800"
                >
                  <GooglePlayGlyph />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] font-medium text-white/70">GET IT ON</span>
                    <span className="-mt-0.5 text-[13px] font-semibold tracking-tight">Google Play</span>
                  </span>
                </a>
              </div>

              {/* 하단 액션 */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={hideToday}
                  className="text-xs font-medium text-zinc-400 transition hover:text-zinc-600"
                >
                  오늘 하루 보지 않기
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-primary-500 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-primary-600"
                >
                  확인
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
