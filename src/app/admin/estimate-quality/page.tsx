"use client";

/**
 * 관리자 견적 품질 진단 페이지 (P14-3 + P16-5)
 * 가이드: inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §9,
 *        inpick-material-category-taxonomy-base-20260513.md §16-5
 */
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface CategoryCoverage {
  categoryCode: string;
  totalLines: number;
  matchedLines: number;
  fallbackLines: number;
  highValueFallbackLines: number;
  matchRate: number;
  productsInDb: number;
  avgFallbackUnitPrice: number;
  sampleItems: Array<{ itemName: string; amount: number; subTrade: string }>;
}

interface CoverageResponse {
  summary: {
    totalLinesAnalyzed: number;
    totalCategoriesObserved: number;
    categoriesWithZeroProducts: number;
    totalFallbackLines: number;
    totalHighValueFallback: number;
  };
  coverage: CategoryCoverage[];
}

interface QualityData {
  lineCount: number;
  productResolvedCount: number;
  priceResolvedCount: number;
  fallbackCount: number;
  fallbackRatio: number;
  matchStatusBreakdown: Record<string, number>;
  priceSourceBreakdown: Record<string, number>;
  fallbackByTrade: Record<string, { count: number; totalAmount: number }>;
  unresolvedHighValueLines: Array<{
    lineId: string;
    tradeCode: string;
    tradeName: string;
    itemName: string;
    totalAmount: number;
    fallbackReason: string | null;
    matchStatus: string | null;
  }>;
  warningMessage?: string;
}

const SOURCE_LABEL_KO: Record<string, string> = {
  user_selected_material: "사용자 확정",
  vision_confirmed_material: "이미지 분석 확정",
  vision_recommended_material: "이미지 분석 추천",
  prompt_extracted_material: "디자인 설명 기반",
  scope_default_material: "Scope 기본값",
  standard_fallback_material: "표준 fallback",
  confirmed: "확정",
  recommended: "추천",
  category_default: "카테고리 기본",
  manual_override: "사용자 override",
  material_price_lookup: "물가협회 단가",
  material_price_observations: "최근 30일 평균",
  contractor_price: "납품사 단가",
  catalog_price: "카탈로그",
  category_standard: "카테고리 표준",
  kpa_standard: "KPA fallback",
};

