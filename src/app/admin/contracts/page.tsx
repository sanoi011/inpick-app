"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Item {
  id: string;
  [key: string]: unknown;
}

const BID_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
  selected: { label: "선정", color: "bg-green-100 text-green-700" },
  rejected: { label: "미선정", color: "bg-red-100 text-red-700" },
};

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "bg-gray-100 text-gray-600" },
  pending_signature: { label: "서명대기", color: "bg-yellow-100 text-yellow-700" },
  signed: { label: "서명완료", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "시공중", color: "bg-green-100 text-green-700" },
  completed: { label: "완공", color: "bg-purple-100 text-purple-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
};

export default function AdminContractsPage() {
  const { authChecked } = useAdminAuth();
  const [tab, setTab] = useState<"bids" | "contracts">("contracts");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, tab, page, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: tab, page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/contracts?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);
  const statusMap = tab === "bids" ? BID_STATUS : CONTRACT_STATUS;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">계약 / 입찰 관리</h2>
        <p className="text-sm text-gray-500">총 {total}건</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setTab("contracts"); setPage(1); setStatusFilter(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "contracts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            계약
          </button>
          <button onClick={() => { setTab("bids"); setPage(1); setStatusFilter(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "bids" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            입찰
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium ${!statusFilter ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            전체
          </button>
          {Object.entries(statusMap).map(([key, val]) => (
            <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium ${statusFilter === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              {val.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ID</th>
                {tab === "bids" ? (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">견적 ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">업체</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">금액</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">프로젝트명</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">업체</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">총액</th>
                  </>
                )}
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />데이터가 없습니다
                </td></tr>
              ) : items.map((item) => {
                const st = statusMap[item.status as string];
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.id?.slice(0, 8)}</td>
                    {tab === "bids" ? (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-500">{(item.estimate_id as string)?.slice(0, 8) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{(item.contractor_name as string) || (item.contractor_id as string)?.slice(0, 8) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{((item.total_amount as number) || 0).toLocaleString()}원</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{(item.project_name as string) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{(item.contractor_name as string) || "-"}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{((item.total_amount as number) || 0).toLocaleString()}원</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st?.color || "bg-gray-100 text-gray-600"}`}>
                        {st?.label || String(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(item.created_at as string).toLocaleDateString("ko-KR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
