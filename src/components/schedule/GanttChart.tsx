"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import type { ConstructionSchedule, PhaseSchedule, GanttViewMode } from "@/types/construction-schedule";
import { getMonthColumns, dayOffset, diffDays, formatDateKR, addDays } from "@/lib/schedule/date-utils";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── 치수 상수 ───

const ROW_HEIGHT = 36;
const BAR_HEIGHT = 22;
const BAR_RADIUS = 4;
const LABEL_WIDTH = 180;
const HEADER_HEIGHT = 52;
const SUB_INDENT = 24;

const DAY_WIDTHS: Record<GanttViewMode, number> = {
  day: 36,
  week: 20,
  month: 8,
};

// ─── Props ───

interface GanttChartProps {
  schedule: ConstructionSchedule;
  editable?: boolean;
  compact?: boolean;
  viewMode?: GanttViewMode;
  showSubTasks?: boolean;
  onPhaseUpdate?: (phaseId: string, startDate: string, endDate: string) => void;
  className?: string;
}

export function GanttChart({
  schedule,
  editable = false,
  compact = false,
  viewMode: initialViewMode = "week",
  showSubTasks: initialShowSubs = false,
  onPhaseUpdate,
  className = "",
}: GanttChartProps) {
  const [viewMode, setViewMode] = useState<GanttViewMode>(initialViewMode);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showSubTasks, setShowSubTasks] = useState(initialShowSubs);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; phase: PhaseSchedule } | null>(null);
  const [dragState, setDragState] = useState<{
    phaseId: string;
    type: "move" | "resize-end";
    startX: number;
    originalStart: string;
    originalEnd: string;
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const dayWidth = DAY_WIDTHS[viewMode];
  const totalDays = schedule.totalDays;
  const chartWidth = totalDays * dayWidth;
  const monthColumns = useMemo(() => getMonthColumns(schedule.startDate, schedule.endDate), [schedule.startDate, schedule.endDate]);

  // 오늘 위치
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOffset = dayOffset(schedule.startDate, todayStr);
  const showToday = todayOffset >= 0 && todayOffset <= totalDays;

  // 표시할 행 목록 계산
  const rows = useMemo(() => {
    const result: { type: "phase" | "task"; phase: PhaseSchedule; taskIdx?: number; indent: number }[] = [];
    for (const phase of schedule.phases) {
      result.push({ type: "phase", phase, indent: 0 });
      if (showSubTasks && expandedPhases.has(phase.id)) {
        for (let i = 0; i < phase.tasks.length; i++) {
          result.push({ type: "task", phase, taskIdx: i, indent: 1 });
        }
      }
    }
    return result;
  }, [schedule.phases, showSubTasks, expandedPhases]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  // ─── 드래그 핸들러 ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, phaseId: string, type: "move" | "resize-end") => {
      if (!editable || !onPhaseUpdate) return;
      const phase = schedule.phases.find((p) => p.id === phaseId);
      if (!phase) return;
      e.preventDefault();
      setDragState({
        phaseId,
        type,
        startX: e.clientX,
        originalStart: phase.startDate,
        originalEnd: phase.endDate,
      });
    },
    [editable, onPhaseUpdate, schedule.phases]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !onPhaseUpdate) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / dayWidth);
      if (deltaDays === 0) return;

      if (dragState.type === "move") {
        const newStart = addDays(dragState.originalStart, deltaDays);
        const newEnd = addDays(dragState.originalEnd, deltaDays);
        onPhaseUpdate(dragState.phaseId, newStart, newEnd);
      } else {
        const dur = diffDays(dragState.originalStart, dragState.originalEnd) + 1 + deltaDays;
        if (dur < 1) return;
        const newEnd = addDays(dragState.originalStart, dur - 1);
        onPhaseUpdate(dragState.phaseId, dragState.originalStart, newEnd);
      }
    },
    [dragState, dayWidth, onPhaseUpdate]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* 툴바 */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1.5">
            {(["month", "week", "day"] as GanttViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === m ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-200"
                }`}
              >
                {m === "day" ? "일" : m === "week" ? "주" : "월"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSubTasks(!showSubTasks); if (!showSubTasks) setExpandedPhases(new Set(schedule.phases.map((p) => p.id))); }}
              className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded-md"
            >
              {showSubTasks ? "접기" : "상세 보기"}
            </button>
          </div>
        </div>
      )}

      {/* 차트 영역 */}
      <div
        className="flex overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 왼쪽 라벨 (sticky) */}
        <div className="flex-shrink-0 border-r border-gray-200 bg-white z-10" style={{ width: compact ? 140 : LABEL_WIDTH }}>
          {/* 헤더 빈칸 */}
          <div className="border-b border-gray-200 bg-gray-50 flex items-center px-3" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-semibold text-gray-500">공정명</span>
          </div>
          {/* 행 라벨 */}
          {rows.map((row, idx) => {
            const isPhase = row.type === "phase";
            const hasChildren = isPhase && row.phase.tasks.length > 0 && showSubTasks;
            const isExpanded = expandedPhases.has(row.phase.id);

            return (
              <div
                key={`label-${idx}`}
                className={`flex items-center border-b border-gray-50 hover:bg-gray-50 ${
                  isPhase ? "font-medium" : "text-gray-500"
                }`}
                style={{ height: ROW_HEIGHT, paddingLeft: row.indent * SUB_INDENT + 8 }}
              >
                {hasChildren && (
                  <button onClick={() => togglePhase(row.phase.id)} className="mr-1 text-gray-400">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
                  style={{ backgroundColor: row.phase.color }}
                />
                <span className="text-xs truncate">
                  {isPhase ? row.phase.name : row.phase.tasks[row.taskIdx!]?.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* 오른쪽 차트 (스크롤) */}
        <div className="flex-1 overflow-x-auto" ref={chartRef}>
          <div style={{ width: chartWidth, minWidth: "100%" }}>
            {/* 월 헤더 */}
            <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: HEADER_HEIGHT }}>
              {monthColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 border-r border-gray-100 flex items-center justify-center"
                  style={{ width: col.days * dayWidth }}
                >
                  <span className="text-xs font-semibold text-gray-600">
                    {col.year !== new Date().getFullYear() && `${col.year}. `}
                    {col.label}
                  </span>
                </div>
              ))}
            </div>

            {/* SVG 바 영역 */}
            <svg width={chartWidth} height={rows.length * ROW_HEIGHT} className="select-none">
              {/* 그리드 라인 */}
              {monthColumns.map((col, i) => (
                <line
                  key={`grid-${i}`}
                  x1={col.offsetDays * dayWidth}
                  y1={0}
                  x2={col.offsetDays * dayWidth}
                  y2={rows.length * ROW_HEIGHT}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
              ))}

              {/* 행 구분선 */}
              {rows.map((_, idx) => (
                <line
                  key={`row-${idx}`}
                  x1={0}
                  y1={(idx + 1) * ROW_HEIGHT}
                  x2={chartWidth}
                  y2={(idx + 1) * ROW_HEIGHT}
                  stroke="#F3F4F6"
                  strokeWidth={1}
                />
              ))}

              {/* 바 렌더링 */}
              {rows.map((row, idx) => {
                const isPhase = row.type === "phase";
                const item = isPhase ? row.phase : row.phase.tasks[row.taskIdx!];
                if (!item || !item.startDate || !item.endDate) return null;

                const startOff = dayOffset(schedule.startDate, item.startDate);
                const endOff = dayOffset(schedule.startDate, item.endDate);
                const barX = startOff * dayWidth + 2;
                const barWidth = Math.max((endOff - startOff + 1) * dayWidth - 4, 4);
                const barY = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;

                const isCompleted = item.status === "COMPLETED";
                const isInProgress = item.status === "IN_PROGRESS";
                const opacity = isCompleted ? 1 : isInProgress ? 0.85 : 0.5;

                return (
                  <g key={`bar-${idx}`}>
                    {/* 바 배경 */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={BAR_HEIGHT}
                      rx={BAR_RADIUS}
                      fill={row.phase.color}
                      opacity={opacity}
                      className={editable && isPhase ? "cursor-grab" : ""}
                      onMouseDown={(e) => isPhase && handleMouseDown(e, row.phase.id, "move")}
                      onMouseEnter={(e) => {
                        if (isPhase) {
                          const rect = (e.target as SVGRectElement).getBoundingClientRect();
                          setTooltip({ x: rect.left, y: rect.bottom + 4, phase: row.phase });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />

                    {/* 완료 체크마크 또는 일수 텍스트 */}
                    {barWidth > 30 && (
                      <text
                        x={barX + barWidth / 2}
                        y={barY + BAR_HEIGHT / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[9px] fill-white font-medium pointer-events-none"
                      >
                        {isCompleted ? "✓" : `${item.durationDays}일`}
                      </text>
                    )}

                    {/* 드래그 핸들 (편집 모드, 공정만) */}
                    {editable && isPhase && (
                      <rect
                        x={barX + barWidth - 6}
                        y={barY}
                        width={8}
                        height={BAR_HEIGHT}
                        fill="transparent"
                        className="cursor-ew-resize"
                        onMouseDown={(e) => handleMouseDown(e, row.phase.id, "resize-end")}
                      />
                    )}
                  </g>
                );
              })}

              {/* 오늘 표시선 */}
              {showToday && (
                <>
                  <line
                    x1={todayOffset * dayWidth}
                    y1={0}
                    x2={todayOffset * dayWidth}
                    y2={rows.length * ROW_HEIGHT}
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={todayOffset * dayWidth}
                    y={-4}
                    textAnchor="middle"
                    className="text-[9px] fill-red-500 font-bold"
                  >
                    오늘
                  </text>
                </>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* 툴팁 */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold">{tooltip.phase.name}</p>
          <p className="text-gray-300 mt-0.5">
            {formatDateKR(tooltip.phase.startDate)} ~ {formatDateKR(tooltip.phase.endDate)} ({tooltip.phase.durationDays}일)
          </p>
          <p className="text-gray-400 mt-0.5">
            {tooltip.phase.status === "COMPLETED" ? "완료" : tooltip.phase.status === "IN_PROGRESS" ? "진행중" : "대기"}
          </p>
        </div>
      )}

      {/* 범례 */}
      {!compact && (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50 flex-wrap">
          {schedule.phases.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-[10px] text-gray-500">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
