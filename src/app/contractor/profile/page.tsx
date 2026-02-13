"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Save, Plus, X, Star, Trash2, Edit3,
  Building2, Phone, Mail, MapPin, FileText, Briefcase, Image, Upload,
} from "lucide-react";
import { useContractorAuth } from "@/hooks/useContractorAuth";

const TRADE_OPTIONS = [
  { code: "T01", label: "도배" }, { code: "T02", label: "타일" },
  { code: "T03", label: "목공" }, { code: "T04", label: "전기" },
  { code: "T05", label: "설비" }, { code: "T06", label: "도장" },
  { code: "T07", label: "철거" }, { code: "T08", label: "방수" },
  { code: "T09", label: "금속" }, { code: "T10", label: "유리" },
  { code: "T15", label: "주방가구" }, { code: "T16", label: "붙박이장" },
  { code: "T17", label: "바닥재" }, { code: "T18", label: "조명" },
  { code: "T19", label: "욕실" }, { code: "T22", label: "청소" },
];

const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

type Tab = "info" | "trades" | "docs" | "portfolio" | "reviews";

interface ProfileData {
  companyName: string;
  representativeName: string;
  phone: string;
  email: string;
  address: string;
  region: string;
  licenseNumber: string;
  introduction: string;
  businessLicenseUrl: string;
}

interface TradeItem { code: string; label: string; experienceYears: number; isPrimary: boolean; }
interface PortfolioItem { id: string; title: string; description: string; project_type: string; completion_date: string; images: string[]; tags: string[]; }
interface ReviewItem { id: string; overall_rating?: number; rating?: number; content: string; response_content?: string; response_at?: string; created_at: string; is_verified?: boolean; }

