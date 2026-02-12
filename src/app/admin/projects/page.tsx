"use client";

import { useState, useEffect } from "react";
import { FolderKanban, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "ADDRESS_SELECTION", label: "주소 선택" },
  { value: "FLOOR_PLAN", label: "도면" },
  { value: "AI_DESIGN", label: "AI 디자인" },
  { value: "RENDERING", label: "렌더링" },
  { value: "ESTIMATE", label: "견적" },
  { value: "RFQ", label: "견적요청" },
];

const STATUS_COLORS: Record<string, string> = {
  ADDRESS_SELECTION: "bg-gray-100 text-gray-600",
  FLOOR_PLAN: "bg-blue-100 text-blue-700",
  AI_DESIGN: "bg-purple-100 text-purple-700",
  RENDERING: "bg-indigo-100 text-indigo-700",
  ESTIMATE: "bg-green-100 text-green-700",
  RFQ: "bg-orange-100 text-orange-700",
};

interface Project {
  id: string;
  user_id: string;
  status: string;
  address: Record<string, unknown> | null;
  drawing_id: string | null;
  estimate_id: string | null;
  design_state: Record<string, unknown> | null;
  rendering_state: Record<string, unknown> | null;
  estimate_state: Record<string, unknown> | null;
  rfq_state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export default function AdminProjectsPage() {
  const { authChecked } = useAdminAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, page, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/projects?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      setProjects(data.projects || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">프로젝트 관리</h2>
        <p className="text-sm text-gray-500">총 {total}건</p>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">주소</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">업데이트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-300" />프로젝트가 없습니다
                </td></tr>
              ) : projects.map((p) => (
                <>
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    <td className="px-2 text-center">
                      {expandedId === p.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.user_id?.slice(0, 8) || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_OPTIONS.find(o => o.value === p.status)?.label || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">
                      {(p.address as { roadAddress?: string })?.roadAddress || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(p.updated_at).toLocaleString("ko-KR")}</td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Address</p>
                            <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">{JSON.stringify(p.address, null, 2)}</pre>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Design State</p>
                            <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">{JSON.stringify(p.design_state, null, 2) || "null"}</pre>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Rendering State</p>
                            <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">{JSON.stringify(p.rendering_state, null, 2) || "null"}</pre>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Estimate / RFQ State</p>
                            <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">{JSON.stringify(p.estimate_state || p.rfq_state, null, 2) || "null"}</pre>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-gray-400">
                          <span>Drawing: {p.drawing_id || "없음"}</span>
                          <span>Estimate: {p.estimate_id || "없음"}</span>
                          <span>생성: {new Date(p.created_at).toLocaleString("ko-KR")}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
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
