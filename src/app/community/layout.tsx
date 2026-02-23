import { Metadata } from "next";
import Header from "@/components/landing/Header";
import LandingFooter from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "커뮤니티 - 인테리어 영감과 정보",
  description:
    "INPICK 커뮤니티에서 인테리어 영감을 찾고, 시공 후기를 공유하고, AI 디자인 갤러리를 탐색하세요.",
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-4 py-2 text-center">
            <p className="text-xs text-amber-700">커뮤니티는 현재 준비 중입니다. 아래 콘텐츠는 미리보기용 샘플 데이터입니다.</p>
          </div>
        </div>
        {children}
      </main>
      <LandingFooter />
    </>
  );
}
