/* eslint-disable @next/next/no-img-element */
/**
 * 기본정보 입력 카드 — 3 옵션 (주소·도면·LIDAR) + 예산·기본/확장형 통합.
 *
 * 옵션 1: 주소 검색 → 네이버 평면도 있으면 원본 형식 유지 + 워터마크 최소 정리
 *                   → 없으면 수동 평형으로 실별 평균 면적 산출
 * 옵션 2: 도면 직접 업로드 (이미지·손도면)
 * 옵션 3: LIDAR 스캔 (모바일) — placeholder
 *
 * 셋 중 하나만 완료해도 다음 단계 진행 가능.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  Search,
  Loader2,
  Upload,
  ScanLine,
  MapPin,
  Camera,
  FileImage,
  Wallet,
} from "lucide-react";
import type { AddressSearchResult } from "@/types/address";
import {
  fetchFloorplanJson,
  FLOORPLAN_CLIENT_TIMEOUT_MS,
  FLOORPLAN_STALE_STATE_MS,
  FloorplanRequestError,
} from "@/lib/inpick/floorplan/normalize-request";

type InputMode = "address" | "upload" | "lidar";
const FLOORPLAN_PIPELINE_VERSION = 8;

export interface BasicInfoData {
  mode: InputMode;
  // 주소
  selectedAddress?: AddressSearchResult;
  selectedComplex?: { complexNo: string; complexName: string; bcode: string };
  selectedPyeong?: {
    pyeongNo: number;
    pyeongName: string;
    exclusiveArea: number;
    grandPlanUrl?: string;
    roomCnt?: number;
    bathroomCnt?: number;
  };
  // 도면 업로드
  uploadedFloorplan?: { dataUrl: string; filename: string; isHandDrawn: boolean };
  // LIDAR
  lidarScan?: { dataUrl: string };
  // 예산
  budget: number; // 만원
  expansionType: "basic" | "extended" | null;
  // 정형화 평면도 (워터마크 제거된 raster + 치수 SVG 오버레이)
  cleanedImageUrl?: string;
  normalizedImageUrl?: string;       // 가이드 §1 — Storage에 저장된 normalized.png URL
  floorplanPropertyId?: string;      // 가이드 §3 — render-room 호출 시 사용
  dimensionOverlaySvg?: string;
  totalWidthMm?: number;
  totalDepthMm?: number;
  normalizing?: boolean;
  normalizationStartedAt?: number;
  normalizationPipelineVersion?: number;
  /** 도면 생성 실패 시 사용자 안내 */
  normalizationWarning?: string;
  floorplanModel?: string;
  floorplanQuality?: "medium" | "high";
  layoutVariant?: "basic" | "extended";
  analysisEngine?: string;
  normalizedRooms?: Array<{
    name: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    xMm?: number;
    yMm?: number;
    source: "vision" | "standard";
  }>;
  normalizedOpenings?: Array<{ wall?: string; type?: string; widthMm?: number; heightMm?: number }>;
  normalizedNotes?: string;
  normalizedPyeong?: string;
}

interface Props {
  value: BasicInfoData;
  onChange: (next: BasicInfoData) => void;
}

interface NormalizeFloorplanResponse {
  error?: string;
  property_id?: string;
  cleanedImageUrl?: string;
  normalizedImageUrl?: string;
  dimensionOverlaySvg?: string;
  totalWidthMm?: number;
  totalDepthMm?: number;
  rooms?: BasicInfoData["normalizedRooms"];
  openings?: BasicInfoData["normalizedOpenings"];
  notes?: string;
  pyeong?: string;
  cleanModel?: string;
  cleanQuality?: "medium" | "high";
  layoutVariant?: "basic" | "extended";
  analysisEngine?: string;
}

