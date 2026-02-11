"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  FileText,
  Calendar,
  Clock,
  Home,
  Volume2,
  DollarSign,
  CheckCircle2,
  Star,
  MapPin,
  Medal,
  Phone,
  Building2,
  ShieldCheck,
  TrendingDown,
  ThumbsUp,
  Loader2,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";

// Mock 입찰 데이터
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
  duration: number;
  warranty: number;
  message: string;
  aiTag: string;
  aiReason: string;
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
    specialties: ["아파트", "주거 리모델링"],
    bidAmount: 12500000,
    duration: 21,
    warranty: 2,
    message: "안녕하세요. 25년 경력의 대한인테리어입니다. 꼼꼼한 시공과 하자 보증으로 만족스러운 결과를 약속드립니다.",
    aiTag: "AI 추천",
    aiReason: "평점 최고, 유사 프로젝트 경험 풍부",
  },
  {
    id: "bid-2",
    companyName: "미래건설 인테리어",
    representative: "박시공",
    phone: "010-9876-5432",
    region: "서울 강남",
    rating: 4.6,
    reviewCount: 89,
    totalProjects: 215,
    specialties: ["모던 인테리어", "오피스텔"],
    bidAmount: 11200000,
    duration: 18,
    warranty: 1,
    message: "합리적인 가격에 트렌디한 디자인을 제공합니다. 3D 렌더링 기반 시공으로 오차를 최소화합니다.",
    aiTag: "최저가",
    aiReason: "견적 대비 10.4% 저렴, 빠른 공기",
  },
  {
    id: "bid-3",
    companyName: "한빛홈데코",
    representative: "이인테",
    phone: "010-5555-7777",
    region: "서울 서초/송파",
    rating: 4.9,
    reviewCount: 203,
    totalProjects: 487,
    specialties: ["고급 인테리어", "자재 전문"],
    bidAmount: 14800000,
    duration: 25,
    warranty: 3,
    message: "프리미엄 자재와 장인 시공으로 차별화된 결과를 제공합니다. 3년 하자보증은 저희만의 자신감입니다.",
    aiTag: "프리미엄",
    aiReason: "최장 보증 3년, 최다 시공 실적",
  },
  {
    id: "bid-4",
    companyName: "청춘리빙",
    representative: "최청춘",
    phone: "010-3333-4444",
    region: "서울 강남/역삼",
    rating: 4.5,
    reviewCount: 56,
    totalProjects: 98,
    specialties: ["원룸/투룸", "소형 평수"],
    bidAmount: 10800000,
    duration: 15,
    warranty: 1,
    message: "젊은 감각으로 빠르고 깔끔한 시공을 약속합니다. 소형 평수 전문으로 효율적인 공간 활용에 자신 있습니다.",
    aiTag: "빠른 시공",
    aiReason: "최단 공기 15일, 합리적 가격",
  },
];

const AI_TAG_STYLES: Record<string, string> = {
  "AI 추천": "bg-blue-100 text-blue-700",
  최저가: "bg-green-100 text-green-700",
  프리미엄: "bg-purple-100 text-purple-700",
  "빠른 시공": "bg-amber-100 text-amber-700",
};

