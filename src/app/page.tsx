import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import LogoCloud from "@/components/landing/LogoCloud";
import Features from "@/components/landing/Features";
import PainPoints from "@/components/landing/PainPoints";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FeaturesDark from "@/components/landing/FeaturesDark";
import Contact from "@/components/landing/Contact";
import FAQ from "@/components/landing/FAQ";
import LandingFooter from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <HowItWorks />
      <LogoCloud />
      <Features />
      <PainPoints />
      <Testimonials />
      <Pricing />
      <FeaturesDark />
      <FAQ />
      <Contact />
      <LandingFooter />
    </>
  );
}
