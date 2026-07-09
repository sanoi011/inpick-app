import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { ToastContainer } from "@/components/ui/Toast";
import { TokensProvider } from "@/contexts/TokensContext";
import NativeAuthListener from "@/components/auth/NativeAuthListener";
import SessionTracker from "@/components/analytics/SessionTracker";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-bodoni",
  display: "swap",
});
// Host Grotesk 가 next/font 14.2 에 아직 미수록 → Manrope 로 대체 (가장 흡사한 모던 그로테스크)
const hostGrotesk = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-host",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://interiorpick.co.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 브랜드명 표기: INPICK(영문)·인픽·인테리어픽(도메인 interiorpick 한글 독음) 병기.
  // 네이버 브랜드 검색("인테리어픽")에 잡히려면 이 정확한 문자열이 title/description/keywords에 있어야 함.
  title: {
    default: "인테리어픽(INPICK) - AI 인테리어 견적 플랫폼",
    template: "%s | 인테리어픽 INPICK",
  },
  description:
    "인테리어픽(INPICK) — AI가 설계하는 나만의 인테리어 견적. 주소만 입력하면 실시간 공식 단가 기반으로 정확한 견적을 만들어 드립니다.",
  keywords: [
    "인테리어픽",
    "인테리어픽 인픽",
    "INPICK",
    "인픽",
    "인테리어 견적",
    "AI 인테리어",
    "인테리어 플랫폼",
    "견적 자동화",
    "인테리어 비용",
    "리모델링 견적",
    "인테리어 AI",
  ],
  openGraph: {
    title: "인테리어픽(INPICK) - AI 인테리어 견적 플랫폼",
    description: "주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.",
    siteName: "인테리어픽 INPICK",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "인테리어픽(INPICK) - AI 인테리어 견적 플랫폼",
    description: "주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.",
  },
  verification: {
    // 네이버 서치어드바이저 사이트 소유 확인 (2026-07-07)
    other: {
      "naver-site-verification": "3f6eec071969ce3612e4d083917d8e24473eafb2",
    },
  },
};

// 모바일/Capacitor WebView 필수 viewport.
//  - viewportFit: "cover" → 노치/홈 인디케이터 영역까지 그려 env(safe-area-inset-*) 활성화
//  - maximumScale 1 + userScalable false → 입력 포커스 시 iOS 자동 확대(zoom) 방지 (앱 느낌)
//  - themeColor → Android 상태바/주소창 색 (primary-500)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F73B20",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* 브랜드 구조화 데이터 — 네이버/구글이 "인테리어픽=이 사이트"로 인식(alternateName) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "인테리어픽",
              alternateName: ["INPICK", "인픽", "인테리어픽", "interiorpick"],
              url: SITE_URL,
              logo: `${SITE_URL}/icons/icon-512x512.png`,
              description: "AI 기반 인테리어 견적 플랫폼",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "인테리어픽 INPICK",
              alternateName: "인테리어픽",
              url: SITE_URL,
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} ${hostGrotesk.variable} antialiased font-sans`}
      >
        <TokensProvider>
          {children}
          <ToastContainer />
          <NativeAuthListener />
          <SessionTracker />
        </TokensProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

function ServiceWorkerRegistration() {
  // 옛 inpick-v1 SW 강제 정리: 페이지 진입 즉시 모든 SW unregister + 모든 cache 삭제 → 1회 reload.
  // 사용자가 옛 캐시에 갇혀있는 경우 새 코드가 즉시 도달하도록 함.
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  if (typeof window === 'undefined') return;
  var purged = sessionStorage.getItem('inpick_purged_v4');
  if (purged) return;
  if (!('serviceWorker' in navigator)) return;
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister().catch(function(){}); }));
    }),
    ('caches' in window)
      ? caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k).catch(function(){}); }));
        })
      : Promise.resolve()
  ]).then(function () {
    sessionStorage.setItem('inpick_purged_v4', '1');
    if (performance && performance.navigation && performance.navigation.type !== 1) {
      window.location.reload();
    } else {
      // 이미 reload 중이거나 첫 진입 — reload 한 번
      try { window.location.reload(); } catch (e) {}
    }
  }).catch(function(){
    sessionStorage.setItem('inpick_purged_v4', '1');
  });
})();
        `,
      }}
    />
  );
}
