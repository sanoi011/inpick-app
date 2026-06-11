"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, MapPin, Clock, FolderOpen, RefreshCw, FileSignature, ArrowRight, Trash2,
  CheckSquare, Square, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import { SkeletonProjectCard } from "@/components/ui/Skeleton";
import { ProjectProgress } from "@/components/ui/ProjectProgress";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import {
  CONSUMER_PROJECT_STATUS_LABELS,
  CONSUMER_PROJECT_STATUS_COLORS,
} from "@/types/consumer-project";
import type { ConsumerProjectStatus, ProjectAddress } from "@/types/consumer-project";

const PROJECT_FILTERS = [
  { label: "전체", value: "all" },
  { label: "진행중", value: "active" },
  { label: "견적/계약", value: "rfq" },
  { label: "완료", value: "done" },
];

interface ProjectSummary {
  id: string;
  user_id: string;
  status: string;
  address: ProjectAddress | null;
  drawing_id: string | null;
  created_at: string;
  updated_at: string;
}

function mergeProjects(
  remoteProjects: ProjectSummary[],
  localProjects: { id: string; status: string; address?: ProjectAddress; updatedAt: string }[]
): ProjectSummary[] {
  const merged = new Map<string, ProjectSummary>();
  for (const rp of remoteProjects) merged.set(rp.id, rp);
  for (const lp of localProjects) {
    if (!merged.has(lp.id)) {
      merged.set(lp.id, {
        id: lp.id, user_id: "", status: lp.status,
        address: lp.address || null, drawing_id: null,
        created_at: lp.updatedAt, updated_at: lp.updatedAt,
      });
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function getLocalProjects(): { id: string; status: string; address?: ProjectAddress; updatedAt: string }[] {
  const projects: { id: string; status: string; address?: ProjectAddress; updatedAt: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("inpick_project_")) {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        if (data.id) {
          projects.push({
            id: data.id, status: data.status || "ADDRESS_SELECTION",
            address: data.address,
            updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
          });
        }
      }
    }
  } catch { /* ignore */ }
  return projects;
}

export default function MyPageProjects() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n삭제된 프로젝트는 복구할 수 없습니다.`)) return;
    setDeletingId(id);
    try {
      // 서버 삭제 (로그인 상태)
      if (user) {
        const res = await fetch(`/api/consumer-projects?id=${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          toast({ type: "error", title: "삭제 실패", message: data.error || "프로젝트를 삭제할 수 없습니다" });
          setDeletingId(null);
          return;
        }
      }
      // localStorage 삭제
      localStorage.removeItem(`inpick_project_${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast({ type: "success", title: "삭제 완료", message: "프로젝트가 삭제되었습니다" });
    } catch {
      toast({ type: "error", title: "오류", message: "프로젝트 삭제 중 오류가 발생했습니다" });
    }
    setDeletingId(null);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async (ids: string[], confirmMsg: string) => {
    if (ids.length === 0) return;
    if (!confirm(confirmMsg)) return;
    setBulkDeleting(true);
    try {
      // 서버 삭제 — 100개씩 chunking (URL 길이 안전)
      if (user) {
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const res = await fetch(
            `/api/consumer-projects?ids=${chunk.map(encodeURIComponent).join(",")}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast({ type: "error", title: "일부 삭제 실패", message: data.error || "서버 오류" });
            // 부분 실패해도 계속 — 마지막에 다시 로드
            break;
          }
        }
      }
      // localStorage 삭제
      for (const id of ids) {
        try { localStorage.removeItem(`inpick_project_${id}`); } catch { /* ignore */ }
      }
      setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
      toast({ type: "success", title: "삭제 완료", message: `${ids.length}개 프로젝트가 삭제되었습니다` });
      exitSelectMode();
    } catch {
      toast({ type: "error", title: "오류", message: "일괄 삭제 중 오류가 발생했습니다" });
    }
    setBulkDeleting(false);
  };

  const loadProjects = useCallback(() => {
    setLoading(true);
    setError(false);
    const localProjects = getLocalProjects();
    if (user) {
      const controller = new AbortController();
      fetch(`/api/consumer-projects?userId=${user.id}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => setProjects(mergeProjects(data.projects || [], localProjects)))
        .catch((err) => {
          if (err.name === "AbortError") return;
          setError(true);
          setProjects(mergeProjects([], localProjects));
          toast({ type: "error", title: "서버 연결 실패", message: "로컬 데이터만 표시합니다" });
        })
        .finally(() => setLoading(false));
      return () => controller.abort();
    } else {
      setProjects(mergeProjects([], localProjects));
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const cleanup = loadProjects();
    return () => cleanup?.();
  }, [loadProjects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter === "active") {
      list = list.filter((p) => ["WORKFLOW_IN_PROGRESS", "ADDRESS_SELECTION", "FLOOR_PLAN", "AI_DESIGN", "RENDERING", "ESTIMATING"].includes(p.status));
    } else if (statusFilter === "rfq") {
      list = list.filter((p) => ["RFQ", "CONTRACTED"].includes(p.status));
    } else if (statusFilter === "done") {
      list = list.filter((p) => p.status === "CONTRACTED");
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => {
        const name = p.address?.buildingName || "";
        const addr = p.address?.roadAddress || "";
        return name.toLowerCase().includes(q) || addr.toLowerCase().includes(q);
      });
    }
    return list;
  }, [projects, statusFilter, search]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        {[1, 2, 3, 4].map((i) => <SkeletonProjectCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">내 프로젝트</h1>
          {projects.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && !selectMode && (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <CheckSquare className="w-4 h-4" /> 선택
            </button>
          )}
          {selectMode && (
            <button
              onClick={exitSelectMode}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" /> 취소
            </button>
          )}
          <button
            onClick={() => router.push("/project/new")}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 새 프로젝트
          </button>
        </div>
      </div>

      {/* 선택 모드 툴바 */}
      {selectMode && filtered.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const allIds = filtered.map((p) => p.id);
                const allSelected = allIds.every((id) => selectedIds.has(id));
                if (allSelected) setSelectedIds(new Set());
                else setSelectedIds(new Set(allIds));
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              {filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id)) ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              전체 선택
            </button>
            <span className="text-sm text-gray-600">
              <strong className="text-blue-700">{selectedIds.size}</strong> / {filtered.length}개 선택
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkDelete(
                Array.from(selectedIds),
                `선택한 ${selectedIds.size}개 프로젝트를 삭제하시겠습니까?\n삭제된 프로젝트는 복구할 수 없습니다.`
              )}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button
              onClick={() => bulkDelete(
                filtered.map((p) => p.id),
                `현재 화면의 ${filtered.length}개 프로젝트를 모두 삭제하시겠습니까?\n삭제된 프로젝트는 복구할 수 없습니다.`
              )}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="현재 필터/검색 결과 전체 삭제"
            >
              <Trash2 className="w-4 h-4" />
              전체 삭제
            </button>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mb-4">
          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            placeholder="건물명, 주소로 검색..."
            filters={PROJECT_FILTERS}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">서버 연결에 실패했습니다. 로컬 데이터만 표시됩니다.</p>
          <button onClick={loadProjects} className="flex items-center gap-1 text-sm text-red-600 font-medium hover:text-red-800">
            <RefreshCw className="w-3.5 h-3.5" /> 재시도
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {projects.length === 0 ? "프로젝트가 없습니다" : "검색 결과가 없습니다"}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {projects.length === 0 ? "새 프로젝트를 시작해보세요" : "다른 검색어나 필터를 시도해보세요"}
          </p>
          {projects.length === 0 && (
            <button onClick={() => router.push("/project/new")} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              프로젝트 시작하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((p) => {
            const status = (p.status as ConsumerProjectStatus) || "ADDRESS_SELECTION";
            const isRfqComplete = status === "RFQ" || status === "CONTRACTED";
            const isContracted = status === "CONTRACTED";
            const getTargetUrl = () => {
              if (isContracted) return `/mypage/contracts`;
              if (status === "RFQ") return `/project/${p.id}/rfq`;
              if (status === "ESTIMATING") return `/workflow/estimate?projectId=${p.id}`;
              // 신규 워크플로우 — 진행 중 프로젝트는 현재 워크플로우에서 이어서 진행
              return `/workflow?projectId=${p.id}`;
            };
            const displayName = p.address?.buildingName || p.address?.roadAddress || "새 프로젝트";
            const isSelected = selectedIds.has(p.id);
            return (
              <div key={p.id} className={`bg-white border rounded-xl p-5 transition-all ${
                selectMode && isSelected
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : isContracted
                    ? "border-green-200 hover:border-green-300 hover:shadow-sm"
                    : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
              }`}>
                <button
                  onClick={() => selectMode ? toggleSelect(p.id) : router.push(getTargetUrl())}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {selectMode && (
                        <div className="mt-0.5 flex-shrink-0">
                          {isSelected
                            ? <CheckSquare className="w-5 h-5 text-blue-600" />
                            : <Square className="w-5 h-5 text-gray-300" />}
                        </div>
                      )}
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {displayName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${CONSUMER_PROJECT_STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
                        {CONSUMER_PROJECT_STATUS_LABELS[status] || status}
                      </span>
                      {!selectMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(p.id, String(displayName)); }}
                          disabled={deletingId === p.id}
                          className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="프로젝트 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {p.address?.roadAddress && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />
                      {p.address.roadAddress}{p.address.dongName && ` ${p.address.dongName}`}{p.address.hoName && ` ${p.address.hoName}`}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {p.address?.exclusiveArea && <span>전용 {p.address.exclusiveArea}m²</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.updated_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <ProjectProgress status={status} compact />
                </button>
                {isRfqComplete && !selectMode && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    {isContracted ? (
                      <>
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><FileSignature className="w-3.5 h-3.5" />업체 선정 완료</span>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/contracts`); }} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                          <FileSignature className="w-4 h-4" />계약진행<ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-blue-600 font-medium">입찰 확인 중</span>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/project/${p.id}/rfq`); }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                          입찰 확인<ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > visibleCount && (
            <button onClick={() => setVisibleCount((v) => v + 10)} className="w-full py-3 text-sm font-medium text-blue-600 hover:text-blue-700 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
              더 보기 ({filtered.length - visibleCount}개 남음)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
