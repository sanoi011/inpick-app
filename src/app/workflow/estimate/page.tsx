/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
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
  Share2,
  ShoppingBag,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import type { Step1Data } from "@/components/workflow/Step1Cards";
import type { Step2Data } from "@/components/workflow/Step2Designer";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
} from "@/lib/inpick/korean-apt-dimensions";
// P3/P8: design_outputs analysis 상태 polling + workflow_state DB 복원
import {
  fetchDesignOutputs,
  fetchWorkflowState,
  getOrCreateWorkflowProjectId,
} from "@/lib/inpick/estimate-context/client";
// P7: 공종별 견적 v2 타입 + 클라이언트 빌더 (인증 없어도 17공종 견적 생성)
import type { ConstructionEstimate } from "@/lib/inpick/estimate-v2/types";
import { buildConstructionEstimateClientSide } from "@/lib/inpick/estimate-v2/client-builder";
// P17-1: 견적 정확도 레벨 L0~L5
import { computePrecisionLevel } from "@/lib/inpick/estimate-precision/precision-level";
// pricing v2 (2026-05-14): PDF 다운로드 결제 게이트
import EstimatePdfPurchaseModal from "@/components/payments/EstimatePdfPurchaseModal";
// community v2 (2026-05-14): 커뮤니티 견적 공유
import EstimateShareModal from "@/components/community/EstimateShareModal";
import MaterialShopDrawer from "@/components/workflow/MaterialShopDrawer";
// 2026-05-31: 오늘 만든 견적서 4문서 폼으로 교체 (Vision 분석 견적 → 우리 양식)
import EstimateProForm from "@/components/estimate-pro/EstimateProForm";
import { constructionEstimateToDetailLines } from "@/lib/estimate-pro/detail-model";

// P12: 단가 출처 라벨 (estimate-v2 MaterialPriceSource 매핑)
function priceSourceLabel(source: string): string {
  const map: Record<string, string> = {
    manual_override: "사용자/사업자 확정",
    material_price_lookup: "물가협회 단가",
    material_price_observations: "최근 30일 평균",
    contractor_price: "납품사 단가",
    catalog_price: "카탈로그 단가",
    category_standard: "카테고리 표준",
    kpa_standard: "KPA 표준 fallback",
  };
  return map[source] ?? source;
}

// P4: 견적 line item source — 사용자가 한 눈에 "이 가격이 어디서 왔는지" 알 수 있게
type LineSourceKind =
  | "user_selected_material"
  | "vision_confirmed_material"
  | "vision_recommended_material"
  | "prompt_extracted_material"
  | "scope_default_material"
  | "standard_fallback_material";

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
  // P4: source/confidence (contextId 경로에서 채움. legacy 경로는 matchMetaByRoom에서 채움)
  source?: LineSourceKind;
  confidence?: number;
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
  // P4: 견적 line source — 사용자가 견적의 근거를 한 눈에 식별
  source?: LineSourceKind;
}

// P4: source 배지 라벨/색상 매핑
const SOURCE_LABEL: Record<LineSourceKind, string> = {
  user_selected_material: "사용자 확정",
  vision_confirmed_material: "이미지 분석 확정",
  vision_recommended_material: "이미지 분석 추천",
  prompt_extracted_material: "디자인 설명 기반",
  scope_default_material: "Scope 기본값",
  standard_fallback_material: "표준 기본값",
};

// 색상 규칙(2026-07-04): 출처 배지는 무채색 통일 — 색은 대분류(회색)·소계(파랑)·총계(노랑)에만 사용
const SOURCE_COLOR: Record<LineSourceKind, string> = {
  user_selected_material: "border-zinc-300 bg-zinc-100 text-zinc-700",
  vision_confirmed_material: "border-zinc-300 bg-zinc-100 text-zinc-700",
  vision_recommended_material: "border-zinc-200 bg-zinc-50 text-zinc-600",
  prompt_extracted_material: "border-zinc-200 bg-zinc-50 text-zinc-600",
  scope_default_material: "border-zinc-200 bg-zinc-50 text-zinc-500",
  standard_fallback_material: "border-zinc-200 bg-zinc-50 text-zinc-500",
};

function EstimateSourceBadge({
  source,
  confidence,
}: {
  source?: LineSourceKind;
  confidence?: number;
}) {
  if (!source) return null;
  const label = SOURCE_LABEL[source] ?? source;
  const cls = SOURCE_COLOR[source] ?? "border-stone-300 bg-stone-50 text-stone-700";
  const pct = typeof confidence === "number" ? ` · ${Math.round(confidence * 100)}%` : "";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.62rem] font-bold ${cls}`}
      title={`출처: ${label}${pct}`}
    >
      {label}
      {pct}
    </span>
  );
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

/**
 * PDF 발행 + 다운로드 + entitlement consume.
 * 권한 체크는 호출하는 쪽에서 미리 수행.
 */
async function downloadEstimatePdf(input: {
  projectId: string;
  entitlementId?: string;
  step1: Step1Data | null;
  estimates: EstimateRoom[];
  grandTotal: { main: number; aux: number; labor: number; total: number };
  matchMetaByRoom: Record<string, Array<{ matchStatus?: "confirmed" | "recommended" | "fallback"; confidence?: number; surface?: string }>>;
  constructionEstimate: ConstructionEstimate | null;
  /** AI 디자인 이미지 — PDF 부록 첨부 (2026-07-04) */
  designImages?: Array<{ url: string; label: string }>;
}) {
  const res = await fetch("/api/inpick/estimate-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      mode: "consumer_preview",
      addressText: input.step1?.basicInfo.selectedAddress?.roadAddress,
      apartmentName: input.step1?.basicInfo.selectedAddress?.buildingName,
      exclusiveAreaM2: input.step1?.basicInfo.selectedPyeong?.exclusiveArea,
      expansionOption:
        input.step1?.basicInfo.expansionType === "extended" ? "expanded" : "basic",
      buildEstimateResult: {
        estimates: input.estimates,
        grandTotal: {
          mainTotal: input.grandTotal.main,
          auxTotal: input.grandTotal.aux,
          laborTotal: input.grandTotal.labor,
          totalWon: input.grandTotal.total,
        },
        matchMetaByRoom: input.matchMetaByRoom,
      },
      constructionEstimate: input.constructionEstimate || undefined,
    }),
  });
  let data: { package?: unknown; documentNo?: string; error?: string; hint?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    alert(`PDF API 응답 파싱 실패 (HTTP ${res.status})`);
    return;
  }
  if (!data.package) {
    alert(`견적서 발행 실패: ${data.error || "unknown"}${data.hint ? `\n${data.hint}` : ""}`);
    return;
  }
  const { renderEstimatePackagePdf } = await import("@/lib/inpick/estimate-documents/pdf/estimate-pdf");
  const { pdfBlob } = await renderEstimatePackagePdf({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    package: data.package as any,
    designImages: input.designImages,
  });
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `INPICK_견적서_${data.documentNo || "draft"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 단발 entitlement이면 consume (무제한은 NOOP)
  if (input.entitlementId) {
    try {
      await fetch("/api/estimate-pdf/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: input.entitlementId }),
      });
    } catch (e) {
      console.warn("[estimate] entitlement consume failed:", e);
    }
  }
}

// P11-FIX: useSearchParams 사용 페이지는 Suspense로 감싸야 prerender 통과 (Vercel 빌드 에러 4회 원인)
// 가이드: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
export default function EstimatePageWithSuspense() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#FDF7F4] flex items-center justify-center">
          <div className="flex items-center gap-3 text-primary-900">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold">견적서 불러오는 중…</span>
          </div>
        </main>
      }
    >
      <EstimatePage />
    </Suspense>
  );
}

function EstimatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // P2: workflow page의 finalize가 발급한 contextId — 있으면 evidence 기반 견적 합성
  const contextId = searchParams?.get("contextId") ?? null;
  const [resolvedContextId, setResolvedContextId] = useState<string | null>(contextId);

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
  // P0: API/클라이언트 폴백 시 사용자에게 안내할 경고 메시지
  const [warnings, setWarnings] = useState<string[]>([]);
  // P3: design_outputs analysis 진행 상태 (pending/done/failed 카운트)
  const [analysisStatus, setAnalysisStatus] = useState<{
    pending: number;
    done: number;
    failed: number;
    total: number;
  } | null>(null);
  // P5: 견적이 어느 경로로 산출됐는지 사용자에게 진단 표시
  const [estimatePath, setEstimatePath] = useState<{
    path: "context_evidence" | "legacy_vision" | "legacy_standard";
    estimateLevel?: string;
    quotationType?: string;
  }>({ path: "legacy_standard" });
  // P5: design_outputs DB에서 가져온 evidence — 분석된 디자인 갤러리 보강용
  const [designOutputsForGallery, setDesignOutputsForGallery] = useState<
    Array<{ id: string; imageUrl: string; targetName: string; status: string }>
  >([]);
  // P7: 공종별 견적 v2 — contextId 경로에서 받음
  const [constructionEstimate, setConstructionEstimate] = useState<ConstructionEstimate | null>(null);
  const [viewMode, setViewMode] = useState<"trade" | "room" | "surface" | "material">("trade");
  // 2026-05-31: 기본은 새 4문서 폼. 기존 상세표는 토글로만 노출.
  const [showLegacy, setShowLegacy] = useState(false);
  // P14-4: 사용자가 제외한 v2 line ID 집합 — 토글 시 총액 재계산
  const [excludedV2Lines, setExcludedV2Lines] = useState<Set<string>>(new Set());
  // pricing v2 (2026-05-14): PDF 다운로드 결제 게이트
  const [pdfPurchaseOpen, setPdfPurchaseOpen] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  // community v2 (2026-05-14): 커뮤니티 공유 모달
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // 자재 라인 → 실구매/카탈로그/미리보기 드로어
  const [shopMaterial, setShopMaterial] = useState<string | null>(null);

  const goBackToDesign = () => {
    try {
      sessionStorage.setItem("workflow_step", "2");
    } catch {
      /* private mode */
    }
    router.push("/workflow?step=2");
  };

  useEffect(() => {
    router.prefetch("/workflow?step=2");
  }, [router]);

  async function finalizeEstimateContext(s1: Step1Data): Promise<string | null> {
    const projectId = getOrCreateWorkflowProjectId();
    if (!projectId) return null;
    const projectMode: "apartment" | "photo_only" | "commercial" =
      s1.workflowEntry === "photo_residential"
        ? "photo_only"
        : s1.workflowEntry === "photo_commercial"
          ? "commercial"
          : "apartment";
    try {
      const res = await fetch("/api/inpick/estimate-context/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectMode, step1Snapshot: s1 }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { contextId?: string };
      return data.contextId || null;
    } catch (error) {
      console.warn("[estimate] context finalize skipped — legacy estimate fallback", error);
      return null;
    }
  }

  const toggleV2LineIncluded = (lineId: string) => {
    setExcludedV2Lines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  // P14-4: 제외 라인 반영한 v2 재계산 (간접비/관리비/이윤/VAT 자동)
  const adjustedV2 = useMemo(() => {
    if (!constructionEstimate) return null;
    const lines = constructionEstimate.lines.map((l) => ({
      ...l,
      included: !excludedV2Lines.has(l.id),
    }));
    let directMaterial = 0;
    let directLabor = 0;
    let directExpense = 0;
    for (const l of lines) {
      if (!l.included) continue;
      directMaterial += l.materialAmount;
      directLabor += l.laborAmount;
      directExpense += l.expenseAmount;
    }
    const directTotal = directMaterial + directLabor + directExpense;
    const indirectCost = Math.round(directTotal * 0.06);
    const generalManagement = Math.round(directTotal * 0.04);
    const profit = Math.round((directTotal + indirectCost + generalManagement) * 0.05);
    const subtotal = directTotal + indirectCost + generalManagement + profit;
    const vat = Math.round(subtotal * 0.1);
    return {
      lines,
      totals: {
        directMaterial,
        directLabor,
        directExpense,
        directTotal,
        indirectCost,
        generalManagement,
        profit,
        vat,
        totalWithVat: subtotal + vat,
      },
      excludedCount: excludedV2Lines.size,
      excludedAmount: constructionEstimate.lines
        .filter((l) => excludedV2Lines.has(l.id))
        .reduce((s, l) => s + l.totalAmount, 0),
    };
  }, [constructionEstimate, excludedV2Lines]);
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

  // P3: design_outputs analysis 상태를 주기적으로 확인 — 모두 done/failed면 polling 중단
  useEffect(() => {
    if (typeof window === "undefined") return;
    const projectId = getOrCreateWorkflowProjectId();
    if (!projectId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ticks = 0;
    let reanalyzeRequested = false;
    const MAX_ANALYSIS_TICKS = 45; // 약 3분 (4초 × 45) — 재분석 시간 포함, 무한 '진행 중' 방지

    const tick = async () => {
      const outputs = await fetchDesignOutputs(projectId);
      if (stopped) return;
      if (outputs.length === 0) {
        setAnalysisStatus(null);
        return;
      }
      const counts = { pending: 0, done: 0, failed: 0, total: outputs.length };
      for (const o of outputs) {
        if (o.status === "analysis_pending" || o.status === "generated") counts.pending++;
        else if (o.status === "analysis_done") counts.done++;
        else if (o.status === "analysis_failed") counts.failed++;
      }
      // 멈춘 분석(analysis_pending 영구 정체·실패) 자동 재실행 — 페이지 진입당 1회
      if ((counts.pending > 0 || counts.failed > 0) && !reanalyzeRequested) {
        reanalyzeRequested = true;
        void fetch("/api/inpick/design-outputs/reanalyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        }).catch(() => {});
      }
      ticks++;
      // 일정 시간 내 정밀 분석이 끝나지 않으면 남은 항목을 표준값으로 확정(폴링 종료).
      // 견적은 이미 디자인 기반으로 산출되어 있으므로 '진행 중'이 영원히 멈추는 것을 방지.
      if (ticks >= MAX_ANALYSIS_TICKS && counts.pending > 0) {
        counts.done += counts.pending;
        counts.pending = 0;
      }
      setAnalysisStatus(counts);
      // P5: 갤러리 보강 — design_outputs DB의 이미지도 함께 표시
      setDesignOutputsForGallery(
        outputs.map((o) => ({
          id: o.id,
          imageUrl: o.imageUrl,
          targetName: o.targetName,
          status: o.status,
        })),
      );
      // pending(또는 재분석 중인 실패 건)이 남아있으면 4초 후 재조회
      const stillWorking =
        counts.pending > 0 || (reanalyzeRequested && counts.failed > 0 && ticks < MAX_ANALYSIS_TICKS);
      if (stillWorking && !stopped) {
        timer = setTimeout(() => void tick(), 4000);
      }
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const restore = async () => {
      const s1raw = sessionStorage.getItem("workflow_step1");
      const s2raw = sessionStorage.getItem("workflow_step2");
      // P8: DB 우선 — sessionStorage가 비어도 DB에서 복원 가능
      const projectId = getOrCreateWorkflowProjectId();
      let parsedS1: Step1Data | null = null;
      let parsedS2: Step2Data | null = null;

      // 같은 탭에서 넘어온 데이터는 네트워크보다 먼저 복원한다.
      if (s1raw) {
        try {
          parsedS1 = JSON.parse(s1raw) as Step1Data;
        } catch {
          /* ignore */
        }
      }
      if (s2raw) {
        try {
          parsedS2 = JSON.parse(s2raw) as Step2Data;
        } catch {
          /* ignore */
        }
      }

      // 세션이 없는 새 기기/새 탭에서만 DB 복원을 기다린다.
      if (projectId && (!parsedS1 || !parsedS2)) {
        const dbRow = await fetchWorkflowState(projectId);
        if (cancelled) return;
        if (dbRow?.exists && dbRow.workflowState) {
          const ws = dbRow.workflowState;
          if (!parsedS1 && ws.step1) parsedS1 = ws.step1 as unknown as Step1Data;
          if (!parsedS2 && ws.step2) parsedS2 = ws.step2 as unknown as Step2Data;
        }
      }
      // P2: contextId 있으면 sessionStorage 없어도 시도 가능 (DB 스냅샷 truth)
      if (!parsedS1 && !parsedS2 && !contextId) {
        setError("워크플로 데이터가 없습니다. Step1부터 시작해주세요.");
        setLoading(false);
        return;
      }
      const finalS1: Step1Data = parsedS1 ?? ({
        basicInfo: { mode: "address", budget: 3500, expansionType: "basic" },
        buildingType: null,
        rooms: [],
      } as Step1Data);
      const finalS2: Step2Data = parsedS2 ?? ({
        selectedByRoom: {},
        generations: {},
        rendersByRoom: {},
        promptByRoom: {},
      } as Step2Data);
      setStep1(finalS1);
      setStep2(finalS2);
      // sessionStorage 동기화 (다음 진입 시 빠르게)
      try {
        sessionStorage.setItem("workflow_step1", JSON.stringify(finalS1));
        sessionStorage.setItem("workflow_step2", JSON.stringify(finalS2));
      } catch {
        /* quota */
      }
      // 화면 전환 후 context를 생성하므로 이전 화면에서 API를 기다리지 않는다.
      const nextContextId = contextId || (await finalizeEstimateContext(finalS1));
      if (cancelled) return;
      setResolvedContextId(nextContextId);
      void runEstimate(finalS1, finalS2, nextContextId);
    };
    void restore().catch((e) => {
      console.error("[estimate] restore failed:", e);
      setError(e instanceof Error ? e.message : "데이터 복원 실패");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // contextId는 URL에서 한 번만 읽음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runEstimate(
    s1: Step1Data,
    s2: Step2Data,
    contextIdOverride: string | null = resolvedContextId,
  ) {
    setLoading(true);
    setError(null);
    setWarnings([]);
    const accumulatedWarnings: string[] = [];
    try {
      // P2: contextId 있으면 evidence 기반 합성 견적 시도 — 실패 시 legacy 분기로 폴백
      if (contextIdOverride) {
        try {
          const ctxRes = await fetch("/api/inpick/build-estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contextId: contextIdOverride }),
          });
          if (ctxRes.ok) {
            const ctxData = (await ctxRes.json()) as {
              // P7 v2 응답
              estimateVersion?: string;
              constructionEstimate?: ConstructionEstimate;
              // legacy compat
              estimates?: Array<{
                roomName: string;
                totalAreaM2: number;
                items: EstimateItem[];
                mainTotalWon: number;
                auxTotalWon: number;
                laborTotalWon: number;
                totalWon: number;
              }>;
              lines?: Array<{
                targetName: string;
                surface: string;
                materialName: string;
                brand?: string;
                spec?: string;
                sku?: string;
                unit: string;
                quantity: number;
                unitPriceWon: number;
                subtotalWon: number;
                meta: {
                  source: string;
                  confidence: number;
                };
              }>;
              grandTotalWon?: number;
              grandTotal?: {
                mainTotal: number;
                auxTotal: number;
                laborTotal: number;
                totalWon: number;
              };
              warnings?: string[];
              quotationType?: string;
              estimateLevel?: string;
            };
            // P7: v2 응답이면 constructionEstimate 저장 + legacy estimates도 함께 활용
            if (ctxData.constructionEstimate) {
              setConstructionEstimate(ctxData.constructionEstimate);
              if (Array.isArray(ctxData.estimates) && ctxData.estimates.length > 0) {
                setEstimates(ctxData.estimates);
              }
              if (Array.isArray(ctxData.warnings)) accumulatedWarnings.push(...ctxData.warnings);
              setWarnings(accumulatedWarnings);
              setEstimatePath({
                path: "context_evidence",
                estimateLevel: ctxData.estimateLevel,
                quotationType: ctxData.quotationType,
              });
              setLoading(false);
              return;
            }
            if (Array.isArray(ctxData.lines)) {
              // lines를 targetName 별로 그룹화하여 EstimateRoom[] 형식으로 변환
              const byTarget = new Map<string, EstimateItem[]>();
              for (const l of ctxData.lines) {
                if (!byTarget.has(l.targetName)) byTarget.set(l.targetName, []);
                byTarget.get(l.targetName)!.push({
                  surface: l.surface,
                  materialName: l.materialName,
                  brand: l.brand,
                  spec: l.spec,
                  sku: l.sku,
                  quantity: l.quantity,
                  unit: l.unit,
                  unitPriceWon: l.unitPriceWon,
                  subtotalWon: l.subtotalWon,
                  category: "main",
                  // P4: source/confidence 그대로 전달
                  source: l.meta.source as LineSourceKind,
                  confidence: l.meta.confidence,
                });
              }
              const converted: EstimateRoom[] = Array.from(byTarget.entries()).map(
                ([roomName, items]) => {
                  const total = items.reduce((s, it) => s + it.subtotalWon, 0);
                  return {
                    roomName,
                    totalAreaM2: items.reduce(
                      (s, it) => (it.unit === "m²" ? s + it.quantity : s),
                      0,
                    ),
                    items,
                    mainTotalWon: total,
                    auxTotalWon: 0,
                    laborTotalWon: 0,
                    totalWon: total,
                  };
                },
              );
              setEstimates(converted);
              if (Array.isArray(ctxData.warnings)) accumulatedWarnings.push(...ctxData.warnings);
              if (
                ctxData.quotationType === "design_based_estimate" &&
                ctxData.estimateLevel !== "L2_IMAGE_ANALYZED" &&
                ctxData.estimateLevel !== "L3_USER_CONFIRMED"
              ) {
                accumulatedWarnings.push(
                  "현재 견적 기준: 디자인 기반 견적. 자재 정밀 분석이 진행 중입니다. 완료되면 견적 항목이 자동 보강됩니다.",
                );
              }
              setWarnings(accumulatedWarnings);
              // P5: 경로 진단 표시
              setEstimatePath({
                path: "context_evidence",
                estimateLevel: ctxData.estimateLevel,
                quotationType: ctxData.quotationType,
              });
              setLoading(false);
              return;
            }
          } else {
            console.warn(
              `[estimate] contextId 견적 실패 (${ctxRes.status}) — legacy 분기로 폴백`,
            );
          }
        } catch (err) {
          console.warn("[estimate] contextId 견적 에러 — legacy 분기로 폴백:", err);
        }
      }

      // ─── 모드별 분기 (MD plan §10) ──────────────────────────────
      // photo_residential → photo_only 가견적 (면적×등급)
      // photo_commercial → commercial 가견적 (zone×업종×등급+설비)
      // apartment_drawing → 기존 17공종 자재 견적
      const area = s1.basicInfo.selectedPyeong?.exclusiveArea;

      if (s1.workflowEntry === "photo_residential") {
        if (!area) {
          accumulatedWarnings.push(
            "Step1에서 면적/평수를 입력하지 않아 기본값으로 가견적을 산출합니다.",
          );
        }
        const res = await fetch("/api/inpick/build-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectMode: "photo_only",
            areaM2: area || undefined, // API가 평수 기본값 폴백 처리
            budgetTier:
              s1.basicInfo.expansionType === "extended" ? "premium" : "standard",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.hint || "견적 생성 실패");
        if (Array.isArray(data.warnings)) accumulatedWarnings.push(...data.warnings);
        setWarnings(accumulatedWarnings);
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
        // P7-FIX: photo_residential도 17공종 client v2 빌드
        try {
          const prompts = Object.values(s2.rendersByRoom || {})
            .flat()
            .map((r) => r.revisedPrompt || r.prompt)
            .filter(Boolean) as string[];
          const clientEstimate = buildConstructionEstimateClientSide({
            projectId: getOrCreateWorkflowProjectId() || "preview",
            projectMode: "photo_only",
            rooms: [
              {
                roomName: "전체 공간",
                areaM2: area || 79.3,
                prompts,
              },
            ],
          });
          setConstructionEstimate(clientEstimate);
          setEstimatePath({
            path: "legacy_vision",
            estimateLevel: "L1_DESIGN",
            quotationType: "construction_trade_estimate",
          });
        } catch (e) {
          console.warn("[estimate] photo_only v2 build failed:", e);
        }
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
        if (Array.isArray(data.warnings)) accumulatedWarnings.push(...data.warnings);
        setWarnings(accumulatedWarnings);
        // P7-FIX: commercial도 17공종 client v2 빌드 (zone별)
        try {
          const zoneRooms = zoneInputs.map((z) => {
            const prompts = (s2.rendersByRoom?.[z.id] || [])
              .map((r) => r.revisedPrompt || r.prompt)
              .filter(Boolean) as string[];
            return {
              roomName: z.nameKo,
              areaM2: z.areaM2,
              prompts,
            };
          });
          const clientEstimate = buildConstructionEstimateClientSide({
            projectId: getOrCreateWorkflowProjectId() || "preview",
            projectMode: "commercial",
            rooms: zoneRooms,
          });
          setConstructionEstimate(clientEstimate);
          setEstimatePath({
            path: "legacy_vision",
            estimateLevel: "L1_DESIGN",
            quotationType: "construction_trade_estimate",
          });
        } catch (e) {
          console.warn("[estimate] commercial v2 build failed:", e);
        }
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

      // 1) 사용자가 선택한 방 결정 (P0: 사용자가 명시한 시공 범위가 우선)
      //    - Step1에서 명시적으로 선택한 방이 있으면 그것만 사용
      //    - 선택이 없으면 Step2에서 이미지 생성된 방으로 폴백
      //    - 둘 다 없으면 API가 평수 기반 표준 방 셋으로 마지막 폴백
      let selectedRoomKeys: string[] = [];
      if (s1.rooms?.includes("all")) {
        selectedRoomKeys = Object.keys(ROOM_NAME_MAP);
      } else if (s1.rooms?.length) {
        selectedRoomKeys = s1.rooms.filter((r) => r in ROOM_NAME_MAP);
      } else {
        // P0 폴백: Step1 방 선택 없으면 Step2에서 이미지 생성된 방 키로
        // (= 사용자가 실제 시공하려는 공간 = 이미지 만든 공간)
        const generatedKeys = Object.keys(s2.rendersByRoom || {}).filter(
          (k) => k !== "all" && k in ROOM_NAME_MAP && (s2.rendersByRoom[k]?.length ?? 0) > 0,
        );
        if (generatedKeys.length > 0) {
          selectedRoomKeys = generatedKeys;
        }
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

      // P0: requestRooms 비어있어도 차단하지 않음 — API가 평수 기반 표준 방 셋으로 폴백
      //   (Step1 방 선택 없음 + Step2 이미지 생성 없음 → 평수만으로도 가견적 가능)
      // P5: projectId 전달 — API가 design_outputs DB의 materialHints를 자동 활용
      const workflowProjectId = getOrCreateWorkflowProjectId();
      const res = await fetch("/api/inpick/build-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: requestRooms,
          projectId: workflowProjectId,
          // API 폴백을 위해 평수/면적도 전달
          areaM2: area,
          pyung: area ? area / 3.305785 : undefined,
        }),
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
      // P0: API 폴백/표준자재 적용 시 warnings UI에 표시
      if (Array.isArray(data.warnings)) accumulatedWarnings.push(...data.warnings);
      if (data.fallbackRooms?.length > 0) {
        const names = data.fallbackRooms.map((r: { roomName: string }) => r.roomName).join(", ");
        accumulatedWarnings.push(
          `${names}는 이미지 분석 결과가 없어 표준 자재로 산출했습니다. 정확도를 높이려면 해당 방의 이미지를 생성하거나 자재를 직접 선택해주세요.`,
        );
      }
      setWarnings(accumulatedWarnings);
      setEstimates(list);
      // P7-FIX: apartment 경로에서 항상 17공종 견적 클라이언트 빌드.
      //   - 사용자가 한 번도 입력 안 했어도 평수 30평 기본 표준 방 셋으로 산출
      //   - contextId 경로 성공한 경우는 위에서 이미 return됐으므로 여기 도달 안 함
      try {
        const projectMode: "apartment" | "photo_only" | "commercial" = "apartment";
        const totalArea = s1.basicInfo.selectedPyeong?.exclusiveArea ?? 99.0; // 기본 30평
        const normRooms = s1.normalizedFloorplan?.rooms || [];
        const roomEntries: Array<{
          roomName: string;
          areaM2?: number;
          widthM?: number;
          depthM?: number;
          prompts: string[];
        }> = [];
        const generatedKeys = Object.keys(s2.rendersByRoom || {}).filter(
          (k) => k !== "all" && (s2.rendersByRoom[k]?.length ?? 0) > 0,
        );
        const userRoomKeys = s1.rooms?.includes("all")
          ? Object.keys(ROOM_NAME_MAP)
          : s1.rooms || [];
        const allRoomKeys = new Set<string>([...userRoomKeys, ...generatedKeys]);
        for (const k of Array.from(allRoomKeys)) {
          if (!(k in ROOM_NAME_MAP)) continue;
          const koreanName = ROOM_NAME_MAP[k];
          const norm = normRooms.find(
            (r) => r.name === koreanName || r.name.includes(koreanName.replace(/\d+$/, "")),
          );
          const widthM = norm?.widthMm ? norm.widthMm / 1000 : undefined;
          const depthM = norm?.depthMm ? norm.depthMm / 1000 : undefined;
          const areaM2 = widthM && depthM ? widthM * depthM : undefined;
          const prompts = (s2.rendersByRoom?.[k] || [])
            .map((r) => r.revisedPrompt || r.prompt)
            .filter(Boolean) as string[];
          roomEntries.push({ roomName: koreanName, areaM2, widthM, depthM, prompts });
        }
        // 최후 fallback — 어떤 정보도 없으면 표준 5실 (거실/주방/안방/욕실1/현관)
        if (roomEntries.length === 0) {
          roomEntries.push(
            { roomName: "거실", areaM2: totalArea * 0.28, prompts: [] },
            { roomName: "주방", areaM2: totalArea * 0.1, prompts: [] },
            { roomName: "안방", areaM2: totalArea * 0.15, prompts: [] },
            { roomName: "욕실1", areaM2: totalArea * 0.05, prompts: [] },
            { roomName: "현관", areaM2: totalArea * 0.04, prompts: [] },
          );
        }
        console.info(
          `[estimate-v2] client build — rooms=${roomEntries.length} totalArea=${totalArea}`,
        );
        const clientEstimate = buildConstructionEstimateClientSide({
          projectId: getOrCreateWorkflowProjectId() || "preview",
          projectMode,
          rooms: roomEntries,
        });
        console.info(
          `[estimate-v2] built — lines=${clientEstimate.lines.length} trades=${clientEstimate.tradeSummaries.length} total=₩${clientEstimate.totals.totalWithVat.toLocaleString()}`,
        );
        setConstructionEstimate(clientEstimate);
        setEstimatePath((prev) =>
          prev.path === "context_evidence"
            ? prev
            : {
                path: "legacy_vision",
                estimateLevel: "L1_DESIGN",
                quotationType: "construction_trade_estimate",
              },
        );
      } catch (e) {
        console.error("[estimate] client v2 build FAILED:", e);
      }
      // P5: legacy 경로에서 vision이 작동했는지 추정 — fallbackRooms 비어있고 imageUrl 있는 방이 있으면 legacy_vision, 아니면 legacy_standard
      const hadAnyImage = requestRooms.some((r) => "renderImageUrl" in r);
      const allFellBack = (data.fallbackRooms?.length ?? 0) >= requestRooms.length;
      setEstimatePath({
        path: hadAnyImage && !allFellBack ? "legacy_vision" : "legacy_standard",
        quotationType: data.quotationType,
      });
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
        // P4: source/confidence — contextId 경로에서 채운 값 우선, 그 다음 matchStatus → source 매핑
        let source: LineSourceKind | undefined = it.source;
        let confidence: number | undefined = it.confidence;
        if (!source) {
          // matchStatus → source 매핑 (legacy 경로)
          if (matched?.matchStatus === "confirmed") source = "vision_confirmed_material";
          else if (matched?.matchStatus === "recommended") source = "vision_recommended_material";
          else if (matched?.matchStatus === "fallback") source = "standard_fallback_material";
          // 더 폴백: priceSource를 통한 추정
          else if (it.priceSource === "vision_estimate") source = "vision_recommended_material";
          else if (it.priceSource === "manual") source = "user_selected_material";
          else if (it.priceSource === "standard" || it.priceSource === "korea_price_assoc")
            source = "standard_fallback_material";
        }
        if (confidence == null) confidence = matched?.confidence;
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
          confidence,
          source,
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
  //   P7-4: v2 견적이 있으면 그쪽 totals 우선, 없으면 legacy 계산
  //   P14-4: 사용자가 라인 제외했으면 adjustedV2.totals 우선
  const v2Totals = adjustedV2?.totals ?? constructionEstimate?.totals;
  const materialCost = v2Totals ? v2Totals.directMaterial : grandTotal.main + grandTotal.aux;
  const laborCost = v2Totals ? v2Totals.directLabor : grandTotal.labor;
  const expenseCost = v2Totals
    ? v2Totals.directExpense + v2Totals.indirectCost + v2Totals.generalManagement + v2Totals.profit
    : Math.round((materialCost + laborCost) * expenseRate);
  const subtotal = materialCost + laborCost + expenseCost;
  const vat = v2Totals ? v2Totals.vat : Math.round(subtotal * 0.1);
  // VAT 토글이 헤드라인 총액에 반영되도록 v2/legacy 모두 동일 공식 사용.
  // (v2는 vatIncl=true일 때 subtotal+vat === totalWithVat 로 일치 — 별도/포함 전환 가능)
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
              onClick={goBackToDesign}
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-cta hover:bg-primary-600"
              aria-label="디자인 단계로 돌아가기"
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
                onClick={goBackToDesign}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-primary-100 bg-white px-3 text-primary-900 shadow-sm transition hover:bg-primary-50"
                aria-label="디자인 단계로 돌아가기"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden text-xs font-bold sm:inline">디자인으로</span>
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
              <div className="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-primary-100 bg-white px-4 py-2.5 max-w-full">
                <span className="text-sm font-semibold text-primary-900/70 break-keep">
                  {step1?.basicInfo.selectedAddress?.buildingName || "선택한 공간"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[1.6rem] sm:text-[2rem] font-extrabold tabular leading-none tracking-tight text-primary-900">
                  ₩ {finalTotal.toLocaleString()}
                  <ChevronDown className="h-3.5 w-3.5 text-primary-900/40" />
                </span>
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

                {/* P3: 자재 정밀 분석 진행 상태 (분석 끝나면 견적 자동 보강 안내) */}
                {!loading && !error && analysisStatus && analysisStatus.total > 0 && (
                  <div className="mb-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3">
                    <div className="flex items-start gap-2">
                      {analysisStatus.pending > 0 ? (
                        <Loader2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-bold text-blue-800">
                          {analysisStatus.pending > 0
                            ? `자재 정밀 분석 진행 중 — ${analysisStatus.done}/${analysisStatus.total} 완료`
                            : `자재 정밀 분석 완료 — ${analysisStatus.done}건${analysisStatus.failed > 0 ? `, 실패 ${analysisStatus.failed}건` : ""}`}
                        </p>
                        <p className="mt-1 text-[0.72rem] text-blue-800/80 leading-snug">
                          {analysisStatus.pending > 0
                            ? "현재 견적 기준: 디자인 기반 견적. 완료되면 견적 항목이 자동 보강됩니다."
                            : "이미지 분석 결과가 견적에 반영되었습니다."}
                        </p>
                        {analysisStatus.pending === 0 && analysisStatus.done > 0 && (
                          <button
                            onClick={() => {
                              if (step1 && step2) void runEstimate(step1, step2);
                            }}
                            className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-3 py-1 text-[0.7rem] font-bold text-blue-700 hover:bg-blue-50"
                          >
                            <RefreshCw className="h-3 w-3" /> 견적 새로고침
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* P0: 폴백/표준자재 적용 경고 배너 — 소비자 화면에서는 숨김(내부 진단용) */}
                {false && !loading && !error && warnings.length > 0 && (
                  <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-800">
                          견적 산출 안내 — 일부 항목은 표준값으로 계산됐어요
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {warnings.map((w, i) => (
                            <li key={i} className="text-[0.72rem] text-amber-800/80 leading-snug">
                              • {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* P17-1: 견적 정확도 레벨 (L0~L5) — 소비자 화면에서는 숨김(내부 진단용) */}
                {false && !loading && !error && constructionEstimate && (() => {
                  const precision = computePrecisionLevel(constructionEstimate);
                  return (
                    <div className={`mb-3 rounded-2xl border-2 ${precision.info.colorClass} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{precision.info.emoji}</span>
                            <p className="text-sm font-extrabold">{precision.info.label}</p>
                            <span className="ml-2 text-xs font-bold opacity-70">
                              정밀도 {precision.score}점
                            </span>
                          </div>
                          <p className="text-[0.72rem] opacity-80 leading-snug">
                            {precision.info.description}
                          </p>
                          {precision.recommendations.length > 0 && (
                            <ul className="mt-2 space-y-0.5">
                              {precision.recommendations.map((r, i) => (
                                <li key={i} className="text-[0.7rem] opacity-90">
                                  • {r}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="text-right text-[0.7rem] opacity-70 tabular shrink-0">
                          <p>
                            DB 확정 <b>{precision.lineStats.productLocked}</b>
                          </p>
                          <p>
                            Vision <b>{precision.lineStats.visionConfirmed + precision.lineStats.visionRecommended}</b>
                          </p>
                          <p>
                            사용자 <b>{precision.lineStats.userSelected}</b>
                          </p>
                          <p>
                            Fallback <b>{precision.lineStats.standardFallback}</b>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2026-05-31: 생성 디자인 Vision 분석 견적 → 오늘 만든 4문서 폼으로 표시 */}
                {!loading && !error && constructionEstimate && (
                  <button
                    onClick={() => setShowLegacy((v) => !v)}
                    className="mb-2 text-[0.72rem] font-semibold text-primary-700/70 hover:text-primary-700 underline"
                  >
                    {showLegacy ? "← 새 견적서 폼으로" : "기존 상세표(공종/공간/부위/자재별) 보기"}
                  </button>
                )}
                {!loading && !error && constructionEstimate && !showLegacy && (
                  <div className="mb-3">
                    <EstimateProForm
                      lines={constructionEstimateToDetailLines(constructionEstimate)}
                      category="residential"
                      visionBadge="생성 디자인 Vision 분석 기반 견적"
                    />
                  </div>
                )}

                {/* P7-4: 공종별/공간별/부위별/자재별 보기 탭 (기존 상세표 — 토글 시) */}
                {(showLegacy || !constructionEstimate) && !loading && !error && (
                  <div className="mb-3 flex items-center gap-1 rounded-2xl border border-primary-100 bg-white p-1.5 shadow-sm">
                    {(
                      [
                        { v: "trade", label: "공종별", desc: "01~17 공종 실행내역서" },
                        { v: "room", label: "공간별", desc: "방별 합계" },
                        { v: "surface", label: "부위별", desc: "천장/바닥/벽" },
                        { v: "material", label: "자재별", desc: "자재 집계" },
                      ] as const
                    ).map((m) => {
                      const active = viewMode === m.v;
                      const disabled = !constructionEstimate && (m.v === "room" || m.v === "material");
                      return (
                        <button
                          key={m.v}
                          onClick={() => !disabled && setViewMode(m.v)}
                          disabled={disabled}
                          title={disabled ? "v2 견적 활성 시 사용 가능" : m.desc}
                          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                            active
                              ? "bg-primary-500 text-white shadow"
                              : disabled
                                ? "text-primary-900/30 cursor-not-allowed"
                                : "text-primary-900 hover:bg-primary-50"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* P7-FIX: constructionEstimate 없을 때 진단 안내 */}
                {!loading && !error && viewMode === "trade" && !constructionEstimate && (
                  <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3">
                    <p className="text-xs font-bold text-rose-800">
                      ⚠️ 17공종 견적 데이터 미생성
                    </p>
                    <p className="mt-1 text-[0.72rem] text-rose-800/80 leading-snug">
                      Step1에서 평형/면적이 누락됐거나 견적 빌드가 실패했습니다. 콘솔에서 `[estimate-v2]` 로그를 확인하세요.
                      <br />
                      "부위별" 탭을 클릭하면 기존 견적 표를 볼 수 있습니다.
                    </p>
                  </div>
                )}

                {/* P7-4: 공종별 견적 v2 — constructionEstimate가 있을 때 표시 */}
                {showLegacy && !loading && !error && viewMode === "trade" && constructionEstimate && (
                  <div className="mb-3 space-y-2">
                    {constructionEstimate.tradeSummaries.map((trade) => {
                      const lines = constructionEstimate.lines.filter(
                        (l) => l.tradeCode === trade.tradeCode,
                      );
                      return (
                        <section
                          key={trade.tradeCode}
                          className="rounded-2xl overflow-hidden border border-primary-100 bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
                            <span className="font-bold text-sm">
                              {trade.tradeCode}. {trade.tradeNameKo}
                              <span className="ml-2 text-[0.7rem] opacity-80">
                                · {trade.lineCount}건
                              </span>
                            </span>
                            <span className="font-black tabular text-sm">
                              ₩ {trade.totalAmount.toLocaleString()}
                            </span>
                          </div>
                          {/* 모바일: 가로 스크롤(고정 7열이 390px에서 잘리던 것 방지, M4). 웹은 그대로 */}
                          <div className="overflow-x-auto">
                          <div className="divide-y divide-primary-50 min-w-[560px]">
                            {lines.map((line) => {
                              const isExcluded = excludedV2Lines.has(line.id);
                              return (
                              <div
                                key={line.id}
                                className={`grid grid-cols-[28px_60px_120px_110px_1fr_90px_130px] gap-2 px-5 py-2.5 text-xs items-center ${
                                  isExcluded ? "opacity-50" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!isExcluded}
                                  onChange={() => toggleV2LineIncluded(line.id)}
                                  className="accent-primary-500"
                                  title="견적 포함/제외 토글"
                                />
                                <div className="text-primary-900/40 tabular">{line.sortNo}</div>
                                <div className="font-bold text-primary-700">
                                  {line.subTradeCode}
                                  <p className="text-[0.65rem] text-primary-900/60 font-normal mt-0.5">
                                    {line.subTradeNameKo}
                                  </p>
                                </div>
                                <div className="text-primary-900/80">{line.roomName}</div>
                                <div>
                                  <p className="font-bold text-primary-900">{line.taskNameKo}</p>
                                  <p className="text-[0.65rem] text-primary-900/55 mt-0.5">
                                    {line.itemNameKo}
                                    {line.spec ? ` · ${line.spec}` : ""}
                                  </p>
                                  {/* P12: 제조사/브랜드/SKU/단가출처 표시 — DB 매칭된 line만 */}
                                  {(line.brand || line.manufacturer || line.sku) && (
                                    <p className="text-[0.62rem] text-blue-700 mt-0.5 font-semibold">
                                      {line.manufacturer && `${line.manufacturer} · `}
                                      {line.brand}
                                      {line.sku && ` · SKU ${line.sku}`}
                                    </p>
                                  )}
                                  <p className="text-[0.62rem] text-primary-900/40 mt-0.5">
                                    산출: {line.quantityFormulaKo}
                                    {line.materialPriceSource && line.materialPriceSource !== "kpa_standard" && (
                                      <span className="ml-1 text-emerald-700">
                                        · 단가: {priceSourceLabel(line.materialPriceSource)}
                                      </span>
                                    )}
                                    {line.fallbackReason && (
                                      <span className="ml-1 text-rose-600" title={line.fallbackReason}>
                                        · ⚠️ 표준 fallback
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right tabular text-primary-900/80">
                                  {line.quantity.toLocaleString()} {line.unit === "m2" ? "m²" : line.unit}
                                </div>
                                <div className={`text-right tabular font-bold ${isExcluded ? "line-through text-primary-900/40" : "text-primary-900"}`}>
                                  ₩ {line.totalAmount.toLocaleString()}
                                  <p className="text-[0.6rem] text-primary-900/40 font-normal">
                                    재 {line.materialAmount.toLocaleString()} · 노{" "}
                                    {line.laborAmount.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                          </div>
                        </section>
                      );
                    })}
                    {/* P14-4: 제외 항목 합계 표시 + v2 재계산 totals */}
                    {adjustedV2 && adjustedV2.excludedCount > 0 && (
                      <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-zinc-700">
                          제외 {adjustedV2.excludedCount}건 ·{" "}
                          <span className="line-through">₩ {adjustedV2.excludedAmount.toLocaleString()}</span> 절감
                        </span>
                        <span className="text-sm font-bold text-primary-900 tabular">
                          조정 합계 ₩ {adjustedV2.totals.totalWithVat.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* P7-4: 공간별 보기 — constructionEstimate.roomSummaries */}
                {showLegacy && !loading && !error && viewMode === "room" && constructionEstimate && (
                  <div className="mb-3 rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                    <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40 mb-3">
                      공간별 합계
                    </p>
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-primary-100 text-primary-900/60 text-[0.7rem]">
                          <th className="py-2 text-left">공간</th>
                          <th className="py-2 text-right">재료비</th>
                          <th className="py-2 text-right">노무비</th>
                          <th className="py-2 text-right">경비</th>
                          <th className="py-2 text-right">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {constructionEstimate.roomSummaries.map((r) => (
                          <tr key={r.roomId} className="border-b border-primary-50">
                            <td className="py-2 font-bold text-primary-900">{r.roomName}</td>
                            <td className="py-2 text-right tabular">
                              ₩ {r.materialAmount.toLocaleString()}
                            </td>
                            <td className="py-2 text-right tabular">
                              ₩ {r.laborAmount.toLocaleString()}
                            </td>
                            <td className="py-2 text-right tabular">
                              ₩ {r.expenseAmount.toLocaleString()}
                            </td>
                            <td className="py-2 text-right tabular font-bold text-primary-900">
                              ₩ {r.totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {/* P7-4 + P12: 자재집계표 — 제조사/브랜드/SKU/단가출처 표시 */}
                {showLegacy && !loading && !error && viewMode === "material" && constructionEstimate && (
                  <div className="mb-3 rounded-2xl border border-primary-100 bg-white p-5 shadow-card overflow-x-auto">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                        자재집계표 ({constructionEstimate.materialSummary.length}건)
                      </p>
                      <p className="text-[0.6rem] text-primary-900/50">
                        제조사 / 브랜드 / 납품사 / SKU / 단가출처 표시
                      </p>
                    </div>
                    <table className="w-full text-[0.8rem] tabular">
                      <thead>
                        <tr className="border-b-2 border-primary-200 text-primary-900/60 text-[0.65rem] bg-primary-50/40">
                          <th className="px-2 py-2 text-left w-12">No</th>
                          <th className="px-2 py-2 text-left">분류</th>
                          <th className="px-2 py-2 text-left">자재명</th>
                          <th className="px-2 py-2 text-left">제조사/납품사</th>
                          <th className="px-2 py-2 text-left">SKU/규격</th>
                          <th className="px-2 py-2 text-right">수량</th>
                          <th className="px-2 py-2 text-right">단가</th>
                          <th className="px-2 py-2 text-right">금액</th>
                          <th className="px-2 py-2 text-left">단가출처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* P12: materialSummary는 brand/sku만 있어서 단가 정보 부족.
                             대신 constructionEstimate.lines를 자재별로 그룹화하여 단가출처 노출 */}
                        {(() => {
                          // 자재 키(brand+itemNameKo+spec)로 그룹화
                          const byMaterial = new Map<
                            string,
                            {
                              category: string;
                              brand?: string;
                              manufacturer?: string;
                              supplierName?: string;
                              itemNameKo: string;
                              sku?: string;
                              spec?: string;
                              unit: string;
                              totalQty: number;
                              totalAmount: number;
                              priceSource?: string;
                              fallbackReason?: string;
                            }
                          >();
                          for (const l of constructionEstimate.lines) {
                            if (!l.included || l.materialAmount <= 0) continue;
                            const key = [
                              l.brand ?? "",
                              l.manufacturer ?? "",
                              l.itemNameKo,
                              l.spec ?? "",
                              l.unit,
                            ].join("|");
                            let row = byMaterial.get(key);
                            if (!row) {
                              row = {
                                category: l.tradeNameKo,
                                brand: l.brand,
                                manufacturer: l.manufacturer,
                                supplierName: l.supplierName,
                                itemNameKo: l.itemNameKo,
                                sku: l.sku,
                                spec: l.spec ?? l.productSpec,
                                unit: l.unit,
                                totalQty: 0,
                                totalAmount: 0,
                                priceSource: l.materialPriceSource,
                                fallbackReason: l.fallbackReason,
                              };
                              byMaterial.set(key, row);
                            }
                            row.totalQty += l.quantity;
                            row.totalAmount += l.materialAmount;
                          }
                          const rows = Array.from(byMaterial.values()).sort(
                            (a, b) => b.totalAmount - a.totalAmount,
                          );
                          return rows.map((r, i) => (
                            <tr key={i} className="border-b border-primary-50">
                              <td className="px-2 py-2 text-primary-900/40 tabular">{i + 1}</td>
                              <td className="px-2 py-2 text-primary-700 text-[0.7rem]">
                                {r.category}
                              </td>
                              <td className="px-2 py-2 font-bold text-primary-900">
                                {r.brand ? `${r.brand} ` : ""}
                                {r.itemNameKo}
                              </td>
                              <td className="px-2 py-2 text-[0.7rem] text-primary-900/70">
                                {r.manufacturer || "-"}
                                {r.supplierName && (
                                  <p className="text-[0.62rem] text-primary-900/50">
                                    납품 {r.supplierName}
                                  </p>
                                )}
                              </td>
                              <td className="px-2 py-2 text-[0.7rem] text-primary-900/60 font-mono">
                                {r.sku ? `SKU ${r.sku}` : "-"}
                                {r.spec && (
                                  <p className="text-[0.62rem] text-primary-900/40">{r.spec}</p>
                                )}
                              </td>
                              <td className="px-2 py-2 text-right tabular">
                                {Math.round(r.totalQty * 10) / 10}{" "}
                                {r.unit === "m2" ? "m²" : r.unit}
                              </td>
                              <td className="px-2 py-2 text-right tabular text-primary-900/70">
                                ₩ {Math.round(r.totalAmount / r.totalQty).toLocaleString()}
                              </td>
                              <td className="px-2 py-2 text-right tabular font-bold text-primary-900">
                                ₩ {r.totalAmount.toLocaleString()}
                              </td>
                              <td className="px-2 py-2 text-[0.7rem]">
                                {r.priceSource ? (
                                  <span
                                    className={
                                      r.priceSource === "material_price_lookup" ||
                                      r.priceSource === "contractor_price"
                                        ? "text-emerald-700 font-semibold"
                                        : r.priceSource === "kpa_standard" ||
                                            r.priceSource === "category_standard"
                                          ? "text-rose-600"
                                          : "text-primary-700"
                                    }
                                    title={r.fallbackReason ?? ""}
                                  >
                                    {priceSourceLabel(r.priceSource)}
                                  </span>
                                ) : (
                                  <span className="text-primary-900/40">미확정</span>
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* P4: source 범례 — 각 견적 라인 출처 표시 가이드 */}
                {!loading && !error && tradeGroups.length > 0 && (
                  <div className="mb-3 rounded-2xl border border-primary-100 bg-white/80 px-4 py-2.5">
                    <p className="text-[0.65rem] font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      견적 라인 출처
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(
                        [
                          "user_selected_material",
                          "vision_confirmed_material",
                          "vision_recommended_material",
                          "prompt_extracted_material",
                          "scope_default_material",
                          "standard_fallback_material",
                        ] as LineSourceKind[]
                      ).map((s) => (
                        <EstimateSourceBadge key={s} source={s} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-primary-100 bg-white shadow-card overflow-hidden">
                  {loading && (
                    <div className="px-7 py-16 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                      <p className="mt-3 text-sm font-semibold text-primary-900">
                        견적 분석 중…
                      </p>
                      <p className="mt-1 text-xs text-primary-900/50">
                        실별 자재·물량·단가 산출 중 (약 5–10초 / 실)
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
                          onClick={goBackToDesign}
                          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white px-4 py-2 text-xs font-semibold text-primary-900 hover:bg-primary-50"
                        >
                          디자인으로 돌아가기
                        </button>
                        <button
                          onClick={goBackToDesign}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-xs font-semibold text-white shadow-cta hover:bg-primary-600"
                        >
                          Step2로 돌아가서 디자인 생성하기 <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* P7-4: 부위별 보기는 viewMode="surface"일 때만 (legacy 호환).
                       v2 견적 미사용 시 기본으로 표시. */}
                  {!loading &&
                    !error &&
                    tradeGroups.length > 0 &&
                    ((viewMode === "surface" && showLegacy) || !constructionEstimate) && (
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
                              onShop={setShopMaterial}
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

                  {/* P5: design_outputs(DB) + step2.rendersByRoom(sessionStorage) 합쳐서 표시.
                       - DB 우선 (analysis status 함께 표시)
                       - sessionStorage는 DB에 없는 것만 보강
                       - 빈 이미지 카드는 null 처리 */}
                  {(() => {
                    type GalleryItem = {
                      key: string;
                      imageUrl: string;
                      label: string;
                      status?: string;
                    };
                    const items: GalleryItem[] = [];
                    const seenUrls = new Set<string>();
                    // DB design_outputs 우선
                    for (const o of designOutputsForGallery) {
                      if (seenUrls.has(o.imageUrl)) continue;
                      seenUrls.add(o.imageUrl);
                      items.push({
                        key: `db-${o.id}`,
                        imageUrl: o.imageUrl,
                        label: o.targetName,
                        status: o.status,
                      });
                    }
                    // sessionStorage rendersByRoom 보강 — 모든 렌더 항목을 가져옴 (selected 1개만 X)
                    if (step2) {
                      for (const [roomKey, list] of Object.entries(step2.rendersByRoom || {})) {
                        for (const r of list ?? []) {
                          const url = r.refinedUrl || r.url;
                          if (!url || seenUrls.has(url)) continue;
                          seenUrls.add(url);
                          items.push({
                            key: `ss-${roomKey}-${url.slice(-20)}`,
                            imageUrl: url,
                            label: ROOM_NAME_MAP[roomKey] || roomKey,
                          });
                        }
                      }
                    }
                    if (items.length === 0) return null;
                    return (
                      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[0.7rem] font-bold uppercase tracking-widest text-primary-900/40">
                            분석된 디자인 · {items.length}건
                          </p>
                          {designOutputsForGallery.length === 0 && (
                            <span
                              className="text-[0.6rem] text-amber-700"
                              title="design_outputs DB 미수신 — 로그인 또는 마이그레이션 확인 필요"
                            >
                              로컬만
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {items.map((it) => (
                            <div
                              key={it.key}
                              className="relative aspect-square rounded-lg overflow-hidden border border-primary-100"
                            >
                              <img
                                src={it.imageUrl}
                                alt={it.label}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[0.6rem] font-bold p-1 text-center">
                                {it.label}
                              </span>
                              {it.status === "analysis_pending" && (
                                <span className="absolute top-1 right-1 inline-flex items-center rounded-full bg-blue-500/90 text-white text-[0.65rem] font-bold px-1.5 py-0.5">
                                  분석중
                                </span>
                              )}
                              {it.status === "analysis_done" && (
                                <span className="absolute top-1 right-1 inline-flex items-center rounded-full bg-emerald-500/90 text-white text-[0.65rem] font-bold px-1.5 py-0.5">
                                  완료
                                </span>
                              )}
                              {it.status === "analysis_failed" && (
                                <span className="absolute top-1 right-1 inline-flex items-center rounded-full bg-rose-500/90 text-white text-[0.65rem] font-bold px-1.5 py-0.5">
                                  실패
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary-600" />
                      <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                        건축공사 견적서
                      </p>
                    </div>
                    <p className="mt-2 text-[0.78rem] leading-relaxed text-primary-900/60">
                      베타테스트 — 현재 자체 검증 업체를 선별 중에 있습니다. 해당 견적서를 다운받아 진행 가능한 업체에 세부 견적 의뢰를 맡기세요.
                    </p>
                    <button
                      type="button"
                      disabled={pdfDownloading}
                      onClick={async () => {
                        // pricing v2: 다운로드 직전 권한 체크
                        try {
                          setPdfDownloading(true);
                          const queryProjectId =
                            typeof window !== "undefined"
                              ? new URLSearchParams(window.location.search).get("projectId")
                              : null;
                          const projectId =
                            queryProjectId ||
                            getOrCreateWorkflowProjectId() ||
                            "preview";
                          // 권한 체크
                          const accessRes = await fetch(
                            `/api/estimate-pdf/check-access?consumerProjectId=${encodeURIComponent(projectId)}`,
                          );
                          if (accessRes.status === 401) {
                            alert("PDF 다운로드는 로그인 후 가능합니다.");
                            return;
                          }
                          const access = (await accessRes.json()) as {
                            granted: boolean;
                            entitlementId?: string;
                            reason?: string;
                          };
                          if (!access.granted) {
                            setPdfPurchaseOpen(true);
                            return;
                          }
                          await downloadEstimatePdf({
                            projectId,
                            entitlementId: access.entitlementId,
                            step1,
                            estimates,
                            grandTotal,
                            matchMetaByRoom,
                            constructionEstimate,
                            designImages: designOutputsForGallery.map((o) => ({
                              url: o.imageUrl,
                              label: o.targetName,
                            })),
                          });
                        } catch (e) {
                          console.error("[estimate] PDF download failed:", e);
                          alert("PDF 생성 실패: " + (e instanceof Error ? e.message : String(e)));
                        } finally {
                          setPdfDownloading(false);
                        }
                      }}
                      className="mt-3 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-95 transition disabled:opacity-50"
                    >
                      {pdfDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      견적서 PDF 다운로드 (9,900원)
                    </button>
                    <p className="mt-2 text-[0.65rem] text-primary-900/50 text-center">
                      건축공사 업체용 형식 (갑지 / 총괄표 / 총괄내역 / 공종별)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      className="mt-2 inline-flex items-center justify-center gap-2 w-full rounded-xl border border-[#E5E2DD] bg-white px-4 py-2 text-[0.78rem] font-semibold text-[#202123] transition hover:bg-[#F7F7F5]"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      커뮤니티에 견적 공유 (무료)
                    </button>
                    <p className="mt-1 text-[0.65rem] text-[#9A9A9A] text-center">
                      개인정보 자동 제거 · 검증 사업자 의견 받기
                    </p>
                  </div>

                  {/* P5: 산정 근거를 실제 라인 source 통계로 동적 표시 (사기 표시 방지) */}
                  {(() => {
                    // 모든 라인에서 source 카운트
                    const sourceCounts: Record<LineSourceKind, number> = {
                      user_selected_material: 0,
                      vision_confirmed_material: 0,
                      vision_recommended_material: 0,
                      prompt_extracted_material: 0,
                      scope_default_material: 0,
                      standard_fallback_material: 0,
                    };
                    let totalLines = 0;
                    for (const g of tradeGroups) {
                      for (const row of g.rows) {
                        totalLines++;
                        if (row.source) sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
                        else sourceCounts.standard_fallback_material++;
                      }
                    }
                    const pct = (n: number) =>
                      totalLines > 0 ? Math.round((n / totalLines) * 100) : 0;
                    const visionTotal =
                      sourceCounts.vision_confirmed_material + sourceCounts.vision_recommended_material;
                    const standardTotal = sourceCounts.standard_fallback_material;
                    const userTotal = sourceCounts.user_selected_material;
                    const promptTotal = sourceCounts.prompt_extracted_material;
                    const scopeTotal = sourceCounts.scope_default_material;
                    // 현재 견적 신뢰도 레벨
                    const trustLevel =
                      visionTotal > totalLines * 0.5
                        ? "high"
                        : visionTotal > 0 || promptTotal > 0
                          ? "medium"
                          : "low";
                    return (
                      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                          <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">
                            산정 근거 ({totalLines}건 라인)
                          </p>
                        </div>
                        {/* P5: 진단 — 현재 산출 경로 */}
                        <div className="mb-3 rounded-lg bg-primary-50/50 px-3 py-2">
                          <p className="text-[0.7rem] font-bold text-primary-900 mb-0.5">
                            현재 산출 경로:
                          </p>
                          <p className="text-[0.7rem] text-primary-900/70">
                            {estimatePath.path === "context_evidence" && (
                              <>
                                ✅ <b>Evidence 기반</b> ({estimatePath.estimateLevel ?? "L1"})
                                <br />
                                <span className="text-[0.65rem]">design_outputs + 자재분석 결과 활용</span>
                              </>
                            )}
                            {estimatePath.path === "legacy_vision" && (
                              <>
                                🟡 <b>Legacy Vision</b>
                                <br />
                                <span className="text-[0.65rem]">이미지 1차 분석 + 표준자재 혼합</span>
                              </>
                            )}
                            {estimatePath.path === "legacy_standard" && (
                              <>
                                ⚠️ <b>표준자재 폴백</b>
                                <br />
                                <span className="text-[0.65rem]">이미지 분석 결과 미반영 — 로그인/마이그레이션 확인 필요</span>
                              </>
                            )}
                          </p>
                        </div>
                        {/* P5: 실제 라인 source 분포 — 사기 표시 방지 */}
                        {totalLines > 0 && (
                          <div className="mb-3">
                            <p className="text-[0.7rem] font-bold text-primary-900 mb-1.5">
                              자재 출처 분포
                            </p>
                            <ul className="space-y-0.5 text-[0.7rem] text-primary-900/70">
                              {userTotal > 0 && (
                                <li>
                                  · <span className="text-emerald-700 font-bold">사용자 확정</span>{" "}
                                  {userTotal}건 ({pct(userTotal)}%)
                                </li>
                              )}
                              {visionTotal > 0 && (
                                <li>
                                  · <span className="text-blue-700 font-bold">이미지 분석</span>{" "}
                                  {visionTotal}건 ({pct(visionTotal)}%)
                                </li>
                              )}
                              {promptTotal > 0 && (
                                <li>
                                  · <span className="text-amber-700 font-bold">디자인 설명 기반</span>{" "}
                                  {promptTotal}건 ({pct(promptTotal)}%)
                                </li>
                              )}
                              {scopeTotal > 0 && (
                                <li>
                                  · <span className="text-stone-700 font-bold">Scope 기본값</span>{" "}
                                  {scopeTotal}건 ({pct(scopeTotal)}%)
                                </li>
                              )}
                              {standardTotal > 0 && (
                                <li>
                                  · <span className="text-rose-700 font-bold">표준 기본값</span>{" "}
                                  {standardTotal}건 ({pct(standardTotal)}%)
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                        <ul className="space-y-1 text-[0.72rem] text-primary-900/70 leading-relaxed">
                          <li>
                            · <b>주자재 단가</b>: 한국물가협회 단가 (2026 Q1)
                          </li>
                          <li>
                            · <b>부자재</b>: 주자재의 10%
                          </li>
                          <li>
                            · <b>노무비</b>: 국토부 표준품셈 일위대가
                          </li>
                          <li>
                            · <b>경비</b>: (재료비 + 노무비) × 비율 (기본 3%)
                          </li>
                          <li>
                            · <b>VAT</b>: 10%
                          </li>
                        </ul>
                        <p
                          className={`mt-2 text-[0.7rem] font-bold ${
                            trustLevel === "high"
                              ? "text-emerald-700"
                              : trustLevel === "medium"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }`}
                        >
                          {trustLevel === "high" &&
                            "🟢 이미지 분석 기반 — 정밀도 높음"}
                          {trustLevel === "medium" &&
                            "🟡 부분 분석 적용 — 추가 자재 선택 권장"}
                          {trustLevel === "low" &&
                            "🔴 표준값 기반 가견적 — Step2에서 이미지 생성/자재 선택 시 정밀 산출"}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
      <EstimateShareModal
        open={shareModalOpen}
        projectId={
          (typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("projectId")
            : null) ||
          getOrCreateWorkflowProjectId() ||
          ""
        }
        estimateContextId={resolvedContextId ?? undefined}
        hints={{
          areaLabel: step1?.basicInfo?.selectedPyeong?.exclusiveArea
            ? `${Math.round((step1.basicInfo.selectedPyeong.exclusiveArea / 3.3058) / 10) * 10}평대`
            : undefined,
          regionLabel: step1?.basicInfo?.selectedAddress?.roadAddress?.split(/\s+/).slice(0, 2).join(" "),
          buildingType: "아파트",
        }}
        onClose={() => setShareModalOpen(false)}
      />
      <MaterialShopDrawer materialName={shopMaterial} onClose={() => setShopMaterial(null)} />
      <EstimatePdfPurchaseModal
        open={pdfPurchaseOpen}
        consumerProjectId={
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("projectId") ||
              getOrCreateWorkflowProjectId() ||
              null
            : null
        }
        onClose={() => setPdfPurchaseOpen(false)}
        onPaid={async ({ entitlementId }) => {
          setPdfPurchaseOpen(false);
          // 결제 완료 → 즉시 다운로드
          const projectId =
            (typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("projectId")
              : null) ||
            getOrCreateWorkflowProjectId() ||
            "preview";
          setPdfDownloading(true);
          try {
            await downloadEstimatePdf({
              projectId,
              entitlementId,
              step1,
              estimates,
              grandTotal,
              matchMetaByRoom,
              constructionEstimate,
              designImages: designOutputsForGallery.map((o) => ({
                url: o.imageUrl,
                label: o.targetName,
              })),
            });
          } finally {
            setPdfDownloading(false);
          }
        }}
      />
    </LenisProvider>
  );
}

function TradeGroup({
  trade,
  rows,
  groupTotal,
  excluded,
  onToggle,
  onShop,
}: {
  trade: string;
  rows: ConsolidatedRow[];
  groupTotal: number;
  excluded: Set<string>;
  onToggle: (key: string) => void;
  onShop?: (materialName: string) => void;
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
                <button
                  type="button"
                  onClick={() => onShop?.(r.materialName)}
                  className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-bold text-primary-600 hover:text-primary-700"
                >
                  <ShoppingBag className="h-3 w-3" /> 자재·구매 보기
                </button>
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
                  {/* P4: 통합 source 배지 — 한 눈에 "이 가격이 어디서 왔는지" */}
                  {r.source ? (
                    <EstimateSourceBadge source={r.source} confidence={r.confidence} />
                  ) : (
                    <>
                      {/* P4 폴백: source 없으면 legacy matchStatus 배지 유지 */}
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
                    </>
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
