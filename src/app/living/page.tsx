import type { Metadata } from "next";
import LivingLobby from "./LivingLobby";

export const metadata: Metadata = {
  title: "INPICK LIVING",
  description: "내 아파트 타입을 선택하고 1인칭으로 입장하는 INPICK 3D 공간 서비스",
};

export default function LivingPage() {
  return <LivingLobby />;
}
