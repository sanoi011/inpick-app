"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Send,
  Building2,
  Medal,
  ThumbsUp,
  BarChart3,
  Phone,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";

interface MockBid {
  id: string;
  companyName: string;
  representative: string;
  phone: string;
  region: string;
  rating: number;
  reviewCount: number;
  totalProjects: number;
  specialties: string[];
  bidAmount: number;
  duration: number; // 공사 기간 (일)
  warranty: number; // 하자보증 (년)
  portfolioImages: string[];
  message: string;
  submittedAt: string;
}

const MOCK_BIDS: MockBid[] = [
  {
    id: "bid-1",
    companyName: "대한인테리어",
    representative: "김건설",
    phone: "010-1234-5678",
    region: "서울 강남/서초",
    rating: 4.8,
    reviewCount: 127,
    totalProjects: 342,
    specialties: ["아파트 리모델링", "주방 전문", "욕실 전문"],
    bidAmount: 11800000,
    duration: 21,
    warranty: 2,
    portfolioImages: [],
    message: "안녕하세요, 20년 경력의 대한인테리어입니다. 꼼꼼한 시공과 합리적인 가격으로 고객 만족도 1위를 유지하고 있습니다.",
    submittedAt: "2026-02-10T14:30:00Z",
  },
  {
    id: "bid-2",
    companyName: "모던하우스 디자인",
    representative: "이모던",
    phone: "010-9876-5432",
    region: "서울 전지역",
    rating: 4.6,
    reviewCount: 89,
    totalProjects: 215,
    specialties: ["모던 인테리어", "전체 리모델링", "조명 설계"],
    bidAmount: 12500000,
    duration: 18,
    warranty: 3,
    portfolioImages: [],
    message: "모던하우스는 디자인부터 시공까지 원스톱 서비스를 제공합니다. 3년 하자보증으로 안심하고 맡기세요.",
    submittedAt: "2026-02-10T16:45:00Z",
  },
  {
    id: "bid-3",
    companyName: "착한시공",
    representative: "박시공",
    phone: "010-5555-1234",
    region: "서울/경기",
    rating: 4.4,
    reviewCount: 64,
    totalProjects: 178,
    specialties: ["가성비 시공", "부분 인테리어", "도배/장판"],
    bidAmount: 9900000,
    duration: 25,
    warranty: 1,
    portfolioImages: [],
    message: "합리적인 가격으로 만족스러운 시공을 약속드립니다. 부분 시공도 가능합니다.",
    submittedAt: "2026-02-11T09:15:00Z",
  },
  {
    id: "bid-4",
    companyName: "프리미엄 홈즈",
    representative: "최프리",
    phone: "010-7777-8888",
    region: "서울 강남",
    rating: 4.9,
    reviewCount: 203,
    totalProjects: 456,
    specialties: ["프리미엄 시공", "수입 자재", "스마트홈"],
    bidAmount: 15200000,
    duration: 14,
    warranty: 5,
    portfolioImages: [],
    message: "프리미엄 홈즈는 최고급 자재와 숙련된 기술진으로 차별화된 퀄리티를 선사합니다. 5년 하자보증 포함.",
    submittedAt: "2026-02-11T11:00:00Z",
  },
];

