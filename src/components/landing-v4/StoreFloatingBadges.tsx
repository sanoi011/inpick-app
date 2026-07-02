"use client";

/**
 * 메인 페이지 우측 하단 플로팅 앱 설치 배지 (App Store / Google Play).
 * - 실제 스토어 URL은 NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_GOOGLE_PLAY_URL 사용.
 *   미설정 시 스토어 홈으로 연결(클릭 가능 placeholder) — 출시 후 env만 채우면 실제 앱으로 연결됨.
 * - 닫기(X) 시 해당 세션 동안 숨김.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isNativeApp } from "@/lib/mobile/platform";

const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL || "https://www.apple.com/app-store/";
const GOOGLE_PLAY_URL =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || "https://play.google.com/store";

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.7c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
    </svg>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#00C3FF" d="M3.6 2.3C3.2 2.5 3 2.9 3 3.5v17c0 .6.2 1 .6 1.2l9.4-9.6V12L3.6 2.3z" />
      <path fill="#FFCE00" d="M16 15.3l-3-3v-.2l3-3 3.7 2.1c1 .6 1 1.6 0 2.2L16 15.3z" />
      <path fill="#00F076" d="M16.1 15.2L13 12 3.6 21.7c.3.3.9.4 1.5.1l11-6.6z" />
      <path fill="#FF3A44" d="M16.1 8.8L5.1 2.2c-.6-.3-1.2-.3-1.5.1L13 12l3.1-3.2z" />
    </svg>
  );
}

export default function StoreFloatingBadges() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // 네이티브 앱(iOS/Android) 안에서는 스토어 설치 배지 숨김
    // (App Store 3.1.1 — 앱 내 외부 다운로드 유도 금지 / 앱 안에서 설치 배너는 무의미)
    if (isNativeApp()) return;
    try {
      if (sessionStorage.getItem("inpick_store_badges_dismissed") === "1") return;
    } catch {
      /* ignore */
    }
    setHidden(false);
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem("inpick_store_badges_dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="앱 설치 배너 닫기"
        className="mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/70 text-white/80 backdrop-blur transition hover:bg-zinc-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="rounded-full bg-zinc-900/70 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur">
        인픽 앱 설치
      </p>

      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-[170px] items-center gap-2.5 rounded-xl border border-white/15 bg-black px-3.5 py-2 text-white shadow-lg transition hover:scale-[1.02] hover:bg-zinc-900"
      >
        <AppleGlyph />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-medium text-white/75">Download on the</span>
          <span className="-mt-0.5 text-[15px] font-semibold tracking-tight">App Store</span>
        </span>
      </a>

      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-[170px] items-center gap-2.5 rounded-xl border border-white/15 bg-black px-3.5 py-2 text-white shadow-lg transition hover:scale-[1.02] hover:bg-zinc-900"
      >
        <GooglePlayGlyph />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-medium text-white/75">GET IT ON</span>
          <span className="-mt-0.5 text-[15px] font-semibold tracking-tight">Google Play</span>
        </span>
      </a>
    </div>
  );
}
