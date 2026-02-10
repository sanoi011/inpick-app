"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, Clock, CheckCircle2 } from "lucide-react";

interface Estimate {
  id: string;
  title: string;
  status: string;
  project_type: string;
  total_area_m2: number;
  grand_total: number;
  created_at: string;
}

export default function BidsPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
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

  const filtered = filter === "all" ? estimates : estimates.filter((e) => e.status === filter);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "완료";
      case "in_progress": return "진행중";
      case "archived": return "보관";
      default: return "초안";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/contractor" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm font-medium text-gray-700">입찰 관리</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">입찰 목록</h1>
          <div className="flex gap-2">
            {[
              { value: "all", label: "전체" },
              { value: "draft", label: "초안" },
              { value: "in_progress", label: "진행중" },
              { value: "completed", label: "완료" },
            ].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}>
                {f.label}
              </button>
            ))}
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">제목</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">유형</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">면적</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">총액</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 flex items-center gap-2">
                      {statusIcon(est.status)}
                      <span className="text-sm text-gray-700">{statusLabel(est.status)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{est.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {est.project_type === "residential" ? "주거" : est.project_type === "commercial" ? "상업" : "산업"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                      {est.total_area_m2 ? `${est.total_area_m2}m²` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      {est.grand_total ? `${Math.round(est.grand_total).toLocaleString()}원` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 text-right">
                      {new Date(est.created_at).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
