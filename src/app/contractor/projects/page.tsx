"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import Link from "next/link";
import {
  Loader2, FolderKanban, Plus, ChevronDown, ChevronUp,
  CheckSquare, Square, AlertTriangle, Clock, Activity,
  MapPin, Calendar, DollarSign, X, BarChart3, List, RefreshCw,
  Camera, Trash2, ImageIcon, FileImage,
} from "lucide-react";
import {
  type Project, type ProjectPhase, type ProjectIssue, type ProjectActivity,
  mapDbProject,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  PHASE_STATUS_COLORS, ISSUE_SEVERITY_COLORS,
} from "@/types/project";
import type { ConstructionSchedule } from "@/types/construction-schedule";
import { toast } from "@/components/ui/Toast";

const GanttChart = dynamic(() => import("@/components/schedule/GanttChart").then(m => ({ default: m.GanttChart })), { ssr: false });

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "planning", label: "준비중" },
  { value: "in_progress", label: "진행중" },
  { value: "on_hold", label: "일시중지" },
  { value: "completed", label: "완료" },
];

export default function ProjectsPage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 새 프로젝트 모달
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", address: "", startDate: "", endDate: "", totalBudget: "" });
  const [creating, setCreating] = useState(false);

  // 이슈 추가
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: "", description: "", severity: "medium" as string });

  // 공정표
  const [detailViewMode, setDetailViewMode] = useState<"list" | "gantt">("list");
  const [schedule, setSchedule] = useState<ConstructionSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!contractorId) return;
    try {
      const params = new URLSearchParams({ contractorId });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/contractor/projects?${params}`);
      const data = await res.json();
      setProjects((data.projects || []).map((p: Record<string, unknown>) => mapDbProject(p)));
    } catch { toast({ type: "error", title: "오류", message: "프로젝트를 불러올 수 없습니다" }); } finally { setLoading(false); }
  }, [contractorId, statusFilter]);

  useEffect(() => { if (authChecked && contractorId) loadProjects(); }, [authChecked, contractorId, loadProjects]);

  // 프로젝트 상세 로드
  const loadDetail = async (projectId: string) => {
    if (expandedId === projectId) { setExpandedId(null); setDetailProject(null); return; }
    setExpandedId(projectId);
    setDetailLoading(true);
    setDetailViewMode("list");
    setSchedule(null);
    try {
      const res = await fetch(`/api/contractor/projects/${projectId}`);
      const data = await res.json();
      if (data.project) setDetailProject(mapDbProject(data.project));
    } catch { toast({ type: "error", title: "오류", message: "프로젝트 상세를 불러올 수 없습니다" }); } finally { setDetailLoading(false); }
  };

  // 공정표 로드
  const loadSchedule = async (projectId: string) => {
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/contractor/projects/${projectId}/schedule`);
      const data = await res.json();
      if (data.generated && data.schedule) setSchedule(data.schedule);
      else setSchedule(null);
    } catch { setSchedule(null); } finally { setScheduleLoading(false); }
  };

  // 공정표 생성
  const handleGenerateSchedule = async () => {
    if (!detailProject) return;
    setGeneratingSchedule(true);
    try {
      const res = await fetch(`/api/contractor/projects/${detailProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateSchedule" }),
      });
      if (res.ok) await loadSchedule(detailProject.id);
    } catch { toast({ type: "error", title: "오류", message: "공정표 생성에 실패했습니다" }); } finally { setGeneratingSchedule(false); }
  };

  // 공정표 바 드래그 업데이트
  const handlePhaseUpdate = async (phaseId: string, startDate: string, endDate: string) => {
    if (!detailProject) return;
    try {
      await fetch(`/api/contractor/projects/${detailProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePhaseSchedule", phaseId, startDate, endDate }),
      });
      await loadSchedule(detailProject.id);
    } catch { toast({ type: "error", title: "오류", message: "공정 업데이트에 실패했습니다" }); }
  };

  // 프로젝트 생성
  const handleCreate = async () => {
    if (!contractorId || !createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/contractor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId,
          name: createForm.name.trim(),
          address: createForm.address || undefined,
          startDate: createForm.startDate || undefined,
          endDate: createForm.endDate || undefined,
          totalBudget: createForm.totalBudget ? Number(createForm.totalBudget) : undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ name: "", address: "", startDate: "", endDate: "", totalBudget: "" });
        loadProjects();
      }
    } catch { toast({ type: "error", title: "오류", message: "프로젝트 생성에 실패했습니다" }); } finally { setCreating(false); }
  };

  // 공정 체크리스트 토글
  const handleChecklistToggle = async (phase: ProjectPhase, itemIdx: number) => {
    if (!detailProject) return;
    const updated = [...phase.checklist];
    updated[itemIdx] = { ...updated[itemIdx], completed: !updated[itemIdx].completed, completedAt: !updated[itemIdx].completed ? new Date().toISOString() : undefined };
    try {
      await fetch(`/api/contractor/projects/${detailProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePhase", phaseId: phase.id, checklist: updated }),
      });
      loadDetail(detailProject.id);
    } catch { toast({ type: "error", title: "오류", message: "체크리스트 업데이트에 실패했습니다" }); }
  };

  // 공정 상태 변경
  const handlePhaseStatus = async (phaseId: string, status: string) => {
    if (!detailProject) return;
    try {
      await fetch(`/api/contractor/projects/${detailProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePhase", phaseId, status }),
      });
      loadDetail(detailProject.id);
      loadProjects();
    } catch { toast({ type: "error", title: "오류", message: "공정 상태 변경에 실패했습니다" }); }
  };

  // 이슈 추가
  const handleAddIssue = async () => {
    if (!detailProject || !issueForm.title.trim()) return;
    try {
      await fetch(`/api/contractor/projects/${detailProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addIssue", ...issueForm }),
      });
      setShowIssueForm(false);
      setIssueForm({ title: "", description: "", severity: "medium" });
      loadDetail(detailProject.id);
    } catch { toast({ type: "error", title: "오류", message: "이슈 추가에 실패했습니다" }); }
  };

  if (!authChecked) return null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-blue-600" /> 프로젝트 관리
        </h1>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 새 프로젝트
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} onClick={() => { setStatusFilter(f.value); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">프로젝트가 없습니다</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-sm text-blue-600 hover:underline">새 프로젝트 만들기</button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* 카드 헤더 */}
              <button onClick={() => loadDetail(project.id)}
                className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{project.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PROJECT_STATUS_COLORS[project.status]}`}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {project.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.address}</span>}
                      {project.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{project.startDate}{project.endDate ? ` ~ ${project.endDate}` : ""}</span>}
                      {project.totalBudget > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(project.totalBudget)}원</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    {/* 진행률 */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{project.progressPct}%</p>
                      <div className="w-24 h-2 bg-gray-100 rounded-full mt-1">
                        <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${project.progressPct}%` }} />
                      </div>
                    </div>
                    {expandedId === project.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
              </button>

              {/* 상세 뷰 */}
              {expandedId === project.id && (
                <div className="border-t border-gray-200 p-5">
                  {detailLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                  ) : detailProject ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* 공정 타임라인 / 공정표 */}
                      <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-600" /> 공정 현황
                          </h4>
                          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                            <button onClick={() => setDetailViewMode("list")}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                detailViewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                              }`}>
                              <List className="w-3.5 h-3.5" /> 리스트
                            </button>
                            <button onClick={() => { setDetailViewMode("gantt"); if (!schedule) loadSchedule(detailProject.id); }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                detailViewMode === "gantt" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                              }`}>
                              <BarChart3 className="w-3.5 h-3.5" /> 공정표
                            </button>
                          </div>
                        </div>

                        {detailViewMode === "list" ? (
                        <div className="space-y-2">
                          {detailProject.phases.map((phase) => (
                            <PhaseCard key={phase.id} phase={phase}
                              onStatusChange={handlePhaseStatus}
                              onChecklistToggle={handleChecklistToggle}
                              projectId={detailProject.id}
                              contractorId={contractorId || ""}
                              onReload={() => loadDetail(detailProject.id)} />
                          ))}
                        </div>
                        ) : (
                        <div>
                          {scheduleLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                              <span className="ml-2 text-sm text-gray-500">공정표 로딩...</span>
                            </div>
                          ) : schedule ? (
                            <div>
                              <GanttChart schedule={schedule} editable onPhaseUpdate={handlePhaseUpdate} />
                              <button onClick={handleGenerateSchedule} disabled={generatingSchedule}
                                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                <RefreshCw className={`w-3.5 h-3.5 ${generatingSchedule ? "animate-spin" : ""}`} />
                                공정표 재생성
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                              <p className="text-sm text-gray-500 mb-1">공정표가 아직 생성되지 않았습니다</p>
                              <p className="text-xs text-gray-400 mb-4">프로젝트 시작/종료일 기반으로 자동 생성됩니다</p>
                              <button onClick={handleGenerateSchedule} disabled={generatingSchedule || !detailProject.startDate || !detailProject.endDate}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {generatingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                                공정표 생성
                              </button>
                              {(!detailProject.startDate || !detailProject.endDate) && (
                                <p className="text-xs text-amber-500 mt-2">시작일과 종료일을 먼저 설정해주세요</p>
                              )}
                            </div>
                          )}
                        </div>
                        )}

                        {/* 이슈 섹션 */}
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-500" /> 이슈 ({detailProject.issues.length})
                            </h4>
                            <button onClick={() => setShowIssueForm(true)}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <Plus className="w-3 h-3" /> 이슈 추가
                            </button>
                          </div>
                          {showIssueForm && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-3">
                              <input value={issueForm.title} onChange={(e) => setIssueForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="이슈 제목" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2" />
                              <textarea value={issueForm.description} onChange={(e) => setIssueForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="설명 (선택)" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2" />
                              <div className="flex items-center gap-2">
                                <select value={issueForm.severity} onChange={(e) => setIssueForm(f => ({ ...f, severity: e.target.value }))}
                                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                  <option value="low">낮음</option>
                                  <option value="medium">보통</option>
                                  <option value="high">높음</option>
                                  <option value="critical">긴급</option>
                                </select>
                                <button onClick={handleAddIssue} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">추가</button>
                                <button onClick={() => setShowIssueForm(false)} className="px-3 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
                              </div>
                            </div>
                          )}
                          {detailProject.issues.length === 0 ? (
                            <p className="text-xs text-gray-400">등록된 이슈가 없습니다</p>
                          ) : (
                            <div className="space-y-2">
                              {detailProject.issues.map((issue) => (
                                <IssueCard key={issue.id} issue={issue} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 활동 로그 + 시공도면 */}
                      <div>
                        {/* 시공도면 바로가기 */}
                        {detailProject.contractId && (
                          <Link
                            href={`/contract/${detailProject.contractId}#drawings`}
                            className="flex items-center gap-2 px-4 py-3 mb-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            <FileImage className="w-4 h-4" />
                            시공도면 보기
                          </Link>
                        )}

                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-green-600" /> 활동 기록
                        </h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {detailProject.activities.length === 0 ? (
                            <p className="text-xs text-gray-400">활동 기록이 없습니다</p>
                          ) : (
                            detailProject.activities.map((act) => (
                              <ActivityItem key={act.id} activity={act} />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 프로젝트 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">새 프로젝트</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">프로젝트명 *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 강남 아파트 인테리어" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">주소</label>
                <input value={createForm.address} onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="시공 현장 주소" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={createForm.startDate} onChange={(e) => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={createForm.endDate} onChange={(e) => setCreateForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">총 예산 (원)</label>
                <input type="number" value={createForm.totalBudget} onChange={(e) => setCreateForm(f => ({ ...f, totalBudget: e.target.value }))}
                  placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleCreate} disabled={creating || !createForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 서브 컴포넌트 ─── */

function PhaseCard({ phase, onStatusChange, onChecklistToggle, projectId, contractorId, onReload }: {
  phase: ProjectPhase;
  onStatusChange: (phaseId: string, status: string) => void;
  onChecklistToggle: (phase: ProjectPhase, idx: number) => void;
  projectId: string;
  contractorId: string;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const completedCount = phase.checklist.filter(c => c.completed).length;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contractorId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractorId", contractorId);
      formData.append("folder", "phases");
      const uploadRes = await fetch("/api/contractor/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { toast({ type: "error", title: "업로드 실패", message: uploadData.error || "사진 업로드에 실패했습니다" }); return; }

      await fetch(`/api/contractor/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPhasePhoto", phaseId: phase.id, photoUrl: uploadData.url, fileName: file.name }),
      });
      onReload();
    } catch { toast({ type: "error", title: "오류", message: "사진 업로드에 실패했습니다" }); } finally { setUploading(false); e.target.value = ""; }
  };

  const handlePhotoDelete = async (idx: number) => {
    try {
      await fetch(`/api/contractor/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removePhasePhoto", phaseId: phase.id, photoIndex: idx }),
      });
      onReload();
    } catch { toast({ type: "error", title: "오류", message: "사진 삭제에 실패했습니다" }); }
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 w-5">{phase.phaseOrder}</span>
          <span className="text-sm font-medium text-gray-900">{phase.name}</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PHASE_STATUS_COLORS[phase.status]}`}>
            {phase.status === "PENDING" ? "대기" : phase.status === "IN_PROGRESS" ? "진행중" : phase.status === "COMPLETED" ? "완료" : "건너뜀"}
          </span>
          {phase.checklist.length > 0 && (
            <span className="text-xs text-gray-400">{completedCount}/{phase.checklist.length}</span>
          )}
          {phase.photos.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400"><ImageIcon className="w-3 h-3" />{phase.photos.length}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-3">
          {/* 상태 변경 버튼 */}
          <div className="flex gap-1.5 mb-3">
            {(["pending", "in_progress", "completed", "skipped"] as const).map((s) => (
              <button key={s} onClick={() => onStatusChange(phase.id, s)}
                className={`px-2 py-1 rounded text-xs ${phase.status === s.toUpperCase().replace(" ", "_") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s === "pending" ? "대기" : s === "in_progress" ? "진행중" : s === "completed" ? "완료" : "건너뜀"}
              </button>
            ))}
          </div>

          {/* 시공 사진 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Camera className="w-3 h-3" /> 시공 사진 ({phase.photos.length}/5)
              </span>
              {phase.photos.length < 5 && (
                <label className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {uploading ? "업로드중..." : "사진 추가"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>
            {phase.photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {phase.photos.map((photo, idx) => (
                  <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.fileName || `사진 ${idx + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => handlePhotoDelete(idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 체크리스트 */}
          {phase.checklist.length > 0 ? (
            <div className="space-y-1.5">
              {phase.checklist.map((item, idx) => (
                <button key={item.id || idx} onClick={() => onChecklistToggle(phase, idx)}
                  className="flex items-center gap-2 w-full text-left hover:bg-gray-50 rounded p-1">
                  {item.completed ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                  <span className={`text-xs ${item.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>{item.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">체크리스트가 없습니다</p>
          )}
          {phase.notes && <p className="text-xs text-gray-500 mt-2 italic">{phase.notes}</p>}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: ProjectIssue }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ISSUE_SEVERITY_COLORS[issue.severity]}`}>
          {issue.severity === "LOW" ? "낮음" : issue.severity === "MEDIUM" ? "보통" : issue.severity === "HIGH" ? "높음" : "긴급"}
        </span>
        <h5 className="text-sm font-medium text-gray-900">{issue.title}</h5>
      </div>
      {issue.description && <p className="text-xs text-gray-500">{issue.description}</p>}
      <p className="text-xs text-gray-400 mt-1">{new Date(issue.createdAt).toLocaleDateString("ko-KR")}</p>
    </div>
  );
}

function ActivityItem({ activity }: { activity: ProjectActivity }) {
  const typeIcon: Record<string, string> = {
    created: "🆕", status_change: "🔄", issue_created: "⚠️", phase_update: "📋",
  };
  return (
    <div className="flex gap-2">
      <span className="text-sm flex-shrink-0">{typeIcon[activity.activityType] || "📌"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700">{activity.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {activity.actor && `${activity.actor} · `}
          {new Date(activity.createdAt).toLocaleDateString("ko-KR")}
        </p>
      </div>
    </div>
  );
}
