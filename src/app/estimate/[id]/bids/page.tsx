"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Star, Calendar, Clock, MessageSquare,
  CheckCircle2, XCircle, Award, Building2, Briefcase, TrendingDown,
} from "lucide-react";
import type { BidInfo } from "@/types/bid";
import { mapDbBid, BID_STATUS_LABELS, BID_STATUS_COLORS } from "@/types/bid";
import type { Estimate } from "@/types/estimate";
import { mapDbEstimate } from "@/types/estimate";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function BidCard({ bid, estimate, onSelect, onReject }: {
  bid: BidInfo;
  estimate: Estimate;
  onSelect: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const savings = estimate.finalPrice - bid.bidAmount;
  const savingsRate = estimate.finalPrice > 0 ? (savings / estimate.finalPrice) * 100 : 0;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      bid.status === "SELECTED" ? "border-green-300 ring-2 ring-green-100" :
      bid.status === "REJECTED" ? "border-gray-200 opacity-60" : "border-gray-200 hover:border-blue-300"
    }`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{bid.contractor.companyName || "업체명 미등록"}</h3>
              <p className="text-xs text-gray-500">{bid.contractor.representativeName}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${BID_STATUS_COLORS[bid.status]}`}>
            {BID_STATUS_LABELS[bid.status]}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <StarRating rating={bid.contractor.rating} />
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> {bid.contractor.completedProjects}건 완료
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Award className="w-3 h-3" /> {bid.contractor.experienceYears}년 경력
          </span>
        </div>

        {/* Bid Details */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">입찰 금액</p>
            <p className="text-lg font-bold text-gray-900">{fmt(bid.bidAmount)}<span className="text-xs font-normal">원</span></p>
            {savingsRate > 0 && (
              <p className="text-xs text-green-600 flex items-center justify-center gap-0.5 mt-1">
                <TrendingDown className="w-3 h-3" /> {savingsRate.toFixed(1)}% 절감
              </p>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">예상 공사일</p>
            <p className="text-lg font-bold text-gray-900">{bid.estimatedDays}<span className="text-xs font-normal">일</span></p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">착공 가능일</p>
            <p className="text-sm font-bold text-gray-900">
              {bid.startAvailableDate ? new Date(bid.startAvailableDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "-"}
            </p>
          </div>
        </div>

        {/* Message */}
        {bid.message && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 leading-relaxed">{bid.message}</p>
            </div>
          </div>
        )}

        {/* Expandable Portfolio */}
        {bid.contractor.portfolio.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 hover:underline mb-3">
            포트폴리오 {bid.contractor.portfolio.length}건 {expanded ? "접기" : "보기"}
          </button>
        )}
        {expanded && bid.contractor.portfolio.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {bid.contractor.portfolio.slice(0, 6).map((p) => (
              <div key={p.id} className="bg-gray-100 rounded-lg p-2">
                <p className="text-xs font-medium text-gray-900 truncate">{p.title}</p>
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recent Reviews */}
        {expanded && bid.contractor.recentReviews.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold text-gray-700">최근 후기</p>
            {bid.contractor.recentReviews.slice(0, 2).map((r) => (
              <div key={r.id} className="bg-gray-50 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating rating={r.rating} />
                  {r.isVerified && <span className="text-xs text-green-600">인증됨</span>}
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {bid.status === "PENDING" && (
          <div className="flex gap-2">
            <button onClick={onSelect}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> 이 업체 선정
            </button>
            <button onClick={onReject}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> 미선정
            </button>
          </div>
        )}

        {bid.status === "SELECTED" && (
          <Link href={`/contract/${bid.id}`}
            className="block w-full text-center px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            계약서 작성하기
          </Link>
        )}
      </div>
    </div>
  );
}

export default function BidComparisonPage() {
  const params = useParams();
  const router = useRouter();
  const estimateId = params.id as string;

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [bids, setBids] = useState<BidInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"amount" | "days" | "rating">("amount");

  useEffect(() => {
    async function load() {
      try {
        const [estRes, bidRes] = await Promise.all([
          fetch(`/api/estimates?id=${estimateId}`),
          fetch(`/api/bids?estimateId=${estimateId}`),
        ]);
        const estData = await estRes.json();
        const bidData = await bidRes.json();

        if (estData.estimate) setEstimate(mapDbEstimate(estData.estimate));
        if (bidData.bids) setBids(bidData.bids.map((b: Record<string, unknown>) => mapDbBid(b)));
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, [estimateId]);

  const handleSelect = async (bidId: string) => {
    const res = await fetch("/api/bids", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bidId, status: "selected" }),
    });
    if (res.ok) {
      setBids((prev) => prev.map((b) => ({
        ...b,
        status: b.id === bidId ? "SELECTED" : b.status === "PENDING" ? "REJECTED" : b.status,
      })));
    }
  };

  const handleReject = async (bidId: string) => {
    const res = await fetch("/api/bids", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bidId, status: "rejected" }),
    });
    if (res.ok) {
      setBids((prev) => prev.map((b) => b.id === bidId ? { ...b, status: "REJECTED" as const } : b));
    }
  };

  const sorted = [...bids].sort((a, b) => {
    if (a.status === "SELECTED") return -1;
    if (b.status === "SELECTED") return 1;
    switch (sortBy) {
      case "amount": return a.bidAmount - b.bidAmount;
      case "days": return a.estimatedDays - b.estimatedDays;
      case "rating": return b.contractor.rating - a.contractor.rating;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">입찰 비교</span>
          </div>
          {estimate && (
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              기준가: {fmt(estimate.finalPrice)}원
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Summary */}
        {estimate && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h1 className="text-lg font-bold text-gray-900 mb-1">{estimate.projectName}</h1>
            <p className="text-sm text-gray-500">{estimate.totalArea}m² | 입찰 {bids.length}건</p>
            {bids.length > 0 && (
              <div className="flex gap-6 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">최저가</p>
                  <p className="text-sm font-bold text-green-600">{fmt(Math.min(...bids.map((b) => b.bidAmount)))}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">평균가</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(bids.reduce((s, b) => s + b.bidAmount, 0) / bids.length)}원</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">최단 공사일</p>
                  <p className="text-sm font-bold text-blue-600">{Math.min(...bids.map((b) => b.estimatedDays))}일</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-700 font-semibold">{bids.length}개 입찰</p>
          <div className="flex gap-1.5">
            {([
              { value: "amount", label: "금액순", icon: TrendingDown },
              { value: "days", label: "공기순", icon: Clock },
              { value: "rating", label: "평점순", icon: Star },
            ] as const).map((s) => (
              <button key={s.value} onClick={() => setSortBy(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  sortBy === s.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}>
                <s.icon className="w-3 h-3" /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bid Cards */}
        {bids.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">아직 입찰이 없습니다</p>
            <p className="text-sm text-gray-400">업체 매칭 후 입찰을 받아보세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((bid) => (
              <BidCard
                key={bid.id}
                bid={bid}
                estimate={estimate!}
                onSelect={() => handleSelect(bid.id)}
                onReject={() => handleReject(bid.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
