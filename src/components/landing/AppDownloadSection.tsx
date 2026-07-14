"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { isRegularWebBrowser } from "@/lib/mobile/platform";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/kr/app/id6786585773";
const GOOGLE_PLAY_URL =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || "https://play.google.com/store/apps/details?id=kr.inpick.app";

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.7c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
    </svg>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="#00C3FF" d="M3.6 2.3C3.2 2.5 3 2.9 3 3.5v17c0 .6.2 1 .6 1.2l9.4-9.6V12L3.6 2.3z" />
      <path fill="#FFCE00" d="M16 15.3l-3-3v-.2l3-3 3.7 2.1c1 .6 1 1.6 0 2.2L16 15.3z" />
      <path fill="#00F076" d="M16.1 15.2L13 12 3.6 21.7c.3.3.9.4 1.5.1l11-6.6z" />
      <path fill="#FF3A44" d="M16.1 8.8L5.1 2.2c-.6-.3-1.2-.3-1.5.1L13 12l3.1-3.2z" />
    </svg>
  );
}

export default function AppDownloadSection() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isRegularWebBrowser());
  }, []);

  if (!visible) return null;

  const stores = [
    {
      name: "App Store",
      eyebrow: "iPhone · iPad",
      description: "Apple 기기에서 인픽을 설치하고 프로젝트를 이어보세요.",
      href: APP_STORE_URL,
      store: "app_store",
      icon: AppleGlyph,
    },
    {
      name: "Google Play",
      eyebrow: "Android",
      description: "안드로이드 기기에서 인픽의 AI 인테리어를 이용하세요.",
      href: GOOGLE_PLAY_URL,
      store: "google_play",
      icon: GooglePlayGlyph,
    },
  ] as const;

  return (
    <section className="border-y border-black/[0.07] bg-[#f7f7f5] px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-20">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black/40">INPICK MOBILE</p>
          <h2 className="mt-3 text-[32px] font-medium leading-[1.08] tracking-[-0.055em] sm:text-[46px]">
            앱으로 더 편하게<br />인테리어를 시작하세요.
          </h2>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-black/50 sm:text-[14px]">
            웹에서 시작한 디자인과 견적을 모바일에서도 확인하고 이어서 작업할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {stores.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClientEvent(AnalyticsEvents.StoreBadgeClicked, { props: { store: item.store, placement: "home_download_cards" } })}
                className="group rounded-[24px] border border-black/[0.09] bg-white p-5 transition hover:border-black/30 hover:shadow-[0_12px_36px_rgba(0,0,0,0.07)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                    <Icon />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-black/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black" />
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/38">{item.eyebrow}</p>
                <h3 className="mt-1 text-[21px] font-semibold tracking-[-0.04em]">{item.name}</h3>
                <p className="mt-2 text-[13px] leading-5 text-black/48">{item.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2.5 text-[12px] font-semibold text-white">
                  <Smartphone className="h-3.5 w-3.5" /> 앱 설치하기
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
