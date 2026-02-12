import { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  description: "INPICK에 로그인하여 AI 인테리어 견적 서비스를 이용하세요.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
