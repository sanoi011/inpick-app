import { Metadata } from "next";
import HeaderV4 from "@/components/landing-v4/HeaderV4";
import LandingFooter from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "서비스 후기 - INPICK",
  description: "INPICK 전체 인테리어·부분 인테리어·자재 미리보기 서비스의 실사용 후기를 확인하세요.",
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderV4 variant="solid" />
      <main
        className="min-h-screen bg-[#F7F7F5]"
        style={{ paddingTop: "calc(72px + env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <LandingFooter />
    </>
  );
}
