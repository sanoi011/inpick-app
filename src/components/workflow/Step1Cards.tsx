"use client";

import { motion } from "motion/react";
import { Layers, Check, ChevronDown, Building2, Home, Store, Box, RotateCcw } from "lucide-react";
import BasicInfoCard, { BasicInfoData } from "./BasicInfoCard";

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

  // 기본정보 완료 — 평형 선택만 있어도 진행 가능 (grandPlanUrl 강제 X)
  const inputDone =
    (value.basicInfo.mode === "address" &&
      (!!value.basicInfo.selectedPyeong || !!value.basicInfo.selectedAddress)) ||
    (value.basicInfo.mode === "upload" && !!value.basicInfo.uploadedFloorplan?.dataUrl) ||
    (value.basicInfo.mode === "lidar" && !!value.basicInfo.lidarScan?.dataUrl);
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

  const allOk = basicDone && scopeOk;
  // 안내 메시지 — 미완료 시 어디가 부족한지 명확히
  const missing: string[] = [];
  if (!inputDone) missing.push("주소·평형 또는 도면");
  // 예산은 견적 단계에서 자동 산출 — missing에 포함 X
  if (!value.buildingType) missing.push("건물 유형");
  if (isResidential && value.rooms.length === 0) missing.push("공사할 공간");
  if (isCommercial && !value.storeUsage) missing.push("용도");

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
    });
  };

  return (
    <div className="space-y-3">
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
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            처음부터 다시
          </button>
        </div>
      )}

      {/* 3-mode entry — 어떻게 시작할까요? (MD plan §3-1) */}
      {!value.workflowEntry && (
        <div className="rounded-[28px] border border-primary-100 bg-white/85 p-6 shadow-card backdrop-blur-2xl">
          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-500">
            INPICK 시작하기
          </p>
          <h3 className="mt-2 text-lg font-extrabold tracking-tight text-primary-900">
            어떻게 시작할까요?
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => selectMode("apartment_drawing")}
              className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-4 text-left transition hover:border-primary-500 hover:bg-primary-50"
            >
              <div className="text-2xl">🏢</div>
              <p className="mt-2 text-sm font-bold text-primary-900">아파트 도면으로</p>
              <p className="mt-1 text-[0.7rem] text-primary-900/60 leading-relaxed">
                주소·평형 검색으로 도면을 불러옵니다. 방별 정밀 디자인 + 17공종 견적.
              </p>
            </button>
            <button
              type="button"
              onClick={() => selectMode("photo_residential")}
              className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4 text-left transition hover:border-primary-500 hover:bg-primary-50"
            >
              <div className="text-2xl">🏠</div>
              <p className="mt-2 text-sm font-bold text-primary-900">내 공간 사진으로</p>
              <p className="mt-1 text-[0.7rem] text-primary-900/60 leading-relaxed">
                도면 없이도 가능. 원룸·투룸·아파트 등 평수 + 사진 기반.
              </p>
            </button>
            <button
              type="button"
              onClick={() => selectMode("photo_commercial")}
              className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 text-left transition hover:border-primary-500 hover:bg-primary-50"
            >
              <div className="text-2xl">☕</div>
              <p className="mt-2 text-sm font-bold text-primary-900">상가·사무실</p>
              <p className="mt-1 text-[0.7rem] text-primary-900/60 leading-relaxed">
                카페·식당·미용실·사무실 등 업종별 zone 디자인 + 가견적.
              </p>
            </button>
          </div>
        </div>
      )}
      {value.workflowEntry && (
        <div className="flex items-center justify-between rounded-2xl border border-primary-100 bg-white/70 px-4 py-2">
          <span className="text-[0.72rem] text-primary-900/70">
            현재 모드 ·{" "}
            <span className="font-bold text-primary-700">
              {value.workflowEntry === "apartment_drawing"
                ? "아파트 도면"
                : value.workflowEntry === "photo_residential"
                  ? "내 공간 사진"
                  : "상가·사무실"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, workflowEntry: undefined })}
            className="text-[0.7rem] font-semibold text-primary-600 hover:underline"
          >
            모드 변경
          </button>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-7">
      {/* Card 1: 기본정보 입력 (3 모드 + 예산) */}
      <Card title="기본정보 입력" icon={Layers} done={basicDone}>
        <BasicInfoCard
          value={value.basicInfo}
          onChange={(next) => update("basicInfo", next)}
        />
      </Card>

      {/* Card 2: 시공범위 (건물유형별 동적 UI) */}
      <Card title="시공 범위" icon={Layers} done={scopeOk}>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
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
                  })
                }
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[0.78rem] font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
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
            <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
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
                        ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                        : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
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
                className="mt-2 w-full rounded-xl border border-primary-100 bg-white/90 px-3 py-2 text-sm text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
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
              ? "bg-primary-500 text-white shadow-cta hover:bg-primary-600 cursor-pointer"
              : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {allOk ? (
            <>
              내 공간 꾸미기
              <ChevronDown className="h-3.5 w-3.5 animate-bounce-down" />
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
      <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
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
                    ? "border-amber-500 bg-amber-500 text-white shadow-cta"
                    : "border-primary-500 bg-primary-500 text-white shadow-cta"
                  : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
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
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
            추가 시공 옵션 (가구·붙박이)
          </p>
          {expandedRooms.map((roomKey) => {
            const opts = ROOM_FURNISHING_OPTIONS[roomKey];
            const roomLabel = RESIDENTIAL_ROOMS.find((r) => r.v === roomKey)?.label || roomKey;
            const sel = furnishings[roomKey] || [];
            return (
              <div
                key={roomKey}
                className="rounded-xl border border-primary-100 bg-primary-50/30 p-2.5"
              >
                <p className="text-[0.7rem] font-bold text-primary-700 mb-1.5">
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
                            ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                            : "border-primary-200 bg-white text-primary-900/70 hover:border-primary-400 hover:text-primary-900"
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
      <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
        {label}
      </p>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-primary-100 bg-white/90 px-3 py-2.5 text-sm text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />
      <p className="mt-1 text-[0.7rem] text-primary-900/40">{hint}</p>
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
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className={`relative overflow-hidden rounded-[28px] border bg-white/75 p-7 shadow-card backdrop-blur-2xl transition-all ${
        done
          ? "border-primary-400 shadow-card-hover"
          : "border-primary-100 hover:border-primary-200"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity ${
          done ? "opacity-100" : "opacity-50"
        }`}
        style={{
          background: "linear-gradient(90deg, transparent, #F73B20, transparent)",
        }}
      />
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              done ? "bg-primary-500 text-white" : "bg-primary-50 text-primary-600"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-[0.92rem] font-bold tracking-tight text-primary-900">{title}</p>
        </div>
        {done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
