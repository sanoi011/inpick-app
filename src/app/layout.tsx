import type { Metadata } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "INPICK - AI 인테리어 견적 플랫폼",
  description:
    "AI가 설계하는 나만의 인테리어 견적. 주소만 입력하면 실시간 공식 단가 기반으로 정확한 견적을 만들어 드립니다.",
  keywords: [
    "인테리어 견적",
    "AI 인테리어",
    "인테리어 플랫폼",
    "견적 자동화",
    "INPICK",
    "인픽",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
