"use client";

/**
 * ConstructionEstimateV2Panel — 사업자 입찰 화면에서 소비자 v2 견적(17공종)을 노출.
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §16-3
 *
 * consumer_project_id로 construction_estimates + construction_estimate_lines를 조회해서
 * 공종별 합계 + 정밀도 레벨 + product_match_status 분포를 사업자에게 보여준다.
 *
 * 사업자가 보면:
 *  - 어떤 공종에 fallback이 많은지 (사업자가 더 정확한 단가 제시 기회)
 *  - 사용자 자재 확정 여부 (L4 견적이면 견적가 흔들기 어려움)
 *  - 카테고리/SKU별 단가 (사업자 자체 단가와 비교)
 */
import { useState } from "react";
import { Loader2, Lock, Sparkles, TriangleAlert } from "lucide-react";

interface V2Line {
  id: string;
  trade_code: string;
  trade_name_ko: string;
  task_name_ko: string;
  item_name_ko: string;
  unit: string;
  quantity: number;
  material_unit_price: number;
  labor_unit_price: number;
  expense_unit_price: number;
  total_amount: number;
  source: string;
  product_match_status: string | null;
  material_category_code: string | null;
  assumptions?: string[] | null;
  warnings?: string[] | null;
  pricing_basis?: string | null;
  contractor_editable?: boolean | null;
  site_verification_required?: boolean | null;
  variation_notice?: string | null;
  site_adjustment_factors?: string[] | null;
  site_condition_adjustment_factor?: number | null;
  site_condition_adjustment_reason?: string | null;
}

interface V2Estimate {
  id: string;
  consumer_project_id: string;
  precision_level?: string | null;
  total_amount: number;
  lines: V2Line[];
}

interface Props {
  consumerProjectId: string;
}

const SOURCE_LABEL_KO: Record<string, string> = {
  user_selected_material: "사용자 확정",
  vision_confirmed_material: "Vision 확정",
  vision_recommended_material: "Vision 추천",
  prompt_extracted_material: "프롬프트 추출",
  standard_fallback_material: "표준 fallback",
  ai_inferred_quantity: "AI 추정",
};

const SOURCE_COLOR: Record<string, string> = {
  user_selected_material: "bg-black text-white",
  vision_confirmed_material: "bg-black/[0.08] text-black",
  vision_recommended_material: "bg-black/[0.08] text-black",
  prompt_extracted_material: "bg-black/[0.08] text-black",
  standard_fallback_material: "bg-black/[0.05] text-black/60",
  ai_inferred_quantity: "bg-black/[0.08] text-black",
};

