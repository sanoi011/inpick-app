"use client";

import { useState, useEffect } from "react";
import { Bot, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Star, Download } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface AILog {
  id: string;
  agent_type: string;
  user_id: string;
  user_message: string;
  assistant_response: string;
  context_data: Record<string, unknown> | null;
  model_used: string;
  response_time_ms: number;
  rating: number | null;
  feedback_helpful: boolean | null;
  feedback_accurate: boolean | null;
  created_at: string;
}

const AGENT_TYPES = [
  { value: "", label: "전체" },
  { value: "consumer_design", label: "소비자 디자인" },
  { value: "contractor_ai", label: "사업자 AI" },
  { value: "consult", label: "상담" },
];

export default function AdminAILogsPage() {
  const { authChecked } = useAdminAuth();
  const [logs, setLogs] = useState<AILog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState("");
  const [ratingOnly, setRatingOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ftStats, setFtStats] = useState<{ count: number; avgRating: number } | null>(null);

  // Fine-tuning 통계 로드
  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/admin/fine-tuning?format=json&minRating=4", {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    })
      .then((r) => r.json())
      .then((d) => setFtStats({ count: d.count || 0, avgRating: d.stats?.avgRating || 0 }))
      .catch(() => setFtStats({ count: 0, avgRating: 0 }));
  }, [authChecked]);

  const handleDownloadJsonl = () => {
    const params = new URLSearchParams({ format: "jsonl", minRating: "4" });
    if (agentFilter) params.set("agentType", agentFilter);
    window.open(`/api/admin/fine-tuning?${params}`, "_blank");
  };

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, page, agentFilter, ratingOnly]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (agentFilter) params.set("agentType", agentFilter);
      if (ratingOnly) params.set("hasRating", "true");
      const res = await fetch(`/api/admin/ai-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">AI 대화 로그</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">총 {total}건</p>
          <button onClick={handleDownloadJsonl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" />
            JSONL 다운로드{ftStats ? ` (${ftStats.count}건)` : ""}
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        {AGENT_TYPES.map((t) => (
          <button key={t.value} onClick={() => { setAgentFilter(t.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${agentFilter === t.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            {t.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={ratingOnly} onChange={(e) => { setRatingOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300" />
          평가 있는 것만
        </label>
      </div>

      {/* 로그 목록 */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">AI 대화 로그가 없습니다</p>
          </div>
        ) : logs.map((log) => (
          <div key={log.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
              {expandedId === log.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                log.agent_type === "consumer_design" ? "bg-purple-100 text-purple-700" :
                log.agent_type === "contractor_ai" ? "bg-blue-100 text-blue-700" :
                "bg-green-100 text-green-700"
              }`}>{AGENT_TYPES.find(t => t.value === log.agent_type)?.label || log.agent_type}</span>
              <p className="text-sm text-gray-700 truncate flex-1">{log.user_message?.slice(0, 80) || "..."}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {log.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                    <Star className="w-3 h-3 fill-yellow-500" />{log.rating}
                  </span>
                )}
                {log.response_time_ms > 0 && (
                  <span className="text-[10px] text-gray-400">{(log.response_time_ms / 1000).toFixed(1)}s</span>
                )}
                <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>
            {expandedId === log.id && (
              <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">사용자 메시지</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{log.user_message}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">AI 응답</p>
                  <p className="text-sm text-gray-800 bg-blue-50 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">{log.assistant_response?.slice(0, 2000)}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>User: {log.user_id?.slice(0, 8)}</span>
                  <span>Model: {log.model_used || "unknown"}</span>
                  {log.feedback_helpful !== null && <span>유용함: {log.feedback_helpful ? "Yes" : "No"}</span>}
                  {log.feedback_accurate !== null && <span>정확함: {log.feedback_accurate ? "Yes" : "No"}</span>}
                  <span>{new Date(log.created_at).toLocaleString("ko-KR")}</span>
                </div>
              </div>
            )}
          </div>
        ))}
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
