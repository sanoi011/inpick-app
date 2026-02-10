"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import {
  Loader2, Gavel, ChevronDown, ChevronUp, Send,
  MapPin, Calendar, Ruler, DollarSign, Clock,
  FileText, CheckCircle2, XCircle, Filter,
} from "lucide-react";
import { BID_STATUS_LABELS, BID_STATUS_COLORS, type BidStatus } from "@/types/bid";

interface EstimateForBid {
  id: string;
  title: string;
  status: string;
  project_type: string;
  space_type: string;
  total_area_m2: number;
  grand_total: number;
  address: string;
  created_at: string;
  updated_at: string;
  bid_count?: number;
  my_bid?: MyBid | null;
}

interface MyBid {
  id: string;
  bid_amount: number;
  discount_rate: number | null;
  estimated_days: number;
  start_available_date: string | null;
  message: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const TAB_FILTERS = [
  { value: "available", label: "입찰 가능" },
  { value: "my_bids", label: "내 입찰" },
  { value: "selected", label: "선정됨" },
  { value: "rejected", label: "미선정" },
];

const SPACE_TYPES = [
  { value: "", label: "전체 공간" },
  { value: "apartment", label: "아파트" },
  { value: "villa", label: "빌라" },
  { value: "office", label: "사무실" },
  { value: "store", label: "상가" },
  { value: "house", label: "단독주택" },
];

const BUDGET_RANGES = [
  { value: "", label: "전체 예산" },
  { value: "0-10000000", label: "1천만원 이하" },
  { value: "10000000-30000000", label: "1천~3천만원" },
  { value: "30000000-50000000", label: "3천~5천만원" },
  { value: "50000000-100000000", label: "5천만~1억" },
  { value: "100000000-", label: "1억 이상" },
];

export default function BidsPage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [tab, setTab] = useState("available");
  const [estimates, setEstimates] = useState<EstimateForBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 필터
  const [showFilters, setShowFilters] = useState(false);
  const [spaceType, setSpaceType] = useState("");
  const [budgetRange, setBudgetRange] = useState("");