export default function RfqPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateRfq, updateStatus } = useProjectState(projectId);

  const [step, setStep] = useState<"form" | "sending" | "bids">(
    project?.rfq?.sentAt ? "bids" : "form"
  );

  // 폼 상태
  const [specialNotes, setSpecialNotes] = useState(project?.rfq?.specialNotes || "");
  const [preferredStartDate, setPreferredStartDate] = useState(project?.rfq?.preferredStartDate || "");
  const [preferredDuration, setPreferredDuration] = useState(project?.rfq?.preferredDuration || "");
  const [budgetRange, setBudgetRange] = useState(project?.rfq?.budgetRange || "");
  const [livingDuringWork, setLivingDuringWork] = useState(project?.rfq?.livingDuringWork || false);
  const [noiseRestriction, setNoiseRestriction] = useState(project?.rfq?.noiseRestriction || "");

  const [selectedBid, setSelectedBid] = useState<string | null>(project?.rfq?.selectedBidId || null);

  // 견적요청 발송
  const handleSubmitRfq = useCallback(async () => {
    setStep("sending");

    updateRfq({
      specialNotes,
      preferredStartDate,
      preferredDuration,
      budgetRange,
      livingDuringWork,
      noiseRestriction,
      sentAt: new Date().toISOString(),
    });
    updateStatus("RFQ");

    // Mock: 발송 시뮬레이션
    await new Promise((r) => setTimeout(r, 2000));
    setStep("bids");
  }, [specialNotes, preferredStartDate, preferredDuration, budgetRange, livingDuringWork, noiseRestriction, updateRfq, updateStatus]);

  // 업체 선정
  const handleSelectBid = (bidId: string) => {
    setSelectedBid(bidId);
    updateRfq({ selectedBidId: bidId });
  };

  // 계약 확정
  const handleConfirmContract = () => {
    updateStatus("CONTRACTED");
    router.push(`/project/${projectId}`);
  };

  const estimate = project?.estimate;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}/estimate`)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 물량산출
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-purple-600" />
            견적요청
          </h2>
          {step === "bids" && (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 발송 완료
            </span>
          )}
        </div>
        {selectedBid && (
          <button
            onClick={handleConfirmContract}
            className="flex items-center gap-1 px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> 업체 확정
          </button>
        )}
      </div>

      {/* 메인 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {step === "form" && (
          /* 특기사항 입력 폼 */
          <div className="max-w-2xl mx-auto p-6">
            {/* 프로젝트 요약 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">프로젝트 요약</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">주소</span>
                  <span className="font-medium text-gray-900 ml-auto">
                    {project?.address?.roadAddress || "미설정"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">면적</span>
                  <span className="font-medium text-gray-900 ml-auto">
                    {project?.address?.exclusiveArea || 0}m²
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">예상 견적</span>
                  <span className="font-medium text-gray-900 ml-auto">
                    {estimate ? `${estimate.grandTotal.toLocaleString()}원` : "미산출"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">건물 유형</span>
                  <span className="font-medium text-gray-900 ml-auto">
                    {project?.address?.buildingType || "미설정"}
                  </span>
                </div>
              </div>
            </div>

            {/* 특기사항 폼 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-bold text-gray-900">특기사항 입력</h3>

              {/* 시공 희망 기간 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  희망 시공 시작일
                </label>
                <input
                  type="date"
                  value={preferredStartDate}
                  onChange={(e) => setPreferredStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* 공사 기간 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  희망 공사 기간
                </label>
                <select
                  value={preferredDuration}
                  onChange={(e) => setPreferredDuration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">선택 안 함</option>
                  <option value="2주 이내">2주 이내</option>
                  <option value="3주">약 3주</option>
                  <option value="4주">약 4주 (1개월)</option>
                  <option value="6주">약 6주</option>
                  <option value="기간 무관">기간 무관</option>
                </select>
              </div>

              {/* 예산 범위 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                  예산 범위
                </label>
                <select
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">선택 안 함</option>
                  <option value="500만원 이하">500만원 이하</option>
                  <option value="500~1000만원">500~1,000만원</option>
                  <option value="1000~1500만원">1,000~1,500만원</option>
                  <option value="1500~2000만원">1,500~2,000만원</option>
                  <option value="2000~3000만원">2,000~3,000만원</option>
                  <option value="3000만원 이상">3,000만원 이상</option>
                </select>
              </div>

              {/* 거주 중 시공 */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={livingDuringWork}
                    onChange={(e) => setLivingDuringWork(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    <Home className="w-3.5 h-3.5 inline mr-1" />
                    거주 중 시공
                  </span>
                  <span className="text-[10px] text-gray-400">(시공 기간 중 해당 주소에 거주합니다)</span>
                </label>
              </div>

              {/* 소음 제한 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <Volume2 className="w-3.5 h-3.5 inline mr-1" />
                  소음 제한 시간대
                </label>
                <input
                  type="text"
                  value={noiseRestriction}
                  onChange={(e) => setNoiseRestriction(e.target.value)}
                  placeholder="예: 평일 오전 9시~오후 5시만 가능"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* 추가 요청사항 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  추가 요청사항
                </label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  rows={4}
                  placeholder="시공 관련 추가 요청사항이 있으면 자유롭게 입력해주세요."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* 발송 버튼 */}
              <button
                onClick={handleSubmitRfq}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                견적요청 발송
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                주변 지역의 검증된 인테리어 업체에 견적 요청이 발송됩니다.
              </p>
            </div>
          </div>
        )}

        {step === "sending" && (
          /* 발송 중 */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">견적요청을 발송하고 있습니다</h3>
              <p className="text-sm text-gray-500">주변 인테리어 업체에 프로젝트 정보를 전달 중...</p>
            </div>
          </div>
        )}

        {step === "bids" && (
          /* 입찰 목록 */
          <div className="max-w-3xl mx-auto p-6">
            {/* AI 분석 헤더 */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ThumbsUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">AI 입찰 분석 결과</h3>
                  <p className="text-xs text-gray-600">
                    {MOCK_BIDS.length}개 업체가 입찰했습니다.
                    견적 범위: {Math.min(...MOCK_BIDS.map((b) => b.bidAmount)).toLocaleString()}원 ~{" "}
                    {Math.max(...MOCK_BIDS.map((b) => b.bidAmount)).toLocaleString()}원.{" "}
                    <strong className="text-blue-700">대한인테리어</strong>가 AI 종합 추천 1위입니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 입찰 카드 목록 */}
            <div className="space-y-4">
              {MOCK_BIDS.map((bid) => {
                const isSelected = selectedBid === bid.id;
                const isRecommended = bid.aiTag === "AI 추천";

                return (
                  <div
                    key={bid.id}
                    className={`bg-white rounded-xl border overflow-hidden transition-all ${
                      isSelected
                        ? "border-green-400 ring-2 ring-green-200"
                        : isRecommended
                          ? "border-blue-300"
                          : "border-gray-200"
                    }`}
                  >
                    {/* AI 태그 */}
                    {bid.aiTag && (
                      <div className="px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${AI_TAG_STYLES[bid.aiTag] || "bg-gray-100 text-gray-600"}`}>
                          {bid.aiTag}
                        </span>
                        <span className="text-[10px] text-gray-400">{bid.aiReason}</span>
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-gray-900">{bid.companyName}</h4>
                            <div className="flex items-center gap-0.5 text-amber-500">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="text-xs font-medium">{bid.rating}</span>
                              <span className="text-[10px] text-gray-400">({bid.reviewCount})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {bid.region}
                            </span>
                            <span className="flex items-center gap-1">
                              <Medal className="w-3 h-3" /> {bid.totalProjects}건 시공
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {bid.bidAmount.toLocaleString()}
                            <span className="text-xs font-normal text-gray-500">원</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {bid.duration}일
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" /> 보증 {bid.warranty}년
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 전문 분야 */}
                      <div className="flex gap-1 mb-2">
                        {bid.specialties.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* 메시지 */}
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                        &quot;{bid.message}&quot;
                      </p>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectBid(bid.id)}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                            isSelected
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> 선택됨
                            </>
                          ) : (
                            "업체 선택"
                          )}
                        </button>
                        <button className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <Phone className="w-3.5 h-3.5" /> 연락하기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 안내 */}
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium mb-1">입찰 안내</p>
                  <ul className="space-y-0.5 text-[11px]">
                    <li>- 업체 선택 후 &quot;업체 확정&quot; 버튼을 눌러 계약을 진행합니다.</li>
                    <li>- 실측 후 최종 견적이 변경될 수 있습니다.</li>
                    <li>- 모든 업체는 INPICK 검증을 완료한 등록 사업자입니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
