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

interface EstimateRoom {
  roomName: string;
  totalAreaM2: number;
  items: Array<{
    surface: string;
    materialName: string;
    spec?: string;
    quantity: number;
    unit: string;
    unitPriceWon: number;
    subtotalWon: number;
    category: "main" | "aux" | "labor";
  }>;
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

const ROOM_LABEL_EN: Record<string, string> = {
  거실: "Living Room",
  안방: "Master Bedroom",
  주방: "Kitchen",
  부엌: "Kitchen",
  욕실: "Bathroom",
  욕실1: "Bathroom",
  욕실2: "Bathroom 2",
  침실: "Bedroom",
  침실1: "Bedroom",
  침실2: "Bedroom 2",
  현관: "Entrance",
  발코니: "Balcony",
  드레스룸: "Dressing Room",
  다이닝: "Dining",
  서재: "Study",
};

const SURFACE_LABEL_EN: Record<string, string> = {
  바닥: "Floor",
  벽: "Wall",
  천장: "Ceiling",
  fixture: "Fixture",
  창호: "Window",
  도어: "Door",
};

const ROOM_KEY_EN: Record<string, string> = {
  living: "Living",
  master: "Master",
  kitchen: "Kitchen",
  bath: "Bath",
  bedroom: "Bedroom",
  entrance: "Entrance",
  balcony: "Balcony",
  dress: "Closet",
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s1raw = sessionStorage.getItem("workflow_step1");
      const s2raw = sessionStorage.getItem("workflow_step2");
      const parsedS1: Step1Data | null = s1raw ? JSON.parse(s1raw) : null;
      const parsedS2: Step2Data | null = s2raw ? JSON.parse(s2raw) : null;
      setStep1(parsedS1);
      setStep2(parsedS2);
      // sessionStorage 없어도 기본 데이터로 견적 생성 (테스트 가능)
      void runEstimate(parsedS1, parsedS2);
    } catch (e) {
      // 파싱 실패해도 기본 견적 생성
      void runEstimate(null, null);
      console.error(e);
    }
  }, []);

  async function runEstimate(s1: Step1Data | null, s2: Step2Data | null) {
    setLoading(true);
    setError(null);
    try {
      const normalizedRooms = s1?.normalizedFloorplan?.rooms || [];
      const area = s1?.basicInfo.selectedPyeong?.exclusiveArea;
      const pyeong = area ? classifyPyeong(area) : "30평";
      const standardDims = estimateRoomDimsFromPyeong(pyeong);

      const requestRooms: Array<{
        roomName: string;
        dim: { widthMm: number; depthMm: number; heightMm: number };
        renderImageUrl?: string;
      }> = [];

      let selectedRoomKeys: string[] = [];
      if (s1?.rooms?.includes("all")) {
        selectedRoomKeys = Object.keys(ROOM_NAME_MAP);
      } else if (s1?.rooms?.length) {
        selectedRoomKeys = s1.rooms.filter((r) => r in ROOM_NAME_MAP);
      }
      for (const k of Object.keys(s2?.rendersByRoom || {})) {
        if (!selectedRoomKeys.includes(k) && k in ROOM_NAME_MAP) {
          selectedRoomKeys.push(k);
        }
      }
      // Fallback: default 4 rooms (apartment standard)
      if (selectedRoomKeys.length === 0) {
        selectedRoomKeys = ["living", "master", "kitchen", "bath"];
      }

      for (const key of selectedRoomKeys) {
        const koreanName = ROOM_NAME_MAP[key];
        if (!koreanName) continue;
        let dim = normalizedRooms.find(
          (r) =>
            r.name === koreanName || r.name.includes(koreanName.replace(/\d+$/, "")),
        );
        if (!dim) {
          const std =
            standardDims[koreanName] || standardDims[koreanName.replace(/\d+$/, "")];
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
        const renders = s2?.rendersByRoom?.[key] || [];
        const idx = s2?.selectedByRoom?.[key];
        const selectedRender = idx != null ? renders[idx] : renders[renders.length - 1];
        requestRooms.push({
          roomName: koreanName,
          dim: { widthMm: dim.widthMm, depthMm: dim.depthMm, heightMm: dim.heightMm },
          renderImageUrl: selectedRender?.refinedUrl || selectedRender?.url,
        });
      }

      const res = await fetch("/api/inpick/build-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: requestRooms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estimate failed");
      setEstimates(data.estimates || []);
      if ((data.estimates || []).length === 0) {
        setError("No estimate generated. Please try again.");
      }
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

  const grandTotal = useMemo(
    () =>
      estimates.reduce(
        (acc, e) => ({
          main: acc.main + e.mainTotalWon,
          aux: acc.aux + e.auxTotalWon,
          labor: acc.labor + e.laborTotalWon,
          total: acc.total + e.totalWon,
        }),
        { main: 0, aux: 0, labor: 0, total: 0 },
      ),
    [estimates],
  );

  const vat = Math.round(grandTotal.total * 0.1);
  const finalTotal = vatIncl ? grandTotal.total + vat : grandTotal.total;
  const inpickFee = Math.round(finalTotal * 0.05);
  const budgetMan = step1?.basicInfo.budget || 0;
  const budgetWon = budgetMan * 10000;
  const budgetDelta = finalTotal - budgetWon;

  const availableRoomKeys =
    step1?.rooms?.includes("all")
      ? Object.keys(ROOM_NAME_MAP)
      : step1?.rooms?.filter((r) => r in ROOM_NAME_MAP) || [];

  return (
    <LenisProvider>
      <main className="relative min-h-screen bg-[#FDF7F4] text-primary-900">
        <div className="flex min-h-screen">
          {/* Left icon sidebar */}
          <aside className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-1 border-r border-primary-100 bg-white py-6">
            <button
              onClick={() => router.push("/workflow")}
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-cta hover:bg-primary-600"
              aria-label="Home"
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
              title="All rooms"
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
                  title={ROOM_LABEL_EN[koreanName] || koreanName}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    sel
                      ? "bg-primary-500 text-white"
                      : "text-primary-900/50 hover:bg-primary-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={() => router.push("/account/tokens")}
              title="Tokens"
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
                  onClick={() => runEstimate(step1, step2)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={() => router.push("/workflow/bidding")}
                  disabled={loading || estimates.length === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
                >
                  Bidding <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="px-6 lg:px-10">
              <h1 className="text-[2.4rem] lg:text-[3rem] font-extrabold tracking-tightest text-primary-900 leading-none">
                Estimate
              </h1>
              <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-primary-100 bg-white px-4 py-2.5">
                <span className="text-sm font-semibold text-primary-900/70">
                  {step1?.basicInfo.selectedAddress?.buildingName || "Selected space"}
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
                      {step1.basicInfo.selectedPyeong.pyeongName} · {step1.basicInfo.selectedPyeong.exclusiveArea}㎡
                    </span>
                  )}
                  {step1.basicInfo.expansionType && (
                    <span className="rounded-full bg-white px-3 py-1 border border-primary-100">
                      {step1.basicInfo.expansionType === "extended" ? "Extended" : "Standard"}
                    </span>
                  )}
                  <span className="rounded-full bg-primary-50 px-3 py-1 border border-primary-200 font-bold tabular text-primary-700">
                    Budget ₩ {budgetWon.toLocaleString()}
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
                      Filter
                      {filterCat !== "all" && (
                        <span className="ml-1 rounded-full bg-primary-500 px-1.5 py-0.5 text-[0.65rem] text-white">
                          {filterCat === "main" ? "Material" : filterCat === "aux" ? "Sub" : "Labor"}
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
                              filterCat === c
                                ? "text-primary-700 font-bold"
                                : "text-primary-900/70"
                            }`}
                          >
                            {c === "all" ? "All" : c === "main" ? "Material" : c === "aux" ? "Sub-material (10%)" : "Labor (MOLIT)"}
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
                      Sort
                      {sortBy !== "default" && (
                        <span className="ml-1 text-[0.65rem] text-primary-700">
                          {sortBy === "price-desc"
                            ? "Price ↓"
                            : sortBy === "price-asc"
                              ? "Price ↑"
                              : "Name"}
                        </span>
                      )}
                    </button>
                    {sortOpen && (
                      <div className="absolute z-10 mt-1.5 w-44 rounded-xl border border-primary-100 bg-white shadow-card-hover py-1">
                        {(
                          [
                            ["default", "Default"],
                            ["price-desc", "Price High → Low"],
                            ["price-asc", "Price Low → High"],
                            ["name", "Name A → Z"],
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
                    {filteredRooms.reduce((s, r) => s + r.items.length, 0)} items
                  </span>
                </div>

                <div className="rounded-2xl border border-primary-100 bg-white shadow-card overflow-hidden">
                  {loading && (
                    <div className="px-7 py-16 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                      <p className="mt-3 text-sm font-semibold text-primary-900">
                        Extracting materials from designs...
                      </p>
                      <p className="mt-1 text-xs text-primary-900/50">
                        ~5–10s per room · GPT-4o Vision
                      </p>
                    </div>
                  )}

                  {error && !loading && estimates.length === 0 && (
                    <div className="px-7 py-12 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                      <p className="mt-3 text-sm font-semibold text-amber-800">{error}</p>
                      <button
                        onClick={() => router.push("/workflow")}
                        className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Restart
                      </button>
                    </div>
                  )}

                  {!loading && filteredRooms.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.85rem]">
                        <thead>
                          <tr className="border-b border-primary-100 text-left text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                            <th className="px-5 py-3 w-16">Room</th>
                            <th className="px-3 py-3">Material</th>
                            <th className="px-3 py-3">Spec</th>
                            <th className="px-3 py-3 text-right">Qty</th>
                            <th className="px-3 py-3 text-right">Unit Price</th>
                            <th className="px-3 py-3 text-right pr-5">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRooms.map((room) => (
                            <RoomRows key={room.roomName} room={room} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {!loading && estimates.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-primary-100 bg-white p-6 shadow-card">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <SumCard label="Materials" value={grandTotal.main} />
                      <SumCard label="Sub (10%)" value={grandTotal.aux} />
                      <SumCard label="Labor (MOLIT)" value={grandTotal.labor} />
                    </div>
                    <div className="flex items-center justify-between border-t border-primary-100 pt-4">
                      <span className="text-[0.85rem] text-primary-900/60">
                        VAT 10% {vatIncl ? "(included)" : "(excluded)"}
                      </span>
                      <span className="tabular text-primary-900 font-semibold">
                        ₩ {vat.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-primary-900">Total</span>
                      <span className="text-[2rem] font-extrabold tabular leading-none tracking-tightest text-gradient-primary">
                        ₩ {finalTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[0.75rem] text-primary-900/50">
                      <span>InPick fee 5%</span>
                      <span className="tabular">₩ {inpickFee.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <aside className="lg:col-span-4">
                <div className="space-y-4 lg:sticky lg:top-6">
                  {!loading && estimates.length > 0 && (
                    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                        Budget vs Estimate
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-xl bg-primary-50 p-3">
                          <p className="text-[0.65rem] text-primary-900/60 font-semibold">
                            Target
                          </p>
                          <p className="mt-1 text-base font-extrabold tabular text-primary-900">
                            ₩{budgetWon.toLocaleString()}
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
                            {budgetDelta > 0 ? "Over" : "Under"}
                          </p>
                          <p
                            className={`mt-1 text-base font-extrabold tabular ${
                              budgetDelta > 0 ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {budgetDelta > 0 ? "+" : ""}
                            ₩{Math.abs(budgetDelta).toLocaleString()}
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
                        Applied Designs
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
                                {ROOM_KEY_EN[roomKey] || roomKey}
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
                        Export Locked
                      </p>
                    </div>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-primary-900/60">
                      PDF / Excel download is unlocked at the contract stage.
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <LockedButton icon={Download} label="Estimate PDF" />
                      <LockedButton icon={FileSpreadsheet} label="Detail Excel" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                      <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                        Methodology
                      </p>
                    </div>
                    <ul className="space-y-1 text-[0.75rem] text-primary-900/70 leading-relaxed">
                      <li>
                        · <b>Materials</b>: GPT-4o Vision extraction + Korean catalog price
                      </li>
                      <li>
                        · <b>Sub-materials</b>: 10% of main material (bulk)
                      </li>
                      <li>
                        · <b>Labor</b>: MOLIT 표준품셈 (Korea standard)
                      </li>
                      <li>
                        · <b>Dimensions</b>: Vision floorplan + standard pyeong fallback
                      </li>
                    </ul>
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

function RoomRows({ room }: { room: EstimateRoom }) {
  const roomEn = ROOM_LABEL_EN[room.roomName] || room.roomName;
  return (
    <>
      {room.items.map((item, i) => (
        <motion.tr
          key={`${room.roomName}-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-b border-primary-50 last:border-0 hover:bg-primary-50/30 transition-colors"
        >
          {i === 0 ? (
            <td
              rowSpan={room.items.length}
              className="px-5 py-3 align-top border-r border-primary-50"
            >
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-500">
                {roomEn}
              </p>
              <p className="text-[0.65rem] text-primary-900/40 tabular mt-0.5">
                {room.totalAreaM2}㎡
              </p>
            </td>
          ) : null}
          <td className="px-3 py-3 align-middle">
            <p
              className={`font-semibold tracking-tight ${
                item.category === "main"
                  ? "text-primary-900"
                  : item.category === "labor"
                    ? "text-amber-800"
                    : "text-primary-900/60"
              }`}
            >
              {item.materialName}
            </p>
            <p className="text-[0.65rem] text-primary-900/40 mt-0.5">
              {SURFACE_LABEL_EN[item.surface] || item.surface} ·{" "}
              {item.category === "main"
                ? "Main"
                : item.category === "aux"
                  ? "Sub (10%)"
                  : "Labor"}
            </p>
          </td>
          <td className="px-3 py-3 align-middle text-[0.78rem] text-primary-900/60">
            {item.spec}
          </td>
          <td className="px-3 py-3 align-middle text-right text-[0.82rem] tabular text-primary-900">
            {item.quantity}{" "}
            <span className="text-[0.7rem] text-primary-900/40">{item.unit}</span>
          </td>
          <td className="px-3 py-3 align-middle text-right tabular text-primary-900/80">
            ₩ {item.unitPriceWon.toLocaleString()}
          </td>
          <td className="px-3 py-3 pr-5 align-middle text-right tabular font-bold text-primary-900">
            ₩ {item.subtotalWon.toLocaleString()}
          </td>
        </motion.tr>
      ))}
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
