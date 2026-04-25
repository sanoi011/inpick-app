import type { Metadata } from "next";
import AiodLandingClient from "./AiodLandingClient";

export const metadata: Metadata = {
  title: "AIOD 아이오드 — 한국 건축의 디지털 표준",
  description:
    "AIOD는 한국 건축·인테리어 산업의 디지털 인프라를 만드는 딥테크 스타트업입니다. 견적·설계·매칭·계약을 하나의 흐름으로.",
  alternates: { canonical: "/aiod" },
  openGraph: {
    title: "AIOD 아이오드 — 한국 건축의 디지털 표준",
    description:
      "30초의 정확한 견적, 검증된 시공자 매칭, 공정거래위 표준 계약.",
    url: "/aiod",
    type: "website",
  },
};

export default function AiodPage() {
  return <AiodLandingClient />;
}