export default function EstimateQualityPage() {
  const { adminId, authChecked } = useAdminAuth();
  const isLoggedIn = !!adminId;
  const [contextId, setContextId] = useState("");
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P16-5
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const loadCoverage = async () => {
    setCoverageLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
      const res = await fetch("/api/admin/material-product-coverage?limit=2000", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CoverageResponse;
      setCoverage(json);
    } catch (e) {
      console.error("[coverage] load failed:", e);
    } finally {
      setCoverageLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      void loadCoverage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const load = async () => {
    if (!contextId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // ADMIN_PASSWORD을 클라이언트에서 직접 보낼 수 없으므로 로그인 시 발급된 token 사용 (간단화: localStorage)
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
      const res = await fetch(
        `/api/admin/estimate-quality?contextId=${encodeURIComponent(contextId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as QualityData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="p-8 text-center text-gray-300">관리자 로그인이 필요합니다.</div>
    );
  }

  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-2xl font-bold text-white mb-2">견적 품질 진단</h1>
      <p className="text-sm text-gray-400 mb-6">
        estimate_contexts.id를 입력하면 해당 견적의 자재/단가 매칭 통계와 고액 fallback 라인을 확인할 수 있습니다.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={contextId}
          onChange={(e) => setContextId(e.target.value)}
          placeholder="contextId (uuid)"
          className="flex-1 px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 font-mono text-sm"
        />
        <button
          onClick={load}
          disabled={loading || !contextId.trim()}
          className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-30"
        >
          {loading ? "조회 중..." : "조회"}
        </button>
      </div>

      {/* P16-5: material_products coverage 진단 */}
      <section className="mb-6 bg-gray-900 border border-gray-700 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-white">자재 카탈로그 매칭 진단</h2>
            <p className="text-[0.7rem] text-gray-400">
              최근 견적 라인 2,000건을 분석하여 카테고리별 material_products 매칭 커버리지를 보여줍니다.
            </p>
          </div>
          <button
            onClick={() => void loadCoverage()}
            disabled={coverageLoading}
            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded disabled:opacity-30"
          >
            {coverageLoading ? "조회 중..." : "새로고침"}
          </button>
        </div>
        {coverage && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
              <StatCard label="분석 라인" value={coverage.summary.totalLinesAnalyzed} color="white" />
              <StatCard label="카테고리 수" value={coverage.summary.totalCategoriesObserved} color="white" />
              <StatCard label="DB 0개" value={coverage.summary.categoriesWithZeroProducts} color="rose-400" />
              <StatCard label="Fallback 라인" value={coverage.summary.totalFallbackLines} color="amber-400" />
              <StatCard
                label="고액 Fallback"
                value={coverage.summary.totalHighValueFallback}
                color="rose-400"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-1.5 text-left">카테고리</th>
                    <th className="py-1.5 text-right">라인</th>
                    <th className="py-1.5 text-right">매칭률</th>
                    <th className="py-1.5 text-right">Fallback</th>
                    <th className="py-1.5 text-right">고액</th>
                    <th className="py-1.5 text-right">DB 제품수</th>
                    <th className="py-1.5 text-right">평균단가</th>
                    <th className="py-1.5 text-left">샘플</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.coverage.slice(0, 30).map((c) => {
                    const matchPct = Math.round(c.matchRate * 100);
                    const priority =
                      c.highValueFallbackLines > 0 && c.productsInDb === 0
                        ? "bg-rose-950"
                        : c.fallbackLines > 5 && c.productsInDb < 3
                          ? "bg-amber-950/40"
                          : "";
                    return (
                      <tr key={c.categoryCode} className={`border-b border-gray-800 ${priority}`}>
                        <td className="py-1.5 font-mono text-white">{c.categoryCode}</td>
                        <td className="py-1.5 text-right text-gray-200">{c.totalLines}</td>
                        <td
                          className={`py-1.5 text-right font-semibold ${
                            matchPct >= 50 ? "text-emerald-300" : matchPct >= 20 ? "text-amber-300" : "text-rose-300"
                          }`}
                        >
                          {matchPct}%
                        </td>
                        <td className="py-1.5 text-right text-amber-300">{c.fallbackLines}</td>
                        <td className="py-1.5 text-right text-rose-300">{c.highValueFallbackLines}</td>
                        <td
                          className={`py-1.5 text-right font-bold ${
                            c.productsInDb === 0 ? "text-rose-400" : "text-emerald-300"
                          }`}
                        >
                          {c.productsInDb}
                        </td>
                        <td className="py-1.5 text-right font-mono text-gray-300">
                          {c.avgFallbackUnitPrice > 0 ? `₩${c.avgFallbackUnitPrice.toLocaleString()}` : "-"}
                        </td>
                        <td className="py-1.5 text-gray-400 truncate max-w-xs">
                          {c.sampleItems.map((s) => s.itemName).join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[0.7rem] text-gray-500">
              🔴 행: 고액 fallback 발생 + DB 제품 0개 (시급 보강). 노란 행: 5건 이상 fallback + DB &lt; 3.
            </p>
          </>
        )}
      </section>

      {/* P16-1: Taxonomy seed 트리거 */}
      <div className="mb-6 p-3 bg-gray-900 border border-gray-700 rounded flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-bold text-white mb-1">자재 카테고리 베이스 (Taxonomy Seed)</p>
          <p className="text-[0.7rem] text-gray-400">
            70+ 카테고리 + 80+ alias를 DB에 upsert. 카테고리/alias 코드 변경 후 1회 실행.
          </p>
        </div>
        <button
          onClick={async () => {
            const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
            try {
              const r = await fetch("/api/admin/taxonomy/seed", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              const d = await r.json();
              alert(d.ok ? `✅ ${d.message}` : `❌ ${d.error}: ${d.details ?? ""}`);
            } catch (e) {
              alert(`❌ ${e instanceof Error ? e.message : String(e)}`);
            }
          }}
          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded"
        >
          Taxonomy Seed 적용
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-900/40 border border-rose-700 rounded mb-4 text-rose-200 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="총 라인" value={data.lineCount} color="white" />
            <StatCard label="상품 확정" value={data.productResolvedCount} color="emerald-400" />
            <StatCard label="단가 확정" value={data.priceResolvedCount} color="blue-400" />
            <StatCard label="Fallback" value={data.fallbackCount} color="rose-400" />
            <StatCard
              label="Fallback 비율"
              value={`${Math.round(data.fallbackRatio * 100)}%`}
              color={
                data.fallbackRatio > 0.5
                  ? "rose-400"
                  : data.fallbackRatio > 0.3
                    ? "amber-400"
                    : "emerald-400"
              }
            />
          </div>

          {/* 경고 메시지 */}
          {data.warningMessage && (
            <div className="p-4 bg-amber-900/40 border border-amber-700 rounded text-amber-200">
              ⚠️ {data.warningMessage}
            </div>
          )}

          {/* matchStatus 분포 */}
          <section className="bg-gray-900 border border-gray-700 rounded p-4">
            <h2 className="text-sm font-bold text-white mb-3">자재 매칭 상태 분포</h2>
            <div className="space-y-1">
              {Object.entries(data.matchStatusBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = (count / data.lineCount) * 100;
                  const isFallback = status === "standard_fallback";
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-gray-400">
                        {SOURCE_LABEL_KO[status] || status}
                      </div>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                        <div
                          className={`h-full ${isFallback ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-sm font-mono text-white">
                        {count}건 ({Math.round(pct)}%)
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* priceSource 분포 */}
          <section className="bg-gray-900 border border-gray-700 rounded p-4">
            <h2 className="text-sm font-bold text-white mb-3">단가 출처 분포</h2>
            <div className="space-y-1">
              {Object.entries(data.priceSourceBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([src, count]) => {
                  const pct = (count / data.lineCount) * 100;
                  const isGood = ["material_price_lookup", "contractor_price", "manual_override"].includes(src);
                  const isFallback = ["kpa_standard", "category_standard"].includes(src);
                  return (
                    <div key={src} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-gray-400">
                        {SOURCE_LABEL_KO[src] || src}
                      </div>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            isGood ? "bg-emerald-500" : isFallback ? "bg-rose-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-sm font-mono text-white">
                        {count}건 ({Math.round(pct)}%)
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* 고액 fallback 라인 */}
          {data.unresolvedHighValueLines.length > 0 && (
            <section className="bg-rose-950 border border-rose-700 rounded p-4">
              <h2 className="text-sm font-bold text-rose-200 mb-3">
                ⚠️ 고액 fallback 라인 ({data.unresolvedHighValueLines.length}건)
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rose-700 text-rose-300 text-xs">
                    <th className="py-2 text-left">공종</th>
                    <th className="py-2 text-left">자재</th>
                    <th className="py-2 text-right">금액</th>
                    <th className="py-2 text-left">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unresolvedHighValueLines.map((l) => (
                    <tr key={l.lineId} className="border-b border-rose-800">
                      <td className="py-2 text-rose-200">
                        {l.tradeCode}. {l.tradeName}
                      </td>
                      <td className="py-2 text-white font-semibold">{l.itemName}</td>
                      <td className="py-2 text-right font-mono text-rose-100">
                        ₩ {l.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-2 text-xs text-rose-300">{l.fallbackReason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 공종별 fallback */}
          {Object.keys(data.fallbackByTrade).length > 0 && (
            <section className="bg-gray-900 border border-gray-700 rounded p-4">
              <h2 className="text-sm font-bold text-white mb-3">공종별 Fallback 분포</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs">
                    <th className="py-2 text-left">공종</th>
                    <th className="py-2 text-right">건수</th>
                    <th className="py-2 text-right">총액</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.fallbackByTrade)
                    .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
                    .map(([trade, stat]) => (
                      <tr key={trade} className="border-b border-gray-800">
                        <td className="py-2 text-white">{trade}</td>
                        <td className="py-2 text-right font-mono text-gray-200">{stat.count}건</td>
                        <td className="py-2 text-right font-mono text-rose-300">
                          ₩ {stat.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold text-${color}`}>{value}</p>
    </div>
  );
}
