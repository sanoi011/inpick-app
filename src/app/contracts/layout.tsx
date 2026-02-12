import { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 계약",
  description: "체결된 인테리어 계약을 확인하고 관리하세요.",
};

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
