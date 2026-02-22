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
      <main className="min-h-screen bg-gray-50">{children}</main>
      <LandingFooter />
    </>
  );
}
