/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Download,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
  ArrowUpDown,
  Sparkles,
  Home,
  Bed,
  ChefHat,
  Bath,
  DoorOpen,
  Wallet,
  Layers,
  ChevronDown,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import type { Step1Data } from "@/components/workflow/Step1Cards";
import type { Step2Data } from "@/components/workflow/Step2Designer";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
} from "@/lib/inpick/korean-apt-dimensions";

interface EstimateItem {
  surface: string;
  materialName: string;
  brand?: string;
  spec?: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPriceWon: number;
  subtotalWon: number;
  category: "main" | "aux" | "labor";
}

interface EstimateRoom {
  roomName: string;
  totalAreaM2: number;
  items: EstimateItem[];
  mainTotalWon: number;
  auxTotalWon: number;
  laborTotalWon: number;
  totalWon: number;
}

const ROOM_NAME_MAP: Record<string, string> = {
  living: "거실",
  master: "안방",
  kitchen: "주방",
  bath: "욕실1",
  bedroom: "침실1",
  entrance: "현관",
  balcony: "발코니",
  dress: "드레스룸",
};

const ROOM_ICONS: Record<string, typeof Home> = {
  living: Home,
  master: Bed,
  kitchen: ChefHat,
  bath: Bath,
  bedroom: Bed,
  entrance: DoorOpen,
  balcony: Layers,
  dress: Layers,
};

type FilterCategory = "all" | "main" | "aux" | "labor";
type SortBy = "default" | "price-desc" | "price-asc" | "name";