export default function ConstructionEstimateV2Panel({ consumerProjectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<V2Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    if (estimate) {
      setExpanded((v) => !v);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inpick/construction-estimate?consumerProjectId=${consumerProjectId}`);
      if (!res.ok) {
        setError("v2 견적 없음 (소비자가 견적 산출을 완료하지 않았거나 구버전입니다)");
        setEstimate(null);
        return;
      }
      const data = await res.json();
      if (!data.estimate) {
        setError("v2 견적 없음");
        return;
      }
      setEstimate(data.estimate);
      setExpanded(true);
    } catch {
      setError("조회 실패");
    } finally {
      setLoading(false);
    }
  };

  const tradeSummary = (() => {
    if (!estimate) return [];
    const map = new Map<string, { code: string; name: string; total: number; lineCount: number }>();
    for (const l of estimate.lines) {
      const key = l.trade_code;
      const cur = map.get(key) ?? { code: key, name: l.trade_name_ko, total: 0, lineCount: 0 };
      cur.total += Number(l.total_amount) || 0;
      cur.lineCount += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  })();

  const sourceStats = (() => {
    if (!estimate) return [];
    const map = new Map<string, number>();
    for (const l of estimate.lines) {
      map.set(l.source, (map.get(l.source) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const siteConditionSummary = (() => {
    if (!estimate) return [];
    const definitions = [
      {
        key: "demolition",
        label: "철거·폐기",
        codes: ["02", "15"],
        notice: "기존 마감·폐기물·양중 조건에 따라 현장 확인 후 조정",
      },
      {
        key: "electrical",
        label: "전기",
        codes: ["04"],
        notice: "분전반·노후 배선·전용회로와 매립 범위 확인 후 조정",
      },
      {
        key: "plumbing",
        label: "설비·배관",
        codes: ["05"],
        notice: "배관 노후도·누수·급배수 위치 이동 범위 확인 후 조정",
      },
    ];
    return definitions.map((definition) => {
      const lines = estimate.lines.filter((line) => definition.codes.includes(line.trade_code));
      return {
        ...definition,
        lineCount: lines.length,
        amount: lines.reduce((sum, line) => sum + (Number(line.total_amount) || 0), 0),
      };
    }).filter((item) => item.lineCount > 0);
  })();

  return (
    <div>
      <button
        onClick={load}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-full border border-black/[0.09] bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-black hover:text-white disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {estimate ? (expanded ? "v2 17공종 접기" : "v2 17공종 펼치기") : "v2 17공종 견적 보기"}
      </button>

      {error && <p className="mt-2 text-xs text-gray-500">{error}</p>}

      {estimate && expanded && (
        <div className="mt-3 rounded-2xl border border-black/[0.08] bg-[#f5f5f3] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black px-2.5 py-0.5 text-[10px] font-semibold text-white">
              v2 정밀 견적
            </span>
            {estimate.precision_level && (
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-black ring-1 ring-black/10">
                <Lock className="mr-1 inline h-3 w-3" />
                {estimate.precision_level}
              </span>
            )}
            <span className="ml-auto text-sm font-bold text-black">
              총 {Number(estimate.total_amount).toLocaleString("ko-KR")}원
            </span>
          </div>

          {siteConditionSummary.length > 0 && (
            <div className="mb-3 rounded-xl border border-black/[0.09] bg-white p-3">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-black/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-black">현장 확인 후 사업자 조정 공종</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-black/45">
                    아래 금액은 INPICK 기본단가 가견적입니다. 현장 방문 후 공종별 수량·재료비·노무비를 업체 단가로 수정해 입찰에 반영하세요.
                  </p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                    {siteConditionSummary.map((item) => (
                      <div key={item.key} className="rounded-lg bg-[#f5f5f3] px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-bold text-black/65">{item.label}</span>
                          <span className="text-black/35">{item.lineCount}건</span>
                        </div>
                        <p className="mt-0.5 text-xs font-black text-black">{Math.round(item.amount).toLocaleString("ko-KR")}원</p>
                        <p className="mt-1 text-[9px] leading-3.5 text-black/40">{item.notice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 공종별 합계 */}
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
            {tradeSummary.map((t) => (
              <div key={t.code} className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-black/[0.06]">
                <div className="text-[10px] text-gray-500">{t.code}공종 · {t.lineCount}건</div>
                <div className="truncate text-xs font-semibold text-gray-900">{t.name}</div>
                <div className="text-xs font-bold text-black">
                  {Math.round(t.total).toLocaleString("ko-KR")}원
                </div>
              </div>
            ))}
          </div>

          {/* Source 분포 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sourceStats.map(([src, count]) => (
              <span
                key={src}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  SOURCE_COLOR[src] ?? "bg-black/[0.05] text-black/60"
                }`}
              >
                {SOURCE_LABEL_KO[src] ?? src} · {count}건
              </span>
            ))}
          </div>

          {/* Top 10 라인 */}
          <div className="overflow-hidden rounded-lg ring-1 ring-black/[0.07]">
            <table className="w-full text-xs">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left">공종</th>
                  <th className="px-2 py-1.5 text-left">품명</th>
                  <th className="px-2 py-1.5 text-right">수량</th>
                  <th className="px-2 py-1.5 text-right">단가</th>
                  <th className="px-2 py-1.5 text-right">금액</th>
                  <th className="px-2 py-1.5 text-left">출처</th>
                </tr>
              </thead>
              <tbody>
                {[...estimate.lines]
                  .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
                  .slice(0, 10)
                  .map((l) => (
                    <tr key={l.id} className="border-t border-black/[0.06] bg-white">
                      <td className="px-2 py-1 text-gray-700">{l.trade_name_ko}</td>
                      <td className="px-2 py-1 text-gray-900">
                        {l.item_name_ko}
                        {l.site_condition_adjustment_reason && (
                          <span className="mt-0.5 block text-[9px] font-semibold text-amber-700">
                            {l.site_condition_adjustment_reason}
                            {l.site_condition_adjustment_factor
                              ? ` · ×${Number(l.site_condition_adjustment_factor).toFixed(2)}`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {l.quantity}
                        {l.unit}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-gray-600">
                        {Math.round(Number(l.material_unit_price) + Number(l.labor_unit_price) + Number(l.expense_unit_price || 0)).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums text-black">
                        {Math.round(Number(l.total_amount)).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                              SOURCE_COLOR[l.source] ?? "bg-black/[0.05] text-black/60"
                            }`}
                          >
                            {SOURCE_LABEL_KO[l.source]?.slice(0, 6) ?? l.source.slice(0, 6)}
                          </span>
                          {["02", "04", "05", "15"].includes(l.trade_code) && (
                            <span className="rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white">현장확인</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            금액 상위 10개 라인만 표시. 전체 {estimate.lines.length}개 라인. 표준 fallback 항목이 많을수록
            사업자 견적이 받아들여질 여지가 큽니다.
          </p>
        </div>
      )}
    </div>
  );
}
