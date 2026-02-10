"use client";

import { useState, useEffect, useCallback } from "react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import {
  Loader2, Calendar, Plus, ChevronLeft, ChevronRight, X, Clock, MapPin, AlertTriangle,
} from "lucide-react";
import {
  type ScheduleItem, type CalendarView,
  mapDbSchedule,
  SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS,
} from "@/types/schedule";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(d);
  return days;
}

function getWeekDates(date: Date) {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function SchedulePage() {
  const { contractorId, authChecked } = useContractorAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [conflicts, setConflicts] = useState<{ date: string; items: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", date: "", startTime: "", endTime: "", scheduleType: "project" as string,
    location: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadSchedules = useCallback(async () => {
    if (!contractorId) return;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    // 주간/일간일 때도 한 달 데이터 로드
    try {
      const params = new URLSearchParams({
        contractorId,
        startDate: dateStr(start),
        endDate: dateStr(end),
      });
      const res = await fetch(`/api/contractor/schedule?${params}`);
      const data = await res.json();
      setSchedules((data.schedules || []).map((s: Record<string, unknown>) => mapDbSchedule(s)));
      setConflicts(data.conflicts || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [contractorId, year, month]);

  useEffect(() => { if (authChecked && contractorId) loadSchedules(); }, [authChecked, contractorId, loadSchedules]);

  // 네비게이션
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "monthly") d.setMonth(d.getMonth() + dir);
    else if (view === "weekly") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  // 일정 추가/수정
  const openModal = (prefillDate?: string, scheduleId?: string) => {
    if (scheduleId) {
      const s = schedules.find(sc => sc.id === scheduleId);
      if (s) {
        setEditId(scheduleId);
        setForm({
          title: s.title, date: s.date, startTime: s.startTime || "", endTime: s.endTime || "",
          scheduleType: s.scheduleType.toLowerCase(), location: s.location || "", notes: s.description || "",
        });
      }
    } else {
      setEditId(null);
      setForm({ title: "", date: prefillDate || dateStr(new Date()), startTime: "09:00", endTime: "18:00", scheduleType: "project", location: "", notes: "" });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!contractorId || !form.date) return;
    setSaving(true);
    try {
      const url = "/api/contractor/schedule";
      const method = editId ? "PATCH" : "POST";
      const payload = editId
        ? { id: editId, contractorId, ...form, scheduleType: form.scheduleType }
        : { contractorId, ...form, scheduleType: form.scheduleType };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        setLoading(true);
        loadSchedules();
      } else {
        const err = await res.json();
        alert(err.error || "저장 실패");
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!contractorId || !confirm("일정을 삭제하시겠습니까?")) return;
    try {
      await fetch("/api/contractor/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, contractorId }),
      });
      setLoading(true);
      loadSchedules();
    } catch { /* ignore */ }
  };

  // 날짜별 일정 맵
  const schedulesByDate = new Map<string, ScheduleItem[]>();
  for (const s of schedules) {
    const arr = schedulesByDate.get(s.date) || [];
    arr.push(s);
    schedulesByDate.set(s.date, arr);
  }

  const conflictDates = new Set(conflicts.map(c => c.date));

  if (!authChecked) return null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> 일정 관리
        </h1>
        <button onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 일정 추가
        </button>
      </div>

      {/* 뷰 토글 + 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {(["monthly", "weekly", "daily"] as CalendarView[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {v === "monthly" ? "월간" : v === "weekly" ? "주간" : "일간"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <span className="text-sm font-semibold text-gray-900">
            {view === "monthly" ? `${year}년 ${month + 1}월` :
             view === "weekly" ? `${year}년 ${month + 1}월 ${currentDate.getDate()}일 주간` :
             `${year}년 ${month + 1}월 ${currentDate.getDate()}일`}
          </span>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">오늘</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          {/* 월간 뷰 */}
          {view === "monthly" && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7">
                {DAYS.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 border-b border-gray-100">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getMonthDays(year, month).map((day, idx) => {
                  const ds = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
                  const items = ds ? (schedulesByDate.get(ds) || []) : [];
                  const isToday = ds === dateStr(new Date());
                  const hasConflict = conflictDates.has(ds);
                  return (
                    <div key={idx}
                      className={`min-h-[90px] border-b border-r border-gray-100 p-1 ${!day ? "bg-gray-50" : "cursor-pointer hover:bg-blue-50"}`}
                      onClick={() => day && openModal(ds)}>
                      {day && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}>{day}</span>
                            {hasConflict && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {items.slice(0, 3).map((s) => (
                              <div key={s.id} onClick={(e) => { e.stopPropagation(); openModal(ds, s.id); }}
                                className={`text-xs truncate px-1 py-0.5 rounded text-white ${SCHEDULE_TYPE_COLORS[s.scheduleType]}`}>
                                {s.title || SCHEDULE_TYPE_LABELS[s.scheduleType]}
                              </div>
                            ))}
                            {items.length > 3 && <span className="text-xs text-gray-400">+{items.length - 3}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 주간 뷰 */}
          {view === "weekly" && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-7">
                {getWeekDates(currentDate).map((d) => {
                  const ds = dateStr(d);
                  const items = schedulesByDate.get(ds) || [];
                  const isToday = ds === dateStr(new Date());
                  return (
                    <div key={ds} className="border-r border-gray-100 last:border-r-0">
                      <div className={`py-2 text-center text-xs font-medium border-b border-gray-100 ${isToday ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}>
                        {DAYS[d.getDay()]} {d.getDate()}
                      </div>
                      <div className="min-h-[300px] p-2 space-y-1">
                        {items.map((s) => (
                          <button key={s.id} onClick={() => openModal(ds, s.id)}
                            className={`w-full text-left p-2 rounded text-xs text-white ${SCHEDULE_TYPE_COLORS[s.scheduleType]}`}>
                            <p className="font-medium truncate">{s.title || SCHEDULE_TYPE_LABELS[s.scheduleType]}</p>
                            {s.startTime && <p className="opacity-80">{s.startTime}~{s.endTime}</p>}
                          </button>
                        ))}
                        {items.length === 0 && (
                          <button onClick={() => openModal(ds)} className="w-full py-4 text-xs text-gray-300 hover:text-gray-500">+ 추가</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 일간 뷰 */}
          {view === "daily" && (() => {
            const ds = dateStr(currentDate);
            const items = schedulesByDate.get(ds) || [];
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">{currentDate.toLocaleDateString("ko-KR", { weekday: "long", month: "long", day: "numeric" })}</h3>
                  <span className="text-xs text-gray-500">{items.length}건</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">일정이 없습니다</p>
                    <button onClick={() => openModal(ds)} className="mt-3 text-sm text-blue-600 hover:underline">일정 추가</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")).map((s) => {
                      const isConflict = conflicts.some(c => c.date === ds && c.items.includes(s.id));
                      return (
                        <div key={s.id}
                          className={`border rounded-lg p-4 ${isConflict ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${SCHEDULE_TYPE_COLORS[s.scheduleType]}`} />
                                <h4 className="text-sm font-semibold text-gray-900">{s.title || SCHEDULE_TYPE_LABELS[s.scheduleType]}</h4>
                                {isConflict && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {s.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.startTime} ~ {s.endTime}</span>}
                                {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                              </div>
                              {s.description && <p className="text-xs text-gray-500 mt-1">{s.description}</p>}
                            </div>
                            <div className="flex gap-1 ml-3">
                              <button onClick={() => openModal(ds, s.id)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">편집</button>
                              <button onClick={() => handleDelete(s.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">삭제</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editId ? "일정 수정" : "일정 추가"}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="일정 제목" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">날짜 *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">유형</label>
                <select value={form.scheduleType} onChange={(e) => setForm(f => ({ ...f, scheduleType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="project">현장 시공</option>
                  <option value="meeting">미팅</option>
                  <option value="inspection">검수</option>
                  <option value="delivery">자재 입고</option>
                  <option value="personal">개인</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">장소</label>
                <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="현장 주소" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">메모</label>
                <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <div>
                {editId && (
                  <button onClick={() => { handleDelete(editId); setShowModal(false); }}
                    className="px-4 py-2 text-red-600 text-sm hover:bg-red-50 rounded-lg">삭제</button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleSave} disabled={saving || !form.date}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editId ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
