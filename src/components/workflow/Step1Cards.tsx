"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Layers, Check, ChevronDown, Building2, Home, Store, Box, RotateCcw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import BasicInfoCard, { BasicInfoData } from "./BasicInfoCard";
import {
  normalizeSiteConditionAnswers,
  SITE_CONDITION_OPTIONS,
  type SiteConditionAnswers,
} from "@/lib/inpick/estimate-v2/site-condition-answers";

type BuildingType = "apartment" | "house" | "store" | "etc";

const BUILDING_TYPES: Array<{ v: BuildingType; label: string; icon: typeof Home }> = [
  { v: "apartment", label: "아파트", icon: Building2 },
  { v: "house", label: "주택", icon: Home },
  { v: "store", label: "상가", icon: Store },
  { v: "etc", label: "기타", icon: Box },
];

const RESIDENTIAL_ROOMS = [
  { v: "all", label: "전체" },
  { v: "living", label: "거실" },
  { v: "master", label: "안방" },
  { v: "kitchen", label: "부엌" },
  { v: "bath", label: "욕실" },
  { v: "bedroom", label: "침실" },
  { v: "entrance", label: "현관" },
  { v: "balcony", label: "베란다" },
  { v: "dress", label: "드레스룸" },
];

const STORE_USAGES = [
  "식당",
  "카페",
  "도소매 매장",
  "사무실",
  "학원",
  "병원·의원",
  "미용실",
  "기타",
];

export interface NormalizedRoom {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  xMm?: number;
  yMm?: number;
  source: "vision" | "standard";
}

export interface NormalizedFloorplan {
  pyeong: string;
  rooms: NormalizedRoom[];
  openings: Array<{ wall?: string; type?: string; widthMm?: number; heightMm?: number }>;
  notes: string;
}

/**
 * Workflow entry mode — 사용자가 어떤 흐름으로 진입했는지.
 * - apartment_drawing: 아파트 도면 기반 (주소→평형→도면→방별)
 * - photo_residential: 도면 없는 주거 (원룸/투룸/아파트 사진 기반)
 * - photo_commercial: 상가/사무실 (업종 + zone 기반)
 *
 * Step1Cards 첫 화면에서 선택하거나, "도면없이 사진으로 바로 시작" CTA가 photo_* 모드 트리거.
 */
export type WorkflowEntry =
  | "apartment_drawing"
  | "photo_residential"
  | "photo_commercial";

/**
 * 도면 없는 주거 모드의 공간 종류 (Step2 탭 단위).
 */
export type PhotoResidentialSpace =
  | "studio"        // 원룸
  | "one_bed"       // 투룸
  | "two_bed"       // 쓰리룸
  | "apartment"     // 아파트 (도면 없이)
  | "house"         // 단독주택
  | "officetel"     // 오피스텔
  | "other_residential";

/**
 * 상가/사무실 모드의 업종 (Step2 zone 템플릿 결정).
 */
export type PhotoCommercialBusiness =
  | "cafe"
  | "restaurant"
  | "retail"
  | "beauty_salon"
  | "clinic"
  | "academy"
  | "office"
  | "gym"
  | "bakery"
  | "bar"
  | "studio_space"
  | "other_commercial";

export interface Step1Data {
  basicInfo: BasicInfoData;
  buildingType: BuildingType | null;
  /** 신규 — workflow 진입 모드. 미지정 시 기존 buildingType 기반으로 추정. */
  workflowEntry?: WorkflowEntry;
  /** photo_residential 모드: 공간 종류 */
  photoSpaceType?: PhotoResidentialSpace;
  /** photo_commercial 모드: 업종 */
  commercialBusiness?: PhotoCommercialBusiness;
  rooms: string[];
  floorLevel?: string;
  storeUsage?: string;
  storeUsageEtc?: string;
  normalizedFloorplan?: NormalizedFloorplan;
  // 실별 가구·붙박이 옵션 (예: { living: ["builtIn", "systemCloset"], kitchen: ["sinkUpper", "fridgeCabinet"] })
  roomFurnishings?: Record<string, string[]>;
  /** 이미지로 확인하기 어려운 철거·전기·설비·반출 조건 */
  siteConditions?: SiteConditionAnswers;
}

