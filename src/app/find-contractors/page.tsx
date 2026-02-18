"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, ChevronLeft, ChevronRight, Crown, FolderOpen, Loader2 } from "lucide-react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ContractorCard } from "@/components/contractor/ContractorCard";
import { ContractorFilters } from "@/components/contractor/ContractorFilters";
import type { PublicContractor, ContractorType } from "@/types/contractor-directory";

export default function FindContractorsPage() {
  const [contractors, setContractors] = useState<PublicContractor[]>([]);
  const [featured, setFeatured] = useState<PublicContractor[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ContractorType | "all">("all");
  const [trade, setTrade] = useState("");
  const [region, setRegion] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);

  const fetchContractors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (trade) params.set("trade", trade);
      if (region) params.set("region", region);
      if (minRating > 0) params.set("minRating", String(minRating));
      if (sort) params.set("sort", sort);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));

      const res = await fetch(`/api/contractors?${params}`);
      const data = await res.json();

      setContractors(data.contractors || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);

      // 추천 업체 (첫 페이지, 필터 없을 때)
      if (page === 1 && !search && type === "all" && !trade && !region) {
        setFeatured((data.contractors || []).filter((c: PublicContractor) => c.isFeatured));
      } else {
        setFeatured([]);
      }
    } catch {
      setContractors([]);
    } finally {
      setLoading(false);
    }
  }, [type, trade, region, minRating, sort, search, page]);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  // 필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setPage(1);
  }, [type, trade, region, minRating, sort, search]);

  const regularContractors = featured.length > 0
    ? contractors.filter((c) => !c.isFeatured)
    : contractors;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* 히어로 배너 */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Building2 className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-bold">인테리어 전문업체 찾기</h1>
          </div>
          <p className="text-sm text-blue-100 mb-6">
            검증된 종합 인테리어 업체와 전문공종 업체를 찾아보세요
          </p>
          {/* 검색 바 (히어로 내) */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="업체명으로 검색..."
              className="w-full pl-11 pr-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-lg"
            />
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 필터 */}
        <div className="mb-6">
          <ContractorFilters
            search={search}
            onSearchChange={setSearch}
            type={type}
            onTypeChange={setType}
            trade={trade}
            onTradeChange={setTrade}
            region={region}
            onRegionChange={setRegion}
            minRating={minRating}
            onMinRatingChange={setMinRating}
            sort={sort}
            onSortChange={setSort}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">업체 목록 불러오는 중...</p>
          </div>
        ) : contractors.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {search || type !== "all" || trade || region
                ? "검색 결과가 없습니다"
                : "등록된 업체가 없습니다"}
            </h3>
            <p className="text-sm text-gray-500">
              {search || type !== "all" || trade || region
                ? "다른 조건으로 검색해보세요"
                : "곧 다양한 업체가 등록될 예정입니다"}
            </p>
          </div>
        ) : (
          <>
            {/* 추천 업체 */}
            {featured.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-gray-900">추천 업체</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featured.map((c) => (
                    <ContractorCard key={c.id} contractor={c} />
                  ))}
                </div>
              </div>
            )}

            {/* 전체 업체 */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">
                전체 업체 <span className="text-gray-400 font-normal">({total}개)</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularContractors.map((c) => (
                <ContractorCard key={c.id} contractor={c} />
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${
                        page === pageNum
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
