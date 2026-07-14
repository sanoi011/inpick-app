/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileSignature,
  Hexagon,
  Loader2,
  ChevronRight,
  Building2,
  Award,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import BidProgressTracker from "@/components/bid/BidProgressTracker";
import type { BidStage } from "@/lib/inpick/bid-pipeline";

function deriveStage(estStatus: string, bids: Array<{ status: string }>): BidStage {
  if (estStatus === "selected" || bids.some((b) => b.status === "selected")) return "selected";
  if (estStatus === "in_progress") return "in_progress";
  if (estStatus === "completed") return "completed";
  if (estStatus === "warranty") return "warranty";
  if (estStatus === "cancelled") return "cancelled";
  if (estStatus === "closed") return "bidding_closed";
  if (bids.length > 0) return "bidding_open";
  if (estStatus === "open") return "rfq_published";
  return "draft";
}

interface BidLite {
  id: string;
  estimate_id: string;
  contractor_id: string;
  bid_amount: number;
  estimated_days: number;
  start_available_date: string | null;
  message: string | null;
  status: string;
  created_at: string;
  contractor?: { company_name?: string; rating?: number; region?: string };
}

interface EstimateLite {
  id: string;
  title: string;
  address: string;
  total_area_m2: number;
  grand_total: number;
  status: string;
  created_at: string;
  bids: BidLite[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "입찰 진행 중",
  closed: "마감",
  selected: "낙찰 완료",
  rejected: "유찰",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-[#0d0d0d] text-white",
  closed: "bg-zinc-100 text-zinc-600",
  selected: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ContractsProgressPage() {
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<EstimateLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/consumer/contracts-progress?userId=${user.id}`, {
        cache: "no-store",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "조회 실패");
      setEstimates(d.estimates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function selectBid(estimateId: string, bidId: string) {
    setSelectingId(bidId);
    try {
      const res = await fetch("/api/bids/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId, bidId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "선정 실패");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "선정 오류");
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      {/* 헤더 */}
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">
          BIDS & CONTRACTS
        </p>
        <h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[36px]">
          입찰·계약 진행 현황
        </h1>
        <p className="mt-2 text-sm text-black/45">
          제출된 견적별 사업자 입찰을 비교하고 시공사를 선정하세요.
        </p>
      </div>

      {loading && (
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-black/45" />
          <p className="mt-3 text-sm text-black/45">입찰 현황 불러오는 중…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">{error}</p>
            <p className="mt-1 text-amber-800/80">
              아직 견적 요청·입찰 데이터가 없거나 조회 권한이 없습니다.
            </p>
            <Link
              href="/workflow"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#0d0d0d] px-4 py-2 text-xs font-medium text-white hover:bg-black/80"
            >
              새 견적 요청 시작 <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && estimates.length === 0 && (
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
          <FileSignature className="mx-auto h-10 w-10 text-black/18" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-semibold">진행 중인 입찰이 없습니다</p>
          <p className="mt-1 text-xs text-black/45">
            견적을 만들어 사업자에게 입찰 공고를 보내보세요.
          </p>
          <Link
            href="/workflow"
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-[#0d0d0d] px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80"
          >
            새 견적 시작 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {!loading &&
        estimates.map((est) => {
          const sortedBids = [...est.bids].sort((a, b) => a.bid_amount - b.bid_amount);
          const selectedBid = est.bids.find((b) => b.status === "selected");
          const stage = deriveStage(est.status, est.bids);
          return (
            <div key={est.id} className="space-y-3">
              {/* 진행 단계 추적기 */}
              <BidProgressTracker currentStage={stage} />

              <div
                className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white"
              >
              {/* 견적 헤더 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] bg-[#fafaf8] px-5 py-4 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{est.title}</h2>
                    <span
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[est.status] || "bg-zinc-100 text-zinc-600"}`}
                    >
                      {STATUS_LABELS[est.status] || est.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.78rem] text-black/48">
                    {est.address} · {est.total_area_m2}㎡
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.65rem] font-medium tracking-widest text-black/38">
                    내 견적 금액
                  </p>
                  <p className="text-lg font-semibold tabular-nums tracking-[-0.03em]">
                    ₩ {est.grand_total.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* 입찰 목록 */}
              <div className="divide-y divide-black/[0.05]">
                {sortedBids.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-black/45">
                    <Clock className="mx-auto mb-2 h-6 w-6 text-black/18" />
                    아직 도착한 입찰이 없습니다. 사업자 알림 후 보통 24~72시간 내 도착합니다.
                  </div>
                ) : (
                  sortedBids.map((bid, idx) => {
                    const diff = bid.bid_amount - est.grand_total;
                    const diffPct = est.grand_total > 0 ? (diff / est.grand_total) * 100 : 0;
                    const isSelected = bid.status === "selected";
                    return (
                      <div
                        key={bid.id}
                        className={`px-6 py-4 transition-colors ${
                          isSelected ? "bg-[#f7f7f5]" : "hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {idx === 0 && !isSelected && (
                                <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                                  최저가
                                </span>
                              )}
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                                  <Award className="h-3 w-3" />
                                  낙찰
                                </span>
                              )}
                              <span className="font-semibold">
                                {bid.contractor?.company_name || "사업자"}
                              </span>
                              {bid.contractor?.rating && (
                                <span className="text-[0.7rem] text-amber-600 font-bold">
                                  ★ {bid.contractor.rating.toFixed(1)}
                                </span>
                              )}
                              {bid.contractor?.region && (
                                <span className="inline-flex items-center gap-0.5 text-[0.7rem] text-black/45">
                                  <Building2 className="h-3 w-3" />
                                  {bid.contractor.region}
                                </span>
                              )}
                            </div>
                            {bid.message && (
                              <p className="mt-1.5 line-clamp-2 text-[0.78rem] text-black/62">
                                {bid.message}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] text-black/42">
                              <span>예상 공기 {bid.estimated_days}일</span>
                              {bid.start_available_date && (
                                <span>
                                  착공 가능{" "}
                                  {new Date(bid.start_available_date).toLocaleDateString("ko-KR")}
                                </span>
                              )}
                              <span>
                                제출 {new Date(bid.created_at).toLocaleDateString("ko-KR")}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-semibold tabular-nums tracking-[-0.03em]">
                              ₩ {bid.bid_amount.toLocaleString()}
                            </p>
                            <p
                              className={`text-[0.7rem] tabular font-semibold ${
                                diff < 0 ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              {diff < 0 ? "−" : "+"}
                              {Math.abs(diff).toLocaleString()}원 ({diffPct.toFixed(1)}%)
                            </p>
                            {!selectedBid && (
                              <button
                                onClick={() => selectBid(est.id, bid.id)}
                                disabled={selectingId === bid.id}
                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0d0d0d] px-3.5 py-2 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-50"
                              >
                                {selectingId === bid.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Hexagon className="h-3 w-3 fill-white" />
                                )}
                                이 사업자 선정
                              </button>
                            )}
                            {isSelected && (
                              <Link
                                href={`/contract/consumer/${est.id}`}
                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                              >
                                계약서 작성 <ChevronRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
