/**
 * INPICK EXPO — 고객 결정 (블루프린트 §3.16 Client Decision).
 *
 * 불변조건:
 *   - 결정은 공유 토큰 소지자(고객)의 행위로만 기록된다 — 자동 승인 없음.
 *   - 승인은 "제안 검토 승인"이지 시공/계약 확정이 아니다 (렌더 승인 ≠ 제작
 *     승인). UI는 이 구분을 항상 표기한다.
 */

export type ExpoClientDecisionKind = "approved" | "changes_requested";

export interface ExpoClientDecision {
  decision: ExpoClientDecisionKind;
  comment: string;
  decidedAt: string;
}

export const EXPO_DECISION_COMMENT_MAX = 500;

export function isExpoClientDecision(
  value: unknown,
): value is ExpoClientDecision {
  if (!value || typeof value !== "object") return false;
  const decision = value as ExpoClientDecision;
  return (
    (decision.decision === "approved" ||
      decision.decision === "changes_requested") &&
    typeof decision.comment === "string" &&
    decision.comment.length <= EXPO_DECISION_COMMENT_MAX &&
    typeof decision.decidedAt === "string"
  );
}

export const EXPO_DECISION_LABELS: Record<ExpoClientDecisionKind, string> = {
  approved: "고객 승인됨 (제안 검토 승인 — 시공 확정 아님)",
  changes_requested: "고객 변경 요청",
};
