"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Star, Shield, MapPin, Crown, Phone, Mail, Briefcase,
  Clock, Camera, MessageCircle, Building2,
} from "lucide-react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { InquiryModal } from "@/components/contractor/InquiryModal";
import { CONTRACTOR_TYPE_LABELS, CONTRACTOR_TYPE_COLORS } from "@/types/contractor-directory";
import type { ContractorType } from "@/types/contractor-directory";

interface ContractorDetail {
  id: string;
  company_name: string;
  contact_name: string;
  region: string;
  contractor_type: ContractorType;
  rating: number;
  total_reviews: number;
  completed_projects: number;
  is_verified: boolean;
  is_featured: boolean;
  subscription_tier: string;
  introduction: string;
  description: string;
  logo_url: string;
  phone: string;
  email: string;
  contractor_trades: { trade_code: string; trade_name: string; experience_years: number; is_primary: boolean }[];
  contractor_portfolio: { id: string; title: string; description: string; project_type: string; completion_date: string; image_urls: string[]; tags: string[] }[];
  contractor_reviews: { id: string; rating: number; title: string; content: string; is_verified: boolean; created_at: string }[];
}

type Tab = "intro" | "portfolio" | "reviews" | "trades";

export default function ContractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("intro");
  const [showInquiry, setShowInquiry] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetch(`/api/contractors/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setContractor(data.contractor || null);
      })
      .catch(() => setContractor(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5]">
        <Header />
        <main className="mx-auto max-w-4xl px-4 pb-10 pt-28 sm:px-6">
          <div className="h-5 w-20 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3 min-w-0">
                <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
            </div>
          </div>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-[#f7f7f5]">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">업체를 찾을 수 없습니다</h2>
          <button
            onClick={() => router.push("/find-contractors")}
            className="mt-4 rounded-full bg-[#0d0d0d] px-5 py-2.5 text-sm text-white hover:bg-black/80"
          >
            업체 목록으로
          </button>
        </div>
      </div>
    );
  }

  const c = contractor;
  const trades = c.contractor_trades || [];
  const portfolio = c.contractor_portfolio || [];
  const reviews = c.contractor_reviews || [];
  const isPremium = c.is_featured || c.subscription_tier === "premium" || c.subscription_tier === "enterprise";
  const maxExp = trades.length > 0 ? Math.max(...trades.map((t) => t.experience_years)) : 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "intro", label: "소개" },
    { key: "portfolio", label: "포트폴리오", count: portfolio.length },
    { key: "reviews", label: "리뷰", count: reviews.length },
    { key: "trades", label: "시공 공종", count: trades.length },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#0d0d0d]">
      <Header />

      <main className="mx-auto max-w-4xl px-4 pb-10 pt-28 sm:px-6">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push("/find-contractors")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> 업체 목록
        </button>

        {/* 프로필 히어로 */}
        <div className={`mb-6 rounded-[26px] border bg-white p-5 sm:p-7 ${
          isPremium ? "border-black/25 ring-1 ring-black/[0.04]" : "border-black/[0.07]"
        }`}>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* 로고 */}
            {c.logo_url ? (
              <Image src={c.logo_url} alt={c.company_name} width={80} height={80} className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-2xl">
                {c.company_name.charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{c.company_name}</h1>
                {c.is_verified && <Shield className="w-5 h-5 text-black/55" />}
                {isPremium && <Crown className="w-5 h-5 text-amber-500" />}
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  CONTRACTOR_TYPE_COLORS[c.contractor_type || "specialty"]
                }`}>
                  {CONTRACTOR_TYPE_LABELS[c.contractor_type || "specialty"]}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-900">{c.rating.toFixed(1)}</span>
                  <span className="text-gray-400">({c.total_reviews} 리뷰)</span>
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5" /> {c.region || "전국"}
                </span>
                {maxExp > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> 경력 {maxExp}년
                    </span>
                  </>
                )}
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Briefcase className="w-3.5 h-3.5" /> 시공 {c.completed_projects}건
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowInquiry(true)}
              className="flex flex-shrink-0 items-center gap-2 rounded-full bg-[#0d0d0d] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80"
            >
              <MessageCircle className="w-4 h-4" />
              견적 요청하기
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#0d0d0d] text-[#0d0d0d]"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        {activeTab === "intro" && (
          <div className="space-y-6 rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">회사 소개</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {c.introduction || c.description || "등록된 소개가 없습니다."}
              </p>
            </div>

            {/* 연락처 (공개 정보) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {c.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {c.phone}
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {c.email}
                </div>
              )}
            </div>

            {/* 주요 공종 */}
            {trades.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">주요 공종</h3>
                <div className="flex flex-wrap gap-2">
                  {trades.map((t) => (
                    <span
                      key={t.trade_code}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.is_primary
                          ? "bg-[#0d0d0d] text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.trade_name} ({t.experience_years}년)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "portfolio" && (
          <div>
            {portfolio.length === 0 ? (
              <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
                <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">등록된 포트폴리오가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {portfolio.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
                    {p.image_urls?.[0] && (
                      <div className="relative w-full h-48">
                        <Image
                          src={p.image_urls[0]}
                          alt={p.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="text-sm font-bold text-gray-900">{p.title}</h4>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {p.project_type && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {p.project_type}
                          </span>
                        )}
                        {p.completion_date && (
                          <span className="text-xs text-gray-400">
                            {new Date(p.completion_date).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </div>
                      {p.image_urls?.length > 1 && (
                        <div className="flex gap-1 mt-2">
                          {p.image_urls.slice(1, 4).map((url, i) => (
                            <Image key={i} src={url} alt="" width={48} height={48} className="w-12 h-12 rounded object-cover" />
                          ))}
                          {p.image_urls.length > 4 && (
                            <span className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                              +{p.image_urls.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            {reviews.length === 0 ? (
              <div className="rounded-[24px] border border-black/[0.07] bg-white p-12 text-center">
                <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">아직 리뷰가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 평점 요약 */}
                <div className="flex items-center gap-4 rounded-[22px] border border-black/[0.07] bg-white p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{c.rating.toFixed(1)}</div>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= Math.round(c.rating)
                              ? "text-yellow-500 fill-yellow-500"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{reviews.length}개 리뷰</div>
                  </div>
                </div>

                {/* 리뷰 리스트 */}
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-[22px] border border-black/[0.07] bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= r.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      {r.is_verified && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          인증됨
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(r.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    {r.title && <h4 className="text-sm font-semibold text-gray-900 mb-1">{r.title}</h4>}
                    <p className="text-xs text-gray-600">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "trades" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trades.map((t) => (
              <div
                key={t.trade_code}
                className={`rounded-[20px] border bg-white p-4 ${
                  t.is_primary ? "border-black/25" : "border-black/[0.07]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{t.trade_name}</span>
                    {t.is_primary && (
                      <span className="rounded bg-[#0d0d0d] px-1.5 py-0.5 text-xs font-semibold text-white">
                        주공종
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{t.experience_years}년 경력</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* 문의 모달 */}
      {showInquiry && (
        <InquiryModal
          contractorId={c.id}
          companyName={c.company_name}
          onClose={() => setShowInquiry(false)}
        />
      )}
    </div>
  );
}
