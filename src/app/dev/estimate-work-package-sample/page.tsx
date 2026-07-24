import { notFound } from "next/navigation";

import EstimateProForm from "@/components/estimate-pro/EstimateProForm";
import {
  assembleByRoom,
  constructionEstimateToDetailLines,
} from "@/lib/estimate-pro/detail-model";
import { buildConstructionEstimate } from "@/lib/inpick/estimate-v2/build-construction-estimate";
import type {
  RoomQuantityBasis,
  SurfacePlan,
} from "@/lib/inpick/estimate-v2/types";

const ROOM: RoomQuantityBasis = {
  roomId: "living-sample",
  roomName: "거실",
  roomType: "living_room",
  floorM2: 25.2,
  ceilingM2: 25.2,
  wallM2: 42,
  perimeterM: 20,
  doorCount: 1,
  windowCount: 2,
  heightM: 2.3,
  basisSource: "manual_input",
  assumptions: ["거실 순바닥 25.2m², 벽 42m², 천장 25.2m² 로컬 검수 기준"],
};

function plan(
  id: string,
  surfaceType: "floor" | "wall" | "ceiling",
  materialCategory: string,
  materialNameKo: string,
  selectedMaterialUnitPrice: number,
): SurfacePlan {
  return {
    id,
    projectId: "local-estimate-work-package-sample",
    projectMode: "apartment",
    roomId: ROOM.roomId,
    roomName: ROOM.roomName,
    roomType: ROOM.roomType,
    surfaceType,
    action: "demolish_and_new",
    materialCategory,
    materialNameKo,
    selectedMaterialUnitPrice,
    source: "user_selected_material",
    confidence: 0.95,
    evidenceRefs: [],
    assumptions: [],
    warnings: [],
  };
}

export default function EstimateWorkPackageSamplePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const estimate = buildConstructionEstimate({
    projectId: "local-estimate-work-package-sample",
    projectMode: "apartment",
    surfacePlans: [
      plan("sample-floor", "floor", "engineered_floor", "강마루", 65_000),
      plan("sample-wall", "wall", "silk_wallpaper", "실크벽지", 8_500),
      plan("sample-ceiling", "ceiling", "silk_wallpaper", "실크벽지", 8_500),
    ],
    quantityBasisByRoom: { [ROOM.roomId]: ROOM },
  });
  const lines = constructionEstimateToDetailLines(estimate);
  const living = assembleByRoom(lines).groups.find((group) => group.trade === "거실");
  const packageCount = living?.lines.filter((line) => line.isWorkPackage).length || 0;
  const contractLineCount = living?.lines.length || 0;
  const atomicCount = living?.lines.reduce(
    (sum, line) => sum + (line.workBreakdown?.length || 1),
    0,
  ) || 0;

  return (
    <main className="min-h-screen bg-[#f4f4f2] px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-400">
            INPICK · LOCAL REVIEW
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            실별 공사 패키지 견적 샘플
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            거실 바닥·벽·천장은 각각 한 줄로 표시하고, 철거·바탕·부자재·마감·폐기물은
            각 행의 ‘세부 산출근거’와 공종별 탭에 보존합니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="기존 거실 표시" value={`${atomicCount}개 원가 라인`} />
            <Metric
              label="개선된 거실 표시"
              value={`${contractLineCount}개 계약 항목 · 마감 ${packageCount}개`}
            />
            <Metric label="대표 바닥 수량" value={`${ROOM.floorM2}m² 순면적`} />
          </div>
        </header>

        <EstimateProForm
          lines={lines}
          projectName="거실 마감공사 검수 샘플"
          areaLabel={`거실 ${ROOM.floorM2}㎡`}
          visionBadge="로컬 표준 샘플 · 원가 합계 보존"
          initialExpandedGroups={["거실"]}
        />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70">
      <p className="text-[11px] font-semibold text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-black text-zinc-900">{value}</p>
    </div>
  );
}
