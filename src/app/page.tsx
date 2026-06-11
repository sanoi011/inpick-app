import LenisProvider from "@/components/landing-v4/LenisProvider";
import HeaderV4 from "@/components/landing-v4/HeaderV4";
import HeroV4 from "@/components/landing-v4/HeroV4Bird";
import WalkthroughV4 from "@/components/landing-v4/WalkthroughV4";
import EstimateLiveV4 from "@/components/landing-v4/EstimateLiveV4";
import MobileMockV4 from "@/components/landing-v4/MobileMockV4";
import TestimonialsV4 from "@/components/landing-v4/TestimonialsV4";
import FinalCtaV4 from "@/components/landing-v4/FinalCtaV4";
import ProgressBarV4 from "@/components/landing-v4/ProgressBarV4";
import StoreFloatingBadges from "@/components/landing-v4/StoreFloatingBadges";

export default function Home() {
  return (
    <LenisProvider>
      <ProgressBarV4 />
      <HeaderV4 />
      <HeroV4 />
      <WalkthroughV4 />
      <EstimateLiveV4 />
      <MobileMockV4 />
      {/* 리뷰(시공사 견적과는 다른 경험) 섹션 — 모바일에서는 숨김, 데스크탑 웹은 유지 */}
      <div className="hidden md:block">
        <TestimonialsV4 />
      </div>
      <FinalCtaV4 />
      <StoreFloatingBadges />
    </LenisProvider>
  );
}