type SortKey = "price" | "duration" | "rating";

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function BidsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project } = useProjectState(projectId);

  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [isRfqSent, setIsRfqSent] = useState(false);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);

  const estimateTotal = 10680200; // Mock - Phase 4 합계

  const sortedBids = [...MOCK_BIDS].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return a.bidAmount - b.bidAmount;
      case "duration":
        return a.duration - b.duration;
      case "rating":
        return b.rating - a.rating;
      default:
        return 0;
    }
  });

  const lowestBid = [...MOCK_BIDS].sort((a, b) => a.bidAmount - b.bidAmount)[0];
  const highestRated = [...MOCK_BIDS].sort((a, b) => b.rating - a.rating)[0];
  const fastestBid = [...MOCK_BIDS].sort((a, b) => a.duration - b.duration)[0];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-50">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}/estimate`)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> 견적산출
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-600" />
            견적받기
          </h2>
          <span className="text-xs text-gray-400">
            {MOCK_BIDS.length}개 업체 입찰
          </span>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* RFQ 요약 카드 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">입찰 요청서 (RFQ)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {project?.address?.roadAddress || "주소 미설정"} ·{" "}
                  {project?.address?.exclusiveArea || 25}㎡ ·{" "}
                  {project?.address?.buildingType || "아파트"}
                </p>
              </div>
              {!isRfqSent ? (
                <button
                  onClick={() => setIsRfqSent(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Send className="w-4 h-4" /> 입찰 요청 발송
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200">
                  <CheckCircle2 className="w-4 h-4" /> 발송 완료
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-500">예상 공사비</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatNumber(estimateTotal)}원
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-500">공간 수</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">5개 공간</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-500">공종</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  철거·마감·목공·전기·설비
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-500">입찰 마감</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">2026.02.18</p>
              </div>
            </div>
          </div>

          {/* AI 분석 패널 */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-purple-900">AI 입찰 분석</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-[11px] font-medium text-green-700">최저가</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{lowestBid.companyName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatNumber(lowestBid.bidAmount)}원 (예상 대비{" "}
                  {(((estimateTotal - lowestBid.bidAmount) / estimateTotal) * 100).toFixed(0)}%↓)
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-medium text-blue-700">최적 추천</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{highestRated.companyName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  평점 {highestRated.rating} · {highestRated.reviewCount}건 리뷰 · 하자보증 {highestRated.warranty}년
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] font-medium text-amber-700">주의 사항</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  최저가 업체는 하자보증 {lowestBid.warranty}년으로 짧음. 자재 등급 확인 필요.
                </p>
              </div>
            </div>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">정렬:</span>
            {(
              [
                { key: "price", label: "금액순" },
                { key: "duration", label: "공기순" },
                { key: "rating", label: "평점순" },
              ] as { key: SortKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === opt.key
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 입찰 카드 목록 */}
          <div className="space-y-3">
            {sortedBids.map((bid, idx) => {
              const isSelected = selectedBidId === bid.id;
              const isBest = bid.id === highestRated.id;
              const isLowest = bid.id === lowestBid.id;
              const isFastest = bid.id === fastestBid.id;

              return (
                <div
                  key={bid.id}
                  className={`bg-white rounded-xl border-2 p-5 transition-all ${
                    isSelected
                      ? "border-blue-500 shadow-lg"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* 순번 */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                      {idx + 1}
                    </div>

                    {/* 업체 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900">{bid.companyName}</h4>
                        {isBest && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full flex items-center gap-0.5">
                            <Medal className="w-3 h-3" /> AI 추천
                          </span>
                        )}
                        {isLowest && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">
                            최저가
                          </span>
                        )}
                        {isFastest && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">
                            최단 공기
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          {bid.rating} ({bid.reviewCount})
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Building2 className="w-3 h-3" />
                          시공 {bid.totalProjects}건
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {bid.region}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {bid.specialties.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{bid.message}</p>
                    </div>

                    {/* 금액 + 조건 */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {formatNumber(bid.bidAmount)}
                        <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          공기 {bid.duration}일
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          하자보증 {bid.warranty}년
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> 연락
                        </button>
                        <button
                          onClick={() => setSelectedBidId(bid.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                        >
                          {isSelected ? "선정됨 ✓" : "이 업체 선정"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 선정 확인 */}
          {selectedBidId && (
            <div className="bg-blue-600 text-white rounded-xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {MOCK_BIDS.find((b) => b.id === selectedBidId)?.companyName} 선정
                </p>
                <p className="text-sm text-blue-200 mt-0.5">
                  계약 진행을 시작하시겠습니까?
                </p>
              </div>
              <button className="px-5 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
                계약 시작하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