export default function ProfilePage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 기본 정보
  const [profile, setProfile] = useState<ProfileData>({
    companyName: "", representativeName: "", phone: "", email: "",
    address: "", region: "", licenseNumber: "", introduction: "", businessLicenseUrl: "",
  });

  // 공종
  const [trades, setTrades] = useState<TradeItem[]>([]);

  // 포트폴리오
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({ title: "", description: "", projectType: "", completionDate: "", imageUrl: "", tags: "" });
  const [portfolioImageUrls, setPortfolioImageUrls] = useState<string[]>([]);

  // 리뷰
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewStats, setReviewStats] = useState({ totalReviews: 0, averageRating: 0 });
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authChecked || !contractorId) return;
    loadProfile();
  }, [authChecked, contractorId]);

  async function loadProfile() {
    setLoading(true);
    try {
      const [profileRes, portfolioRes, reviewRes] = await Promise.all([
        fetch(`/api/contractor/profile?contractorId=${contractorId}`),
        fetch(`/api/contractor/portfolio?contractorId=${contractorId}`),
        fetch(`/api/contractor/reviews?contractorId=${contractorId}`),
      ]);

      const profileData = await profileRes.json();
      const portfolioData = await portfolioRes.json();
      const reviewData = await reviewRes.json();

      if (profileData.contractor) {
        const c = profileData.contractor;
        setProfile({
          companyName: c.company_name || "",
          representativeName: c.contact_name || c.representative_name || "",
          phone: c.phone || "",
          email: c.email || "",
          address: c.address || "",
          region: c.region || "",
          licenseNumber: c.license_number || "",
          introduction: c.introduction || c.description || "",
          businessLicenseUrl: c.business_license_url || "",
        });
        const dbTrades = (c.contractor_trades || []) as { trade_code: string; trade_name: string; experience_years: number; is_primary: boolean }[];
        setTrades(dbTrades.map(t => ({
          code: t.trade_code, label: t.trade_name,
          experienceYears: t.experience_years || 0, isPrimary: t.is_primary || false,
        })));
      }

      setPortfolio(portfolioData.portfolio || []);
      setReviews(reviewData.reviews || []);
      setReviewStats(reviewData.stats || { totalReviews: 0, averageRating: 0 });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/contractor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId, ...profile, trades }),
      });
      if (res.ok) {
        setMessage("저장되었습니다");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("저장 실패");
      }
    } catch {
      setMessage("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  function toggleTrade(code: string) {
    const exists = trades.find(t => t.code === code);
    if (exists) {
      setTrades(trades.filter(t => t.code !== code));
    } else {
      const opt = TRADE_OPTIONS.find(o => o.code === code);
      if (opt) setTrades([...trades, { code, label: opt.label, experienceYears: 1, isPrimary: trades.length === 0 }]);
    }
  }

  async function addPortfolio() {
    if (!portfolioForm.title) return;
    try {
      const allImages = [
        ...portfolioImageUrls.map((url, i) => ({ url, caption: "", order: i })),
        ...(portfolioForm.imageUrl ? [{ url: portfolioForm.imageUrl, caption: "", order: portfolioImageUrls.length }] : []),
      ];
      const res = await fetch("/api/contractor/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId,
          title: portfolioForm.title,
          description: portfolioForm.description,
          projectType: portfolioForm.projectType,
          completionDate: portfolioForm.completionDate || null,
          images: allImages,
          tags: portfolioForm.tags ? portfolioForm.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
        }),
      });
      if (res.ok) {
        setShowPortfolioForm(false);
        setPortfolioForm({ title: "", description: "", projectType: "", completionDate: "", imageUrl: "", tags: "" });
        setPortfolioImageUrls([]);
        loadProfile();
      }
    } catch { /* ignore */ }
  }

  async function deletePortfolio(id: string) {
    try {
      await fetch(`/api/contractor/portfolio?id=${id}&contractorId=${contractorId}`, { method: "DELETE" });
      setPortfolio(portfolio.filter(p => p.id !== id));
    } catch { /* ignore */ }
  }

  async function submitResponse(reviewId: string) {
    const content = responseText[reviewId];
    if (!content?.trim()) return;
    try {
      const res = await fetch("/api/contractor/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, contractorId, responseContent: content }),
      });
      if (res.ok) {
        setResponseText(prev => ({ ...prev, [reviewId]: "" }));
        loadProfile();
      }
    } catch { /* ignore */ }
  }

  if (!authChecked || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "기본 정보" },
    { key: "trades", label: "공종 설정" },
    { key: "docs", label: "서류" },
    { key: "portfolio", label: "포트폴리오" },
    { key: "reviews", label: "리뷰" },
  ];

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">프로필 설정</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${message.includes("실패") || message.includes("오류") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      {/* 기본 정보 탭 */}
      {tab === "info" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block"><Building2 className="w-4 h-4 inline mr-1" />상호명</label>
              <input value={profile.companyName} onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">대표자명</label>
              <input value={profile.representativeName} onChange={e => setProfile({ ...profile, representativeName: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block"><Phone className="w-4 h-4 inline mr-1" />연락처</label>
              <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block"><Mail className="w-4 h-4 inline mr-1" />이메일</label>
              <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block"><MapPin className="w-4 h-4 inline mr-1" />지역</label>
              <select value={profile.region} onChange={e => setProfile({ ...profile, region: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">선택</option>
                {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block"><FileText className="w-4 h-4 inline mr-1" />사업자등록번호</label>
              <input value={profile.licenseNumber} onChange={e => setProfile({ ...profile, licenseNumber: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block"><MapPin className="w-4 h-4 inline mr-1" />상세 주소</label>
            <input value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">업체 소개 (500자 이내)</label>
            <textarea value={profile.introduction} onChange={e => setProfile({ ...profile, introduction: e.target.value })}
              maxLength={500} rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            <p className="text-xs text-gray-400 mt-1">{profile.introduction.length}/500</p>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
        </div>
      )}

      {/* 공종 설정 탭 */}
      {tab === "trades" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-4">수행 가능한 공종을 선택하세요. 첫 번째 선택이 주력 공종이 됩니다.</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {TRADE_OPTIONS.map(opt => {
              const selected = trades.find(t => t.code === opt.code);
              return (
                <button key={opt.code} onClick={() => toggleTrade(opt.code)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                  {opt.label}
                  {selected?.isPrimary && <span className="ml-1 text-xs opacity-80">(주력)</span>}
                </button>
              );
            })}
          </div>

          {trades.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-gray-700">경력 설정</h3>
              {trades.map((t, idx) => (
                <div key={t.code} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-gray-900 w-20">{t.label}</span>
                  <input type="number" min={0} max={50} value={t.experienceYears}
                    onChange={e => {
                      const updated = [...trades];
                      updated[idx] = { ...t, experienceYears: parseInt(e.target.value) || 0 };
                      setTrades(updated);
                    }}
                    className="w-20 px-2 py-1.5 rounded border border-gray-300 text-sm text-center" />
                  <span className="text-xs text-gray-500">년</span>
                  {idx === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">주력</span>}
                </div>
              ))}
            </div>
          )}

          <button onClick={saveProfile} disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
        </div>
      )}

      {/* 서류 탭 */}
      {tab === "docs" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">사업자등록증</label>
            <FileDropZone
              accept="image/jpeg,image/png,image/webp,application/pdf"
              contractorId={contractorId || ""}
              folder="documents"
              onUploaded={(url) => setProfile({ ...profile, businessLicenseUrl: url })}
            />
          </div>
          {profile.businessLicenseUrl && (
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">미리보기</p>
              {profile.businessLicenseUrl.endsWith(".pdf") ? (
                <a href={profile.businessLicenseUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <FileText className="w-4 h-4" /> PDF 파일 열기
                </a>
              ) : (
                <img src={profile.businessLicenseUrl} alt="사업자등록증" className="max-w-xs rounded" onError={e => (e.currentTarget.style.display = "none")} />
              )}
            </div>
          )}
          <button onClick={saveProfile} disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
        </div>
      )}

      {/* 포트폴리오 탭 */}
      {tab === "portfolio" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{portfolio.length}개의 포트폴리오</p>
            <button onClick={() => setShowPortfolioForm(true)}
              className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>

          {showPortfolioForm && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">새 포트폴리오</h3>
                <button onClick={() => setShowPortfolioForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <input value={portfolioForm.title} onChange={e => setPortfolioForm({ ...portfolioForm, title: e.target.value })}
                placeholder="프로젝트 제목 *" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm" />
              <textarea value={portfolioForm.description} onChange={e => setPortfolioForm({ ...portfolioForm, description: e.target.value })}
                placeholder="설명" rows={3} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={portfolioForm.projectType} onChange={e => setPortfolioForm({ ...portfolioForm, projectType: e.target.value })}
                  placeholder="공간 유형 (예: 아파트)" className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm" />
                <input type="date" value={portfolioForm.completionDate} onChange={e => setPortfolioForm({ ...portfolioForm, completionDate: e.target.value })}
                  className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">이미지 업로드</label>
                <FileDropZone
                  accept="image/jpeg,image/png,image/webp"
                  contractorId={contractorId || ""}
                  folder="portfolio"
                  onUploaded={(url) => setPortfolioImageUrls(prev => [...prev, url])}
                />
                {portfolioImageUrls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {portfolioImageUrls.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded border border-gray-200 overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setPortfolioImageUrls(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input value={portfolioForm.imageUrl} onChange={e => setPortfolioForm({ ...portfolioForm, imageUrl: e.target.value })}
                placeholder="또는 이미지 URL 직접 입력" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm" />
              <input value={portfolioForm.tags} onChange={e => setPortfolioForm({ ...portfolioForm, tags: e.target.value })}
                placeholder="태그 (쉼표 구분: 모던, 미니멀)" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm" />
              <button onClick={addPortfolio} disabled={!portfolioForm.title}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">등록</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {portfolio.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {item.images && item.images.length > 0 && typeof item.images[0] === "object" ? (
                  <div className="h-40 bg-gray-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-300" />
                  </div>
                ) : (
                  <div className="h-40 bg-gray-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                    <button onClick={() => deletePortfolio(item.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(item.tags as string[]).map((tag, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {portfolio.length === 0 && !showPortfolioForm && (
            <div className="text-center py-12">
              <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">포트폴리오가 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">시공 사례를 추가하면 입찰 선정 확률이 높아집니다</p>
            </div>
          )}
        </div>
      )}

      {/* 리뷰 탭 */}
      {tab === "reviews" && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{reviewStats.averageRating || "-"}</p>
              <div className="flex justify-center mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(reviewStats.averageRating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{reviewStats.totalReviews}개 리뷰</p>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= (review.overall_rating || review.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                  {review.is_verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">인증됨</span>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(review.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="text-sm text-gray-800">{review.content}</p>

                {review.response_content ? (
                  <div className="mt-3 bg-blue-50 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">업체 답변</p>
                    <p className="text-sm text-blue-900">{review.response_content}</p>
                    {review.response_at && (
                      <p className="text-xs text-blue-400 mt-1">{new Date(review.response_at).toLocaleDateString("ko-KR")}</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <textarea value={responseText[review.id] || ""} onChange={e => setResponseText({ ...responseText, [review.id]: e.target.value })}
                      placeholder="답변 작성..." rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none" />
                    <button onClick={() => submitResponse(review.id)} disabled={!responseText[review.id]?.trim()}
                      className="mt-2 inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                      <Edit3 className="w-3 h-3" /> 답변 등록
                    </button>
                  </div>
                )}
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="text-center py-12">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">아직 리뷰가 없습니다</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FileDropZone({ accept, contractorId, folder, onUploaded }: {
  accept: string;
  contractorId: string;
  folder: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (file: File) => {
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("파일 크기가 5MB를 초과합니다.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractorId", contractorId);
      formData.append("folder", folder);

      const res = await fetch("/api/contractor/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        onUploaded(data.url);
      } else {
        setError(data.error || "업로드 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
          ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"}`}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">업로드 중...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-gray-400" />
            <p className="text-sm text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-xs text-gray-400">JPG, PNG, PDF (최대 5MB)</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
