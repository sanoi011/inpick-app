// ─── 날짜 유틸리티 (공정표용) ───

/** YYYY-MM-DD 문자열에 n일 더하기 */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 두 날짜 사이 일수 (endDate - startDate) */
export function diffDays(startStr: string, endStr: string): number {
  const a = new Date(startStr + "T00:00:00");
  const b = new Date(endStr + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Date → YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 한국어 날짜 포맷: 3월 15일 */
export function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 한국어 날짜 포맷 (전체): 2026년 3월 15일 */
export function formatDateFullKR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 두 날짜 사이의 월 목록 반환 (Gantt 헤더용) */
export interface MonthColumn {
  year: number;
  month: number;       // 1-12
  label: string;       // "3월", "4월"
  startDate: string;   // 해당 월의 시작 (프로젝트 범위 내)
  endDate: string;     // 해당 월의 끝 (프로젝트 범위 내)
  days: number;        // 해당 월 내 프로젝트 일수
  offsetDays: number;  // 프로젝트 시작일 기준 오프셋
}

export function getMonthColumns(startStr: string, endStr: string): MonthColumn[] {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const columns: MonthColumn[] = [];

  let cursor = new Date(start);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    // 이 월의 시작/끝 (프로젝트 범위 클램프)
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // 해당 월의 마지막 날
    const clampedStart = monthStart < start ? start : monthStart;
    const clampedEnd = monthEnd > end ? end : monthEnd;

    const days = diffDays(toDateStr(clampedStart), toDateStr(clampedEnd)) + 1;
    const offsetDays = diffDays(startStr, toDateStr(clampedStart));

    columns.push({
      year,
      month,
      label: `${month}월`,
      startDate: toDateStr(clampedStart),
      endDate: toDateStr(clampedEnd),
      days,
      offsetDays,
    });

    // 다음 달로
    cursor = new Date(year, month, 1);
  }

  return columns;
}

/** 날짜가 프로젝트 시작일 기준 몇일째인지 (0-based) */
export function dayOffset(projectStart: string, dateStr: string): number {
  return diffDays(projectStart, dateStr);
}
