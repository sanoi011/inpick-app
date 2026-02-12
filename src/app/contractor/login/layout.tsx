import { Metadata } from "next";

export const metadata: Metadata = {
  title: "사업자 로그인",
  description: "INPICK 사업자 포털에 로그인하세요.",
};

export default function ContractorLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