  // 입찰서 작성
  const [bidFormId, setBidFormId] = useState<string | null>(null);
  const [bidForm, setBidForm] = useState({
    bidAmount: "", discountRate: "", estimatedDays: "30",
    startAvailableDate: "", message: "", highlights: "", warrantyMonths: "12",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!contractorId) return;
    setLoading(true);
    try {
      if (tab === "available") {
        // 입찰 가능한 견적 목록
        const params = new URLSearchParams();
        if (spaceType) params.set("spaceType", spaceType);
        if (budgetRange) params.set("budgetRange", budgetRange);
        const res = await fetch(`/api/estimates?status=confirmed&${params}`);
        const data = await res.json();
        const estimatesList = data.estimates || [];

        // 내 입찰 정보 확인
        const bidRes = await fetch(`/api/bids?contractorId=${contractorId}`);
        const bidData = await bidRes.json();
        const myBids = bidData.bids || [];
        const myBidMap = new Map<string, MyBid>();
        for (const b of myBids) { myBidMap.set(b.estimate_id, b); }

        setEstimates(estimatesList.map((e: EstimateForBid) => ({
          ...e,
          my_bid: myBidMap.get(e.id) || null,
        })));
      } else {
        // 내 입찰 목록 (상태별)
        const statusParam = tab === "my_bids" ? "" : tab;
        const res = await fetch(`/api/bids?contractorId=${contractorId}${statusParam ? `&status=${statusParam}` : ""}`);
        const data = await res.json();
        const bids = data.bids || [];

        // bid → estimate 형태로 변환
        setEstimates(bids.map((b: Record<string, unknown>) => ({
          id: b.estimate_id as string,
          title: ((b.estimates as Record<string, unknown>)?.title as string) || `견적 ${(b.estimate_id as string).slice(0, 8)}`,
          status: ((b.estimates as Record<string, unknown>)?.status as string) || "",
          project_type: ((b.estimates as Record<string, unknown>)?.project_type as string) || "",
          space_type: ((b.estimates as Record<string, unknown>)?.space_type as string) || "",
          total_area_m2: ((b.estimates as Record<string, unknown>)?.total_area_m2 as number) || 0,
          grand_total: ((b.estimates as Record<string, unknown>)?.grand_total as number) || 0,
          address: ((b.estimates as Record<string, unknown>)?.address as string) || "",
          created_at: b.created_at as string,
          updated_at: b.updated_at as string || b.created_at as string,
          my_bid: {
            id: b.id as string,
            bid_amount: b.bid_amount as number,
            discount_rate: b.discount_rate as number | null,
            estimated_days: b.estimated_days as number,
            start_available_date: b.start_available_date as string | null,
            message: b.message as string | null,
            status: b.status as string,
            metadata: (b.metadata as Record<string, unknown>) || {},
            created_at: b.created_at as string,
          },
        })));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [contractorId, tab, spaceType, budgetRange]);

  useEffect(() => { if (authChecked && contractorId) loadData(); }, [authChecked, contractorId, loadData]);

  // 입찰서 제출
  const handleSubmitBid = async (estimateId: string) => {
    if (!contractorId || !bidForm.bidAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId,
          contractorId,
          bidAmount: Number(bidForm.bidAmount),
          discountRate: bidForm.discountRate ? Number(bidForm.discountRate) : null,
          estimatedDays: Number(bidForm.estimatedDays) || 30,
          startAvailableDate: bidForm.startAvailableDate || null,
          message: bidForm.message || null,
          metadata: {
            highlights: bidForm.highlights ? bidForm.highlights.split(",").map(s => s.trim()).filter(Boolean) : [],
            warranty_months: Number(bidForm.warrantyMonths) || 12,
          },
        }),
      });
      if (res.ok) {
        setBidFormId(null);
        setBidForm({ bidAmount: "", discountRate: "", estimatedDays: "30", startAvailableDate: "", message: "", highlights: "", warrantyMonths: "12" });
        loadData();
      }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  const mapBidStatus = (s: string): BidStatus => {
    switch (s) { case "selected": return "SELECTED"; case "rejected": return "REJECTED"; default: return "PENDING"; }
  };

