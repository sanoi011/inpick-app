"use client";

import { useState, useEffect } from "react";
import {
  FileImage,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface DrawingLog {
  id: string;
  project_id: string | null;
  user_id: string | null;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  parse_method: string;
  result_json: Record<string, unknown> | null;
  confidence_score: number | null;
  warnings: string[] | null;
  processing_time_ms: number | null;
  known_area_m2: number | null;
  detected_area_m2: number | null;
  room_count: number | null;
  created_at: string;
}

interface Stats {
  total: number;
  methods: Record<string, number>;
  avgConfidence: number;
  avgProcessingTime: number;
  highConfidence: number;
  lowConfidence: number;
}

const METHOD_LABELS: Record<string, string> = {
  gemini_vision: "Gemini Vision",
  dxf_parser: "DXF 파서",
  mock: "Mock 데이터",
};

const METHOD_FILTERS = [
  { value: "", label: "전체" },
  { value: "gemini_vision", label: "Gemini Vision" },
  { value: "dxf_parser", label: "DXF 파서" },
  { value: "mock", label: "Mock" },
];

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-400">-</span>;
  const pct = Math.round(score * 100);
  if (score >= 0.8) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <CheckCircle2 className="w-3 h-3" />
        {pct}%
      </span>
    );
  }
  if (score >= 0.5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <AlertTriangle className="w-3 h-3" />
        {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
      <XCircle className="w-3 h-3" />
      {pct}%
    </span>
  );
}

export default function AdminDrawingLogsPage() {
  const { authChecked } = useAdminAuth();
  const [logs, setLogs] = useState<DrawingLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!authChecked) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (methodFilter) params.set("method", methodFilter);

    fetch(`/api/admin/drawing-logs?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
        setStats(d.stats || null);
      })
      .catch(() => {
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [authChecked, page, methodFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileImage className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">도면 인식 로그</h1>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
            {total}건
          </span>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">총 파싱</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <div className="mt-1 flex gap-2 text-[10px] text-gray-400">
              {Object.entries(stats.methods).map(([m, c]) => (
                <span key={m}>{METHOD_LABELS[m] || m}: {c}</span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">평균 신뢰도</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {Math.round(stats.avgConfidence * 100)}%
            </p>
            <div className="mt-1 text-[10px] text-gray-400">
              높음({stats.highConfidence}) / 낮음({stats.lowConfidence})
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-gray-500">평균 처리 시간</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.avgProcessingTime > 1000
                ? `${(stats.avgProcessingTime / 1000).toFixed(1)}s`
                : `${stats.avgProcessingTime}ms`}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">성공률</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.total > 0
                ? Math.round(((stats.total - (stats.methods["mock"] || 0)) / stats.total) * 100)
                : 0}%
            </p>
            <div className="mt-1 text-[10px] text-gray-400">
              Mock 제외 실제 파싱 비율
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4">
        {METHOD_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setMethodFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              methodFilter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 로그 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileImage className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">도면 인식 로그가 없습니다</p>
            <p className="text-xs mt-1">도면을 업로드하면 파싱 로그가 기록됩니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">파일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">방법</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">신뢰도</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">면적</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">공간수</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">처리 시간</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">일시</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileImage className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                            {log.file_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {log.file_type.toUpperCase()}
                            {log.file_size_bytes
                              ? ` · ${(log.file_size_bytes / 1024).toFixed(0)}KB`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        log.parse_method === "gemini_vision"
                          ? "bg-blue-50 text-blue-700"
                          : log.parse_method === "dxf_parser"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {METHOD_LABELS[log.parse_method] || log.parse_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ConfidenceBadge score={log.confidence_score} />
                    </td>
                    <td className="px-4 py-3 align-top hidden md:table-cell">
                      <div className="text-xs">
                        {log.detected_area_m2 != null && (
                          <span className="text-gray-900">{log.detected_area_m2}m²</span>
                        )}
                        {log.known_area_m2 != null && (
                          <span className="text-gray-400 ml-1">
                            (입력: {log.known_area_m2}m²)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top hidden md:table-cell text-xs text-gray-700">
                      {log.room_count ?? "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-700">
                      {log.processing_time_ms != null
                        ? log.processing_time_ms > 1000
                          ? `${(log.processing_time_ms / 1000).toFixed(1)}s`
                          : `${log.processing_time_ms}ms`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    {isExpanded && (
                      <td colSpan={8} className="px-4 pb-4">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          {/* 경고 */}
                          {log.warnings && log.warnings.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">경고</p>
                              <div className="space-y-1">
                                {log.warnings.map((w, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    {w}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* 결과 요약 */}
                          {log.result_json && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">파싱 결과 요약</p>
                              <pre className="text-[10px] text-gray-600 bg-white rounded border border-gray-200 p-2 max-h-40 overflow-auto">
                                {JSON.stringify(
                                  {
                                    totalArea: (log.result_json as Record<string, unknown>).totalArea,
                                    rooms: ((log.result_json as Record<string, unknown>).rooms as Array<Record<string, unknown>>)?.length || 0,
                                    walls: ((log.result_json as Record<string, unknown>).walls as Array<unknown>)?.length || 0,
                                    doors: ((log.result_json as Record<string, unknown>).doors as Array<unknown>)?.length || 0,
                                    windows: ((log.result_json as Record<string, unknown>).windows as Array<unknown>)?.length || 0,
                                    fixtures: ((log.result_json as Record<string, unknown>).fixtures as Array<unknown>)?.length || 0,
                                    roomTypes: ((log.result_json as Record<string, unknown>).rooms as Array<Record<string, unknown>>)?.map(
                                      (r) => `${r.name}(${r.type}, ${r.area}m²)`
                                    ),
                                  },
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          )}
                          {/* 메타 */}
                          <div className="flex gap-4 text-[10px] text-gray-400">
                            <span>ID: {log.id.slice(0, 8)}</span>
                            {log.project_id && <span>Project: {log.project_id.slice(0, 8)}</span>}
                            {log.user_id && <span>User: {log.user_id.slice(0, 8)}</span>}
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            {total}건 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, total)}건
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
