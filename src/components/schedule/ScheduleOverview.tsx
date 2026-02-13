"use client";

import { useMemo } from "react";
import type { ConstructionSchedule } from "@/types/construction-schedule";
import { getMonthColumns, dayOffset, formatDateKR, formatDateFullKR } from "@/lib/schedule/date-utils";
import { CheckCircle2, Clock, Circle } from "lucide-react";

interface ScheduleOverviewProps {
  schedule: ConstructionSchedule;
  className?: string;
}

/**
 * 소비자용 간소화 공정표 - 읽기 전용 바 차트
 * 7개 공정만 표시 (sub-task 없음), 드래그 불가
 */
export function ScheduleOverview({ schedule, className = "" }: ScheduleOverviewProps) {
  const ROW_HEIGHT = 40;
  const BAR_HEIGHT = 24;
  const HEADER_HEIGHT = 36;
  const DAY_WIDTH = 6; // 소비자 뷰는 압축

  const monthColumns = useMemo(
    () => getMonthColumns(schedule.startDate, schedule.endDate),
    [schedule.startDate, schedule.endDate]
  );

  const chartWidth = schedule.totalDays * DAY_WIDTH;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOff = dayOffset(schedule.startDate, todayStr);
  const showToday = todayOff >= 0 && todayOff <= schedule.totalDays;

  // 전체 진행률
  const completed = schedule.phases.filter((p) => p.status === "COMPLETED").length;

  return (
    <div className={className}>
      {/* 요약 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span>{formatDateFullKR(schedule.startDate)} ~ {formatDateFullKR(schedule.endDate)}</span>
        <span>총 {schedule.totalDays}일</span>
        <span className="text-blue-600 font-medium">
          {completed}/{schedule.phases.length} 공정 완료
        </span>
      </div>

      {/* 미니 진행 바 */}
      <div className="flex rounded-full overflow-hidden h-3 mb-5 bg-gray-100">
        {schedule.phases.map((p) => (
          <div
            key={p.id}
            className="transition-all"
            style={{
              width: `${(p.durationDays / schedule.totalDays) * 100}%`,
              backgroundColor: p.color,
              opacity: p.status === "COMPLETED" ? 1 : p.status === "IN_PROGRESS" ? 0.7 : 0.25,
            }}
          />
        ))}
      </div>

      {/* 공정 리스트 + 바 차트 */}
      <div className="flex overflow-hidden rounded-lg border border-gray-100">
        {/* 왼쪽 라벨 */}
        <div className="flex-shrink-0 border-r border-gray-100 bg-gray-50" style={{ width: 140 }}>
          <div className="border-b border-gray-100 px-3 flex items-center" style={{ height: HEADER_HEIGHT }}>
            <span className="text-[10px] font-semibold text-gray-400">공정</span>
          </div>
          {schedule.phases.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 px-3 border-b border-gray-50"
              style={{ height: ROW_HEIGHT }}
            >
              {p.status === "COMPLETED" ? (
                <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
              ) : p.status === "IN_PROGRESS" ? (
                <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-gray-300 flex-shrink-0" />
              )}
              <span className={`text-xs truncate ${
                p.status === "COMPLETED" ? "text-gray-400 line-through" :
                p.status === "IN_PROGRESS" ? "text-blue-700 font-medium" : "text-gray-600"
              }`}>
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* 오른쪽 바 차트 */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: Math.max(chartWidth, 200), minWidth: "100%" }}>
            {/* 월 헤더 */}
            <div className="flex border-b border-gray-100 bg-gray-50" style={{ height: HEADER_HEIGHT }}>
              {monthColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 border-r border-gray-50 flex items-center justify-center"
                  style={{ width: col.days * DAY_WIDTH }}
                >
                  <span className="text-[10px] text-gray-400 font-medium">{col.label}</span>
                </div>
              ))}
            </div>

            {/* SVG */}
            <svg width={Math.max(chartWidth, 200)} height={schedule.phases.length * ROW_HEIGHT}>
              {/* 월 그리드 */}
              {monthColumns.map((col, i) => (
                <line
                  key={`g-${i}`}
                  x1={col.offsetDays * DAY_WIDTH}
                  y1={0}
                  x2={col.offsetDays * DAY_WIDTH}
                  y2={schedule.phases.length * ROW_HEIGHT}
                  stroke="#F3F4F6"
                  strokeWidth={1}
                />
              ))}

              {/* 바 */}
              {schedule.phases.map((p, idx) => {
                if (!p.startDate || !p.endDate) return null;
                const startOff = dayOffset(schedule.startDate, p.startDate);
                const endOff = dayOffset(schedule.startDate, p.endDate);
                const barX = startOff * DAY_WIDTH + 1;
                const barWidth = Math.max((endOff - startOff + 1) * DAY_WIDTH - 2, 4);
                const barY = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;

                return (
                  <g key={p.id}>
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={BAR_HEIGHT}
                      rx={4}
                      fill={p.color}
                      opacity={p.status === "COMPLETED" ? 1 : p.status === "IN_PROGRESS" ? 0.7 : 0.3}
                    />
                    {barWidth > 24 && (
                      <text
                        x={barX + barWidth / 2}
                        y={barY + BAR_HEIGHT / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[9px] fill-white font-medium"
                      >
                        {p.durationDays}일
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 오늘 */}
              {showToday && (
                <line
                  x1={todayOff * DAY_WIDTH}
                  y1={0}
                  x2={todayOff * DAY_WIDTH}
                  y2={schedule.phases.length * ROW_HEIGHT}
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {schedule.phases.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-[10px] text-gray-400">
              {p.name} ({formatDateKR(p.startDate)}~{formatDateKR(p.endDate)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
