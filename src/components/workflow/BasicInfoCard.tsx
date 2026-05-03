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

import { useState, useEffect, useCallback } from "react";
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
}

const QUICK_BUDGETS = [1500, 3000, 5000];

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

      {/* ── 예산 / 기본형·확장형 ── */}
      <div className="mt-5 pt-5 border-t border-primary-100">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-primary-500" />
          <span className="text-sm font-bold tracking-tight text-primary-900">예산 & 시공 형태</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { v: "basic", label: "기본형" },
            { v: "extended", label: "확장형" },
          ].map((r) => {
            const sel = value.expansionType === r.v;
            return (
              <button
                key={r.v}
                onClick={() =>
                  onChange({ ...value, expansionType: r.v as "basic" | "extended" })
                }
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <p className="text-[2rem] font-extrabold tabular leading-none tracking-tightest">
          <span className="text-gradient-primary">{value.budget.toLocaleString()}</span>
          <span className="ml-1 text-sm font-bold text-primary-600">만원</span>
        </p>
        <input
          type="range"
          min={500}
          max={10000}
          step={100}
          value={value.budget}
          onChange={(e) => onChange({ ...value, budget: Number(e.target.value) })}
          className="mt-3 w-full accent-primary-500"
        />
        <div className="mt-1 flex items-center justify-between text-[0.7rem] tabular text-primary-900/40">
          <span>500</span>
          <span>10,000</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => onChange({ ...value, budget: b })}
              className={`rounded-full border px-3 py-1 text-[0.78rem] font-semibold tabular tracking-tight transition-all ${
                value.budget === b
                  ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                  : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
              }`}
            >
              {b.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-primary-900/50 leading-relaxed">
        세 가지 입력 방법 중 하나만 선택해도 다음 단계로 진행 가능합니다.
        AI 가 자동으로 평면도를 정형화하고 실별 치수를 추출합니다.
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
function AddressMode({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
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
      onChange({ ...value, mode: "address", selectedAddress: addr });
      setKeyword(addr.roadAddress);
      setResults([]);
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

  const handleSelectPyeong = (p: {
    pyeongNo: number;
    pyeongName: string;
    exclusiveArea: number;
    grandPlanUrl?: string;
    roomCnt?: number;
  }) => {
    onChange({ ...value, selectedPyeong: p });
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-primary-900/40" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="아파트 단지명 또는 도로명 주소 (예: 대전, 잠실)"
          className="w-full rounded-xl border border-primary-100 bg-white pl-10 pr-4 py-3 text-sm font-medium tracking-tight text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 text-primary-500 animate-spin" />
        )}
      </div>

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
          <div className="text-xs font-semibold text-primary-900/70 mb-2">평면도 미리보기 (네이버)</div>
          <img
            src={value.selectedPyeong.grandPlanUrl}
            alt="평면도"
            className="w-full rounded-xl border border-primary-100 bg-white"
          />
          <p className="mt-2 text-xs text-primary-900/50">
            다음 단계에서 AI 가 워터마크 제거·고화질화·실별 치수 추출을 자동 수행합니다.
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

// ─── Mode 3: LIDAR 스캔 ───
function LidarMode({ value, onChange: _ }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  if (!isMobile) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
          <ScanLine className="h-4 w-4" />
          모바일 전용 기능
        </div>
        <p className="mt-2 text-xs text-amber-900/80 leading-relaxed">
          LIDAR 스캔은 iPhone Pro / iPad Pro 또는 LIDAR 지원 안드로이드에서 가능합니다.
          모바일로 InPick 사이트 접속 후 동일 단계에서 이용해주세요.
        </p>
      </div>
    );
  }

  const handleScan = () => {
    alert("LIDAR 스캔 기능 베타 — 실제 스캔 SDK 연동 후 활성화. 우선 도면 업로드를 이용해주세요.");
  };

  return (
    <div>
      <button
        onClick={handleScan}
        className="w-full flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/30 hover:bg-primary-50/50 transition-colors"
      >
        <Camera className="h-8 w-8 text-primary-400 mb-2" />
        <span className="text-sm font-semibold text-primary-900">실내 LIDAR 스캔 시작</span>
        <span className="text-xs text-primary-900/60 mt-1">방마다 1분 — iPhone Pro / iPad Pro 권장</span>
      </button>

      {value.lidarScan && (
        <div className="mt-3">
          <img src={value.lidarScan.dataUrl} alt="LIDAR 스캔 결과" className="w-full rounded-xl border" />
        </div>
      )}

      <p className="mt-3 text-xs text-primary-900/50 leading-relaxed">
        스캔된 3D 데이터에서 실별 치수와 벽·창 위치를 자동 추출합니다.
        <span className="block mt-1 font-medium text-amber-700">베타 버전 — 곧 출시</span>
      </p>
    </div>
  );
}
