"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Clock, Gavel, Plus } from "lucide-react";
import type { EstimateStatus } from "@/types/estimate";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/estimate";

interface EstimateListItem {
  id: string;
  title: string;
  status: string;
  project_type: string;
  total_area_m2: number;
  total_material: number;
  total_labor: number;
  grand_total: number;
  created_at: string;
  updated_at: string;
}

function mapStatus(s: string): EstimateStatus {
  switch (s) {
    case "confirmed": return "CONFIRMED";
    case "bidding": case "in_progress": return "BIDDING";
    case "contracted": case "completed": return "CONTRACTED";
    default: return "DRAFT";
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const statusIcon = (status: EstimateStatus) => {
  switch (status) {
    case "CONTRACTED": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "BIDDING": return <Gavel className="w-4 h-4 text-amber-500" />;
    case "CONFIRMED": return <Clock className="w-4 h-4 text-blue-500" />;
    default: return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

export default function BidsPage() {
  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/estimates");
        const data = await res.json();
        setEstimates(data.estimates || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = filter === "all"
    ? estimates
    : estimates.filter((e) => mapStatus(e.status) === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/contractor" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm font-medium text-gray-700">견적 관리</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">견적 목록</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[
                { value: "all", label: "전체" },
                { value: "DRAFT", label: "초안" },
                { value: "CONFIRMED", label: "확정" },
                { value: "BIDDING", label: "입찰중" },
                { value: "CONTRACTED", label: "완료" },
              ].map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <Link href="/address"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 새 견적
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">견적이 없습니다</p>
            <Link href="/address" className="mt-4 inline-block text-sm text-blue-600 hover:underline">새 견적 만들기</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((est) => {
              const status = mapStatus(est.status);
              return (
                <Link key={est.id} href={`/estimate/${est.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {statusIcon(status)}
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {est.title}
                        </h3>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{est.project_type === "residential" ? "주거" : est.project_type === "commercial" ? "상업" : est.project_type || "-"}</span>
                        {est.total_area_m2 > 0 && <span>{est.total_area_m2}m² ({(est.total_area_m2 * 0.3025).toFixed(1)}평)</span>}
                        <span>{new Date(est.created_at).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900">
                        {est.grand_total ? `${fmt(est.grand_total)}원` : "-"}
                      </p>
                      {est.total_material > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          자재 {fmt(est.total_material)} | 노무 {fmt(est.total_labor)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
