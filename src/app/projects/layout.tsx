import { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 프로젝트",
  description: "진행 중인 인테리어 프로젝트를 확인하고 관리하세요.",
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
