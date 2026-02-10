"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, FileText, Download, Printer,
  ChevronDown, ChevronRight, Package, Wrench, Layers,
  AlertCircle, CheckCircle2, Gavel,
} from "lucide-react";
import type { Estimate, EstimateItem, SpaceSummary } from "@/types/estimate";
import { mapDbEstimate, STATUS_LABELS, STATUS_COLORS } from "@/types/estimate";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const ITEM_TYPE_ICON: Record<string, typeof Package> = {
  FINISH: Package,
  PREREQ: Wrench,
  SUBMATERIAL: Layers,
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  FINISH: "마감재",
  PREREQ: "선행공정",
  SUBMATERIAL: "부자재",
};

function StatusBadge({ status }: { status: Estimate["status"] }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {status === "DRAFT" && <FileText className="w-3 h-3" />}
      {status === "CONFIRMED" && <CheckCircle2 className="w-3 h-3" />}
      {status === "BIDDING" && <Gavel className="w-3 h-3" />}
      {status === "CONTRACTED" && <CheckCircle2 className="w-3 h-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

// 공간별 아이템 그룹
function SpaceItemGroup({ space, items }: { space: SpaceSummary; items: EstimateItem[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-900">{space.spaceName}</span>
          <span className="text-xs text-gray-500">{space.areaM2}m²</span>
          <span className="text-xs text-gray-400">({items.length}개 항목)</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">{fmt(space.spaceTotal)}원</span>
      </button>

      {open && (
        <div>
          {/* Sub header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 font-medium">
            <div className="col-span-1">유형</div>
            <div className="col-span-3">항목명</div>
            <div className="col-span-1">규격</div>
            <div className="col-span-1 text-center">단위</div>
            <div className="col-span-1 text-right">수량</div>
            <div className="col-span-1 text-right">자재비</div>
            <div className="col-span-1 text-right">노무비</div>
            <div className="col-span-1 text-right">합계</div>
            <div className="col-span-1 text-center">비고</div>
          </div>

          {/* Items */}
          {items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => {
            const Icon = ITEM_TYPE_ICON[item.itemType] || Package;
            return (
              <div key={item.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-t border-gray-100 text-sm items-center ${
                item.isAutoAdded ? "bg-blue-50/30" : ""
              }`}>
                <div className="col-span-1 flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">{ITEM_TYPE_LABEL[item.itemType]}</span>
                </div>
                <div className="col-span-3 font-medium text-gray-900 truncate">{item.itemName}</div>
                <div className="col-span-1 text-xs text-gray-500 truncate">{item.specification || "-"}</div>
                <div className="col-span-1 text-center text-gray-600">{item.unit}</div>
                <div className="col-span-1 text-right text-gray-600">{item.quantity}</div>
                <div className="col-span-1 text-right text-gray-600">{fmt(item.materialCost)}</div>
                <div className="col-span-1 text-right text-gray-600">{fmt(item.laborCost)}</div>
                <div className="col-span-1 text-right font-semibold text-gray-900">{fmt(item.totalCost)}</div>
                <div className="col-span-1 text-center">
                  {item.isAutoAdded && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">자동</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Space subtotal */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
            <div className="col-span-6 text-gray-700">소계</div>
            <div className="col-span-1" />
            <div className="col-span-1 text-right text-gray-700">{fmt(space.materialTotal)}</div>
            <div className="col-span-1 text-right text-gray-700">{fmt(space.laborTotal)}</div>
            <div className="col-span-1 text-right text-gray-900">{fmt(space.spaceTotal)}</div>
            <div className="col-span-1" />
          </div>
        </div>
      )}
    </div>
  );
}

// 비용 요약 카드
function CostSummaryCard({ estimate }: { estimate: Estimate }) {
  const rows = [
    { label: "자재비", value: estimate.materialCost, color: "text-blue-700" },
    { label: "노무비", value: estimate.laborCost, color: "text-green-700" },
    { label: "경비", value: estimate.overheadCost, color: "text-amber-700" },
    { label: "총원가", value: estimate.totalCost, color: "text-gray-900", bold: true },
    { label: `이윤 (${estimate.marginRate.toFixed(1)}%)`, value: estimate.finalPrice - estimate.totalCost - (estimate.finalPrice / 1.1 - estimate.totalCost - (estimate.finalPrice - estimate.totalCost - estimate.finalPrice / 11)) , color: "text-purple-700" },
  ];

  const vat = estimate.finalPrice - estimate.finalPrice / 1.1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">비용 요약</h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className={`text-sm ${r.bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>{r.label}</span>
            <span className={`text-sm font-semibold ${r.color}`}>{fmt(r.value)}원</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">부가세 (10%)</span>
          <span className="text-sm font-semibold text-gray-700">{fmt(vat)}원</span>
        </div>
        <div className="border-t-2 border-gray-900 pt-3 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">최종 금액</span>
          <span className="text-lg font-bold text-blue-600">{fmt(estimate.finalPrice)}원</span>
        </div>
      </div>
    </div>
  );
}

// 공간 비율 차트
function SpaceBreakdown({ spaces }: { spaces: SpaceSummary[] }) {
  const total = spaces.reduce((s, sp) => s + sp.spaceTotal, 0) || 1;
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">공간별 비용</h3>
      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-4">
        {spaces.map((sp, i) => (
          <div key={sp.id || i} style={{ width: `${(sp.spaceTotal / total) * 100}%`, backgroundColor: colors[i % colors.length] }} />
        ))}
      </div>
      {/* Legend */}
      <div className="space-y-2">
        {spaces.map((sp, i) => (
          <div key={sp.id || i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-sm text-gray-700">{sp.spaceName}</span>
              <span className="text-xs text-gray-400">{sp.areaM2}m²</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{((sp.spaceTotal / total) * 100).toFixed(1)}%</span>
              <span className="text-sm font-semibold text-gray-900">{fmt(sp.spaceTotal)}원</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EstimateDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/estimates?id=${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setEstimate(mapDbEstimate(data.estimate));
      } catch {
        setError("견적을 찾을 수 없습니다.");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // 공간별 아이템 그룹핑
  const groupedItems = useMemo(() => {
    if (!estimate) return new Map<string, EstimateItem[]>();
    const map = new Map<string, EstimateItem[]>();
    for (const item of estimate.items) {
      const key = item.spaceAreaId || "__unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [estimate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">{error || "견적을 찾을 수 없습니다."}</p>
        <Link href="/contractor/bids" className="text-sm text-blue-600 hover:underline">목록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/contractor/bids" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">견적 상세</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> 인쇄
            </button>
            <button className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1.5">
              <Download className="w-4 h-4" /> 다운로드
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Project Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{estimate.projectName}</h1>
              {estimate.address && <p className="text-sm text-gray-500 mt-1">{estimate.address}</p>}
            </div>
            <StatusBadge status={estimate.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">건물 유형</p>
              <p className="text-sm font-semibold text-gray-900">
                {estimate.buildingType === "residential" ? "주거" : estimate.buildingType === "commercial" ? "상업" : estimate.buildingType || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">총 면적</p>
              <p className="text-sm font-semibold text-gray-900">{estimate.totalArea}m² ({(estimate.totalArea * 0.3025).toFixed(1)}평)</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">생성일</p>
              <p className="text-sm font-semibold text-gray-900">{new Date(estimate.createdAt).toLocaleDateString("ko-KR")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">최종 수정</p>
              <p className="text-sm font-semibold text-gray-900">{new Date(estimate.updatedAt).toLocaleDateString("ko-KR")}</p>
            </div>
          </div>
          {estimate.notes && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              {estimate.notes}
            </div>
          )}
        </div>

        {/* Cost Summary + Space Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CostSummaryCard estimate={estimate} />
          {estimate.spaceSummary.length > 0 && <SpaceBreakdown spaces={estimate.spaceSummary} />}
        </div>

        {/* Detailed Items by Space */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">상세 내역</h2>
          <div className="space-y-4">
            {estimate.spaceSummary.length > 0 ? (
              estimate.spaceSummary.map((space) => {
                const spaceItems = groupedItems.get(space.spaceTypeId || "__unassigned") ||
                  estimate.items.filter((item) => {
                    const dbName = (item as unknown as Record<string, string>).spaceName;
                    return dbName === space.spaceName;
                  });
                return <SpaceItemGroup key={space.id} space={space} items={spaceItems} />;
              })
            ) : estimate.items.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
                  <div className="col-span-1">유형</div>
                  <div className="col-span-3">항목명</div>
                  <div className="col-span-1">규격</div>
                  <div className="col-span-1 text-center">단위</div>
                  <div className="col-span-1 text-right">수량</div>
                  <div className="col-span-1 text-right">자재비</div>
                  <div className="col-span-1 text-right">노무비</div>
                  <div className="col-span-1 text-right">합계</div>
                  <div className="col-span-1 text-center">비고</div>
                </div>
                {estimate.items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => {
                  const Icon = ITEM_TYPE_ICON[item.itemType] || Package;
                  return (
                    <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t border-gray-100 text-sm">
                      <div className="col-span-1 flex items-center gap-1">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="col-span-3 font-medium text-gray-900 truncate">{item.itemName}</div>
                      <div className="col-span-1 text-xs text-gray-500">{item.specification || "-"}</div>
                      <div className="col-span-1 text-center text-gray-600">{item.unit}</div>
                      <div className="col-span-1 text-right text-gray-600">{item.quantity}</div>
                      <div className="col-span-1 text-right text-gray-600">{fmt(item.materialCost)}</div>
                      <div className="col-span-1 text-right text-gray-600">{fmt(item.laborCost)}</div>
                      <div className="col-span-1 text-right font-semibold text-gray-900">{fmt(item.totalCost)}</div>
                      <div className="col-span-1 text-center">
                        {item.isAutoAdded && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">자동</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>등록된 항목이 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Total footer */}
        <div className="bg-blue-600 text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-200">최종 견적금액 (VAT 포함)</p>
            <p className="text-3xl font-bold mt-1">{fmt(estimate.finalPrice)}원</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-blue-200">자재 {fmt(estimate.materialCost)}원</p>
            <p className="text-sm text-blue-200">노무 {fmt(estimate.laborCost)}원</p>
            <p className="text-sm text-blue-200">경비 {fmt(estimate.overheadCost)}원</p>
          </div>
        </div>
      </main>
    </div>
  );
}
