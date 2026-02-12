"use client";

import { useState, useCallback, useEffect } from "react";
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
  Inbox,
  RefreshCw,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useAuth } from "@/hooks/useAuth";

const AI_TAG_STYLES: Record<string, string> = {
  "AI 추천": "bg-blue-100 text-blue-700",
  최저가: "bg-green-100 text-green-700",
  프리미엄: "bg-purple-100 text-purple-700",
  "빠른 시공": "bg-amber-100 text-amber-700",
};

// 입찰에 AI 태그 부여
function assignAiTag(bid: BidData, allBids: BidData[]): { tag: string; reason: string } {
  const minAmount = Math.min(...allBids.map((b) => b.bid_amount));
  const maxRating = Math.max(...allBids.map((b) => b.specialty_contractors?.rating || 0));
  const minDays = Math.min(...allBids.map((b) => b.estimated_days || 99));
  const maxWarranty = Math.max(...allBids.map((b) => (b.metadata?.warranty_months as number) || 0));

  if (bid.specialty_contractors?.rating === maxRating && bid.specialty_contractors?.rating >= 4.5) {
    return { tag: "AI 추천", reason: `평점 ${bid.specialty_contractors.rating}, 종합 최우수` };
  }
  if (bid.bid_amount === minAmount) {
    return { tag: "최저가", reason: `최저 금액 ${bid.bid_amount.toLocaleString()}원` };
  }
  if ((bid.metadata?.warranty_months || 0) === maxWarranty && maxWarranty >= 24) {
    return { tag: "프리미엄", reason: `최장 보증 ${maxWarranty / 12}년` };
  }
  if ((bid.estimated_days || 99) === minDays) {
    return { tag: "빠른 시공", reason: `최단 공기 ${minDays}일` };
  }
  return { tag: "", reason: "" };
}

interface BidData {
  id: string;
  estimate_id: string;
  contractor_id: string;
  bid_amount: number;
  discount_rate?: number;
  estimated_days?: number;
  start_available_date?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  status: string;
  created_at: string;
  specialty_contractors?: {
    id: string;
    company_name: string;
    contact_name: string;
    rating: number;
    total_reviews: number;
    completed_projects: number;
    is_verified: boolean;
    contractor_trades?: { trade_code: string; trade_name: string; experience_years: number }[];
  };
}