export default function EstimatePage() {
  const router = useRouter();

  const [step1, setStep1] = useState<Step1Data | null>(null);
  const [step2, setStep2] = useState<Step2Data | null>(null);
  const [estimates, setEstimates] = useState<EstimateRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vatIncl, setVatIncl] = useState(true);
  const [filterCat, setFilterCat] = useState<FilterCategory>("all");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [filterRoom, setFilterRoom] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // 사용자가 견적에서 제외한 항목 ID set (`${room}::${idx}` 형식)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const itemKey = (roomName: string, idx: number) => `${roomName}::${idx}`;
  const toggleExcluded = (roomName: string, idx: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      const k = itemKey(roomName, idx);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s1raw = sessionStorage.getItem("workflow_step1");
      const s2raw = sessionStorage.getItem("workflow_step2");
      if (!s1raw || !s2raw) {
        setError("워크플로 데이터가 없습니다. Step1부터 시작해주세요.");
        setLoading(false);
        return;
      }
      const parsedS1: Step1Data = JSON.parse(s1raw);
      const parsedS2: Step2Data = JSON.parse(s2raw);
      setStep1(parsedS1);
      setStep2(parsedS2);
      void runEstimate(parsedS1, parsedS2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 파싱 실패");
      setLoading(false);
    }
  }, []);

  async function runEstimate(s1: Step1Data, s2: Step2Data) {
    setLoading(true);
    setError(null);
    try {
      const normalizedRooms = s1.normalizedFloorplan?.rooms || [];
      const area = s1.basicInfo.selectedPyeong?.exclusiveArea;
      const pyeong = area ? classifyPyeong(area) : "30평";
      const standardDims = estimateRoomDimsFromPyeong(pyeong);

      // 1) 사용자가 선택한 방 결정
      let selectedRoomKeys: string[] = [];
      if (s1.rooms?.includes("all")) {
        selectedRoomKeys = Object.keys(ROOM_NAME_MAP);
      } else if (s1.rooms?.length) {
        selectedRoomKeys = s1.rooms.filter((r) => r in ROOM_NAME_MAP);
      }

      // 2) 이미지 있는 방만 견적 산정 (정밀성 — 이미지 없으면 견적 X)
      const requestRooms: Array<{
        roomName: string;
        dim: { widthMm: number; depthMm: number; heightMm: number };
        renderImageUrl: string;
      }> = [];

      for (const key of selectedRoomKeys) {
        const koreanName = ROOM_NAME_MAP[key];
        if (!koreanName) continue;

        const renders = s2.rendersByRoom?.[key] || [];
        if (renders.length === 0) continue; // 이미지 없으면 skip

        const idx = s2.selectedByRoom?.[key];
        const selectedRender = idx != null ? renders[idx] : renders[renders.length - 1];
        const imageUrl = selectedRender?.refinedUrl || selectedRender?.url;
        if (!imageUrl) continue;

        // 치수: 정형화 → 평형 표준 → 일반 표준
        let dim = normalizedRooms.find(
          (r) => r.name === koreanName || r.name.includes(koreanName.replace(/\d+$/, "")),
        );
        if (!dim) {
          const std = standardDims[koreanName] || standardDims[koreanName.replace(/\d+$/, "")];
          if (std) {
            dim = {
              name: koreanName,
              widthMm: std.widthMm,
              depthMm: std.depthMm,
              heightMm: std.heightMm,
              source: "standard",
            };
          }
        }
        if (!dim) {
          dim = {
            name: koreanName,
            widthMm: 3000,
            depthMm: 2800,
            heightMm: 2400,
            source: "standard",
          };
        }

        requestRooms.push({
          roomName: koreanName,
          dim: { widthMm: dim.widthMm, depthMm: dim.depthMm, heightMm: dim.heightMm },
          renderImageUrl: imageUrl,
        });
      }

      if (requestRooms.length === 0) {
        setError(
          "생성된 디자인 이미지가 없습니다. Step2에서 AI 디자인을 먼저 생성해주세요. (Vision 분석 기반 정밀 견적)",
        );
        setLoading(false);
        return;
      }

      const res = await fetch("/api/inpick/build-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: requestRooms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "견적 생성 실패");
      const list: EstimateRoom[] = data.estimates || [];
      if (list.length === 0) {
        setError("Vision 분석이 자재를 추출하지 못했습니다. 더 명확한 디자인 이미지로 재시도해주세요.");
      }
      setEstimates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filteredRooms = useMemo(() => {
    return estimates
      .filter((r) => !filterRoom || r.roomName === filterRoom)
      .map((r) => ({
        ...r,
        items: r.items
          .filter((item) => filterCat === "all" || item.category === filterCat)
          .sort((a, b) => {
            if (sortBy === "price-desc") return b.subtotalWon - a.subtotalWon;
            if (sortBy === "price-asc") return a.subtotalWon - b.subtotalWon;
            if (sortBy === "name") return a.materialName.localeCompare(b.materialName);
            return 0;
          }),
      }))
      .filter((r) => r.items.length > 0);
  }, [estimates, filterCat, sortBy, filterRoom]);

  // 제외 항목 빼고 합계 재계산
  const grandTotal = useMemo(() => {
    let main = 0, aux = 0, labor = 0;
    for (const room of estimates) {
      room.items.forEach((item, idx) => {
        if (excluded.has(itemKey(room.roomName, idx))) return;
        if (item.category === "main") main += item.subtotalWon;
        else if (item.category === "aux") aux += item.subtotalWon;
        else if (item.category === "labor") labor += item.subtotalWon;
      });
    }
    return { main, aux, labor, total: main + aux + labor };
  }, [estimates, excluded]);

  const excludedTotal = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const room of estimates) {
      room.items.forEach((item, idx) => {
        if (excluded.has(itemKey(room.roomName, idx))) {
          sum += item.subtotalWon;
          count++;
        }
      });
    }
    return { sum, count };
  }, [estimates, excluded]);

  const vat = Math.round(grandTotal.total * 0.1);
  const finalTotal = vatIncl ? grandTotal.total + vat : grandTotal.total;
  const inpickFee = Math.round(finalTotal * 0.05);
  const budgetMan = step1?.basicInfo.budget || 0;
  const budgetWon = budgetMan * 10000;
  const budgetDelta = finalTotal - budgetWon;

  const availableRoomKeys = step1?.rooms?.includes("all")
    ? Object.keys(ROOM_NAME_MAP)
    : step1?.rooms?.filter((r) => r in ROOM_NAME_MAP) || [];

  return (
    <LenisProvider>
      <main className="relative min-h-screen bg-[#FDF7F4] text-primary-900">
        <div className="flex min-h-screen">
          {/* 좌측 아이콘 사이드바 */}
          <aside className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-1 border-r border-primary-100 bg-white py-6">
            <button
              onClick={() => router.push("/workflow")}
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-cta hover:bg-primary-600"
              aria-label="홈"
            >
              <span className="font-extrabold text-sm">iP</span>
            </button>
            <button
              onClick={() => setFilterRoom(null)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                !filterRoom
                  ? "bg-primary-500 text-white"
                  : "text-primary-900/50 hover:bg-primary-50"
              }`}
              title="모든 방"
            >
              <Layers className="h-4 w-4" />
            </button>
            {availableRoomKeys.map((key) => {
              const Icon = ROOM_ICONS[key] || Home;
              const koreanName = ROOM_NAME_MAP[key];
              const sel = filterRoom === koreanName;
              return (
                <button
                  key={key}
                  onClick={() => setFilterRoom(sel ? null : koreanName)}
                  title={koreanName}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    sel ? "bg-primary-500 text-white" : "text-primary-900/50 hover:bg-primary-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={() => router.push("/account/tokens")}
              title="토큰"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary-900/50 hover:bg-primary-50"
            >
              <Wallet className="h-4 w-4" />
            </button>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 px-6 lg:px-10 pt-8 pb-4">
              <button
                onClick={() => router.push("/workflow/branch")}
                className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-100 bg-white text-primary-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => step1 && step2 && runEstimate(step1, step2)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  재산출
                </button>
                <button
                  onClick={() => router.push("/workflow/bidding")}
                  disabled={loading || estimates.length === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
                >
                  업체 매칭으로 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="px-6 lg:px-10">
              {/* 영어 1개만 — Invoice */}
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-primary-500">
                Invoice
              </p>
              <h1 className="mt-1 text-[2.4rem] lg:text-[3rem] font-extrabold tracking-tightest text-primary-900 leading-none">
                견적서
              </h1>
              <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-primary-100 bg-white px-4 py-2.5">
                <span className="text-sm font-semibold text-primary-900/70">
                  {step1?.basicInfo.selectedAddress?.buildingName || "선택한 공간"}
                </span>
                <span className="text-[2rem] font-extrabold tabular leading-none tracking-tight text-primary-900">
                  ₩ {finalTotal.toLocaleString()}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-primary-900/40" />
              </div>
              {step1 && (
                <div className="mt-3 flex flex-wrap gap-2 text-[0.78rem] text-primary-900/60">
                  {step1.basicInfo.selectedPyeong && (
                    <span className="rounded-full bg-white px-3 py-1 border border-primary-100">
                      {step1.basicInfo.selectedPyeong.pyeongName} · 전용 {step1.basicInfo.selectedPyeong.exclusiveArea}㎡
                    </span>
                  )}
                  {step1.basicInfo.expansionType && (
                    <span className="rounded-full bg-white px-3 py-1 border border-primary-100">
                      {step1.basicInfo.expansionType === "extended" ? "확장형" : "기본형"}
                    </span>
                  )}
                  <span className="rounded-full bg-primary-50 px-3 py-1 border border-primary-200 font-bold tabular text-primary-700">
                    목표 {budgetMan.toLocaleString()}만원
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-5 px-6 lg:px-10 py-8 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => {
                        setFilterOpen(!filterOpen);
                        setSortOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-[0.85rem] font-semibold text-primary-900 hover:bg-primary-50"
                    >
                      <Filter className="h-3.5 w-3.5 text-primary-500" />
                      필터
                      {filterCat !== "all" && (
                        <span className="ml-1 rounded-full bg-primary-500 px-1.5 py-0.5 text-[0.65rem] text-white">
                          {filterCat === "main" ? "주자재" : filterCat === "aux" ? "부자재" : "인건비"}
                        </span>
                      )}
                    </button>
                    {filterOpen && (
                      <div className="absolute z-10 mt-1.5 w-44 rounded-xl border border-primary-100 bg-white shadow-card-hover py-1">
                        {(["all", "main", "aux", "labor"] as FilterCategory[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setFilterCat(c);
                              setFilterOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2 text-[0.85rem] hover:bg-primary-50 ${
                              filterCat === c ? "text-primary-700 font-bold" : "text-primary-900/70"
                            }`}
                          >
                            {c === "all" ? "전체" : c === "main" ? "주자재" : c === "aux" ? "부자재 (10%)" : "인건비 (MOLIT)"}
                            {filterCat === c && <span className="text-primary-500">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setSortOpen(!sortOpen);
                        setFilterOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-[0.85rem] font-semibold text-primary-900 hover:bg-primary-50"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 text-primary-500" />
                      정렬
                      {sortBy !== "default" && (
                        <span className="ml-1 text-[0.65rem] text-primary-700">
                          {sortBy === "price-desc" ? "가격↓" : sortBy === "price-asc" ? "가격↑" : "이름"}
                        </span>
                      )}
                    </button>
                    {sortOpen && (
                      <div className="absolute z-10 mt-1.5 w-44 rounded-xl border border-primary-100 bg-white shadow-card-hover py-1">
                        {(
                          [
                            ["default", "기본"],
                            ["price-desc", "가격 높은순"],
                            ["price-asc", "가격 낮은순"],
                            ["name", "이름순"],
                          ] as Array<[SortBy, string]>
                        ).map(([v, label]) => (
                          <button
                            key={v}
                            onClick={() => {
                              setSortBy(v);
                              setSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2 text-[0.85rem] hover:bg-primary-50 ${
                              sortBy === v ? "text-primary-700 font-bold" : "text-primary-900/70"
                            }`}
                          >
                            {label}
                            {sortBy === v && <span className="text-primary-500">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1.5">
                    <span className="text-[0.78rem] font-semibold text-primary-900">VAT</span>
                    <button
                      onClick={() => setVatIncl((v) => !v)}
                      className={`relative h-4 w-7 rounded-full transition-colors ${
                        vatIncl ? "bg-primary-500" : "bg-neutral-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                          vatIncl ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  <span className="ml-auto text-[0.78rem] text-primary-900/40 tabular">
                    {filteredRooms.reduce((s, r) => s + r.items.length, 0)} 건
                  </span>
                </div>

                <div className="rounded-2xl border border-primary-100 bg-white shadow-card overflow-hidden">
                  {loading && (
                    <div className="px-7 py-16 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                      <p className="mt-3 text-sm font-semibold text-primary-900">
                        디자인에서 자재를 분석 중…
                      </p>
                      <p className="mt-1 text-xs text-primary-900/50">
                        실당 약 5–10초 · GPT-4o Vision 정밀 추출
                      </p>
                    </div>
                  )}

                  {error && !loading && (
                    <div className="px-7 py-12 text-center">
                      <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                      <p className="mt-3 text-base font-bold text-primary-900">
                        견적을 만들 수 없습니다
                      </p>
                      <p className="mt-2 text-sm text-primary-900/60 max-w-md mx-auto leading-relaxed">
                        {error}
                      </p>
                      <p className="mt-3 text-[0.78rem] text-primary-700 font-semibold">
                        InPick 견적의 정밀성은 AI 가 생성한 실내 이미지를 분석해서 나옵니다.
                      </p>
                      <div className="mt-5 flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push("/workflow")}
                          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white px-4 py-2 text-xs font-semibold text-primary-900 hover:bg-primary-50"
                        >
                          처음으로
                        </button>
                        <button
                          onClick={() => router.push("/workflow")}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-xs font-semibold text-white shadow-cta hover:bg-primary-600"
                        >
                          Step2로 돌아가서 디자인 생성하기 <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {!loading && !error && filteredRooms.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.85rem]">
                        <thead>
                          <tr className="border-b border-primary-100 text-left text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                            <th className="px-3 py-3 w-10 text-center">포함</th>
                            <th className="px-3 py-3 w-14">방</th>
                            <th className="px-3 py-3">자재 / 브랜드</th>
                            <th className="px-3 py-3">규격</th>
                            <th className="px-3 py-3 text-right">수량</th>
                            <th className="px-3 py-3 text-right">단가</th>
                            <th className="px-3 py-3 text-right pr-5">합계</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRooms.map((room) => (
                            <RoomRows
                              key={room.roomName}
                              room={room}
                              excluded={excluded}
                              onToggle={toggleExcluded}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {!loading && !error && estimates.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-primary-100 bg-white p-6 shadow-card">
                    {excludedTotal.count > 0 && (
                      <div className="mb-4 flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-2.5">
                        <span className="text-[0.78rem] text-zinc-700">
                          제외된 항목 <span className="font-bold tabular">{excludedTotal.count}건</span>
                        </span>
                        <span className="text-[0.78rem] tabular text-zinc-700">
                          ₩ <span className="line-through">{excludedTotal.sum.toLocaleString()}</span> 절감
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <SumCard label="주자재" value={grandTotal.main} />
                      <SumCard label="부자재 (10%)" value={grandTotal.aux} />
                      <SumCard label="인건비 (MOLIT)" value={grandTotal.labor} />
                    </div>
                    <div className="flex items-center justify-between border-t border-primary-100 pt-4">
                      <span className="text-[0.85rem] text-primary-900/60">
                        VAT 10% {vatIncl ? "(포함)" : "(별도)"}
                      </span>
                      <span className="tabular text-primary-900 font-semibold">
                        ₩ {vat.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-primary-900">총액</span>
                      <span className="text-[2rem] font-extrabold tabular leading-none tracking-tightest text-gradient-primary">
                        ₩ {finalTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[0.75rem] text-primary-900/50">
                      <span>InPick 수수료 5%</span>
                      <span className="tabular">₩ {inpickFee.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <aside className="lg:col-span-4">
                <div className="space-y-4 lg:sticky lg:top-6">
                  {!loading && !error && estimates.length > 0 && (
                    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                        예산 vs 견적
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-xl bg-primary-50 p-3">
                          <p className="text-[0.65rem] text-primary-900/60 font-semibold">
                            목표
                          </p>
                          <p className="mt-1 text-base font-extrabold tabular text-primary-900">
                            {budgetMan.toLocaleString()}만
                          </p>
                        </div>
                        <div
                          className={`rounded-xl p-3 ${
                            budgetDelta > 0 ? "bg-amber-50" : "bg-emerald-50"
                          }`}
                        >
                          <p
                            className={`text-[0.65rem] font-semibold ${
                              budgetDelta > 0 ? "text-amber-700/70" : "text-emerald-700/70"
                            }`}
                          >
                            {budgetDelta > 0 ? "초과" : "여유"}
                          </p>
                          <p
                            className={`mt-1 text-base font-extrabold tabular ${
                              budgetDelta > 0 ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {budgetDelta > 0 ? "+" : ""}
                            {Math.round(budgetDelta / 10000).toLocaleString()}만
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-primary-50 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            budgetDelta > 0
                              ? "bg-gradient-to-r from-amber-300 to-amber-500"
                              : "bg-gradient-to-r from-emerald-300 to-primary-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (finalTotal / Math.max(budgetWon, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {step2 && Object.keys(step2.rendersByRoom || {}).length > 0 && (
                    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40 mb-3">
                        분석된 디자인
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {Object.entries(step2.rendersByRoom).map(([roomKey, items]) => {
                          const idx = step2.selectedByRoom?.[roomKey];
                          const sel = idx != null ? items[idx] : items[items.length - 1];
                          if (!sel) return null;
                          return (
                            <div
                              key={roomKey}
                              className="relative aspect-square rounded-lg overflow-hidden border border-primary-100"
                            >
                              <img
                                src={sel.refinedUrl || sel.url}
                                alt={roomKey}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[0.6rem] font-bold p-1 text-center">
                                {ROOM_NAME_MAP[roomKey] || roomKey}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                        출력 제한
                      </p>
                    </div>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-primary-900/60">
                      PDF·엑셀 다운로드는 계약 진행 단계에서 활성화됩니다.
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <LockedButton icon={Download} label="견적서 PDF" />
                      <LockedButton icon={FileSpreadsheet} label="상세 내역 엑셀" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                      <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                        산정 근거
                      </p>
                    </div>
                    <ul className="space-y-1 text-[0.75rem] text-primary-900/70 leading-relaxed">
                      <li>
                        · <b>주자재</b>: GPT-4o Vision이 생성된 디자인 이미지에서 자재를 직접 추출
                      </li>
                      <li>
                        · <b>부자재</b>: 주자재의 10% 일괄
                      </li>
                      <li>
                        · <b>인건비</b>: 국토부 표준품셈
                      </li>
                      <li>
                        · <b>치수</b>: 평면도 Vision + 평형 표준치수
                      </li>
                    </ul>
                    <p className="mt-2 text-[0.7rem] text-primary-700 font-semibold">
                      이미지 분석 기반 — 표준 견적 카탈로그가 아닌 실제 디자인 자재로 산출
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </LenisProvider>
  );
}

function RoomRows({
  room,
  excluded,
  onToggle,
}: {
  room: EstimateRoom;
  excluded: Set<string>;
  onToggle: (roomName: string, idx: number) => void;
}) {
  return (
    <>
      {room.items.map((item, i) => {
        const isExcluded = excluded.has(`${room.roomName}::${i}`);
        return (
          <motion.tr
            key={`${room.roomName}-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`border-b border-primary-50 last:border-0 transition-colors ${
              isExcluded ? "bg-zinc-50" : "hover:bg-primary-50/30"
            }`}
          >
            {/* 포함 체크박스 */}
            <td className="px-3 py-3 align-middle text-center">
              <button
                onClick={() => onToggle(room.roomName, i)}
                title={isExcluded ? "이 항목을 견적에 포함" : "이 항목을 견적에서 제외"}
                className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                  isExcluded
                    ? "border-zinc-300 bg-white hover:border-primary-300"
                    : "border-primary-500 bg-primary-500 text-white hover:bg-primary-600"
                }`}
              >
                {!isExcluded && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </td>
            {i === 0 ? (
              <td
                rowSpan={room.items.length}
                className="px-3 py-3 align-top border-r border-primary-50"
              >
                <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-500">
                  {room.roomName}
                </p>
                <p className="text-[0.65rem] text-primary-900/40 tabular mt-0.5">
                  {room.totalAreaM2}㎡
                </p>
              </td>
            ) : null}
            <td className="px-3 py-3 align-middle">
              <p
                className={`font-semibold tracking-tight ${
                  isExcluded
                    ? "line-through text-primary-900/40"
                    : item.category === "main"
                      ? "text-primary-900"
                      : item.category === "labor"
                        ? "text-amber-800"
                        : "text-primary-900/60"
                }`}
              >
                {item.materialName}
              </p>
              <p className="text-[0.65rem] mt-0.5 flex items-center gap-1.5 flex-wrap">
                {item.brand && (
                  <span className="inline-flex items-center rounded-full bg-primary-50 border border-primary-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary-700">
                    {item.brand}
                  </span>
                )}
                {item.sku && (
                  <span className="text-[0.6rem] text-primary-900/50 tabular font-mono">
                    {item.sku}
                  </span>
                )}
                <span className="text-primary-900/40">
                  {item.surface} ·{" "}
                  {item.category === "main"
                    ? "주자재"
                    : item.category === "aux"
                      ? "부자재 (10%)"
                      : "인건비"}
                </span>
              </p>
            </td>
            <td
              className={`px-3 py-3 align-middle text-[0.78rem] ${
                isExcluded ? "line-through text-primary-900/40" : "text-primary-900/70"
              }`}
            >
              {item.spec}
            </td>
            <td
              className={`px-3 py-3 align-middle text-right text-[0.82rem] tabular ${
                isExcluded ? "line-through text-primary-900/40" : "text-primary-900"
              }`}
            >
              {item.quantity}{" "}
              <span className="text-[0.7rem] text-primary-900/40">{item.unit}</span>
            </td>
            <td
              className={`px-3 py-3 align-middle text-right tabular ${
                isExcluded ? "line-through text-primary-900/40" : "text-primary-900/80"
              }`}
            >
              ₩ {item.unitPriceWon.toLocaleString()}
            </td>
            <td
              className={`px-3 py-3 pr-5 align-middle text-right tabular font-bold ${
                isExcluded ? "line-through text-primary-900/40" : "text-primary-900"
              }`}
            >
              ₩ {item.subtotalWon.toLocaleString()}
            </td>
          </motion.tr>
        );
      })}
    </>
  );
}

function SumCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-primary-50/50 p-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary-900/40">
        {label}
      </p>
      <p className="mt-1 text-base font-extrabold tabular text-primary-900">
        ₩ {value.toLocaleString()}
      </p>
    </div>
  );
}

function LockedButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      disabled
      className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-primary-200 bg-primary-50/40 px-3 py-2 text-[0.78rem] font-semibold text-primary-900/50"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <Lock className="h-3 w-3" />
    </button>
  );
}
