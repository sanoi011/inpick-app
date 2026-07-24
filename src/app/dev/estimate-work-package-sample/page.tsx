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

const LIVING_ROOM: RoomQuantityBasis = {
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

const BATHROOM: RoomQuantityBasis = {
  roomId: "bathroom-sample",
  roomName: "욕실",
  roomType: "bathroom",
  floorM2: 4.2,
  ceilingM2: 4.2,
  wallM2: 17.5,
  perimeterM: 8.6,
  doorCount: 1,
  windowCount: 0,
  fixtureCount: 1,
  widthM: 2,
  depthM: 2.1,
  heightM: 2.3,
  basisSource: "manual_input",
  assumptions: ["욕실 바닥 4.2m², 벽 타일 17.5m², 위생기구 1세트 기준"],
};

const KITCHEN: RoomQuantityBasis = {
  roomId: "kitchen-sample",
  roomName: "주방",
  roomType: "kitchen",
  floorM2: 8.5,
  ceilingM2: 8.5,
  wallM2: 14.5,
  perimeterM: 12,
  doorCount: 0,
  windowCount: 1,
  fixtureCount: 1,
  widthM: 3.6,
  depthM: 2.4,
  heightM: 2.3,
  basisSource: "manual_input",
  assumptions: ["주방 바닥 8.5m², 조리대 3.6m 일자형 기준"],
};

function plan(
  id: string,
  room: RoomQuantityBasis,
  surfaceType: SurfacePlan["surfaceType"],
  materialCategory: string,
  materialNameKo: string,
  selectedMaterialUnitPrice?: number,
): SurfacePlan {
  return {
    id,
    projectId: "local-estimate-work-package-sample",
    projectMode: "apartment",
    roomId: room.roomId,
    roomName: room.roomName,
    roomType: room.roomType,
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
      plan(
        "living-floor",
        LIVING_ROOM,
        "floor",
        "engineered_floor",
        "강마루",
        65_000,
      ),
      plan(
        "living-wall",
        LIVING_ROOM,
        "wall",
        "silk_wallpaper",
        "실크벽지",
        8_500,
      ),
      plan(
        "living-ceiling",
        LIVING_ROOM,
        "ceiling",
        "silk_wallpaper",
        "실크벽지",
        8_500,
      ),
      plan(
        "bath-floor",
        BATHROOM,
        "floor",
        "porcelain_tile",
        "욕실 바닥 포세린 타일",
        42_000,
      ),
      plan(
        "bath-wall",
        BATHROOM,
        "wall",
        "wall_tile",
        "욕실 벽 포세린 타일",
        39_000,
      ),
      plan(
        "bath-fixture",
        BATHROOM,
        "fixture",
        "bathroom_full",
        "욕실 위생기구 패키지",
      ),
      plan(
        "kitchen-floor",
        KITCHEN,
        "floor",
        "engineered_floor",
        "강마루",
        65_000,
      ),
      plan(
        "kitchen-wall",
        KITCHEN,
        "wall",
        "silk_wallpaper",
        "실크벽지",
        8_500,
      ),
      plan(
        "kitchen-ceiling",
        KITCHEN,
        "ceiling",
        "silk_wallpaper",
        "실크벽지",
        8_500,
      ),
      plan(
        "kitchen-package",
        KITCHEN,
        "sink",
        "kitchen_standard",
        "일자형 주방가구 패키지",
      ),
    ],
    quantityBasisByRoom: {
      [LIVING_ROOM.roomId]: LIVING_ROOM,
      [BATHROOM.roomId]: BATHROOM,
      [KITCHEN.roomId]: KITCHEN,
    },
    kitchenPlanOverrides: {
      [KITCHEN.roomId]: {
        counterLengthM: 3.6,
        lowerCabinetLengthM: 3.6,
        upperCabinetLengthM: 2.8,
        tallCabinetEa: 1,
        tallCabinetLabels: ["냉장고장"],
        worktopLengthM: 3.6,
        sinkEa: 1,
        faucetEa: 1,
        hoodEa: 1,
        cooktopEa: 1,
        backsplashM2: 2.2,
        electricalAdditionsEa: 3,
        plumbingRelocation: "none",
        layoutType: "linear",
      },
    },
  });
  const lines = constructionEstimateToDetailLines(estimate);
  const roomSheet = assembleByRoom(lines);
  const bathroom = roomSheet.groups.find((group) => group.trade === "욕실");
  const kitchen = roomSheet.groups.find((group) => group.trade === "주방");
  const disciplineCount = estimate.lines.filter(
    (line) => line.tradeCode === "04" || line.tradeCode === "05",
  ).length;

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
            거실은 면 단위로 간결하게, 욕실·주방은 타일·방수·위생기구·가구와
            전기·설비를 실제 검수 가능한 세부 항목으로 표시합니다. 전기·설비는
            ‘주방/욕실 공사’에 숨기지 않고 별도 공종으로도 집계됩니다.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="검수 공간" value="거실 · 욕실 · 주방" />
            <Metric
              label="욕실 계약 표시"
              value={`${bathroom?.lines.length || 0}개 항목`}
            />
            <Metric
              label="주방 계약 표시"
              value={`${kitchen?.lines.length || 0}개 항목`}
            />
            <Metric
              label="전기·설비 원가 라인"
              value={`${disciplineCount}개 분리 산출`}
            />
          </div>
        </header>

        <EstimateProForm
          lines={lines}
          projectName="거실·욕실·주방 공사내역 검수 샘플"
          areaLabel={`거실 ${LIVING_ROOM.floorM2}㎡ · 욕실 ${BATHROOM.floorM2}㎡ · 주방 ${KITCHEN.floorM2}㎡`}
          visionBadge="로컬 다실 샘플 · 전기/설비 분리 · 원가 합계 보존"
          initialExpandedGroups={["욕실", "주방"]}
          initialTab="cover"
          documentNo="INPICK-DEMO-20260724-001"
          clientName="샘플 발주처"
          vendorName="INPICK 제휴 시공사"
          estimateDate="2026-07-24"
          validUntil="2026-08-23"
          siteAddress="로컬 검수용 표준 현장"
          expectedPeriodDays={30}
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
