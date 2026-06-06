import { Metadata } from "next";

export const metadata: Metadata = {
  title: "업체 찾기 - 인테리어 전문업체 검색",
  description: "INPICK에서 검증된 인테리어 업체를 찾아보세요. 종합 인테리어, 전문공종 업체를 지역, 공종, 평점별로 검색할 수 있습니다.",
};

export default function FindContractorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