export default function RfqPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateRfq, updateStatus, setEstimateId } = useProjectState(projectId);
  const { user } = useAuth();

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
  const [bids, setBids] = useState<BidData[]>([]);
  const [bidLoading, setBidLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Supabase 폴백: localStorage에 estimateId가 없으면 서버에서 조회
  useEffect(() => {
    if (project?.estimateId || !projectId) return;

    const checkExistingRfq = async () => {
      try {
        const res = await fetch(`/api/rfq?consumerProjectId=${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.estimate) {
          setEstimateId(data.estimate.id);
          setBids(data.bids || []);
          setStep("bids");
        }
      } catch {
        // 무시
      }
    };

    checkExistingRfq();
  }, [projectId, project?.estimateId, setEstimateId]);

  // 기존 RFQ 제출 여부 확인 + 입찰 로드
  useEffect(() => {
    const estimateId = project?.estimateId;
    if (!estimateId) return;

    const loadBids = async () => {
      setBidLoading(true);
      try {
        const res = await fetch(`/api/bids?estimateId=${estimateId}`);
        if (res.ok) {
          const data = await res.json();
          setBids(data.bids || []);
        }
      } catch {
        // 무시
      } finally {
        setBidLoading(false);
      }
    };

    loadBids();

    // 30초마다 폴링
    const interval = setInterval(loadBids, 30000);
    return () => clearInterval(interval);
  }, [project?.estimateId]);

  // 견적요청 발송 (실제 API)
  const handleSubmitRfq = useCallback(async () => {
    if (!project?.address || !project?.estimate) {
      setSubmitError("주소와 견적 정보가 필요합니다. 이전 단계를 완료해주세요.");
      return;
    }

    setStep("sending");
    setSubmitError("");

    // localStorage 저장
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

    try {
      // Supabase에 RFQ 제출
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          address: project.address,
          estimateData: project.estimate,
          rfqPreferences: {
            specialNotes,
            preferredStartDate,
            preferredDuration,
            budgetRange,
            livingDuringWork,
            noiseRestriction,
          },
          userId: user?.id || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimateId(data.estimateId);
      } else {
        console.error("RFQ submission failed");
      }
    } catch (err) {
      console.error("RFQ submission error:", err);
    }

    setStep("bids");
  }, [
    project, projectId, user, specialNotes, preferredStartDate, preferredDuration,
    budgetRange, livingDuringWork, noiseRestriction, updateRfq, updateStatus, setEstimateId,
  ]);

  // 업체 선정
  const handleSelectBid = async (bidId: string) => {
    setSelectedBid(bidId);
    updateRfq({ selectedBidId: bidId });

    // Supabase에서 입찰 상태 변경
    try {
      await fetch("/api/bids", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bidId, status: "selected" }),
      });
    } catch {
      // 무시
    }
  };

  // 계약 확정
  const handleConfirmContract = async () => {
    if (!selectedBid) return;

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId: selectedBid }),
      });

      if (res.ok) {
        const data = await res.json();
        updateStatus("CONTRACTED");
        router.push(`/contract/${data.contract.id}`);
        return;
      }
    } catch {
      // 실패해도 상태는 업데이트
    }

    updateStatus("CONTRACTED");
    router.push(`/project/${projectId}`);
  };

  // 수동 새로고침
  const handleRefreshBids = async () => {
    const estimateId = project?.estimateId;
    if (!estimateId) return;

    setBidLoading(true);
    try {
      const res = await fetch(`/api/bids?estimateId=${estimateId}`);
      if (res.ok) {
        const data = await res.json();
        setBids(data.bids || []);
      }
    } catch {
      // 무시
    } finally {
      setBidLoading(false);
    }
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
        <div className="flex items-center gap-2">
          {step === "bids" && (
            <button
              onClick={handleRefreshBids}
              disabled={bidLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bidLoading ? "animate-spin" : ""}`} />
              새로고침
            </button>
          )}
          {selectedBid && (
            <button
              onClick={handleConfirmContract}
              className="flex items-center gap-1 px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> 업체 확정
            </button>
          )}
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {step === "form" && (
          <div className="max-w-2xl mx-auto p-6">
            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {submitError}
              </div>
            )}

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
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">견적요청을 발송하고 있습니다</h3>
              <p className="text-sm text-gray-500">주변 인테리어 업체에 프로젝트 정보를 전달 중...</p>
            </div>
          </div>
        )}

        {step === "bids" && (
          <div className="max-w-3xl mx-auto p-6">
            {bids.length > 0 ? (
              <>
                {/* AI 분석 헤더 */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ThumbsUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">AI 입찰 분석 결과</h3>
                      <p className="text-xs text-gray-600">
                        {bids.length}개 업체가 입찰했습니다.
                        견적 범위: {Math.min(...bids.map((b) => b.bid_amount)).toLocaleString()}원 ~{" "}
                        {Math.max(...bids.map((b) => b.bid_amount)).toLocaleString()}원.
                        {(() => {
                          const best = bids.reduce((a, b) =>
                            (a.specialty_contractors?.rating || 0) > (b.specialty_contractors?.rating || 0) ? a : b
                          );
                          return best.specialty_contractors ? (
                            <>
                              {" "}<strong className="text-blue-700">{best.specialty_contractors.company_name}</strong>이(가) AI 종합 추천 1위입니다.
                            </>
                          ) : null;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 입찰 카드 목록 */}
                <div className="space-y-4">
                  {bids.map((bid) => {
                    const isSelected = selectedBid === bid.id;
                    const { tag: aiTag, reason: aiReason } = assignAiTag(bid, bids);
                    const isRecommended = aiTag === "AI 추천";
                    const contractor = bid.specialty_contractors;
                    const trades = contractor?.contractor_trades || [];
                    const warrantyMonths = (bid.metadata?.warranty_months as number) || 12;

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
                        {aiTag && (
                          <div className="px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${AI_TAG_STYLES[aiTag] || "bg-gray-100 text-gray-600"}`}>
                              {aiTag}
                            </span>
                            <span className="text-[10px] text-gray-400">{aiReason}</span>
                          </div>
                        )}

                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-gray-900">
                                  {contractor?.company_name || "업체"}
                                </h4>
                                {contractor && (
                                  <div className="flex items-center gap-0.5 text-amber-500">
                                    <Star className="w-3 h-3 fill-current" />
                                    <span className="text-xs font-medium">{contractor.rating}</span>
                                    <span className="text-[10px] text-gray-400">({contractor.total_reviews})</span>
                                  </div>
                                )}
                                {contractor?.is_verified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {contractor?.contact_name || ""}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Medal className="w-3 h-3" /> {contractor?.completed_projects || 0}건 시공
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                {bid.bid_amount.toLocaleString()}
                                <span className="text-xs font-normal text-gray-500">원</span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {bid.estimated_days || 30}일
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <ShieldCheck className="w-3 h-3" /> 보증 {Math.round(warrantyMonths / 12)}년
                                </span>
                              </div>
                            </div>
                          </div>

                          {trades.length > 0 && (
                            <div className="flex gap-1 mb-2">
                              {trades.map((t) => (
                                <span key={t.trade_code} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                                  {t.trade_name}
                                </span>
                              ))}
                            </div>
                          )}

                          {bid.message && (
                            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                              &quot;{bid.message}&quot;
                            </p>
                          )}

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
              </>
            ) : (
              /* 입찰 대기 중 UI */
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">사업자 검토 중</h3>
                <p className="text-sm text-gray-500 mb-1">
                  견적요청이 성공적으로 발송되었습니다.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  주변 인테리어 업체들이 프로젝트를 검토하고 입찰서를 작성하고 있습니다.
                  <br />
                  입찰이 도착하면 이 화면에 자동으로 표시됩니다. (30초마다 갱신)
                </p>
                <button
                  onClick={handleRefreshBids}
                  disabled={bidLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-200 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${bidLoading ? "animate-spin" : ""}`} />
                  {bidLoading ? "확인 중..." : "지금 확인하기"}
                </button>
              </div>
            )}

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
