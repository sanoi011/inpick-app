import type { Metadata } from "next";
import AiodLandingClient from "./AiodLandingClient";

export const metadata: Metadata = {
  title: "AIOD — 건축·인테리어 AI 솔루션",
  description:
    "AIOD는 건축 도메인 8년의 실무 경험과 AI 기술을 결합해, 인테리어·건설 공사의 견적·설계·계약 과정을 자동화합니다. INPICK 플랫폼의 운영사.",
  alternates: { canonical: "/aiod" },
  openGraph: {
    title: "AIOD — 건축·인테리어 AI 솔루션",
    description:
      "건축 도메인 실무 + AI 기술. INPICK 플랫폼의 운영사 AIOD.",
    url: "/aiod",
    type: "website",
  },
};

export default function AiodPage() {
  return <AiodLandingClient />;
}
