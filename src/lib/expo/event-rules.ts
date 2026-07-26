/**
 * INPICK EXPO — 행사 규정 (Phase 4, 블루프린트 §3.5/마스터 Phase 4).
 *
 * 불변조건:
 *   - 행사 source가 없는 일반 규칙을 "승인된 사실"처럼 표시하지 않는다.
 *     여기의 모든 값은 사용자가 행사 매뉴얼에서 직접 입력한 것이며,
 *     검토 항목에는 그 출처(사용자 입력)를 항상 명시한다.
 *   - 위반은 배치를 막지 않는다 — 사람이 판단하도록 blocked로 노출만 한다.
 *   - 순수 함수.
 */

export interface ExpoEventInfo {
  eventName: string;
  venue: string;
  boothNumber: string;
  /** 행사 매뉴얼 기준 최대 허용 높이 (m) — 미입력 null */
  maxHeightM: number | null;
  /** 신청한 전기 용량 (kW) — 미입력 null */
  powerKw: number | null;
  /** 출처 메모 (예: "매뉴얼 p.12") */
  sourceNote: string;
}

export function createEmptyEventInfo(): ExpoEventInfo {
  return {
    eventName: "",
    venue: "",
    boothNumber: "",
    maxHeightM: null,
    powerKw: null,
    sourceNote: "",
  };
}

export function isExpoEventInfo(value: unknown): value is ExpoEventInfo {
  if (!value || typeof value !== "object") return false;
  const info = value as ExpoEventInfo;
  return (
    typeof info.eventName === "string" &&
    typeof info.venue === "string" &&
    typeof info.boothNumber === "string" &&
    (info.maxHeightM === null || typeof info.maxHeightM === "number") &&
    (info.powerKw === null || typeof info.powerKw === "number") &&
    typeof info.sourceNote === "string"
  );
}

/** 규정 정보가 하나라도 입력됐는가 (readiness 시작 판정) */
export function hasEventRuleInput(info: ExpoEventInfo): boolean {
  return Boolean(
    info.eventName.trim() ||
      info.venue.trim() ||
      info.boothNumber.trim() ||
      info.maxHeightM !== null ||
      info.powerKw !== null,
  );
}

export interface ExpoEventReviewItem {
  code: "height_limit" | "power_capacity";
  severity: "ok" | "warning" | "violation";
  message: string;
}

/** v1 코스트북의 전기 기본 가정 (kW) — estimate.ts fixedLines와 일치 */
export const EXPO_BASE_POWER_KW = 1;

export function evaluateEventRules(
  info: ExpoEventInfo,
  wallHeightM: number | null,
): ExpoEventReviewItem[] {
  const items: ExpoEventReviewItem[] = [];

  if (info.maxHeightM !== null && wallHeightM !== null) {
    if (wallHeightM > info.maxHeightM + 1e-9) {
      items.push({
        code: "height_limit",
        severity: "violation",
        message: `부스 벽 높이 ${wallHeightM}m가 입력된 허용 높이 ${info.maxHeightM}m를 초과합니다 (사용자 입력 매뉴얼 기준).`,
      });
    } else {
      items.push({
        code: "height_limit",
        severity: "ok",
        message: `벽 높이 ${wallHeightM}m ≤ 허용 ${info.maxHeightM}m (사용자 입력 매뉴얼 기준).`,
      });
    }
  }

  if (info.powerKw !== null) {
    if (info.powerKw < EXPO_BASE_POWER_KW) {
      items.push({
        code: "power_capacity",
        severity: "warning",
        message: `신청 전기 ${info.powerKw}kW가 견적 기본 가정(${EXPO_BASE_POWER_KW}kW)보다 작습니다 — 조명·장비 용량을 확인하세요.`,
      });
    } else {
      items.push({
        code: "power_capacity",
        severity: "ok",
        message: `신청 전기 ${info.powerKw}kW (견적 기본 가정 ${EXPO_BASE_POWER_KW}kW 충족).`,
      });
    }
  }

  return items;
}

export function hasEventRuleViolation(items: ExpoEventReviewItem[]): boolean {
  return items.some((item) => item.severity === "violation");
}
