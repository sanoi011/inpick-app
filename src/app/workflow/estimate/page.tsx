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
  FileText,
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
  priceSource?: "korea_price_assoc" | "vision_estimate" | "standard" | "manual" | "molit";
}

/** 자재 단위 행 — main+aux+labor 병합 */
interface ConsolidatedRow {
  no: number;
  trade: string;        // 공정 (철거/목공/천장/바닥/벽/창호/주방/욕실/조명/잡철 등)
  roomName: string;
  materialName: string;
  brand?: string;
  spec?: string;
  sku?: string;
  unit: string;
  quantity: number;
  materialCost: number; // 재료비 (main + aux)
  laborCost: number;    // 노무비 (labor)
  expenseCost: number;  // 경비 (재료+노무 × rate)
  total: number;
  excludeKey: string;   // 체크박스 토글용
  // Phase 7 — vision-materials 매칭 메타 (있으면 배지 표시)
  matchStatus?: "confirmed" | "recommended" | "fallback";
  confidence?: number;
}

// 자재 surface + 이름 → 공정 분류
function inferTrade(surface: string, materialName: string): string {
  const s = surface.toLowerCase();
  const n = materialName.toLowerCase();
  if (n.includes("철거") || n.includes("폐기")) return "철거";
  if (s.includes("바닥") || s.includes("floor") || n.includes("마루") || n.includes("타일") && (n.includes("거실") || n.includes("바닥"))) return "바닥";
  if (s.includes("천장") || s.includes("ceil")) return "천장";
  if (s.includes("창호") || s.includes("window") || s.includes("도어") || s.includes("door") || n.includes("창호") || n.includes("문")) return "창호/문";
  if (n.includes("주방") || n.includes("싱크") || n.includes("kitchen") || n.includes("후드") || n.includes("인덕션")) return "주방";
  if (n.includes("욕실") || n.includes("변기") || n.includes("세면대") || n.includes("욕조") || n.includes("샤워")) return "욕실";
  if (n.includes("조명") || n.includes("led") || n.includes("펜던트")) return "전기";
  if (n.includes("도배") || n.includes("벽지")) return "도배";
  if (n.includes("도장") || n.includes("페인트")) return "도장";
  if (s.includes("벽") || s.includes("wall")) return "도배";
  if (n.includes("드레스") || n.includes("붙박이") || n.includes("팬트리")) return "잡철/하드웨어";
  return "공통";
}

