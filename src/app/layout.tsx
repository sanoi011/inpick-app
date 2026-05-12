import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { ToastContainer } from "@/components/ui/Toast";
import { TokensProvider } from "@/contexts/TokensContext";
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
  title: {
    default: "INPICK - AI 인테리어 견적 플랫폼",
    template: "%s | INPICK",
  },
  description:
    "AI가 설계하는 나만의 인테리어 견적. 주소만 입력하면 실시간 공식 단가 기반으로 정확한 견적을 만들어 드립니다.",
  keywords: [
    "인테리어 견적",
    "AI 인테리어",
    "인테리어 플랫폼",
    "견적 자동화",
    "INPICK",
    "인픽",
    "인테리어 비용",
    "리모델링 견적",
    "인테리어 AI",
  ],
  openGraph: {
    title: "INPICK - AI 인테리어 견적 플랫폼",
    description: "주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.",
    siteName: "INPICK",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "INPICK - AI 인테리어 견적 플랫폼",
    description: "주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.",
  },
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
        <meta name="theme-color" content="#FF6B35" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} ${hostGrotesk.variable} antialiased font-sans`}
      >
        <TokensProvider>
          {children}
          <ToastContainer />
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
