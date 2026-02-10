"use client";

import { useState } from "react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import {
  Loader2, Users, Search, Star, Shield, Clock, MapPin, Send, X, Award,
} from "lucide-react";

const TRADE_OPTIONS = [
  { code: "INT_GENERAL", name: "인테리어 종합" },
  { code: "DEMOLITION", name: "철거" },
  { code: "PLUMBING", name: "설비/배관" },
  { code: "ELECTRICAL", name: "전기" },
  { code: "CARPENTRY", name: "목공" },
  { code: "TILING", name: "타일" },
  { code: "WATERPROOF", name: "방수" },
  { code: "WALLPAPER", name: "도배" },
  { code: "PAINTING", name: "도장" },
  { code: "FLOORING", name: "바닥재" },
  { code: "WINDOW_DOOR", name: "창호/도어" },
  { code: "FURNITURE", name: "가구/수납" },
  { code: "KITCHEN_BATH", name: "주방/욕실" },
  { code: "HVAC", name: "냉난방/환기" },
  { code: "FIRE_SAFETY", name: "소방" },
  { code: "CLEANING", name: "준공 청소" },
];

const REGION_OPTIONS = [
  { value: "seoul", label: "서울" },
  { value: "gyeonggi", label: "경기" },
  { value: "incheon", label: "인천" },
  { value: "busan", label: "부산" },
  { value: "daegu", label: "대구" },
  { value: "daejeon", label: "대전" },
  { value: "gwangju", label: "광주" },
  { value: "ulsan", label: "울산" },
  { value: "sejong", label: "세종" },
  { value: "gangwon", label: "강원" },
  { value: "chungbuk", label: "충북" },
  { value: "chungnam", label: "충남" },
  { value: "jeonbuk", label: "전북" },
  { value: "jeonnam", label: "전남" },
  { value: "gyeongbuk", label: "경북" },
  { value: "gyeongnam", label: "경남" },
  { value: "jeju", label: "제주" },
];

interface MatchResult {
  contractor: {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    region: string;
    rating: number;
    totalReviews: number;
    isVerified: boolean;
  };
  scores: {
    distance: number;
    rating: number;
    price: number;
    schedule: number;
    experience: number;
    reliability: number;
    total: number;
  };
  tradeInfo: {
    experienceYears: number;
    isPrimary: boolean;
  };
  isAvailable: boolean;
}

const SCORE_LABELS: Record<string, string> = {
  distance: "거리",
  rating: "평점",
  price: "가격",
  schedule: "일정",
  experience: "경력",
  reliability: "신뢰도",
};

export default function MatchingPage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [region, setRegion] = useState("seoul");
  const [budgetMax, setBudgetMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 협업 요청 모달
  const [collabTarget, setCollabTarget] = useState<MatchResult | null>(null);
  const [collabForm, setCollabForm] = useState({ message: "", proposedAmount: "", startDate: "", endDate: "" });
  const [collabSending, setCollabSending] = useState(false);

  const toggleTrade = (code: string) => {
    setSelectedTrades((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSearch = async () => {
    if (selectedTrades.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      // 각 공종별로 매칭 후 합산
      const allResults: MatchResult[] = [];
      const seenIds = new Set<string>();

      for (const tradeCode of selectedTrades) {
        const res = await fetch("/api/matching", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tradeCode,
            region,
            budgetMax: budgetMax ? Number(budgetMax) : undefined,
            startDate: startDate || undefined,
          }),
        });
        const data = await res.json();
        for (const m of data.matches || []) {
          if (!seenIds.has(m.contractor.id) && m.contractor.id !== contractorId) {
            seenIds.add(m.contractor.id);
            allResults.push(m);
          }
        }
      }

      allResults.sort((a, b) => b.scores.total - a.scores.total);
      setResults(allResults);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleCollabRequest = async () => {
    if (!contractorId || !collabTarget) return;
    setCollabSending(true);
    try {
      const res = await fetch("/api/contractor/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: contractorId,
          targetId: collabTarget.contractor.id,
          message: collabForm.message || null,
          proposedAmount: collabForm.proposedAmount ? Number(collabForm.proposedAmount) : null,
          proposedStartDate: collabForm.startDate || null,
          proposedEndDate: collabForm.endDate || null,
        }),
      });
      if (res.ok) {
        setCollabTarget(null);
        setCollabForm({ message: "", proposedAmount: "", startDate: "", endDate: "" });
        alert("협업 요청이 전송되었습니다");
      }
    } catch { /* ignore */ } finally { setCollabSending(false); }
  };

  if (!authChecked) return null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-purple-600" /> 전문업체 매칭
      </h1>

      {/* 검색 조건 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">공종 선택</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {TRADE_OPTIONS.map((t) => (
            <button key={t.code} onClick={() => toggleTrade(t.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedTrades.includes(t.code) ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">지역</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {REGION_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">예산 상한 (원)</label>
            <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">시작 가능일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={handleSearch} disabled={loading || selectedTrades.length === 0}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 매칭 검색
            </button>
          </div>
        </div>
      </div>

      {/* 결과 */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">조건에 맞는 업체가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((m, idx) => (
            <div key={m.contractor.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono text-gray-400 w-6">#{idx + 1}</span>
                    <h3 className="text-sm font-semibold text-gray-900">{m.contractor.companyName}</h3>
                    {m.contractor.isVerified && <Shield className="w-4 h-4 text-blue-500" />}
                    {m.tradeInfo.isPrimary && <Award className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" />{m.contractor.rating.toFixed(1)} ({m.contractor.totalReviews})</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{REGION_OPTIONS.find(r => r.value === m.contractor.region)?.label || m.contractor.region}</span>
                    <span>경력 {m.tradeInfo.experienceYears}년</span>
                    <span className={`flex items-center gap-1 ${m.isAvailable ? "text-green-600" : "text-red-500"}`}>
                      <Clock className="w-3 h-3" />{m.isAvailable ? "가용" : "불가"}
                    </span>
                  </div>
                  {/* 점수 바 */}
                  <div className="grid grid-cols-6 gap-2">
                    {Object.entries(SCORE_LABELS).map(([key, label]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-gray-400">{label}</span>
                          <span className="text-xs font-medium text-gray-700">{m.scores[key as keyof typeof m.scores]}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${m.scores[key as keyof typeof m.scores]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{m.scores.total}%</p>
                    <p className="text-xs text-gray-500">매치율</p>
                  </div>
                  <button onClick={() => setCollabTarget(m)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 flex items-center gap-1">
                    <Send className="w-3 h-3" /> 협업 요청
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 협업 요청 모달 */}
      {collabTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">협업 요청: {collabTarget.contractor.companyName}</h3>
              <button onClick={() => setCollabTarget(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">메시지</label>
                <textarea value={collabForm.message} onChange={(e) => setCollabForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="협업 요청 내용을 작성하세요" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">제안 금액 (원)</label>
                <input type="number" value={collabForm.proposedAmount} onChange={(e) => setCollabForm(f => ({ ...f, proposedAmount: e.target.value }))}
                  placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={collabForm.startDate} onChange={(e) => setCollabForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={collabForm.endDate} onChange={(e) => setCollabForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCollabTarget(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleCollabRequest} disabled={collabSending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
                {collabSending && <Loader2 className="w-4 h-4 animate-spin" />} 요청 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