  if (!authChecked) return null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-6 h-6 text-amber-500" /> 입찰 관리
        </h1>
        <button onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
          <Filter className="w-4 h-4" /> 필터
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1.5 mb-4">
        {TAB_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setTab(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === f.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
          <select value={spaceType} onChange={(e) => setSpaceType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {SPACE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {BUDGET_RANGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => { setSpaceType(""); setBudgetRange(""); }}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">초기화</button>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : estimates.length === 0 ? (
        <div className="text-center py-20">
          <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {tab === "available" ? "입찰 가능한 견적이 없습니다" : "해당 입찰이 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates.map((est) => (
            <div key={`${est.id}-${est.my_bid?.id || "none"}`} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* 카드 */}
              <button onClick={() => setExpandedId(expandedId === est.id ? null : est.id)}
                className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{est.title}</h3>
                      {est.my_bid && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${BID_STATUS_COLORS[mapBidStatus(est.my_bid.status)]}`}>
                          {BID_STATUS_LABELS[mapBidStatus(est.my_bid.status)]}
                        </span>
                      )}
                      {!est.my_bid && tab === "available" && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">입찰 가능</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {est.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{est.address}</span>}
                      {est.space_type && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{est.space_type}</span>}
                      {est.total_area_m2 > 0 && <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{est.total_area_m2}m²</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(est.created_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{est.grand_total ? `${fmt(est.grand_total)}원` : "-"}</p>
                      {est.my_bid && (
                        <p className="text-xs text-blue-600 mt-0.5">내 입찰: {fmt(est.my_bid.bid_amount)}원</p>
                      )}
                    </div>
                    {expandedId === est.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
              </button>

              {/* 확장 상세 */}
              {expandedId === est.id && (
                <div className="border-t border-gray-200 p-5">
                  {/* 견적 정보 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <InfoBox icon={<FileText className="w-4 h-4 text-gray-400" />} label="유형" value={est.project_type === "residential" ? "주거" : est.project_type === "commercial" ? "상업" : est.project_type || "-"} />
                    <InfoBox icon={<Ruler className="w-4 h-4 text-gray-400" />} label="면적" value={est.total_area_m2 > 0 ? `${est.total_area_m2}m² (${(est.total_area_m2 * 0.3025).toFixed(1)}평)` : "-"} />
                    <InfoBox icon={<DollarSign className="w-4 h-4 text-gray-400" />} label="견적 금액" value={est.grand_total ? `${fmt(est.grand_total)}원` : "-"} />
                    <InfoBox icon={<MapPin className="w-4 h-4 text-gray-400" />} label="위치" value={est.address || "-"} />
                  </div>

                  {/* 내 입찰 정보 */}
                  {est.my_bid && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                        <Send className="w-4 h-4" /> 내 입찰 정보
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-blue-600 text-xs">입찰 금액</span><p className="font-medium text-blue-900">{fmt(est.my_bid.bid_amount)}원</p></div>
                        {est.my_bid.discount_rate && <div><span className="text-blue-600 text-xs">할인율</span><p className="font-medium text-blue-900">{est.my_bid.discount_rate}%</p></div>}
                        <div><span className="text-blue-600 text-xs">예상 공기</span><p className="font-medium text-blue-900">{est.my_bid.estimated_days}일</p></div>
                        {est.my_bid.start_available_date && <div><span className="text-blue-600 text-xs">착공 가능일</span><p className="font-medium text-blue-900">{est.my_bid.start_available_date}</p></div>}
                      </div>
                      {est.my_bid.message && <p className="text-xs text-blue-700 mt-2">{est.my_bid.message}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {est.my_bid.status === "selected" && <span className="flex items-center gap-1 text-green-700 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" />선정됨</span>}
                        {est.my_bid.status === "rejected" && <span className="flex items-center gap-1 text-gray-500 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />미선정</span>}
                        {est.my_bid.status === "pending" && <span className="flex items-center gap-1 text-amber-600 text-xs font-medium"><Clock className="w-3.5 h-3.5" />검토중</span>}
                      </div>
                    </div>
                  )}

                  {/* 입찰서 작성 폼 */}
                  {!est.my_bid && tab === "available" && (
                    <>
                      {bidFormId === est.id ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">입찰서 작성</h4>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">입찰 금액 (원) *</label>
                              <input type="number" value={bidForm.bidAmount} onChange={(e) => setBidForm(f => ({ ...f, bidAmount: e.target.value }))}
                                placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">할인율 (%)</label>
                              <input type="number" value={bidForm.discountRate} onChange={(e) => setBidForm(f => ({ ...f, discountRate: e.target.value }))}
                                placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">예상 공기 (일)</label>
                              <input type="number" value={bidForm.estimatedDays} onChange={(e) => setBidForm(f => ({ ...f, estimatedDays: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">착공 가능일</label>
                              <input type="date" value={bidForm.startAvailableDate} onChange={(e) => setBidForm(f => ({ ...f, startAvailableDate: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">메시지</label>
                            <textarea value={bidForm.message} onChange={(e) => setBidForm(f => ({ ...f, message: e.target.value }))}
                              placeholder="고객에게 전달할 메시지" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">강점 (쉼표 구분)</label>
                              <input value={bidForm.highlights} onChange={(e) => setBidForm(f => ({ ...f, highlights: e.target.value }))}
                                placeholder="예: 10년 경력, A/S 보증" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">하자보증 (개월)</label>
                              <input type="number" value={bidForm.warrantyMonths} onChange={(e) => setBidForm(f => ({ ...f, warrantyMonths: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setBidFormId(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
                            <button onClick={() => handleSubmitBid(est.id)} disabled={submitting || !bidForm.bidAmount}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 입찰 제출
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setBidFormId(est.id)}
                          className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5">
                          <Gavel className="w-4 h-4" /> 입찰하기
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
