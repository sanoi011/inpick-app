import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "도면 로그",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
