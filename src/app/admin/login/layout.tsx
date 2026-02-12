import { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 로그인",
  description: "INPICK 관리자 포털에 로그인하세요.",
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