// 실별 추가 시공 옵션 (가구·붙박이) — 실 클릭 시 펼쳐짐
// (거실 옵션 삭제 — 사용자 요청)
export const ROOM_FURNISHING_OPTIONS: Record<
  string,
  Array<{ v: string; label: string; note?: string }>
> = {
  master: [
    { v: "builtIn", label: "붙박이장" },
    { v: "systemCloset", label: "시스템 옷장" },
  ],
  bedroom: [
    { v: "builtIn", label: "붙박이장" },
    { v: "systemCloset", label: "시스템 옷장" },
  ],
  entrance: [
    { v: "doubleDoor", label: "중문" },
    { v: "shoeRack_keep", label: "신발장 매핑만 (기존 활용)" },
    { v: "shoeRack_replace", label: "신발장 전체 교체" },
  ],
  bath: [
    { v: "partial", label: "욕실 부분 교체" },
  ],
  kitchen: [
    { v: "sinkUpper", label: "싱크대 상부장" },
    { v: "sinkLower", label: "싱크대 하부장" },
    { v: "sinkFull", label: "싱크대 전체 교체" },
    { v: "fridgeCabinet", label: "냉장고장" },
    { v: "kimchiCabinet", label: "김치냉장고장" },
  ],
};

interface Props {
  value: Step1Data;
  onChange: (next: Step1Data) => void;
  onNext: () => void;
  onReset?: () => void;
}

