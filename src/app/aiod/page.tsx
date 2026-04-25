import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * AIOD 법인 랜딩은 별도 프로젝트(www.aiod.kr)로 분리됨.
 * inpick-app.vercel.app/aiod 접근은 본 도메인으로 308 redirect.
 */

export const metadata: Metadata = {
  title: "AIOD — Redirecting",
  robots: { index: false, follow: false },
};

export default function AiodRedirect() {
  redirect("https://www.aiod.kr");
}
