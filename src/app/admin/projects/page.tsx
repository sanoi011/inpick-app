"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
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
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (monthFilter) params.set("month", monthFilter);
      const res = await fetch(`/api/admin/projects?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      setProjects(data.projects || []);
      setTotal(data.total || 0);
      setMonthCounts(data.monthCounts || {});
      setSelected(new Set()); // 페이지 전환 시 선택 초기화
    } catch {
      toast({ type: "error", title: "오류", message: "프로젝트를 불러올 수 없습니다" });
    }
    setLoading(false);
  }, [page, statusFilter, monthFilter]);

  useEffect(() => {
    if (authChecked) void load();
  }, [authChecked, load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === projects.length && projects.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `선택한 ${selected.size}개의 프로젝트를 모두 삭제하시겠습니까?\n연결된 견적 참조도 정리됩니다. 이 작업은 되돌릴 수 없습니다.`,
      )
    )
      return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/admin/projects`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: "삭제 실패", message: data.error });
      } else {
        toast({
          type: "success",
          title: "일괄 삭제 완료",
          message: `${data.deletedCount}개 프로젝트 삭제됨`,
        });
        await load();
      }
    } catch {
      toast({ type: "error", title: "오류", message: "삭제 중 오류 발생" });
    }
    setBulkDeleting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`프로젝트(${id.slice(0, 8)})를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/projects?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ type: "error", title: "삭제 실패", message: data.error });
      } else {
        toast({ type: "success", title: "삭제 완료" });
        await load();
      }
    } catch {
      toast({ type: "error", title: "오류" });
    }
  };

  if (!authChecked)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );

  const totalPages = Math.ceil(total / 20);
  const sortedMonths = Object.keys(monthCounts).sort().reverse();
  const allSelected = selected.size === projects.length && projects.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">프로젝트 관리</h2>
        <p className="text-sm text-gray-500">총 {total}건</p>
      </div>

      {/* 월별 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            월별 필터
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setMonthFilter("");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              monthFilter === ""
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체 기간
          </button>
          {sortedMonths.slice(0, 12).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMonthFilter(m);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                monthFilter === m
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{m.replace("-", ".")}</span>
              <span
                className={`text-[0.65rem] tabular px-1.5 py-0.5 rounded-full ${
                  monthFilter === m ? "bg-white/20" : "bg-white text-gray-700"
                }`}
              >
                {monthCounts[m]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 일괄 작업 바 — 선택 항목 있을 때 노출 */}
      {selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-red-900">
            {selected.size}개 선택됨
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 rounded-lg"
            >
              선택 해제
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              선택 항목 일괄 삭제
            </button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="w-8 px-2"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">주소</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">생성</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    조회된 프로젝트가 없습니다
                  </td>
                </tr>
              ) : (
                projects.map((p) => {
                  const isSelected = selected.has(p.id);
                  return (
                    <>
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? "bg-red-50/40" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(p.id)}
                            className="rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td
                          className="px-2 text-center cursor-pointer"
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        >
                          {expandedId === p.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {p.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.user_id?.slice(0, 8) || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {STATUS_OPTIONS.find((o) => o.value === p.status)?.label || p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">
                          {(p.address as { roadAddress?: string })?.roadAddress || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-400">
                          {new Date(p.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-2 text-center">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr key={`${p.id}-detail`}>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Address</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">
                                  {JSON.stringify(p.address, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Design State</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">
                                  {JSON.stringify(p.design_state, null, 2) || "null"}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Rendering State</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">
                                  {JSON.stringify(p.rendering_state, null, 2) || "null"}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Estimate / RFQ</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-32 border text-gray-600">
                                  {JSON.stringify(p.estimate_state || p.rfq_state, null, 2) ||
                                    "null"}
                                </pre>
                              </div>
                            </div>
                            <div className="mt-2 flex gap-4 text-xs text-gray-400">
                              <span>Drawing: {p.drawing_id || "없음"}</span>
                              <span>Estimate: {p.estimate_id || "없음"}</span>
                              <span>
                                업데이트: {new Date(p.updated_at).toLocaleString("ko-KR")}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
