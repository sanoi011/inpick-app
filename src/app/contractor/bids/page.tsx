/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  FileText,
  Gavel,
  ImageIcon,
  ListFilter,
  Loader2,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import { toast } from "@/components/ui/Toast";
import type { CostItem, RoomCostSection } from "@/components/project/CostTable";
import DesignGalleryModal, {
  type DesignRender,
} from "@/components/contractor/DesignGalleryModal";

const CostTable = dynamic(() => import("@/components/project/CostTable"), {
  loading: () => (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

const ConstructionEstimateV2Panel = dynamic(
  () => import("@/components/contractor/ConstructionEstimateV2Panel"),
  { loading: () => null },
);

type TabValue = "available" | "my_bids" | "selected" | "rejected";

interface MyBid {
  id: string;
  estimate_id: string;
  bid_amount: number;
  discount_rate: number | null;
  estimated_days: number;
  start_available_date: string | null;
  message: string | null;
  status: "pending" | "selected" | "rejected" | string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface RfqData {
  publishedAt?: string;
  deadlineAt?: string;
  preferredStart?: string;
  preferredDuration?: string;
  visitPreference?: string;
  notes?: string;
  drawingOptions: string[];
  comparisonFields: string[];
  addressVisibility?: string;
  shortlistSize: number;
  matchingRank?: number;
  designRenders: DesignRender[];
}

interface RfqNotice {
  id: string;
  notice_no: string;
  title: string;
  status: string;
  project_type?: string;
  space_type: string;
  total_area_m2: number;
  budget_won: number;
  region: { sido: string; gugun: string; label: string };
  consumer_project_id?: string;
  created_at: string;
  updated_at: string;
  rfq_data: RfqData;
  my_bid: MyBid | null;
}

interface EstimateItemRow {
  id: string;
  space_name?: string;
  item_name?: string;
  unit?: string;
  quantity?: number;
  material_cost?: number;
  labor_cost?: number;
  overhead_cost?: number;
  subtotal?: number;
}

const TAB_FILTERS: Array<{ value: TabValue; label: string }> = [
  { value: "available", label: "맞춤 공고" },
  { value: "my_bids", label: "참여 중" },
  { value: "selected", label: "선정" },
  { value: "rejected", label: "종료" },
];

const SPACE_TYPES = ["전체", "주거", "상업", "아파트", "사무실", "상가"];

const BUDGET_RANGES = [
  { value: "", label: "전체 예산" },
  { value: "0-30000000", label: "3천만원 이하" },
  { value: "30000000-50000000", label: "3천만~5천만원" },
  { value: "50000000-100000000", label: "5천만~1억원" },
  { value: "100000000-", label: "1억원 이상" },
];

const DRAWING_LABELS: Record<string, string> = {
  floor_plan_cleanup: "정리 도면",
  elevation: "입면도",
  reflected_ceiling: "천장도",
  electrical: "전기도",
  material_schedule: "자재표",
};

const money = (value: number) => Math.round(value || 0).toLocaleString("ko-KR");

function normalizeInitialTab(value: string | null): TabValue {
  if (value === "mine") return "my_bids";
  if (value === "result") return "selected";
  if (value === "my_bids" || value === "selected" || value === "rejected") return value;
  return "available";
}

function deadlineInfo(value?: string) {
  if (!value) return { label: "마감 협의", days: Number.POSITIVE_INFINITY, expired: false };
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    return { label: "마감 협의", days: Number.POSITIVE_INFINITY, expired: false };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  return {
    label: days < 0 ? "마감" : days === 0 ? "오늘 마감" : `D-${days}`,
    days,
    expired: days < 0,
  };
}

function budgetMatches(value: number, range: string): boolean {
  if (!range) return true;
  const [minimum, maximum] = range.split("-");
  const min = Number(minimum || 0);
  const max = maximum ? Number(maximum) : Number.POSITIVE_INFINITY;
  return value >= min && value <= max;
}

function bidStatusLabel(status?: string) {
  if (status === "selected") return "선정됨";
  if (status === "rejected") return "종료";
  return "검토 중";
}

export default function ContractorBidsPage() {
  return (
    <Suspense fallback={<BidPageFallback />}>
      <ContractorBidsContent />
    </Suspense>
  );
}

function ContractorBidsContent() {
  const searchParams = useSearchParams();
  const { contractorId, authChecked, authFetch } = useContractorAuth();
  const detailRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabValue>(() => normalizeInitialTab(searchParams.get("tab")));
  const [notices, setNotices] = useState<RfqNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [spaceType, setSpaceType] = useState("전체");
  const [budgetRange, setBudgetRange] = useState("");
  const [deadlineOnly, setDeadlineOnly] = useState(false);
  const [sort, setSort] = useState<"recommended" | "deadline" | "newest" | "budget">("recommended");
  const [galleryNotice, setGalleryNotice] = useState<RfqNotice | null>(null);
  const [estimateItems, setEstimateItems] = useState<Map<string, RoomCostSection[]>>(new Map());
  const [editedEstimates, setEditedEstimates] = useState<Map<string, RoomCostSection[]>>(new Map());
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [showEstimateDetail, setShowEstimateDetail] = useState<string | null>(null);
  const [bidFormId, setBidFormId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bidForm, setBidForm] = useState({
    bidAmount: "",
    estimatedDays: "30",
    startAvailableDate: "",
    warrantyMonths: "12",
    highlights: "",
    message: "",
  });

  const loadData = useCallback(async () => {
    if (!contractorId) return;
    setLoading(true);
    try {
      const response = await authFetch("/api/contractor/rfqs", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "공고 조회 실패");
      setNotices(data.rfqs || []);
    } catch (error) {
      toast({
        type: "error",
        title: "공고를 불러오지 못했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요",
      });
    } finally {
      setLoading(false);
    }
  }, [authFetch, contractorId]);

  useEffect(() => {
    if (authChecked && contractorId) void loadData();
  }, [authChecked, contractorId, loadData]);

  useEffect(() => {
    setTab(normalizeInitialTab(searchParams.get("tab")));
  }, [searchParams]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      available: notices.filter(
        (notice) =>
          !notice.my_bid &&
          (!notice.rfq_data.deadlineAt || new Date(notice.rfq_data.deadlineAt).getTime() >= now),
      ).length,
      urgent: notices.filter((notice) => {
        const deadline = deadlineInfo(notice.rfq_data.deadlineAt);
        return !notice.my_bid && deadline.days >= 0 && deadline.days <= 3;
      }).length,
      active: notices.filter((notice) => notice.my_bid?.status === "pending").length,
      selected: notices.filter((notice) => notice.my_bid?.status === "selected").length,
    };
  }, [notices]);

  const filteredNotices = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = notices.filter((notice) => {
      const deadline = deadlineInfo(notice.rfq_data.deadlineAt);
      const tabMatches =
        tab === "available"
          ? !notice.my_bid && !deadline.expired
          : tab === "my_bids"
            ? notice.my_bid?.status === "pending"
            : tab === "selected"
              ? notice.my_bid?.status === "selected"
              : notice.my_bid?.status === "rejected" || deadline.expired;
      if (!tabMatches) return false;
      if (
        normalizedKeyword &&
        !`${notice.notice_no} ${notice.title} ${notice.region.label} ${notice.space_type}`
          .toLowerCase()
          .includes(normalizedKeyword)
      ) return false;
      if (spaceType !== "전체" && !notice.space_type.includes(spaceType)) return false;
      if (!budgetMatches(notice.budget_won, budgetRange)) return false;
      if (deadlineOnly && !(deadline.days >= 0 && deadline.days <= 3)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "deadline") {
        return deadlineInfo(a.rfq_data.deadlineAt).days - deadlineInfo(b.rfq_data.deadlineAt).days;
      }
      if (sort === "newest") {
        return new Date(b.rfq_data.publishedAt || b.created_at).getTime() - new Date(a.rfq_data.publishedAt || a.created_at).getTime();
      }
      if (sort === "budget") return b.budget_won - a.budget_won;
      return (a.rfq_data.matchingRank || 99) - (b.rfq_data.matchingRank || 99) ||
        deadlineInfo(a.rfq_data.deadlineAt).days - deadlineInfo(b.rfq_data.deadlineAt).days;
    });
  }, [budgetRange, deadlineOnly, keyword, notices, sort, spaceType, tab]);

  useEffect(() => {
    if (!filteredNotices.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredNotices.some((notice) => notice.id === selectedId)) {
      setSelectedId(filteredNotices[0].id);
    }
  }, [filteredNotices, selectedId]);

  const selected = filteredNotices.find((notice) => notice.id === selectedId) || null;

  const selectNotice = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const loadEstimateItems = useCallback(async (estimateId: string) => {
    if (estimateItems.has(estimateId)) {
      setShowEstimateDetail((current) => (current === estimateId ? null : estimateId));
      return;
    }
    setLoadingItems(estimateId);
    try {
      const response = await authFetch(`/api/contractor/rfqs/${estimateId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "상세 견적 조회 실패");
      const rows = (data.estimate?.estimate_items || []) as EstimateItemRow[];
      const roomMap = new Map<string, CostItem[]>();
      for (const row of rows) {
        const roomName = row.space_name || "공통";
        const nameParts = (row.item_name || "").split(" - ");
        if (!roomMap.has(roomName)) roomMap.set(roomName, []);
        roomMap.get(roomName)!.push({
          id: row.id,
          category: nameParts[0] || "기타",
          part: nameParts[1] || "",
          productName: nameParts[2] || row.item_name || "공사 항목",
          method: "시공",
          spec: "",
          unit: row.unit || "식",
          quantity: Number(row.quantity || 1),
          materialCost: Number(row.material_cost || 0),
          laborCost: Number(row.labor_cost || 0),
          overhead: Number(row.overhead_cost || 0),
          total: Number(row.subtotal || 0),
        });
      }
      const sections = Array.from(roomMap.entries()).map(([roomName, items]) => ({
        roomName,
        items,
        subtotal: items.reduce((sum, item) => sum + item.total, 0),
      }));
      setEstimateItems((current) => new Map(current).set(estimateId, sections));
      setShowEstimateDetail(estimateId);
    } catch (error) {
      toast({
        type: "error",
        title: "상세 견적을 불러오지 못했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요",
      });
    } finally {
      setLoadingItems(null);
    }
  }, [authFetch, estimateItems]);

  const handleEditPrice = useCallback((
    estimateId: string,
    sectionName: string,
    itemId: string,
    field: "materialCost" | "laborCost",
    value: number,
  ) => {
    const base = editedEstimates.get(estimateId) || estimateItems.get(estimateId) || [];
    const updated = base.map((section) => {
      if (section.roomName !== sectionName) return section;
      const items = section.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, [field]: Math.max(0, value) };
        next.overhead = Math.round((next.materialCost + next.laborCost) * 0.1);
        next.total = next.materialCost + next.laborCost + next.overhead;
        return next;
      });
      return { ...section, items, subtotal: items.reduce((sum, item) => sum + item.total, 0) };
    });
    setEditedEstimates((current) => new Map(current).set(estimateId, updated));
  }, [editedEstimates, estimateItems]);

  const customTotal = useCallback((estimateId: string) => {
    const sections = editedEstimates.get(estimateId) || estimateItems.get(estimateId) || [];
    return sections.reduce((sum, section) => sum + section.subtotal, 0);
  }, [editedEstimates, estimateItems]);

  const openBidForm = (notice: RfqNotice) => {
    setBidFormId(notice.id);
    const editedTotal = customTotal(notice.id);
    setBidForm((current) => ({
      ...current,
      bidAmount: String(editedTotal || notice.budget_won || ""),
    }));
  };

  const handleSubmitBid = async (notice: RfqNotice) => {
    if (!bidForm.bidAmount || submitting) return;
    setSubmitting(true);
    try {
      const editedSections = editedEstimates.get(notice.id);
      const customEstimate = editedSections
        ? {
            items: editedSections.flatMap((section) =>
              section.items.map((item) => ({
                itemId: item.id,
                roomName: section.roomName,
                category: item.category,
                productName: item.productName,
                materialCost: item.materialCost,
                laborCost: item.laborCost,
                overhead: item.overhead,
                total: item.total,
              })),
            ),
            grandTotal: editedSections.reduce((sum, section) => sum + section.subtotal, 0),
          }
        : undefined;

      const response = await authFetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: notice.id,
          bidAmount: Number(bidForm.bidAmount),
          estimatedDays: Number(bidForm.estimatedDays) || 30,
          startAvailableDate: bidForm.startAvailableDate || null,
          message: bidForm.message.trim() || null,
          metadata: {
            highlights: bidForm.highlights.split(",").map((value) => value.trim()).filter(Boolean),
            warranty_months: Number(bidForm.warrantyMonths) || 12,
            ...(customEstimate ? { customEstimate } : {}),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "입찰 제출 실패");
      toast({
        type: "success",
        title: "입찰서를 제출했습니다",
        message: "고객이 동일 기준으로 비교한 뒤 결과를 알려드립니다.",
      });
      setBidFormId(null);
      setBidForm({
        bidAmount: "",
        estimatedDays: "30",
        startAvailableDate: "",
        warrantyMonths: "12",
        highlights: "",
        message: "",
      });
      await loadData();
      setTab("my_bids");
    } catch (error) {
      toast({
        type: "error",
        title: "입찰서를 제출하지 못했습니다",
        message: error instanceof Error ? error.message : "입력 내용을 확인해주세요",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setKeyword("");
    setSpaceType("전체");
    setBudgetRange("");
    setDeadlineOnly(false);
    setSort("recommended");
  };

  if (!authChecked) return null;

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 pb-16 pt-7 text-black sm:px-6 sm:pt-10 lg:px-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-black/35">INPICK BID BOARD</p>
          <h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[38px]">
            맞춤 입찰 공고
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/48">
            시공 지역과 예산에 맞는 공고만 모았습니다. 공고를 선택하면 디자인, 공사 조건과 세부 견적을 한 화면에서 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.09] bg-white px-4 text-xs font-bold transition hover:bg-black hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 새로고침
          </button>
          <Link
            href="/contractor/profile"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-4 text-xs font-bold text-white transition hover:bg-black/80"
          >
            업체 정보 확인 <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section className="mt-7 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="새 맞춤 공고" value={counts.available} detail="입찰 가능" />
        <MetricCard label="마감 임박" value={counts.urgent} detail="3일 이내" />
        <MetricCard label="참여 중" value={counts.active} detail="고객 검토 중" />
        <MetricCard label="선정" value={counts.selected} detail="계약 진행 가능" />
      </section>

      <section className="mt-6 rounded-[24px] border border-black/[0.07] bg-white p-3 shadow-[0_16px_50px_rgba(0,0,0,0.035)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="공고번호, 지역 또는 공간 유형 검색"
              className="h-11 w-full rounded-full bg-[#f5f5f3] pl-11 pr-4 text-sm outline-none transition placeholder:text-black/30 focus:bg-white focus:ring-1 focus:ring-black/20"
            />
          </div>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 xl:pb-0">
            {TAB_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`h-10 shrink-0 rounded-full px-4 text-xs font-bold transition ${
                  tab === item.value ? "bg-black text-white" : "text-black/50 hover:bg-[#f5f5f3] hover:text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-xs font-bold transition ${
              showFilters ? "border-black bg-black text-white" : "border-black/[0.09] bg-white hover:bg-[#f5f5f3]"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> 상세 필터
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-2 border-t border-black/[0.06] pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect value={spaceType} onChange={setSpaceType} options={SPACE_TYPES.map((value) => ({ value, label: value === "전체" ? "전체 공간" : value }))} />
            <FilterSelect value={budgetRange} onChange={setBudgetRange} options={BUDGET_RANGES} />
            <FilterSelect
              value={sort}
              onChange={(value) => setSort(value as typeof sort)}
              options={[
                { value: "recommended", label: "추천순" },
                { value: "deadline", label: "마감 임박순" },
                { value: "newest", label: "최신순" },
                { value: "budget", label: "예산 높은순" },
              ]}
            />
            <button
              type="button"
              onClick={() => setDeadlineOnly((current) => !current)}
              className={`h-11 rounded-2xl border px-4 text-left text-xs font-bold transition ${
                deadlineOnly ? "border-black bg-black text-white" : "border-black/[0.08] bg-white hover:border-black/20"
              }`}
            >
              3일 이내 마감만
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl text-xs font-bold text-black/45 transition hover:bg-[#f5f5f3] hover:text-black"
            >
              <X className="h-3.5 w-3.5" /> 필터 초기화
            </button>
          </div>
        )}
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[430px_minmax(0,1fr)] xl:grid-cols-[470px_minmax(0,1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-xs font-bold text-black/50">공고 {filteredNotices.length}건</p>
            <p className="inline-flex items-center gap-1 text-[11px] text-black/35">
              <ShieldCheck className="h-3 w-3" /> 인증·지역·예산 매칭
            </p>
          </div>

          {loading ? (
            <NoticeSkeleton />
          ) : filteredNotices.length === 0 ? (
            <EmptyNotice tab={tab} onReset={resetFilters} />
          ) : (
            <div className="space-y-2.5">
              {filteredNotices.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  selected={notice.id === selectedId}
                  onClick={() => selectNotice(notice.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section ref={detailRef} className="scroll-mt-24 lg:sticky lg:top-24">
          {selected ? (
            <NoticeDetail
              notice={selected}
              estimateSections={editedEstimates.get(selected.id) || estimateItems.get(selected.id) || []}
              estimateLoaded={estimateItems.has(selected.id)}
              estimateVisible={showEstimateDetail === selected.id}
              estimateLoading={loadingItems === selected.id}
              estimateEdited={editedEstimates.has(selected.id)}
              customTotal={customTotal(selected.id)}
              bidFormOpen={bidFormId === selected.id}
              bidForm={bidForm}
              submitting={submitting}
              onBidFormChange={setBidForm}
              onToggleEstimate={() => void loadEstimateItems(selected.id)}
              onEditPrice={(sectionName, itemId, field, value) =>
                handleEditPrice(selected.id, sectionName, itemId, field, value)
              }
              onOpenGallery={() => setGalleryNotice(selected)}
              onOpenBid={() => openBidForm(selected)}
              onCloseBid={() => setBidFormId(null)}
              onSubmitBid={() => void handleSubmitBid(selected)}
            />
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-black/[0.07] bg-white text-center">
              <div>
                <ListFilter className="mx-auto h-7 w-7 text-black/20" />
                <p className="mt-3 text-sm font-bold">확인할 공고를 선택해주세요</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <DesignGalleryModal
        open={Boolean(galleryNotice)}
        onClose={() => setGalleryNotice(null)}
        renders={galleryNotice?.rfq_data.designRenders || []}
        projectTitle={galleryNotice?.title}
      />
    </main>
  );
}

function BidPageFallback() {
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-4 w-32 animate-pulse rounded-full bg-black/[0.06]" />
      <div className="mt-4 h-10 w-64 animate-pulse rounded-2xl bg-black/[0.06]" />
      <div className="mt-10 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[20px] bg-white" />)}
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-[20px] border border-black/[0.07] bg-white px-4 py-4 sm:px-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-black/40">{label}</p>
          <p className="mt-2 text-[26px] font-medium tracking-[-0.05em]">{value}</p>
        </div>
        <span className="mb-1 text-[10px] text-black/30">{detail}</span>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-2xl border border-black/[0.08] bg-white px-4 text-xs font-bold outline-none focus:border-black/25"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function NoticeCard({
  notice,
  selected,
  onClick,
}: {
  notice: RfqNotice;
  selected: boolean;
  onClick: () => void;
}) {
  const deadline = deadlineInfo(notice.rfq_data.deadlineAt);
  const thumbnail = notice.rfq_data.designRenders[0]?.refinedUrl || notice.rfq_data.designRenders[0]?.url;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full overflow-hidden rounded-[22px] border bg-white text-left transition ${
        selected
          ? "border-black shadow-[0_18px_50px_rgba(0,0,0,0.08)]"
          : "border-black/[0.07] hover:border-black/20 hover:shadow-[0_12px_35px_rgba(0,0,0,0.045)]"
      }`}
    >
      <div className="flex gap-3 p-4 sm:p-5">
        {thumbnail ? (
          <img src={thumbnail} alt="AI 디자인 시안" className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#f1f1ef] sm:h-24 sm:w-24">
            <FileText className="h-5 w-5 text-black/25" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${deadline.expired ? "bg-black/[0.05] text-black/40" : "bg-black text-white"}`}>
              {deadline.label}
            </span>
            {notice.rfq_data.matchingRank && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-black/40">
                <Sparkles className="h-3 w-3" /> 맞춤 {notice.rfq_data.matchingRank}순위
              </span>
            )}
            {notice.my_bid && (
              <span className="ml-auto text-[10px] font-bold text-black/45">{bidStatusLabel(notice.my_bid.status)}</span>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-bold tracking-[-0.02em] sm:text-[15px]">{notice.title}</p>
          <p className="mt-1 truncate text-[11px] text-black/38">{notice.notice_no}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/48">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{notice.region.label}</span>
            <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3" />{notice.total_area_m2 ? `${Math.round(notice.total_area_m2)}㎡` : "면적 협의"}</span>
          </div>
        </div>
        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition ${selected ? "text-black" : "text-black/20"}`} />
      </div>
      <div className="flex items-center justify-between border-t border-black/[0.05] px-4 py-3 sm:px-5">
        <span className="text-[10px] font-bold text-black/35">고객 예산</span>
        <span className="text-sm font-black">{notice.budget_won ? `${money(notice.budget_won)}원` : "협의"}</span>
      </div>
    </button>
  );
}

function NoticeDetail({
  notice,
  estimateSections,
  estimateLoaded,
  estimateVisible,
  estimateLoading,
  estimateEdited,
  customTotal,
  bidFormOpen,
  bidForm,
  submitting,
  onBidFormChange,
  onToggleEstimate,
  onEditPrice,
  onOpenGallery,
  onOpenBid,
  onCloseBid,
  onSubmitBid,
}: {
  notice: RfqNotice;
  estimateSections: RoomCostSection[];
  estimateLoaded: boolean;
  estimateVisible: boolean;
  estimateLoading: boolean;
  estimateEdited: boolean;
  customTotal: number;
  bidFormOpen: boolean;
  bidForm: {
    bidAmount: string;
    estimatedDays: string;
    startAvailableDate: string;
    warrantyMonths: string;
    highlights: string;
    message: string;
  };
  submitting: boolean;
  onBidFormChange: React.Dispatch<React.SetStateAction<typeof bidForm>>;
  onToggleEstimate: () => void;
  onEditPrice: (sectionName: string, itemId: string, field: "materialCost" | "laborCost", value: number) => void;
  onOpenGallery: () => void;
  onOpenBid: () => void;
  onCloseBid: () => void;
  onSubmitBid: () => void;
}) {
  const deadline = deadlineInfo(notice.rfq_data.deadlineAt);
  const publishedDate = new Date(notice.rfq_data.publishedAt || notice.created_at).toLocaleDateString("ko-KR");
  const deadlineDate = notice.rfq_data.deadlineAt
    ? new Date(notice.rfq_data.deadlineAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : "일정 협의";
  const renderCount = notice.rfq_data.designRenders.length;

  return (
    <div className="overflow-hidden rounded-[28px] border border-black/[0.07] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.045)]">
      <div className="p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black text-white">{deadline.label}</span>
          <span className="text-[10px] font-bold tracking-[0.08em] text-black/35">{notice.notice_no}</span>
          {notice.my_bid && (
            <span className="ml-auto rounded-full bg-[#f1f1ef] px-2.5 py-1 text-[10px] font-bold">{bidStatusLabel(notice.my_bid.status)}</span>
          )}
        </div>

        <h2 className="mt-4 text-[24px] font-medium leading-tight tracking-[-0.045em] sm:text-[30px]">{notice.title}</h2>
        <p className="mt-2 text-xs text-black/40">등록 {publishedDate} · {notice.rfq_data.shortlistSize}개 업체 비교 예정</p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DetailMetric icon={<MapPin />} label="공사 지역" value={notice.region.label} />
          <DetailMetric icon={<Ruler />} label="전용 면적" value={notice.total_area_m2 ? `${Math.round(notice.total_area_m2)}㎡ · ${(notice.total_area_m2 * 0.3025).toFixed(1)}평` : "협의"} />
          <DetailMetric icon={<Wallet />} label="고객 예산" value={notice.budget_won ? `${money(notice.budget_won)}원` : "협의"} />
          <DetailMetric icon={<CalendarDays />} label="입찰 마감" value={deadlineDate} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <InfoLine label="공간 유형" value={notice.space_type || "인테리어"} />
          <InfoLine label="착공 희망" value={notice.rfq_data.preferredStart || "일정 협의"} />
          <InfoLine label="상담 방식" value={notice.rfq_data.visitPreference || "현장 방문 협의"} />
          <InfoLine label="예상 공기" value={notice.rfq_data.preferredDuration || "사업자 제안"} />
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f5f5f3] px-4 py-4">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-xs font-bold">상세 주소는 현장 방문 확정 후 공개됩니다</p>
            <p className="mt-1 text-[11px] leading-5 text-black/45">현재는 시·군·구 단위 정보만 제공합니다. 고객 연락처도 입찰 단계에서는 노출되지 않습니다.</p>
          </div>
        </div>

        {notice.rfq_data.notes && (
          <div className="mt-5">
            <p className="text-[11px] font-black tracking-[0.08em] text-black/35">CUSTOMER REQUEST</p>
            <p className="mt-2 rounded-2xl border border-black/[0.07] px-4 py-4 text-sm leading-6 text-black/68">{notice.rfq_data.notes}</p>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenGallery}
            disabled={renderCount === 0}
            className="group flex min-h-[94px] items-center justify-between rounded-2xl border border-black/[0.08] px-4 text-left transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>
              <span className="flex items-center gap-2 text-xs font-bold"><ImageIcon className="h-4 w-4" /> AI 디자인 시안</span>
              <span className="mt-2 block text-[11px] text-black/40">{renderCount ? `${renderCount}장 첨부` : "첨부 시안 없음"}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black" />
          </button>
          <button
            type="button"
            onClick={onToggleEstimate}
            disabled={estimateLoading}
            className="group flex min-h-[94px] items-center justify-between rounded-2xl border border-black/[0.08] px-4 text-left transition hover:border-black/25 disabled:opacity-45"
          >
            <span>
              <span className="flex items-center gap-2 text-xs font-bold"><FileText className="h-4 w-4" /> 공종별 견적</span>
              <span className="mt-2 block text-[11px] text-black/40">{estimateLoading ? "불러오는 중" : estimateVisible ? "상세 내역 접기" : estimateLoaded ? "저장된 내역 보기" : "자재비·노무비 검토"}</span>
            </span>
            {estimateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 text-black/25" />}
          </button>
        </div>

        {notice.rfq_data.drawingOptions.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold text-black/38">첨부 자료</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {notice.rfq_data.drawingOptions.map((option) => (
                <span key={option} className="rounded-full bg-[#f1f1ef] px-2.5 py-1.5 text-[10px] font-bold text-black/55">
                  {DRAWING_LABELS[option] || option}
                </span>
              ))}
            </div>
          </div>
        )}

        {notice.consumer_project_id && (
          <div className="mt-4">
            <ConstructionEstimateV2Panel consumerProjectId={notice.consumer_project_id} />
          </div>
        )}
      </div>

      {estimateVisible && (
        <div className="border-t border-black/[0.06] bg-[#fbfbfa] p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">공종별 견적 검토</p>
              <p className="mt-1 text-[11px] text-black/40">입찰 전 자재비와 노무비를 업체 단가로 조정할 수 있습니다.</p>
            </div>
            {estimateEdited && <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">수정됨</span>}
          </div>
          {estimateSections.length > 0 ? (
            <>
              <CostTable
                sections={estimateSections}
                editable={!notice.my_bid && !deadline.expired}
                onEditPrice={onEditPrice}
              />
              {estimateEdited && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-black px-4 py-3 text-white">
                  <span className="text-[11px] font-bold text-white/60">조정 견적 합계</span>
                  <span className="text-sm font-black">{money(customTotal)}원</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-xs text-black/40">등록된 세부 견적 항목이 없습니다.</div>
          )}
        </div>
      )}

      <div className="border-t border-black/[0.06] p-5 sm:p-7 lg:p-8">
        {notice.my_bid ? (
          <SubmittedBid notice={notice} />
        ) : deadline.expired ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[#f1f1ef] p-4">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div><p className="text-sm font-bold">마감된 공고입니다</p><p className="mt-1 text-xs text-black/45">새 맞춤 공고에서 참여 가능한 프로젝트를 확인해주세요.</p></div>
          </div>
        ) : bidFormOpen ? (
          <BidForm
            budget={notice.budget_won}
            value={bidForm}
            submitting={submitting}
            onChange={onBidFormChange}
            onCancel={onCloseBid}
            onSubmit={onSubmitBid}
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">이 프로젝트에 참여하시겠어요?</p>
              <p className="mt-1 text-[11px] leading-5 text-black/45">총액·공기·자재·보증 조건이 고객에게 동일한 형식으로 전달됩니다.</p>
            </div>
            <button
              type="button"
              onClick={onOpenBid}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white transition hover:bg-black/80"
            >
              입찰서 작성 <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailMetric({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f5f5f3] p-3.5">
      <div className="flex items-center gap-1.5 text-black/35">
        {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <span className="text-[10px] font-bold">{label}</span>
      </div>
      <p className="mt-2 truncate text-xs font-black">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-black/[0.06] px-4 py-3">
      <span className="text-[11px] text-black/38">{label}</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}

function SubmittedBid({ notice }: { notice: RfqNotice }) {
  const bid = notice.my_bid!;
  return (
    <div className="rounded-[22px] bg-[#f5f5f3] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CircleCheck className="h-4 w-4" /><p className="text-sm font-bold">제출한 입찰서</p></div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold">{bidStatusLabel(bid.status)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BidValue label="입찰 총액" value={`${money(bid.bid_amount)}원`} />
        <BidValue label="예상 공기" value={`${bid.estimated_days}일`} />
        <BidValue label="착공 가능" value={bid.start_available_date || "협의"} />
        <BidValue label="하자보증" value={`${Number(bid.metadata?.warranty_months || 12)}개월`} />
      </div>
      {bid.message && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-black/55">{bid.message}</p>}
      {bid.status === "pending" && (
        <div className="mt-3 flex justify-end">
          <Link href={`/contractor/bids/${bid.id}/edit-rates`} className="inline-flex items-center gap-1 text-[11px] font-bold underline decoration-black/20 underline-offset-4">
            간접비 요율 조정 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function BidValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-black/35">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>;
}

function BidForm({
  budget,
  value,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  budget: number;
  value: {
    bidAmount: string;
    estimatedDays: string;
    startAvailableDate: string;
    warrantyMonths: string;
    highlights: string;
    message: string;
  };
  submitting: boolean;
  onChange: React.Dispatch<React.SetStateAction<typeof value>>;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const amount = Number(value.bidAmount || 0);
  const difference = budget > 0 && amount > 0 ? amount - budget : 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <div><p className="text-base font-bold">입찰서 작성</p><p className="mt-1 text-[11px] text-black/42">필수 조건을 확인한 뒤 제출해주세요.</p></div>
        <button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f1f1ef]" aria-label="입찰서 닫기"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FormField label="입찰 총액" required suffix="원">
          <input type="number" min="1" value={value.bidAmount} onChange={(event) => onChange((current) => ({ ...current, bidAmount: event.target.value }))} placeholder="0" />
        </FormField>
        <FormField label="예상 공사 기간" required suffix="일">
          <input type="number" min="1" value={value.estimatedDays} onChange={(event) => onChange((current) => ({ ...current, estimatedDays: event.target.value }))} />
        </FormField>
        <FormField label="착공 가능일">
          <input type="date" value={value.startAvailableDate} onChange={(event) => onChange((current) => ({ ...current, startAvailableDate: event.target.value }))} />
        </FormField>
        <FormField label="하자보증 기간" suffix="개월">
          <input type="number" min="1" value={value.warrantyMonths} onChange={(event) => onChange((current) => ({ ...current, warrantyMonths: event.target.value }))} />
        </FormField>
      </div>
      {budget > 0 && amount > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#f5f5f3] px-4 py-3 text-xs">
          <span className="text-black/45">고객 예산 대비</span>
          <span className="font-black">{difference === 0 ? "동일" : `${difference > 0 ? "+" : "-"}${money(Math.abs(difference))}원`}</span>
        </div>
      )}
      <label className="mt-3 block">
        <span className="text-[11px] font-bold">시공 강점 <span className="font-normal text-black/35">쉼표로 구분</span></span>
        <input value={value.highlights} onChange={(event) => onChange((current) => ({ ...current, highlights: event.target.value }))} placeholder="예: 10년 경력, 자체 시공팀, 1년 무상 A/S" className="mt-1.5 h-11 w-full rounded-2xl border border-black/[0.08] px-4 text-sm outline-none focus:border-black/25" />
      </label>
      <label className="mt-3 block">
        <span className="text-[11px] font-bold">고객에게 전할 내용</span>
        <textarea value={value.message} onChange={(event) => onChange((current) => ({ ...current, message: event.target.value }))} rows={3} placeholder="공사 방식, 포함 범위와 상담 가능한 시간을 알려주세요." className="mt-1.5 w-full resize-none rounded-2xl border border-black/[0.08] px-4 py-3 text-sm leading-6 outline-none focus:border-black/25" />
      </label>
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#f5f5f3] p-3 text-[11px] leading-5 text-black/45">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" /> 총액에는 부가세와 선택한 공사 범위를 포함해야 하며, 제출 후 고객 선정 전까지 요율을 조정할 수 있습니다.
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-full border border-black/[0.1] text-sm font-bold transition hover:bg-[#f5f5f3]">취소</button>
        <button type="button" onClick={onSubmit} disabled={submitting || !value.bidAmount || !value.estimatedDays} className="inline-flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-35">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} 입찰서 제출
        </button>
      </div>
    </div>
  );
}

function FormField({ label, required, suffix, children }: { label: string; required?: boolean; suffix?: string; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold">{label}{required && <span className="ml-1 text-black/35">필수</span>}</span>
      <span className="relative mt-1.5 block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-black/[0.08] [&_input]:px-4 [&_input]:pr-12 [&_input]:text-sm [&_input]:outline-none focus-within:[&_input]:border-black/25">
        {children}
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/35">{suffix}</span>}
      </span>
    </label>
  );
}

function NoticeSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((index) => <div key={index} className="h-40 animate-pulse rounded-[22px] bg-white" />)}
    </div>
  );
}

function EmptyNotice({ tab, onReset }: { tab: TabValue; onReset: () => void }) {
  const message = tab === "available" ? "조건에 맞는 새 공고가 없습니다" : tab === "my_bids" ? "검토 중인 입찰이 없습니다" : "해당 결과가 없습니다";
  return (
    <div className="rounded-[24px] border border-black/[0.07] bg-white px-6 py-16 text-center">
      <Gavel className="mx-auto h-7 w-7 text-black/20" />
      <p className="mt-4 text-sm font-bold">{message}</p>
      <p className="mt-2 text-xs leading-5 text-black/40">지역·예산 필터를 넓히거나 잠시 후 다시 확인해주세요.</p>
      <button type="button" onClick={onReset} className="mt-5 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold hover:bg-[#f5f5f3]"><RefreshCw className="h-3.5 w-3.5" /> 필터 초기화</button>
    </div>
  );
}
