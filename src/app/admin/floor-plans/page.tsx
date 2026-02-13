"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileImage,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Building2,
  ChevronDown,
  ChevronRight,
  Star,
  BarChart3,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface LibraryItem {
  id: string;
  source_type: string;
  source_file_name: string;
  parse_method: string;
  confidence: number;
  quality_score: number;
  quality_details: Record<string, number>;
  is_verified: boolean;
  is_duplicate: boolean;
  area_sqm: number | null;
  room_count: number | null;
  wall_count: number | null;
  door_count: number | null;
  window_count: number | null;
  fixture_count: number | null;
  collected_at: string;
  apartments?: { complex_name: string; region: string } | null;
  floor_plan_types?: { type_name: string; area_sqm: number } | null;
}

interface Stats {
  total: number;
  verified: number;
  duplicates: number;
  avgQuality: number;
}

export default function FloorPlanLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, duplicates: 0, avgQuality: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (filter === "verified") params.set("verified", "true");
      if (filter === "unverified") params.set("verified", "false");

      const res = await fetch(`/api/admin/floor-plan-library?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  const qualityBadge = (score: number) => {
    if (score >= 0.8) return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">우수</span>;
    if (score >= 0.5) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">보통</span>;
    return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">낮음</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileImage className="w-6 h-6 text-blue-600" />
            도면 라이브러리
          </h1>
          <p className="text-sm text-gray-500 mt-1">수집된 평면도 관리 및 품질 평가</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <FileImage className="w-4 h-4" /> 총 도면
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> 검증 완료
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Copy className="w-4 h-4 text-orange-500" /> 중복
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.duplicates}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Star className="w-4 h-4 text-yellow-500" /> 평균 품질
          </div>
          <p className="text-2xl font-bold text-gray-900">{(stats.avgQuality * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(["all", "verified", "unverified"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {f === "all" ? "전체" : f === "verified" ? "검증됨" : "미검증"}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="파일명 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-8"></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">파일명</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">단지</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">면적</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">공간</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">품질</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">상태</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">수집일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  로딩 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">등록된 도면이 없습니다</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <>
                  <tr
                    key={item.id}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      {expandedId === item.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.is_duplicate && <Copy className="w-3.5 h-3.5 text-orange-400" />}
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">
                          {item.source_file_name || "Unknown"}
                        </span>
                        <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                          {item.source_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.apartments ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="text-xs truncate max-w-[120px]">
                            {item.apartments.complex_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {item.area_sqm ? `${item.area_sqm}m²` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {item.room_count || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">{qualityBadge(item.quality_score)}</td>
                    <td className="px-4 py-3 text-center">
                      {item.is_verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> 검증
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" /> 미검증
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {item.collected_at
                        ? new Date(item.collected_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr key={`${item.id}-detail`} className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-gray-400 mb-1">파싱 방법</p>
                            <p className="font-medium text-gray-700">{item.parse_method || "-"}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">신뢰도</p>
                            <p className="font-medium text-gray-700">{(item.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">벽/문/창</p>
                            <p className="font-medium text-gray-700">
                              {item.wall_count || 0} / {item.door_count || 0} / {item.window_count || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">설비</p>
                            <p className="font-medium text-gray-700">{item.fixture_count || 0}개</p>
                          </div>
                        </div>
                        {item.quality_details && Object.keys(item.quality_details).length > 0 && (
                          <div className="mt-3 flex items-center gap-4">
                            <BarChart3 className="w-4 h-4 text-gray-400" />
                            {Object.entries(item.quality_details).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400">{key}</span>
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${(value as number) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-gray-600">
                                  {((value as number) * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              이전
            </button>
            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