const TRADE_ORDER = [
  "철거",
  "목공",
  "천장",
  "바닥",
  "도배",
  "도장",
  "타일",
  "창호/문",
  "주방",
  "욕실",
  "전기",
  "설비",
  "잡철/하드웨어",
  "청소",
  "공통",
];

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
  // Phase 7 — vision-materials matchMetaByRoom (있으면 행에 배지 표시)
  const [matchMetaByRoom, setMatchMetaByRoom] = useState<
    Record<
      string,
      Array<{
        matchStatus?: "confirmed" | "recommended" | "fallback";
        confidence?: number;
        surface?: string;
      }>
    >
  >({});
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
  // 경비 비율 (기본 3% — 사용자 조정 가능, 0~15% 범위)
  const [expenseRate, setExpenseRate] = useState(0.03);

  const itemKey = (roomName: string, idx: number) => `${roomName}::${idx}`;
  const toggleExcluded = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      // ─── 모드별 분기 (MD plan §10) ──────────────────────────────
      // photo_residential → photo_only 가견적 (면적×등급)
      // photo_commercial → commercial 가견적 (zone×업종×등급+설비)
      // apartment_drawing → 기존 17공종 자재 견적
      const area = s1.basicInfo.selectedPyeong?.exclusiveArea;

      if (s1.workflowEntry === "photo_residential") {
        const res = await fetch("/api/inpick/build-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectMode: "photo_only",
            areaM2: area || 50,
            budgetTier:
              s1.basicInfo.expansionType === "extended" ? "premium" : "standard",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.hint || "견적 생성 실패");
        // 가견적 결과를 estimates 형식으로 변환 (UI 호환)
        setEstimates([
          {
            roomName: `전체 (${data.pyung?.toFixed?.(1) ?? "?"}평) — ${data.disclaimerKo ?? ""}`,
            totalAreaM2: data.areaM2 ?? 0,
            items: [],
            mainTotalWon: data.breakdown?.directCostWon ?? 0,
            auxTotalWon: 0,
            laborTotalWon: 0,
            totalWon: data.grandTotalWon ?? 0,
          },
        ]);
        setLoading(false);
        return;
      }

      if (s1.workflowEntry === "photo_commercial") {
        // commercial은 ROOM_TABS의 zone들을 buildCommercialEstimate에 전달
        // 기본 비율 분배 (사용자가 ZoneEditor에서 수정 안 했으면)
        const totalAreaM2 = area || 100;
        // Step2의 rendersByRoom 키를 zone으로 사용
        const zonesFromRenders = Object.keys(s2.rendersByRoom || {}).filter(
          (k) => k !== "all",
        );
        const zoneInputs = (zonesFromRenders.length > 0
          ? zonesFromRenders
          : ["main_hall", "counter", "kitchen", "restroom"]
        ).map((zoneKey, i, arr) => ({
          id: zoneKey,
          nameKo: zoneKey,
          type: zoneKey,
          areaM2: totalAreaM2 / arr.length, // 균등 분배 (사용자 입력 없으면)
        }));
        const res = await fetch("/api/inpick/build-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectMode: "commercial",
            businessType: s1.commercialBusiness || "other_commercial",
            budgetTier:
              s1.basicInfo.expansionType === "extended" ? "premium" : "standard",
            zones: zoneInputs,
            requiredSystems: [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.hint || "견적 생성 실패");
        setEstimates([
          {
            roomName: `${data.businessType || "상가"} (${data.totalPyung?.toFixed?.(1) ?? "?"}평) — ${data.disclaimerKo ?? ""}`,
            totalAreaM2: data.totalAreaM2 ?? 0,
            items: [],
            mainTotalWon: data.breakdown?.zonesDirectCostWon ?? 0,
            auxTotalWon: data.breakdown?.systemSurchargeWon ?? 0,
            laborTotalWon: 0,
            totalWon: data.grandTotalWon ?? 0,
          },
        ]);
        setLoading(false);
        return;
      }

      // 아파트 도면 모드 (기존 흐름) ────────────────────────────────
      const normalizedRooms = s1.normalizedFloorplan?.rooms || [];
      const pyeong = area ? classifyPyeong(area) : "30평";
      const standardDims = estimateRoomDimsFromPyeong(pyeong);

      // 1) 사용자가 선택한 방 결정
      let selectedRoomKeys: string[] = [];
      if (s1.rooms?.includes("all")) {
        selectedRoomKeys = Object.keys(ROOM_NAME_MAP);
      } else if (s1.rooms?.length) {
        selectedRoomKeys = s1.rooms.filter((r) => r in ROOM_NAME_MAP);
      }

      // 2) 정책 변경 — 이미지 없는 방도 표준 자재로 견적 산정 (자재 컨택 선택사항)
      const requestRooms: Array<{
        roomName: string;
        dim: { widthMm: number; depthMm: number; heightMm: number };
        renderImageUrl?: string;
      }> = [];

      for (const key of selectedRoomKeys) {
        const koreanName = ROOM_NAME_MAP[key];
        if (!koreanName) continue;

        const renders = s2.rendersByRoom?.[key] || [];
        const idx = s2.selectedByRoom?.[key];
        const selectedRender =
          renders.length > 0 ? (idx != null ? renders[idx] : renders[renders.length - 1]) : null;
        const imageUrl = selectedRender?.refinedUrl || selectedRender?.url;
        // 이미지 있으면 vision 추출, 없으면 build-estimate에서 표준 자재 fallback

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
          // 이미지 있으면 전달 (vision 자재 추출), 없으면 omitted → 표준 자재 fallback
          ...(imageUrl ? { renderImageUrl: imageUrl } : {}),
        });
      }

      if (requestRooms.length === 0) {
        setError(
          "Step1에서 방을 선택해주세요. (선택한 방이 견적 산출 대상)",
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
      // 이제 빈 결과 거의 없음 — 표준 자재 fallback이 항상 동작
      // (이미지 있으면 vision 추출, 없으면 표준)
      if (data.fallbackRooms?.length > 0) {
        // 정보 로그 — 사용자에게 강제 안내는 안 함 (선택사항이라)
        console.info(
          "[estimate] 표준 자재 적용된 방:",
          data.fallbackRooms.map((r: { roomName: string }) => r.roomName).join(", "),
        );
      }
      setEstimates(list);
      // Phase 7 — vision-materials 메타 (있으면 표시)
      if (data.matchMetaByRoom) {
        setMatchMetaByRoom(data.matchMetaByRoom);
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

  // 자재 단위 행 + 공정별 그룹 (캡처 디자인 구조)
  const tradeGroups = useMemo(() => {
    const rows: ConsolidatedRow[] = [];
    let no = 1;
    for (const room of filteredRooms) {
      // 같은 자재 이름 main/aux/labor 묶기
      const byMaterial: Record<
        string,
        { main: number; aux: number; labor: number; item: EstimateItem }
      > = {};
      for (const item of room.items) {
        const key = item.materialName.replace(/ 부자재 일괄| 시공/g, "").trim();
        if (!byMaterial[key]) {
          byMaterial[key] = {
            main: 0,
            aux: 0,
            labor: 0,
            item: { ...item, materialName: key },
          };
        }
        if (item.category === "main") byMaterial[key].main = item.subtotalWon;
        else if (item.category === "aux") byMaterial[key].aux = item.subtotalWon;
        else if (item.category === "labor") byMaterial[key].labor = item.subtotalWon;
        // 주자재 정보 우선 (수량/단위/규격 정확)
        if (item.category === "main") byMaterial[key].item = { ...item, materialName: key };
      }
      for (const [, agg] of Object.entries(byMaterial)) {
        const it = agg.item;
        const materialCost = agg.main + agg.aux;
        const laborCost = agg.labor;
        const expenseCost = Math.round((materialCost + laborCost) * expenseRate);
        const total = materialCost + laborCost + expenseCost;
        // Phase 7 — vision-materials 매칭 메타 lookup (roomName + surface 기준)
        const roomMeta = matchMetaByRoom[room.roomName] || [];
        const matched = roomMeta.find((m) => m.surface === it.surface);
        rows.push({
          no: no++,
          trade: inferTrade(it.surface, it.materialName),
          roomName: room.roomName,
          materialName: it.materialName,
          brand: it.brand,
          spec: it.spec,
          sku: it.sku,
          unit: it.unit,
          quantity: it.quantity,
          materialCost,
          laborCost,
          expenseCost,
          total,
          excludeKey: `${room.roomName}::${it.materialName}`,
          matchStatus: matched?.matchStatus,
          confidence: matched?.confidence,
        });
      }
    }

    // 공정별 그룹화
    const groups: Record<string, ConsolidatedRow[]> = {};
    for (const r of rows) {
      if (!groups[r.trade]) groups[r.trade] = [];
      groups[r.trade].push(r);
    }
    // TRADE_ORDER 기준 정렬
    const sorted = Object.keys(groups).sort(
      (a, b) => (TRADE_ORDER.indexOf(a) ?? 99) - (TRADE_ORDER.indexOf(b) ?? 99),
    );
    return sorted.map((trade) => ({
      trade,
      rows: groups[trade],
      groupTotal: groups[trade].reduce((s, r) => s + r.total, 0),
    }));
  }, [filteredRooms, expenseRate]);

  // 제외 항목 빼고 합계 재계산 (자재 단위 키 기준)
  const grandTotal = useMemo(() => {
    let main = 0, aux = 0, labor = 0;
    for (const room of estimates) {
      // 자재별 묶기
      const seen: Record<string, boolean> = {};
      for (const item of room.items) {
        const key = `${room.roomName}::${item.materialName.replace(/ 부자재 일괄| 시공/g, "").trim()}`;
        if (excluded.has(key)) {
          seen[key] = true;
          continue;
        }
        if (seen[key]) continue; // 이미 제외됨
        if (item.category === "main") main += item.subtotalWon;
        else if (item.category === "aux") aux += item.subtotalWon;
        else if (item.category === "labor") labor += item.subtotalWon;
      }
    }
    return { main, aux, labor, total: main + aux + labor };
  }, [estimates, excluded]);

  const excludedTotal = useMemo(() => {
    let sum = 0;
    const counted = new Set<string>();
    for (const room of estimates) {
      for (const item of room.items) {
        const key = `${room.roomName}::${item.materialName.replace(/ 부자재 일괄| 시공/g, "").trim()}`;
        if (excluded.has(key)) {
          sum += item.subtotalWon;
          counted.add(key);
        }
      }
    }
    return { sum, count: counted.size };
  }, [estimates, excluded]);

  // 표준 견적서 형식 — 재료비 / 노무비 / 경비
  const materialCost = grandTotal.main + grandTotal.aux; // 재료비 (주자재 + 부자재)
  const laborCost = grandTotal.labor; // 노무비
  // 경비 = (재료비 + 노무비) × expenseRate (기본 3%, 사용자 조정 가능)
  const expenseCost = Math.round((materialCost + laborCost) * expenseRate);
  const subtotal = materialCost + laborCost + expenseCost;
  const vat = Math.round(subtotal * 0.1);
  const finalTotal = vatIncl ? subtotal + vat : subtotal;
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

                  {!loading && !error && tradeGroups.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.82rem] tabular">
                        <thead>
                          <tr className="border-b-2 border-primary-200 text-left text-[0.7rem] font-bold tracking-tight text-primary-900/60 bg-primary-50/40">
                            <th className="px-2 py-2.5 w-10 text-center">번호</th>
                            <th className="px-2 py-2.5 w-20">구분</th>
                            <th className="px-3 py-2.5">품명</th>
                            <th className="px-2 py-2.5">규격</th>
                            <th className="px-2 py-2.5 w-12 text-center">단위</th>
                            <th className="px-2 py-2.5 w-16 text-right">수량</th>
                            <th className="px-2 py-2.5 w-24 text-right">재료비</th>
                            <th className="px-2 py-2.5 w-24 text-right">노무비</th>
                            <th className="px-2 py-2.5 w-20 text-right">경비</th>
                            <th className="px-2 py-2.5 w-28 text-right pr-3">합계</th>
                            <th className="px-1 py-2.5 w-8 text-center">포함</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradeGroups.map((g) => (
                            <TradeGroup
                              key={g.trade}
                              trade={g.trade}
                              rows={g.rows}
                              groupTotal={g.groupTotal}
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

                    {/* 표준 견적서 정산 (재료비 / 노무비 / 경비) */}
                    <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40 mb-3">
                      견적 정산 (표준 양식)
                    </p>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-primary-100">
                          <td className="py-2.5 align-middle">
                            <p className="font-bold text-primary-900">재료비</p>
                            <p className="text-[0.7rem] text-primary-900/50 mt-0.5">
                              주자재 ₩{grandTotal.main.toLocaleString()} + 부자재 ₩{grandTotal.aux.toLocaleString()}
                            </p>
                          </td>
                          <td className="py-2.5 text-right tabular font-bold text-primary-900">
                            ₩ {materialCost.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="border-b border-primary-100">
                          <td className="py-2.5 align-middle">
                            <p className="font-bold text-primary-900">노무비</p>
                            <p className="text-[0.7rem] text-primary-900/50 mt-0.5">
                              국토부 표준품셈 일위대가 기준
                            </p>
                          </td>
                          <td className="py-2.5 text-right tabular font-bold text-primary-900">
                            ₩ {laborCost.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="border-b border-primary-100">
                          <td className="py-2.5 align-middle">
                            <p className="font-bold text-primary-900">경비</p>
                            <p className="text-[0.7rem] text-primary-900/50 mt-0.5">
                              현장관리비·안전관리비·일반관리비
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[0.7rem] text-primary-900/60">비율</span>
                              <input
                                type="range"
                                min={0}
                                max={15}
                                step={0.5}
                                value={expenseRate * 100}
                                onChange={(e) =>
                                  setExpenseRate(Number(e.target.value) / 100)
                                }
                                className="flex-1 max-w-[140px] accent-primary-500"
                              />
                              <input
                                type="number"
                                min={0}
                                max={15}
                                step={0.5}
                                value={(expenseRate * 100).toFixed(1)}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.min(15, Number(e.target.value)));
                                  setExpenseRate(v / 100);
                                }}
                                className="w-14 rounded border border-primary-200 px-1.5 py-0.5 text-[0.78rem] text-right tabular outline-none focus:border-primary-400"
                              />
                              <span className="text-[0.78rem] font-semibold text-primary-900/70">
                                %
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right tabular font-bold text-primary-900 align-top">
                            ₩ {expenseCost.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="border-b-2 border-primary-300">
                          <td className="py-2.5 align-middle font-bold text-primary-900">
                            소계
                          </td>
                          <td className="py-2.5 text-right tabular font-bold text-primary-900">
                            ₩ {subtotal.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="border-b border-primary-100">
                          <td className="py-2 align-middle text-[0.85rem] text-primary-900/70">
                            VAT 10% {vatIncl ? "(포함)" : "(별도)"}
                          </td>
                          <td className="py-2 text-right tabular text-primary-900/80">
                            ₩ {vat.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-base font-bold text-primary-900">총액</span>
                      <span className="text-[2rem] font-extrabold tabular leading-none tracking-tightest text-gradient-primary">
                        ₩ {finalTotal.toLocaleString()}
                      </span>
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
                      <FileText className="h-3.5 w-3.5 text-primary-600" />
                      <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                        건축공사 견적서
                      </p>
                    </div>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-primary-900/60">
                      A4 가로 4페이지 (갑지 + 총괄표 + 총괄내역서 + 공종별내역서)
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          // 1. estimate document 발행
                          const res = await fetch("/api/inpick/estimate-documents", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              projectId:
                                (typeof window !== "undefined" &&
                                  new URLSearchParams(window.location.search).get("projectId")) ||
                                "preview",
                              mode: "consumer_preview",
                              buildEstimateResult: {
                                estimates,
                                grandTotal: { mainTotal: grandTotal.main, auxTotal: grandTotal.aux, laborTotal: grandTotal.labor, totalWon: grandTotal.total },
                                matchMetaByRoom,
                              },
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok && !data.package) {
                            alert("견적서 발행 실패: " + (data.error || "unknown"));
                            return;
                          }
                          // 2. 클라이언트 측 jsPDF 렌더
                          const { renderEstimatePackagePdf } = await import(
                            "@/lib/inpick/estimate-documents/pdf/estimate-pdf"
                          );
                          const { pdfBlob } = await renderEstimatePackagePdf({ package: data.package });
                          // 3. 다운로드
                          const url = URL.createObjectURL(pdfBlob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `INPICK_견적서_${data.documentNo || "draft"}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          alert("PDF 생성 실패: " + (e instanceof Error ? e.message : String(e)));
                        }
                      }}
                      className="mt-3 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-95 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      A4 가로 PDF 다운로드
                    </button>
                    <p className="mt-2 text-[0.65rem] text-primary-900/50 text-center">
                      건축공사 업체용 형식 (갑지 / 총괄표 / 총괄내역 / 공종별)
                    </p>
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
                        · <b>주자재 종류·수량</b>: GPT-4o Vision이 생성된 이미지에서 추출
                      </li>
                      <li>
                        · <b>주자재 단가</b>: <span className="font-bold text-primary-700">한국물가협회 단가 기준 (2026 Q1)</span>
                      </li>
                      <li>
                        · <b>부자재</b>: 주자재의 10% (몰딩·본드·실링·자투리 일괄)
                      </li>
                      <li>
                        · <b>노무비</b>: 국토부 표준품셈 일위대가 (2026 갱신)
                      </li>
                      <li>
                        · <b>경비</b>: (재료비 + 노무비) × 비율 — 현장관리비·안전관리비·일반관리비 (기본 3%, 사용자 조정 가능)
                      </li>
                      <li>
                        · <b>VAT</b>: 10%
                      </li>
                      <li>
                        · <b>치수</b>: 평면도 Vision + 평형 표준치수
                      </li>
                    </ul>
                    <p className="mt-2 text-[0.7rem] text-primary-700 font-semibold">
                      Vision = 자재 종류·수량 추출 / 단가 = 한국물가협회 표준 (정밀 산출)
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

function TradeGroup({
  trade,
  rows,
  groupTotal,
  excluded,
  onToggle,
}: {
  trade: string;
  rows: ConsolidatedRow[];
  groupTotal: number;
  excluded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const visibleTotal = rows
    .filter((r) => !excluded.has(r.excludeKey))
    .reduce((s, r) => s + r.total, 0);

  return (
    <>
      {/* 그룹 헤더 — 어두운 네이비 */}
      <tr className="bg-[#1B3556] text-white">
        <td colSpan={10} className="px-3 py-2.5">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-bold tracking-tight hover:opacity-80"
          >
            <span className={`transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
            {trade}
            <span className="ml-2 text-[0.7rem] font-semibold opacity-80 tabular">
              {rows.length}건
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-extrabold tabular">
          ₩ {visibleTotal.toLocaleString()}
          {visibleTotal !== groupTotal && (
            <span className="ml-1 text-[0.65rem] font-normal opacity-60 line-through">
              {groupTotal.toLocaleString()}
            </span>
          )}
        </td>
      </tr>
      {open &&
        rows.map((r) => {
          const isExcluded = excluded.has(r.excludeKey);
          return (
            <tr
              key={r.no}
              className={`border-b border-primary-50 transition-colors ${
                isExcluded ? "bg-zinc-50" : "hover:bg-primary-50/30"
              }`}
            >
              <td className="px-2 py-2 text-center text-[0.7rem] tabular text-primary-900/50">
                {r.no}
              </td>
              <td className="px-2 py-2">
                <span className="inline-flex items-center rounded bg-primary-100/60 px-1.5 py-0.5 text-[0.65rem] font-bold text-primary-700">
                  {r.trade}
                </span>
              </td>
              <td className="px-3 py-2">
                <p
                  className={`font-semibold tracking-tight ${
                    isExcluded ? "line-through text-primary-900/40" : "text-primary-900"
                  }`}
                >
                  {r.materialName}
                </p>
                <p className="text-[0.65rem] mt-0.5 flex items-center gap-1.5 flex-wrap text-primary-900/50">
                  {r.brand && (
                    <span className="inline-flex items-center rounded bg-primary-50 border border-primary-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary-700">
                      {r.brand}
                    </span>
                  )}
                  {r.sku && (
                    <span className="inline-flex items-center rounded bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[0.6rem] font-mono text-amber-800">
                      SKU {r.sku}
                    </span>
                  )}
                  {/* Phase 7 — vision-materials matchStatus 배지 */}
                  {r.matchStatus === "confirmed" && (
                    <span className="inline-flex items-center rounded bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-800">
                      확정 {typeof r.confidence === "number" ? `${Math.round(r.confidence * 100)}%` : ""}
                    </span>
                  )}
                  {r.matchStatus === "recommended" && (
                    <span className="inline-flex items-center rounded bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-800">
                      추천 {typeof r.confidence === "number" ? `${Math.round(r.confidence * 100)}%` : ""}
                    </span>
                  )}
                  {r.matchStatus === "fallback" && (
                    <span className="inline-flex items-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-[0.6rem] font-bold text-gray-600">
                      기본
                    </span>
                  )}
                  <span>{r.roomName}</span>
                </p>
              </td>
              <td
                className={`px-2 py-2 text-[0.78rem] ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900/70"
                }`}
              >
                {r.spec || "—"}
              </td>
              <td
                className={`px-2 py-2 text-center text-[0.78rem] ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900/70"
                }`}
              >
                {r.unit}
              </td>
              <td
                className={`px-2 py-2 text-right tabular ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900"
                }`}
              >
                {r.quantity}
              </td>
              <td
                className={`px-2 py-2 text-right tabular ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900/80"
                }`}
              >
                {r.materialCost.toLocaleString()}
              </td>
              <td
                className={`px-2 py-2 text-right tabular ${
                  isExcluded ? "line-through text-primary-900/40" : "text-amber-800/90"
                }`}
              >
                {r.laborCost.toLocaleString()}
              </td>
              <td
                className={`px-2 py-2 text-right tabular ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900/60"
                }`}
              >
                {r.expenseCost.toLocaleString()}
              </td>
              <td
                className={`px-2 py-2 pr-3 text-right tabular font-bold ${
                  isExcluded ? "line-through text-primary-900/40" : "text-primary-900"
                }`}
              >
                {r.total.toLocaleString()}
              </td>
              <td className="px-1 py-2 text-center">
                <button
                  onClick={() => onToggle(r.excludeKey)}
                  title={isExcluded ? "견적에 포함" : "견적에서 제외"}
                  className={`inline-flex h-4 w-4 items-center justify-center rounded border-2 transition-all ${
                    isExcluded
                      ? "border-zinc-300 bg-white"
                      : "border-primary-500 bg-primary-500 text-white"
                  }`}
                >
                  {!isExcluded && (
                    <svg
                      className="h-2.5 w-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </td>
            </tr>
          );
        })}
    </>
  );
}

// 구 RoomRows — TradeGroup으로 대체됨, 제거 보류 (참조 X)
function _UnusedRoomRows(_props: {
  room: EstimateRoom;
  excluded: Set<string>;
  onToggle: (key: string) => void;
}) {
  void _props;
  return null;
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
