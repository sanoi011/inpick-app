import { Metadata } from "next";
import Header from "@/components/landing/Header";
import LandingFooter from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "커뮤니티 - INPICK",
  description:
    "INPICK 커뮤니티에서 AI 견적을 공유하고, 검증 사업자에게 의견을 받고, 인테리어 정보를 나누세요.",
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F7F5]">{children}</main>
      <LandingFooter />
    </>
  );
}
