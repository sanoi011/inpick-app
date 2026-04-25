import LenisProvider from "@/components/landing-v4/LenisProvider";
import HeaderV4 from "@/components/landing-v4/HeaderV4";
import HeroV4 from "@/components/landing-v4/HeroV4";
import WalkthroughV4 from "@/components/landing-v4/WalkthroughV4";
import EstimateLiveV4 from "@/components/landing-v4/EstimateLiveV4";
import MobileMockV4 from "@/components/landing-v4/MobileMockV4";
import TestimonialsV4 from "@/components/landing-v4/TestimonialsV4";
import FinalCtaV4 from "@/components/landing-v4/FinalCtaV4";
import ProgressBarV4 from "@/components/landing-v4/ProgressBarV4";

export default function Home() {
  return (
    <LenisProvider>
      <ProgressBarV4 />
      <HeaderV4 />
      <HeroV4 />
      <WalkthroughV4 />
      <EstimateLiveV4 />
      <MobileMockV4 />
      <TestimonialsV4 />
      <FinalCtaV4 />
    </LenisProvider>
  );
}
