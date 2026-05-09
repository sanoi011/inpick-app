/* eslint-disable @next/next/no-img-element */
/**
 * 기본정보 입력 카드 — 3 옵션 (주소·도면·LIDAR) + 예산·기본/확장형 통합.
 *
 * 옵션 1: 주소 검색 → JUSO 자동완성 + 네이버 평면도 자동 호출
 * 옵션 2: 도면 직접 업로드 (이미지·손도면) — 우리가 정형화
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

type InputMode = "address" | "upload" | "lidar";

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
  normalizedRooms?: Array<{
    name: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
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

export default function BasicInfoCard({ value, onChange }: Props) {
  const mode = value.mode || "address";
  const setMode = (m: InputMode) => onChange({ ...value, mode: m });

  const inputDone =
    (mode === "address" && !!value.selectedPyeong?.grandPlanUrl) ||
    (mode === "upload" && !!value.uploadedFloorplan?.dataUrl) ||
    (mode === "lidar" && !!value.lidarScan?.dataUrl);
  const budgetDone = value.budget > 0;
  const isComplete = inputDone && budgetDone;

  return (
    <div className="rounded-2xl border border-primary-100 bg-white/95 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-primary-500" />
        <h3 className="text-base font-bold tracking-tight text-primary-900">기본정보 입력</h3>
        {isComplete && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
          >
            ✓ 완료
          </motion.span>
        )}
      </div>

      {/* 탭: 3 옵션 */}
      <div className="grid grid-cols-3 gap-2 mb-4 p-1 bg-primary-50/50 rounded-xl">
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

      {/* ── 시공 형태 (기본형/확장형) — 예산은 견적 단계에서 자동 산출 ── */}
      <div className="mt-5 pt-5 border-t border-primary-100">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-primary-500" />
          <span className="text-sm font-bold tracking-tight text-primary-900">시공 형태</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { v: "basic", label: "기본형", desc: "발코니 미확장" },
            { v: "extended", label: "확장형", desc: "발코니 확장 시공" },
          ].map((r) => {
            const sel = value.expansionType === r.v;
            return (
              <button
                key={r.v}
                onClick={() =>
                  onChange({ ...value, expansionType: r.v as "basic" | "extended" })
                }
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                <div className="text-sm font-bold tracking-tight">{r.label}</div>
                <div className={`mt-0.5 text-[0.7rem] ${sel ? "text-white/85" : "text-primary-900/50"}`}>
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-primary-900/50 leading-relaxed">
        세 가지 입력 방법 중 하나만 선택해도 다음 단계로 진행 가능합니다.
        AI 가 자동으로 평면도를 정형화하고 실별 치수를 추출합니다.
        견적 금액은 자재 선택 후 한국물가협회 단가 + 표준품셈으로 자동 산출됩니다.
      </p>
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
          ? "bg-white text-primary-900 shadow-sm"
          : "text-primary-900/50 hover:text-primary-900/80"
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
    }>
  >([]);
  const [loadingBuilding, setLoadingBuilding] = useState(false);

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
      onChange({ ...value, mode: "address", selectedAddress: addr });
      setKeyword(addr.roadAddress);
      setResults([]);
      setFocused(false);
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
      }
    },
    [onChange, value]
  );

  const handleRemoveRecent = (roadAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(roadAddress);
    setRecent(loadRecent());
  };

  const handleSelectPyeong = async (p: {
    pyeongNo: number;
    pyeongName: string;
    exclusiveArea: number;
    grandPlanUrl?: string;
    roomCnt?: number;
  }) => {
    onChange({
      ...value,
      selectedPyeong: p,
      cleanedImageUrl: undefined,
      dimensionOverlaySvg: undefined,
      normalizing: !!p.grandPlanUrl,
    });
    if (!p.grandPlanUrl) return;
    try {
      // STEP 1: 네이버 CDN URL → Supabase Storage 캐시 (재사용 + edits API용 안정 URL 확보)
      let stableUrl = p.grandPlanUrl;
      try {
        const cacheRes = await fetch("/api/inpick/floorplan-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: p.grandPlanUrl }),
        });
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json();
          if (cacheData.url) {
            stableUrl = cacheData.url;
            // selectedPyeong.grandPlanUrl을 Supabase URL로 교체 (이후 흐름 모두 안정 URL 사용)
            p = { ...p, grandPlanUrl: stableUrl };
          }
        }
      } catch (e) {
        console.warn("[floorplan-cache] failed (계속 네이버 URL 사용):", e);
      }

      // STEP 2: 평면도 정형화 (Vision 치수 추출 + 영구 저장 — 가이드 §1)
      const aptName = value.selectedAddress?.buildingName || "";
      const address = value.selectedAddress?.roadAddress
        || value.selectedAddress?.jibunAddress
        || aptName;
      const res = await fetch("/api/inpick/normalize-floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: stableUrl,
          exclusiveAreaM2: p.exclusiveArea,
          unitName: aptName,
          address,
          aptName,
          skipImageClean: false,
          expansion: value.expansionType === "extended",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onChange({
          ...value,
          selectedPyeong: p,
          // 가이드 §3 — propertyId를 step1에 보관 → Step2에서 render-room 호출 시 사용
          floorplanPropertyId: data.property_id,
          cleanedImageUrl: data.cleanedImageUrl,
          normalizedImageUrl: data.normalizedImageUrl,
          dimensionOverlaySvg: data.dimensionOverlaySvg,
          totalWidthMm: data.totalWidthMm,
          totalDepthMm: data.totalDepthMm,
          normalizedRooms: data.rooms,
          normalizedOpenings: data.openings,
          normalizedNotes: data.notes,
          normalizedPyeong: data.pyeong,
          normalizing: false,
        });
      } else {
        onChange({ ...value, selectedPyeong: p, normalizing: false });
      }
    } catch (e) {
      console.error("normalize fail", e);
      onChange({ ...value, selectedPyeong: p, normalizing: false });
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-primary-900/40" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="아파트 단지명 또는 도로명 주소 (예: 대전, 잠실)"
          className="w-full rounded-xl border border-primary-100 bg-white pl-10 pr-4 py-3 text-sm font-medium tracking-tight text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 text-primary-500 animate-spin" />
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
        <div className="mt-3 p-3 rounded-xl bg-primary-50/50 border border-primary-100">
          <div className="text-sm font-semibold text-primary-900">
            {value.selectedAddress.buildingName || "선택된 주소"}
          </div>
          <div className="text-xs text-primary-900/60 mt-0.5">
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
            {pyeongList.map((p) => {
              const sel = value.selectedPyeong?.pyeongNo === p.pyeongNo;
              return (
                <button
                  key={p.pyeongNo}
                  onClick={() => handleSelectPyeong(p)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    sel
                      ? "border-primary-500 bg-primary-50 shadow-sm"
                      : "border-primary-100 bg-white hover:border-primary-300"
                  }`}
                >
                  <div className="text-sm font-bold text-primary-900">
                    {p.pyeongName} ({p.exclusiveArea}m²)
                  </div>
                  <div className="text-xs text-primary-900/60 mt-0.5">
                    {p.roomCnt ? `${p.roomCnt}룸` : ""}
                    {p.grandPlanUrl ? " · 평면도 있음" : " · 평면도 없음"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.selectedPyeong?.grandPlanUrl && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-primary-900/70 mb-2 flex items-center gap-2 flex-wrap">
            평면도 + AI 치수 추출
            {value.normalizing && (
              <span className="inline-flex items-center gap-1 text-primary-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI 도면 정리 중 (60~120초 — 워터마크 제거 + 매핑)
              </span>
            )}
            {value.dimensionOverlaySvg && !value.normalizing && (
              <span className="text-emerald-600 text-[0.65rem] font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                ✓ {value.normalizedRooms?.length ?? 0}개 실 치수
              </span>
            )}
            {!value.normalizing && value.selectedPyeong && !value.cleanedImageUrl && value.dimensionOverlaySvg && (
              <span className="text-amber-600 text-[0.65rem] font-bold bg-amber-50 px-1.5 py-0.5 rounded-full">
                ⓘ 원본 도면 사용 (정리 스킵)
              </span>
            )}
          </div>
          <div className="relative w-full rounded-xl border border-primary-100 bg-white overflow-hidden">
            <img
              src={value.cleanedImageUrl || value.selectedPyeong.grandPlanUrl}
              alt="평면도"
              className="w-full"
            />
            {value.dimensionOverlaySvg && (
              <div
                className="absolute inset-0 pointer-events-none"
                dangerouslySetInnerHTML={{ __html: value.dimensionOverlaySvg }}
              />
            )}
            {value.normalizing && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500 mx-auto" />
                  <p className="mt-2 text-xs text-primary-900/70 font-semibold">치수 추출 중…</p>
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-primary-900/50">
            추출된 실별 mm 치수가 다음 단계 인테리어 렌더링의 기반 데이터로 사용됩니다.
          </p>
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
      <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/30 hover:bg-primary-50/50 cursor-pointer transition-colors">
        <FileImage className="h-8 w-8 text-primary-400 mb-2" />
        <span className="text-sm font-semibold text-primary-900">평면도 이미지 업로드</span>
        <span className="text-xs text-primary-900/60 mt-1">JPG·PNG·HEIC (손도면 OK)</span>
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-primary-900/80">
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
