"use client";

import dynamic from "next/dynamic";
import type { ExpoProvisionalFootprint } from "@/lib/expo/footprint";
import type { ExpoBoothScene } from "@/lib/expo/scene";

/**
 * 공유 제안 페이지의 읽기전용 3D 뷰 — 고객이 직접 회전/시점 전환.
 * 선택/편집 콜백 없이 렌더만 한다 (geometry truth 그대로 노출).
 */

const BoothShell3D = dynamic(() => import("@/components/expo/BoothShell3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-black/10 bg-slate-50 text-sm text-black/50">
      3D 부스 불러오는 중…
    </div>
  ),
});

export default function SharedBoothView({
  footprint,
  confirmed,
  scene,
  brandColorHex,
  brandLogoUrl,
}: {
  footprint: ExpoProvisionalFootprint;
  confirmed: boolean;
  scene: ExpoBoothScene | null;
  brandColorHex: string | null;
  brandLogoUrl: string | null;
}) {
  return (
    <div className="mt-4 print:hidden">
      <BoothShell3D
        footprint={footprint}
        confirmed={confirmed}
        scene={scene}
        selectedComponentId={null}
        brandColorHex={brandColorHex}
        brandLogoUrl={brandLogoUrl}
      />
    </div>
  );
}