export default function BasicInfoCard({ value, onChange }: Props) {
  const mode = value.mode || "address";
  const setMode = (m: InputMode) => onChange({ ...value, mode: m });

  const inputDone =
    (mode === "address" && !!value.selectedPyeong && !!value.expansionType) ||
    (mode === "upload" && !!value.uploadedFloorplan?.dataUrl) ||
    (mode === "lidar" && !!value.lidarScan?.dataUrl);
  const budgetDone = value.budget > 0;
  const isComplete = inputDone && budgetDone;

  return (
    <div className="rounded-[20px] border border-black/[0.07] bg-[#fafafa] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-black" />
        <h3 className="text-[14px] font-semibold tracking-[-0.025em] text-black">기본정보 입력</h3>
        {isComplete && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white"
          >
            ✓ 완료
          </motion.span>
        )}
      </div>

      {/* 탭: 3 옵션 */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-[#eeeeec] p-1">
        <TabBtn
          active={mode === "address"}
          icon={Search}
          label="주소 검색"
          onClick={() => setMode("address")}
        />
        <TabBtn
          active={mode === "upload"}
          icon={Upload}
          label="도면 업로드"
          onClick={() => setMode("upload")}
        />
        <TabBtn
          active={mode === "lidar"}
          icon={ScanLine}
          label="LIDAR 스캔"
          onClick={() => setMode("lidar")}
        />
      </div>

      {/* 본문 */}
      {mode === "address" && <AddressMode value={value} onChange={onChange} />}
      {mode === "upload" && <UploadMode value={value} onChange={onChange} />}
      {mode === "lidar" && <LidarMode value={value} onChange={onChange} />}

      {mode !== "address" && <ConstructionTypeSelector value={value} onChange={onChange} />}

    </div>
  );
}

function ConstructionTypeSelector({ value, onChange }: Props) {
  return (
    <div className="mt-5 border-t border-black/[0.07] pt-5">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-black" />
        <span className="text-sm font-semibold tracking-tight text-black">시공 형태</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: "basic", label: "기본형", desc: "발코니 미확장" },
          { v: "extended", label: "확장형", desc: "발코니 확장 시공" },
        ].map((item) => {
          const selected = value.expansionType === item.v;
          return (
            <button
              key={item.v}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  expansionType: item.v as "basic" | "extended",
                  cleanedImageUrl: undefined,
                  normalizedImageUrl: undefined,
                  floorplanPropertyId: undefined,
                  dimensionOverlaySvg: undefined,
                  totalWidthMm: undefined,
                  totalDepthMm: undefined,
                  normalizedRooms: undefined,
                  normalizedOpenings: undefined,
                  normalizedNotes: undefined,
                  normalizedPyeong: undefined,
                  floorplanModel: undefined,
                  floorplanQuality: undefined,
                  layoutVariant: undefined,
                  analysisEngine: undefined,
                  normalizing: false,
                  normalizationStartedAt: undefined,
                  normalizationWarning: undefined,
                })
              }
              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-black/[0.08] bg-white text-black/55 hover:bg-black/[0.035] hover:text-black"
              }`}
            >
              <div className="text-sm font-bold tracking-tight">{item.label}</div>
              <div className={`mt-0.5 text-[0.7rem] ${selected ? "text-white/65" : "text-black/38"}`}>
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab Button ───
function TabBtn({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
        active
          ? "bg-white text-black shadow-sm"
          : "text-black/42 hover:text-black"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

// ─── Mode 1: 주소 검색 ───
const RECENT_KEY = "inpick_recent_addresses";
const RECENT_MAX = 8;

function loadRecent(): AddressSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(addr: AddressSearchResult) {
  if (typeof window === "undefined") return;
  try {
    const curr = loadRecent();
    // 중복 제거 (roadAddress 기준)
    const filtered = curr.filter((a) => a.roadAddress !== addr.roadAddress);
    const next = [addr, ...filtered].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* localStorage quota / private mode */
  }
}

function removeRecent(roadAddress: string) {
  if (typeof window === "undefined") return;
  try {
    const curr = loadRecent();
    const next = curr.filter((a) => a.roadAddress !== roadAddress);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function AddressMode({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<AddressSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [pyeongList, setPyeongList] = useState<
    Array<{
      pyeongNo: number;
      pyeongName: string;
      exclusiveArea: number;
      grandPlanUrl?: string;
      roomCnt?: number;
      bathroomCnt?: number;
    }>
  >([]);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [showAllPyeong, setShowAllPyeong] = useState(false);
  const [manualPyeong, setManualPyeong] = useState("");
  const [buildingLookupDone, setBuildingLookupDone] = useState(false);
  const valueRef = useRef(value);
  const activeNormalizeKeyRef = useRef<string | null>(null);
  const activeNormalizeControllerRef = useRef<AbortController | null>(null);
  const attemptedNormalizeKeysRef = useRef(new Set<string>());
  valueRef.current = value;

  // Fast Refresh/새로고침 또는 구 파이프라인에서 비동기 호출만 끊긴 경우 자동 복구.
  useEffect(() => {
    if (
      !value.normalizing ||
      (value.normalizationStartedAt &&
        value.normalizationPipelineVersion === FLOORPLAN_PIPELINE_VERSION) ||
      !value.selectedPyeong ||
      !value.expansionType
    ) {
      return;
    }
    const normalizeKey = `${value.selectedPyeong.pyeongNo}:${value.selectedPyeong.grandPlanUrl || "area-average"}:${value.selectedPyeong.exclusiveArea}:${value.expansionType}`;
    attemptedNormalizeKeysRef.current.delete(normalizeKey);
    if (activeNormalizeKeyRef.current === normalizeKey) activeNormalizeKeyRef.current = null;
    onChange({
      ...value,
      normalizing: false,
      normalizationStartedAt: undefined,
      normalizationWarning: undefined,
    });
  }, [onChange, value]);

  // 네트워크 함수가 비정상적으로 유실돼도 무한 로딩 상태는 남기지 않는다.
  useEffect(() => {
    if (!value.normalizing || !value.normalizationStartedAt) return;
    const elapsed = Date.now() - value.normalizationStartedAt;
    const remaining = Math.max(0, FLOORPLAN_STALE_STATE_MS - elapsed);
    const timer = window.setTimeout(() => {
      const current = valueRef.current;
      if (!current.normalizing || current.normalizationStartedAt !== value.normalizationStartedAt) return;
      onChange({
        ...current,
        normalizing: false,
        normalizationStartedAt: undefined,
        normalizationWarning: "공간 정보 분석 시간이 초과되었습니다.",
      });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [onChange, value.normalizationStartedAt, value.normalizing]);

  // 평형 + expansion 둘 다 결정되면 백그라운드 호출한다.
  // 도면이 있으면 워터마크만 최소 정리하고, 없으면 평형 평균 실 치수를 산출한다.
  useEffect(() => {
    if (
      value.selectedPyeong &&
      value.expansionType &&
      !value.normalizedRooms?.length &&
      !value.normalizing &&
      !value.normalizationWarning
    ) {
      // 자동 트리거 — runNormalize는 아래 정의됨
      void runNormalizeRef.current?.(value.selectedPyeong, value.expansionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.selectedPyeong?.pyeongNo,
    value.expansionType,
    value.normalizedRooms?.length,
    value.normalizing,
    value.normalizationWarning,
  ]);

  // runNormalize ref — useEffect 안에서 최신 함수 참조 (closure 회피)
  const runNormalizeRef = useRef<typeof runNormalize | null>(null);

  // 마운트 시 최근 검색 로드
  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  // 자동완성 (300ms 디바운스)
  useEffect(() => {
    if (keyword.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/address?keyword=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const handleSelectAddress = useCallback(
    async (addr: AddressSearchResult) => {
      saveRecent(addr);
      setRecent(loadRecent());
      onChange({
        ...value,
        mode: "address",
        selectedAddress: addr,
        selectedPyeong: undefined,
        expansionType: null,
        cleanedImageUrl: undefined,
        normalizedImageUrl: undefined,
        floorplanPropertyId: undefined,
        dimensionOverlaySvg: undefined,
        totalWidthMm: undefined,
        totalDepthMm: undefined,
        normalizedRooms: undefined,
        normalizedOpenings: undefined,
        normalizedNotes: undefined,
        normalizedPyeong: undefined,
        floorplanModel: undefined,
        floorplanQuality: undefined,
        layoutVariant: undefined,
        analysisEngine: undefined,
        normalizing: false,
        normalizationStartedAt: undefined,
        normalizationWarning: undefined,
      });
      setKeyword(addr.roadAddress);
      setResults([]);
      setFocused(false);
      setPyeongList([]);
      setShowAllPyeong(false);
      setManualPyeong("");
      setBuildingLookupDone(false);
      setLoadingBuilding(true);
      try {
        const params = new URLSearchParams({
          mode: "manual",
          bcode: addr.bcode,
          buildingName: addr.buildingName || "",
        });
        const res = await fetch(`/api/building?${params}`);
        const data = await res.json();
        if (data.pyeongList?.length > 0) {
          setPyeongList(data.pyeongList);
        }
      } catch (e) {
        console.error("building fetch fail", e);
      } finally {
        setLoadingBuilding(false);
        setBuildingLookupDone(true);
      }
    },
    [onChange, value]
  );

  const handleRemoveRecent = (roadAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(roadAddress);
    setRecent(loadRecent());
  };

  /**
   * 도면 최소 정리/평형 평균 분석 호출 — 평형 + expansion 결정 시 실행.
   * useEffect (위)에서 자동 trigger.
   */
  const runNormalize = async (
    pyeong: {
      pyeongNo: number;
      pyeongName: string;
      exclusiveArea: number;
      grandPlanUrl?: string;
      roomCnt?: number;
      bathroomCnt?: number;
    },
    expansion: "basic" | "extended",
  ) => {
    const sourceUrl = pyeong.grandPlanUrl;
    const normalizeKey = `${pyeong.pyeongNo}:${sourceUrl || "area-average"}:${pyeong.exclusiveArea}:${expansion}`;
    if (
      activeNormalizeKeyRef.current === normalizeKey ||
      attemptedNormalizeKeysRef.current.has(normalizeKey)
    ) {
      return;
    }
    activeNormalizeKeyRef.current = normalizeKey;
    attemptedNormalizeKeysRef.current.add(normalizeKey);
    activeNormalizeControllerRef.current?.abort();
    const normalizeController = new AbortController();
    activeNormalizeControllerRef.current = normalizeController;

    const p = pyeong;
    const isCurrentSelection = () => {
      const current = valueRef.current;
      return (
        current.selectedPyeong?.pyeongNo === pyeong.pyeongNo &&
        current.expansionType === expansion
      );
    };
    const finishWithError = (message: string) => {
      if (!isCurrentSelection()) return;
      const current = valueRef.current;
      onChange({
        ...current,
        selectedPyeong: p,
        expansionType: expansion,
        cleanedImageUrl: undefined,
        normalizedImageUrl: undefined,
        normalizing: false,
        normalizationStartedAt: undefined,
        normalizationWarning: message,
      });
    };

    onChange({
      ...valueRef.current,
      selectedPyeong: pyeong,
      expansionType: expansion,
      cleanedImageUrl: undefined,
      normalizedImageUrl: undefined,
      dimensionOverlaySvg: undefined,
      normalizedRooms: undefined,
      normalizedOpenings: undefined,
      floorplanPropertyId: undefined,
      floorplanModel: undefined,
      floorplanQuality: undefined,
      layoutVariant: undefined,
      analysisEngine: undefined,
      normalizing: true,
      normalizationStartedAt: Date.now(),
      normalizationPipelineVersion: FLOORPLAN_PIPELINE_VERSION,
      normalizationWarning: undefined,
    });
    try {
      // 서버가 네이버 원본 다운로드·영구 저장·정규화를 한 요청에서 처리한다.
      // 중간 캐시 요청을 없애 브라우저가 단계 사이에서 멈추는 문제를 방지한다.
      const current = valueRef.current;
      const aptName = current.selectedAddress?.buildingName || "";
      const address =
        current.selectedAddress?.roadAddress ||
        current.selectedAddress?.jibunAddress ||
        aptName;
      const { response: res, data } = await fetchFloorplanJson<NormalizeFloorplanResponse>(
        "/api/inpick/normalize-floorplan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(sourceUrl ? { imageUrl: sourceUrl } : {}),
            exclusiveAreaM2: p.exclusiveArea,
            roomCount: p.roomCnt,
            bathroomCount: p.bathroomCnt,
            unitName: aptName,
            address,
            aptName,
            // 도면이 있으면 형식을 재생성하지 않고 워터마크만 최소 정리한다.
            // 도면이 없으면 평형 통계 평균값으로 실별 치수를 산출한다.
            // 실제 도면이 있으면 평균 평형으로 대체하지 않고 구조 분석을 수행한다.
            // 원본은 그대로 Storage에 보존하고 이미지 재생성(clean edit)은 생략한다.
            skipImageClean: true,
            processingMode: sourceUrl ? "structure_only" : "area_average",
            expansion: expansion === "extended",
            layoutVariant: expansion,
          }),
          signal: normalizeController.signal,
        },
        { timeoutMs: FLOORPLAN_CLIENT_TIMEOUT_MS },
      );
      if (res.ok && data.rooms?.length) {
        if (data.layoutVariant !== expansion) {
          finishWithError("선택한 시공 형태와 도면이 일치하지 않습니다. 다시 시도해주세요.");
          return;
        }
        if (!isCurrentSelection()) return;
        onChange({
          ...valueRef.current,
          selectedPyeong: p,
          expansionType: expansion,
          floorplanPropertyId: data.cleanedImageUrl ? data.property_id : undefined,
          cleanedImageUrl: data.cleanedImageUrl,
          normalizedImageUrl: data.normalizedImageUrl || data.cleanedImageUrl,
          dimensionOverlaySvg: data.dimensionOverlaySvg,
          totalWidthMm: data.totalWidthMm,
          totalDepthMm: data.totalDepthMm,
          normalizedRooms: data.rooms,
          normalizedOpenings: data.openings,
          normalizedNotes: data.notes,
          normalizedPyeong: data.pyeong,
          floorplanModel: data.cleanModel,
          floorplanQuality:
            data.cleanQuality === "high" || data.cleanQuality === "medium"
              ? data.cleanQuality
              : undefined,
          layoutVariant: data.layoutVariant || expansion,
          analysisEngine: data.analysisEngine,
          normalizing: false,
          normalizationStartedAt: undefined,
          normalizationWarning: undefined,
        });
      } else {
        console.warn("[floorplan-normalize] unavailable:", data.error || res.status);
        finishWithError("공간 정보를 정밀 분석하지 못했습니다.");
      }
    } catch (e) {
      console.error("normalize fail", e);
      if (
        e instanceof DOMException &&
        e.name === "AbortError" &&
        activeNormalizeControllerRef.current !== normalizeController
      ) {
        return;
      }
      finishWithError(
        e instanceof FloorplanRequestError && e.code === "timeout"
          ? "공간 정보 분석 시간이 초과되었습니다."
          : "공간 정보를 정밀 분석하지 못했습니다.",
      );
    } finally {
      if (activeNormalizeControllerRef.current === normalizeController) {
        activeNormalizeControllerRef.current = null;
      }
      if (activeNormalizeKeyRef.current === normalizeKey) {
        activeNormalizeKeyRef.current = null;
      }
    }
  };

  // useEffect가 평형+expansion 둘 다 결정될 때 자동 trigger하므로 최신 함수를 ref에 저장
  runNormalizeRef.current = runNormalize;

  const retryNormalize = () => {
    const pyeong = valueRef.current.selectedPyeong;
    const expansion = valueRef.current.expansionType;
    if (!pyeong || !expansion) return;
    const normalizeKey = `${pyeong.pyeongNo}:${pyeong.grandPlanUrl || "area-average"}:${pyeong.exclusiveArea}:${expansion}`;
    attemptedNormalizeKeysRef.current.delete(normalizeKey);
    if (activeNormalizeKeyRef.current === normalizeKey) activeNormalizeKeyRef.current = null;
    void runNormalizeRef.current?.(pyeong, expansion);
  };

  /**
   * 평형 클릭 → 저장만. useEffect가 expansion까지 셋되면 자동 호출.
   * 새 흐름: 주소 → 평형 → 기본/확장 클릭 → 도면 호출
   */
  const handleSelectPyeong = async (p: {
    pyeongNo: number;
    pyeongName: string;
    exclusiveArea: number;
    grandPlanUrl?: string;
    roomCnt?: number;
    bathroomCnt?: number;
  }) => {
    onChange({
      ...value,
      selectedPyeong: p,
      expansionType: null,
      cleanedImageUrl: undefined,
      normalizedImageUrl: undefined,
      floorplanPropertyId: undefined,
      dimensionOverlaySvg: undefined,
      totalWidthMm: undefined,
      totalDepthMm: undefined,
      normalizedRooms: undefined,
      normalizedOpenings: undefined,
      normalizedNotes: undefined,
      normalizedPyeong: undefined,
      floorplanModel: undefined,
      floorplanQuality: undefined,
      layoutVariant: undefined,
      analysisEngine: undefined,
      normalizing: false,
      normalizationStartedAt: undefined,
      normalizationWarning: undefined,
    });
    // expansion 이미 셋된 상태에서 평형 클릭 → useEffect가 자동 호출
  };

  const handleManualPyeong = () => {
    const pyeong = Number(manualPyeong);
    if (!Number.isFinite(pyeong) || pyeong < 5 || pyeong > 200) return;
    // 사용자가 말하는 아파트 "평형"은 통상 공급면적 기준이다.
    // 전용률 76% 평균으로 전용면적을 추정하고 이후 실별 평균값 산정에 사용한다.
    const exclusiveArea = Math.round(pyeong * 3.3058 * 0.76 * 10) / 10;
    void handleSelectPyeong({
      pyeongNo: -Math.round(pyeong * 10),
      pyeongName: `${pyeong}평`,
      exclusiveArea,
    });
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-black/30" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="아파트 단지명 또는 도로명 주소 (예: 대전, 잠실)"
          className="h-[48px] w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm font-medium tracking-tight text-black outline-none placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)]"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-4 h-4 w-4 animate-spin text-primary-500" />
        )}
      </div>

      {/* 검색 결과 우선 */}
      {results.length > 0 && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-primary-100 bg-white">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelectAddress(r)}
              className="w-full text-left px-4 py-2 hover:bg-primary-50 transition-colors border-b border-primary-50 last:border-0"
            >
              <div className="text-sm font-medium text-primary-900">
                {r.buildingName || r.roadAddress}
              </div>
              <div className="text-xs text-primary-900/60">{r.roadAddress}</div>
            </button>
          ))}
        </div>
      )}

      {/* 최근 검색 (focus + 검색결과 없음 + keyword 비어있음) */}
      {focused && results.length === 0 && keyword.trim().length < 2 && recent.length > 0 && (
        <div className="mt-2 rounded-xl border border-primary-100 bg-white overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between border-b border-primary-50 bg-primary-50/30">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/50">
              최근 검색
            </span>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (typeof window !== "undefined") {
                  localStorage.removeItem(RECENT_KEY);
                  setRecent([]);
                }
              }}
              className="text-[0.65rem] text-primary-900/40 hover:text-primary-700"
            >
              모두 지우기
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {recent.map((r, i) => (
              <div
                key={i}
                className="group relative flex items-center border-b border-primary-50 last:border-0 hover:bg-primary-50/50"
              >
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelectAddress(r);
                  }}
                  className="flex-1 text-left px-4 py-2 transition-colors"
                >
                  <div className="text-sm font-medium text-primary-900">
                    {r.buildingName || r.roadAddress}
                  </div>
                  <div className="text-xs text-primary-900/60">{r.roadAddress}</div>
                </button>
                <button
                  onMouseDown={(e) => handleRemoveRecent(r.roadAddress, e)}
                  className="opacity-0 group-hover:opacity-100 text-primary-900/40 hover:text-primary-700 px-3 text-sm"
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {value.selectedAddress && (
        <div className="mt-3 rounded-xl border border-black/[0.07] bg-white p-3">
          <div className="text-sm font-semibold text-black">
            {value.selectedAddress.buildingName || "선택된 주소"}
          </div>
          <div className="mt-0.5 text-xs text-black/45">
            {value.selectedAddress.roadAddress}
          </div>
        </div>
      )}

      {loadingBuilding && (
        <div className="mt-3 flex items-center justify-center py-4 text-sm text-primary-900/60">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          단지·평면도 정보 조회 중...
        </div>
      )}
      {pyeongList.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-primary-900/70 mb-2">평형 선택</div>
          <div className="grid grid-cols-2 gap-2">
            {(showAllPyeong ? pyeongList : pyeongList.slice(0, 4)).map((p) => {
              const sel = value.selectedPyeong?.pyeongNo === p.pyeongNo;
              return (
                <button
                  key={p.pyeongNo}
                  onClick={() => handleSelectPyeong(p)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    sel
                      ? "border-black bg-black text-white"
                      : "border-black/[0.08] bg-white hover:bg-black/[0.035]"
                  }`}
                >
                  <div className={`text-sm font-bold ${sel ? "text-white" : "text-black"}`}>
                    {p.pyeongName} ({p.exclusiveArea}m²)
                  </div>
                  <div className={`mt-0.5 text-xs ${sel ? "text-white/65" : "text-black/45"}`}>
                    {p.roomCnt ? `${p.roomCnt}룸` : ""}
                    {p.grandPlanUrl ? " · 평면도 있음" : " · 평면도 없음"}
                  </div>
                </button>
              );
            })}
          </div>
          {pyeongList.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllPyeong((current) => !current)}
              aria-expanded={showAllPyeong}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-black/[0.08] bg-white text-xs font-semibold text-black transition hover:bg-black/[0.035]"
            >
              {showAllPyeong
                ? "평형 접기"
                : `평형 더보기 (${pyeongList.length - 4}개)`}
            </button>
          )}
        </div>
      )}

      {value.selectedAddress && buildingLookupDone && pyeongList.length === 0 && (
        <div className="mt-3 rounded-xl border border-black/[0.08] bg-white p-3">
          <p className="text-xs font-semibold text-black/70">평형 정보를 찾지 못했습니다</p>
          <p className="mt-1 text-[11px] leading-4 text-black/42">
            공급 평형을 직접 입력하면 실별 평균 면적을 백그라운드에서 계산합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="number"
                min={5}
                max={200}
                step={0.1}
                value={manualPyeong}
                onChange={(event) => setManualPyeong(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleManualPyeong();
                  }
                }}
                placeholder="예: 34"
                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 pr-9 text-sm font-semibold text-black outline-none focus:border-black/30"
              />
              <span className="pointer-events-none absolute right-3 top-3 text-xs text-black/38">평</span>
            </div>
            <button
              type="button"
              onClick={handleManualPyeong}
              disabled={!manualPyeong || Number(manualPyeong) < 5 || Number(manualPyeong) > 200}
              className="rounded-xl bg-black px-4 text-xs font-semibold text-white transition disabled:bg-black/20"
            >
              적용
            </button>
          </div>
        </div>
      )}

      {value.selectedPyeong && (
        <ConstructionTypeSelector value={value} onChange={onChange} />
      )}

      {value.selectedPyeong && value.expansionType && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white px-4 py-3">
          {value.normalizing ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black/55" />
          ) : (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
              ✓
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-black/70">
              {value.normalizing ? "공간 정보를 분석하고 있습니다" : "공간 정보가 준비되었습니다"}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-black/40">
              {value.normalizationWarning
                ? "분석은 보류하고 선택한 평형 평균값으로 디자인과 가견적을 진행합니다."
                : value.selectedPyeong.grandPlanUrl
                  ? "원본 형식은 유지하고 워터마크만 정리하며, 실별 면적은 평형 평균값으로 계산합니다."
                  : "선택한 평형의 실별 평균 면적을 계산하며 다음 단계는 바로 진행할 수 있습니다."}
            </p>
          </div>
          {value.normalizationWarning && (
            <button
              type="button"
              onClick={retryNormalize}
              className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-black/60 transition hover:text-black"
            >
              다시 분석
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mode 2: 도면 업로드 ───
function UploadMode({ value, onChange }: Props) {
  const [isHand, setIsHand] = useState(value.uploadedFloorplan?.isHandDrawn ?? false);

  async function resizeImage(file: File, maxSide = 1280, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (Math.max(width, height) > maxSide) {
            if (width >= height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await resizeImage(f, 1280, 0.85);
      onChange({
        ...value,
        mode: "upload",
        uploadedFloorplan: { dataUrl, filename: f.name, isHandDrawn: isHand },
      });
    } catch (err) {
      console.error("resize fail", err);
    }
  };

  return (
    <div>
      <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-white transition hover:bg-black/[0.025]">
        <FileImage className="h-8 w-8 text-primary-400 mb-2" />
        <span className="text-sm font-semibold text-black">평면도 이미지 업로드</span>
        <span className="mt-1 text-xs text-black/42">JPG·PNG·HEIC (손도면 OK)</span>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-black/62">
        <input
          type="checkbox"
          checked={isHand}
          onChange={(e) => {
            setIsHand(e.target.checked);
            if (value.uploadedFloorplan) {
              onChange({
                ...value,
                uploadedFloorplan: { ...value.uploadedFloorplan, isHandDrawn: e.target.checked },
              });
            }
          }}
          className="rounded"
        />
        <span>손그림 도면입니다 (AI 가 자동 정형화)</span>
      </label>

      {value.uploadedFloorplan && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-primary-900/70 mb-2">
            업로드 미리보기
            {value.uploadedFloorplan.isHandDrawn && (
              <span className="ml-2 text-amber-600">손도면 — 정형화 적용</span>
            )}
          </div>
          <img
            src={value.uploadedFloorplan.dataUrl}
            alt="업로드한 평면도"
            className="w-full rounded-xl border border-primary-100 bg-white"
          />
          <p className="mt-2 text-xs text-primary-900/50">
            다음 단계에서 AI 가 평면도 인식·정형화·실별 치수 추출을 수행합니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Mode 3: LIDAR 스캔 — 외부 앱(RoomPlan/PolyCam) 결과 파일 업로드 ───
function LidarMode({ value, onChange }: Props) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [bbox, setBbox] = useState<{ width: number; depth: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setProcessing(true);
    setProgress(0);
    setBbox(null);
    try {
      // 클라 측 lazy import — Three.js 번들 크기 (Step1 진입 전엔 로드 X)
      const mod = await import("@/lib/inpick/lidar-to-floorplan");
      const result = await mod.lidarFileToFloorplan(file, {
        size: 1024,
        onProgress: (_stage, percent) => setProgress(percent),
      });
      setBbox(result.bboxMm);
      onChange({
        ...value,
        lidarScan: { dataUrl: result.dataUrl },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const accept = ".usdz,.obj,.glb,.gltf,.ply";

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="hidden"
      />

      {/* 안내 */}
      <div className="rounded-xl border border-primary-200 bg-primary-50/30 p-3 text-xs leading-relaxed text-primary-900/80">
        <p className="font-semibold text-primary-900 mb-1.5 inline-flex items-center gap-1.5">
          <ScanLine className="h-3.5 w-3.5" />
          LIDAR 스캔 파일 업로드
        </p>
        <ol className="list-decimal list-inside space-y-1 text-primary-900/70">
          <li>iPhone Pro / iPad Pro의 <b>RoomPlan</b>(iOS 16+ 기본 앱) 또는 <b>PolyCam</b> · <b>Scaniverse</b>로 방 스캔</li>
          <li>스캔 완료 → Export → <b>USDZ</b> · OBJ · GLB · PLY 형식 저장</li>
          <li>파일을 PC로 옮기거나 모바일에서 직접 업로드</li>
        </ol>
      </div>

      {/* 업로드 버튼 */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={processing}
        className="w-full flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-primary-300 bg-white hover:bg-primary-50/40 transition-colors disabled:opacity-60"
      >
        {processing ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary-500 mb-2" />
            <span className="text-sm font-semibold text-primary-900">처리 중… {progress}%</span>
            <span className="text-xs text-primary-900/60 mt-1">평면도 변환 중 (3D mesh → top-down)</span>
          </>
        ) : value.lidarScan ? (
          <>
            <Camera className="h-6 w-6 text-emerald-500 mb-1.5" />
            <span className="text-sm font-semibold text-emerald-700">변환 완료 · 다른 파일 선택</span>
          </>
        ) : (
          <>
            <Camera className="h-7 w-7 text-primary-400 mb-1.5" />
            <span className="text-sm font-semibold text-primary-900">LIDAR 파일 선택</span>
            <span className="text-xs text-primary-900/60 mt-1">USDZ · OBJ · GLB · PLY</span>
          </>
        )}
      </button>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* 변환 결과 미리보기 */}
      {value.lidarScan && !processing && (
        <div className="rounded-xl border border-primary-200 bg-white overflow-hidden">
          <img
            src={value.lidarScan.dataUrl}
            alt="LIDAR top-down 평면도"
            className="w-full"
          />
          {bbox && (
            <div className="px-3 py-2 border-t border-primary-100 text-[0.7rem] text-primary-900/70 tabular flex items-center justify-between flex-wrap gap-1">
              <span>
                추정 크기 · <strong>{(bbox.width / 1000).toFixed(2)}m</strong> ×{" "}
                <strong>{(bbox.depth / 1000).toFixed(2)}m</strong> × 천장{" "}
                <strong>{(bbox.height / 1000).toFixed(2)}m</strong>
              </span>
              <span className="text-emerald-600 font-bold">✓ 자동 평면도 생성됨</span>
            </div>
          )}
        </div>
      )}

      <p className="text-[0.7rem] text-primary-900/50 leading-relaxed">
        업로드한 3D 데이터를 위에서 본 평면도(top-down)로 변환합니다. 다음 단계에서 AI가 실별 치수와 벽·창 위치를 자동 추출합니다.
      </p>
    </div>
  );
}