export default function Step1Cards({ value, onChange, onNext, onReset }: Props) {
  const update = <K extends keyof Step1Data>(k: K, v: Step1Data[K]) =>
    onChange({ ...value, [k]: v });

  // workflowEntry 기반 — 아파트 도면 모드만 주소 입력 필수 (도면 호출용)
  // 상가/사무실/도면없는 주거는 도면 호출 불가능 → 주소 선택 (다음 단계 진행 가능)
  const isApartmentDrawingMode = value.workflowEntry === "apartment_drawing";

  // 기본정보 완료 — 아파트 도면 모드일 때만 강제
  const addressInputDone =
    (value.basicInfo.mode === "address" &&
      !!value.basicInfo.selectedPyeong &&
      !!value.basicInfo.expansionType) ||
    (value.basicInfo.mode === "upload" && !!value.basicInfo.uploadedFloorplan?.dataUrl) ||
    (value.basicInfo.mode === "lidar" && !!value.basicInfo.lidarScan?.dataUrl);
  const inputDone = isApartmentDrawingMode ? addressInputDone : true;
  // expansionType 미선택 시 'basic' 자동 기본값으로 통과
  // 예산은 견적 단계에서 자동 산출 — Step1에서 미리 받지 않음 (과장 견적 방지)
  const basicDone = inputDone;

  // 시공범위 완료 — 건물유형 + 1개 이상 옵션 (방·층수·용도 중 하나)
  const isResidential = value.buildingType === "apartment" || value.buildingType === "house";
  const isCommercial = value.buildingType === "store" || value.buildingType === "etc";
  const scopeOk =
    value.buildingType !== null &&
    (isResidential
      ? value.rooms.length > 0
      : isCommercial
        ? !!value.storeUsage
        : false);

  // 주소 모드는 구조 분석을 백그라운드로 유지한다. Step2는 면적·형태와
  // 원본 참조로 즉시 시작하고, 분석 결과가 준비되면 정밀 공간정보를 사용한다.
  const normalizing = !!value.basicInfo.normalizing;
  const floorplanProcessingFailed =
    isApartmentDrawingMode &&
    value.basicInfo.mode === "address" &&
    !!value.basicInfo.normalizationWarning;
  const allOk =
    basicDone &&
    scopeOk &&
    (value.basicInfo.mode === "address" || (!normalizing && !floorplanProcessingFailed));
  // 안내 메시지 — 미완료 시 어디가 부족한지 명확히
  const missing: string[] = [];
  if (!inputDone) missing.push("주소·평형 또는 도면");
  // 예산은 견적 단계에서 자동 산출 — missing에 포함 X
  if (!value.buildingType) missing.push("건물 유형");
  if (isResidential && value.rooms.length === 0) missing.push("공사할 공간");
  if (isCommercial && !value.storeUsage) missing.push("용도");
  if (value.basicInfo.mode !== "address" && normalizing) missing.push("도면 정리 완료 대기");
  if (value.basicInfo.mode !== "address" && floorplanProcessingFailed) missing.push("도면 다시 처리");

  // 3-mode entry card 선택 시 workflowEntry + buildingType 함께 세팅
  const selectMode = (entry: WorkflowEntry) => {
    const buildingType: BuildingType =
      entry === "photo_commercial" ? "store" : "apartment";
    onChange({
      ...value,
      workflowEntry: entry,
      buildingType,
      // 모드 바뀌면 의존 필드 초기화
      rooms: [],
      storeUsage: undefined,
      storeUsageEtc: undefined,
      siteConditions: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* 상단 — 처음부터 다시 버튼 */}
      {onReset && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (
                confirm(
                  "입력하신 모든 정보(주소·도면·예산·건물유형·공간 옵션 등)가 초기화됩니다.\n계속하시겠습니까?",
                )
              ) {
                onReset();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold text-black/55 transition hover:bg-black/[0.035] hover:text-black"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            처음부터 다시
          </button>
        </div>
      )}

      {/* 3-mode entry — 어떻게 시작할까요? (MD plan §3-1) */}
      {!value.workflowEntry && (
        <div className="rounded-[26px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)] sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/32">
            Start with InPick
          </p>
          <h3 className="mt-2 text-[20px] font-medium tracking-[-0.045em] text-black">
            어떻게 시작할까요?
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ModeEntryCard
              onClick={() => selectMode("apartment_drawing")}
              bgImage="/mode-cards/apartment-drawing-v2.webp"
              fallbackEmoji="🏢"
              accent="from-blue-500/70 to-blue-700/80"
              title="아파트 주소·평형"
              description="주소로 평형을 찾고, 없으면 직접 입력합니다. 공간별 AI 디자인 + 17공종 가견적."
            />
            <ModeEntryCard
              onClick={() => selectMode("photo_residential")}
              bgImage="/mode-cards/photo-residential-v2.webp"
              fallbackEmoji="🏠"
              accent="from-amber-500/70 to-amber-700/80"
              title="내 공간 사진으로"
              description="도면 없이도 가능. 원룸·투룸·아파트 등 평수 + 사진 기반."
            />
            <ModeEntryCard
              onClick={() => selectMode("photo_commercial")}
              bgImage="/mode-cards/photo-commercial-v2.webp"
              fallbackEmoji="☕"
              accent="from-emerald-500/70 to-emerald-700/80"
              title="상가·사무실"
              description="카페·식당·미용실·사무실 등 업종별 zone 디자인 + 가견적."
            />
          </div>
        </div>
      )}
      {value.workflowEntry && (
        <div className="flex items-center justify-between rounded-2xl border border-black/[0.07] bg-white px-4 py-3">
          <span className="text-[11px] text-black/48">
            현재 모드 ·{" "}
            <span className="font-semibold text-black">
              {value.workflowEntry === "apartment_drawing"
                ? "아파트 주소·평형"
                : value.workflowEntry === "photo_residential"
                  ? "내 공간 사진"
                  : "상가·사무실"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, workflowEntry: undefined })}
            className="text-[11px] font-semibold text-black/48 underline decoration-black/20 underline-offset-4 hover:text-black"
          >
            모드 변경
          </button>
        </div>
      )}
      <div className={`grid gap-5 ${isApartmentDrawingMode ? "lg:grid-cols-2 lg:gap-7" : "lg:grid-cols-1"}`}>
      {/* Card 1: 기본정보 입력 — 아파트 도면 모드에서만 필수 표시
         (상가/사무실/사진 모드는 도면 호출 불가능하므로 주소 입력 선택) */}
      {isApartmentDrawingMode && (
        <Card title="기본정보 입력" icon={Layers} done={basicDone}>
          <BasicInfoCard
            value={value.basicInfo}
            onChange={(next) =>
              onChange({
                ...value,
                basicInfo: next,
                normalizedFloorplan: next.normalizedRooms?.length
                  ? {
                      pyeong: next.normalizedPyeong || next.selectedPyeong?.pyeongName || "평형 평균",
                      rooms: next.normalizedRooms,
                      openings: next.normalizedOpenings || [],
                      notes: next.normalizedNotes || "평형 통계 평균값",
                    }
                  : undefined,
              })
            }
          />
        </Card>
      )}

      {/* Card 2: 시공범위 (건물유형별 동적 UI) */}
      <Card title="시공 범위" icon={Layers} done={scopeOk}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
          건물 유형
        </p>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {BUILDING_TYPES.map((b) => {
            const sel = value.buildingType === b.v;
            const Icon = b.icon;
            return (
              <button
                key={b.v}
                onClick={() =>
                  onChange({
                    ...value,
                    buildingType: b.v,
                    // 유형 바뀌면 의존 필드 초기화
                    rooms: [],
                    floorLevel: undefined,
                    storeUsage: undefined,
                    storeUsageEtc: undefined,
                    siteConditions: undefined,
                  })
                }
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[0.78rem] font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-black bg-black text-white"
                    : "border-black/[0.08] bg-white text-black/55 hover:bg-black/[0.035] hover:text-black"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* 아파트 → 공사할 공간 */}
        {value.buildingType === "apartment" && (
          <ResidentialRooms value={value} onChange={onChange} />
        )}

        {/* 주택 → 공사할 공간 + 층수 */}
        {value.buildingType === "house" && (
          <>
            <ResidentialRooms value={value} onChange={onChange} />
            <FloorLevelInput
              value={value.floorLevel}
              onChange={(v) => update("floorLevel", v)}
              label="층수 / 동 정보"
              placeholder="예: 2층, 단층, 1F+2F"
              hint="공사 대상 층수 또는 다층 주택 시 해당 층"
            />
          </>
        )}

        {/* 상가·기타 → 용도 + 층수 */}
        {(value.buildingType === "store" || value.buildingType === "etc") && (
          <>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
              용도
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {STORE_USAGES.map((u) => {
                const sel = value.storeUsage === u;
                return (
                  <button
                    key={u}
                    onClick={() => update("storeUsage", u)}
                    className={`rounded-lg border px-2 py-2 text-[0.78rem] font-semibold tracking-tight transition-all ${
                      sel
                        ? "border-black bg-black text-white"
                        : "border-black/[0.08] bg-white text-black/55 hover:bg-black/[0.035] hover:text-black"
                    }`}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
            {value.storeUsage === "기타" && (
              <input
                type="text"
                value={value.storeUsageEtc || ""}
                onChange={(e) => update("storeUsageEtc", e.target.value)}
                placeholder="용도 직접 입력 (예: 스튜디오, 공방)"
                className="mt-2 h-[46px] w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-black outline-none placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
              />
            )}
            <FloorLevelInput
              value={value.floorLevel}
              onChange={(v) => update("floorLevel", v)}
              label="층수 / 위치"
              placeholder="예: 1층, B1, 3층 (전체 1동)"
              hint="공사 대상 층 또는 호실 정보"
            />
          </>
        )}

        {isResidential && scopeOk && (
          <SiteConditionQuestions
            value={value.siteConditions}
            onChange={(siteConditions) => update("siteConditions", siteConditions)}
          />
        )}

        {/* 다음 단계 버튼 — 항상 노출 (allOk 시 활성, 아니면 비활성 + 안내) */}
        <motion.button
          onClick={() => allOk && onNext()}
          disabled={!allOk}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={allOk ? { scale: 1.02 } : undefined}
          whileTap={allOk ? { scale: 0.98 } : undefined}
          className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold transition-all ${
            allOk
              ? "cursor-pointer bg-black text-white hover:bg-black/75"
              : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {allOk ? (
            <>
              내 공간 꾸미기
              <ChevronDown className="h-3.5 w-3.5 animate-bounce-down" />
            </>
          ) : normalizing ? (
            <>
              공간 정보 분석 중
            </>
          ) : (
            <>다음 단계 — 입력 필요: {missing.join(" · ")}</>
          )}
        </motion.button>
      </Card>
      </div>
    </div>
  );
}

function SiteConditionQuestions({
  value,
  onChange,
}: {
  value?: SiteConditionAnswers;
  onChange: (next: SiteConditionAnswers) => void;
}) {
  const answers = normalizeSiteConditionAnswers(value);
  const groups: Array<{
    key: keyof SiteConditionAnswers;
    title: string;
    question: string;
    options: ReadonlyArray<{ value: string; label: string; description: string }>;
  }> = [
    {
      key: "demolitionScope",
      title: "철거 범위",
      question: "기존 마감을 어느 정도 철거하나요?",
      options: SITE_CONDITION_OPTIONS.demolitionScope,
    },
    {
      key: "electricalScope",
      title: "전기 공사",
      question: "배선과 회로 공사 범위는 어느 정도인가요?",
      options: SITE_CONDITION_OPTIONS.electricalScope,
    },
    {
      key: "plumbingScope",
      title: "설비·배관",
      question: "주방·욕실의 급배수 위치를 이동하나요?",
      options: SITE_CONDITION_OPTIONS.plumbingScope,
    },
    {
      key: "siteAccess",
      title: "폐기물 반출",
      question: "엘리베이터와 차량 반출 조건은 어떤가요?",
      options: SITE_CONDITION_OPTIONS.siteAccess,
    },
  ];

  return (
    <div className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-4">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-black/55" />
        <div>
          <p className="text-xs font-bold text-black">현장조건 확인</p>
          <p className="mt-1 text-[11px] leading-5 text-black/45">
            이미지로 볼 수 없는 공사 조건입니다. 잘 모르면 기본단가로 계산하고 사업자가 현장에서 확정합니다.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[10px] font-black tracking-[0.08em] text-black/35">{group.title}</span>
              <p className="text-xs font-semibold text-black/70">{group.question}</p>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {group.options.map((option) => {
                const selected = answers[group.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...answers,
                        [group.key]: option.value,
                      } as SiteConditionAnswers)
                    }
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-black/[0.08] bg-white text-black hover:border-black/25"
                    }`}
                  >
                    <span className="block text-[11px] font-bold">{option.label}</span>
                    <span className={`mt-0.5 block text-[10px] leading-4 ${selected ? "text-white/60" : "text-black/40"}`}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 거주공간 (아파트·주택 공통) ───
function ResidentialRooms({ value, onChange }: { value: Step1Data; onChange: (n: Step1Data) => void }) {
  const furnishings = value.roomFurnishings || {};

  const toggle = (v: string) => {
    if (v === "all") {
      const allOn = value.rooms.includes("all");
      onChange({ ...value, rooms: allOn ? [] : ["all"] });
    } else {
      const without = value.rooms.filter((x) => x !== "all" && x !== v);
      const next = value.rooms.includes(v) ? without : [...without, v];
      onChange({ ...value, rooms: next });
    }
  };

  const toggleFurnishing = (roomKey: string, opt: string) => {
    const cur = furnishings[roomKey] || [];
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
    onChange({
      ...value,
      roomFurnishings: { ...furnishings, [roomKey]: next },
    });
  };

  // "전체" 또는 개별 실 선택 시 옵션 표시 대상 결정
  const expandedRooms = value.rooms.includes("all")
    ? Object.keys(ROOM_FURNISHING_OPTIONS)
    : value.rooms.filter((r) => ROOM_FURNISHING_OPTIONS[r]);

  return (
    <>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
        공사할 공간
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {RESIDENTIAL_ROOMS.map((r) => {
          const sel = value.rooms.includes(r.v);
          const isAll = r.v === "all";
          return (
            <button
              key={r.v}
              onClick={() => toggle(r.v)}
              className={`rounded-lg border px-2 py-2 text-[0.78rem] font-semibold tracking-tight transition-all ${
                sel
                  ? isAll
                    ? "border-black bg-black text-white"
                    : "border-black bg-black text-white"
                  : "border-black/[0.08] bg-white text-black/55 hover:bg-black/[0.035] hover:text-black"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* 실별 가구·붙박이 옵션 — 선택된 실에 한해 노출 */}
      {expandedRooms.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
            추가 시공 옵션 (가구·붙박이)
          </p>
          {expandedRooms.map((roomKey) => {
            const opts = ROOM_FURNISHING_OPTIONS[roomKey];
            const roomLabel = RESIDENTIAL_ROOMS.find((r) => r.v === roomKey)?.label || roomKey;
            const sel = furnishings[roomKey] || [];
            return (
              <div
                key={roomKey}
                className="rounded-xl border border-black/[0.07] bg-white p-2.5"
              >
                <p className="mb-1.5 text-[11px] font-semibold text-black/60">
                  ▸ {roomLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((opt) => {
                    const isSel = sel.includes(opt.v);
                    return (
                      <button
                        key={opt.v}
                        onClick={() => toggleFurnishing(roomKey, opt.v)}
                        className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold tracking-tight transition-all ${
                          isSel
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-white text-black/55 hover:bg-black/[0.035] hover:text-black"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── 층수 입력 ───
function FloorLevelInput({
  value,
  onChange,
  label,
  placeholder,
  hint,
}: {
  value?: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  hint: string;
}) {
  return (
    <>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
        {label}
      </p>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-[46px] w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-black outline-none placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
      />
      <p className="mt-1 text-[11px] text-black/35">{hint}</p>
    </>
  );
}

// ─── Card Wrapper ───
function Card({
  title,
  icon: Icon,
  done,
  children,
}: {
  title: string;
  icon: LucideIcon;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className={`relative overflow-hidden rounded-[26px] border bg-white p-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)] transition sm:p-7 ${
        done
          ? "border-black/15"
          : "border-black/[0.07] hover:border-black/15"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center text-black">
            <Icon className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <p className="text-[15px] font-semibold tracking-[-0.025em] text-black">{title}</p>
        </div>
        {done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}

// ─── 3-mode 진입 카드 — 원본 이미지와 설명을 분리해 사진 품질을 그대로 노출 ───
function ModeEntryCard({
  onClick,
  bgImage,
  fallbackEmoji,
  accent,
  title,
  description,
}: {
  onClick: () => void;
  bgImage: string;
  fallbackEmoji: string;
  accent: string; // tailwind from-/to- color classes
  title: string;
  description: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full overflow-hidden rounded-[20px] border border-black/[0.08] bg-white text-left transition hover:border-black/25 hover:shadow-lg"
    >
      <div className="relative h-48 overflow-hidden bg-[#ececea] sm:h-52">
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage}
            alt={title}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
            loading="lazy"
          />
        )}
        {imgFailed && (
          <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${accent} text-6xl`}>
            <span aria-hidden>{fallbackEmoji}</span>
          </div>
        )}
      </div>
      <div className="border-t border-black/[0.06] bg-white px-4 py-3.5">
        <p className="text-[15px] font-semibold tracking-[-0.025em] text-black">{title}</p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-black/46">
          {description}
        </p>
      </div>
    </button>
  );
}
