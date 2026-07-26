/**
 * INPICK EXPO — Proposal Readiness 레일 (블루프린트 §3.16).
 *
 * 불변조건: 전체 퍼센트만 보여주고 blocking 사유를 숨기지 않는다 —
 * 항목별 상태와 사유를 항상 함께 노출한다. 이 모듈은 현재 브리프
 * 데이터에서 상태를 계산만 하고, 어떤 항목도 자동으로 confirmed로
 * 승격하지 않는다 (confirmed는 사람의 확정 행위에서만 온다).
 */

export type ExpoReadinessState =
  | "unstarted"
  | "assumed"
  | "needs_review"
  | "confirmed"
  | "blocked"
  | "stale";

export const EXPO_READINESS_STATE_LABELS: Record<ExpoReadinessState, string> = {
  unstarted: "시작 전",
  assumed: "가정",
  needs_review: "검토 필요",
  confirmed: "확정",
  blocked: "차단됨",
  stale: "갱신 필요",
};

export type ExpoReadinessDimension =
  | "space"
  | "brand"
  | "configuration"
  | "price"
  | "event_rules"
  | "official_services"
  | "client_decision";

export interface ExpoReadinessItem {
  dimension: ExpoReadinessDimension;
  label: string;
  state: ExpoReadinessState;
  detail: string;
}

export interface ExpoReadinessInput {
  hasFootprint: boolean;
  dimensionsConfirmed: boolean;
  componentCount: number;
  priceStage: "conceptual_range" | "catalog_estimate" | null;
  /** 사용자가 브랜드 킷을 확정(사용 권한 확인 포함)했는가 */
  brandConfirmed?: boolean;
  /** 행사 규정 — 입력 여부와 위반 여부 (event-rules.ts 계산 결과) */
  eventRules?: { entered: boolean; violation: boolean };
  /** 고객 결정 (공유 페이지에서 기록) */
  clientDecision?: "approved" | "changes_requested" | null;
  /** 공식 서비스(전기/리깅/인터넷) 신청 현황 입력 여부 */
  officialServicesEntered?: boolean;
}

export function evaluateProposalReadiness(
  input: ExpoReadinessInput,
): ExpoReadinessItem[] {
  const {
    hasFootprint,
    dimensionsConfirmed,
    componentCount,
    priceStage,
    brandConfirmed = false,
    eventRules = { entered: false, violation: false },
    clientDecision = null,
    officialServicesEntered = false,
  } = input;

  const space: ExpoReadinessItem = dimensionsConfirmed
    ? {
        dimension: "space",
        label: "공간",
        state: "confirmed",
        detail: "행사 매뉴얼/실측 기준 치수 확정됨",
      }
    : hasFootprint
      ? {
          dimension: "space",
          label: "공간",
          state: "assumed",
          detail: "면적 기반 가정 치수 — 확정 필요",
        }
      : {
          dimension: "space",
          label: "공간",
          state: "unstarted",
          detail: "면적을 입력하면 시작됩니다",
        };

  const configuration: ExpoReadinessItem =
    componentCount > 0
      ? {
          dimension: "configuration",
          label: "구성",
          state: "assumed",
          detail: `카탈로그 배치 ${componentCount}개 — 시공 검토 전`,
        }
      : {
          dimension: "configuration",
          label: "구성",
          state: "unstarted",
          detail: "카탈로그에서 구성 요소를 배치하세요",
        };

  const price: ExpoReadinessItem =
    priceStage === "catalog_estimate"
      ? {
          dimension: "price",
          label: "금액",
          state: "assumed",
          detail: "카탈로그 견적 — 전 항목 가정 단가(allowance)",
        }
      : priceStage === "conceptual_range"
        ? {
            dimension: "price",
            label: "금액",
            state: "assumed",
            detail: "개념 범위 — 치수 확정 시 카탈로그 견적으로",
          }
        : {
            dimension: "price",
            label: "금액",
            state: "unstarted",
            detail: "면적 입력 후 계산됩니다",
          };

  return [
    space,
    brandConfirmed
      ? {
          dimension: "brand" as const,
          label: "브랜드",
          state: "confirmed" as const,
          detail: "브랜드 킷 확정됨 (사용 권한 확인)",
        }
      : {
          dimension: "brand" as const,
          label: "브랜드",
          state: "unstarted" as const,
          detail: "참고 웹사이트에서 브랜드를 가져오세요",
        },
    configuration,
    price,
    eventRules.violation
      ? {
          dimension: "event_rules" as const,
          label: "행사 규정",
          state: "blocked" as const,
          detail: "입력한 매뉴얼 기준 위반 항목 있음 — 검토 필요",
        }
      : eventRules.entered
        ? {
            dimension: "event_rules" as const,
            label: "행사 규정",
            state: "confirmed" as const,
            detail: "행사 매뉴얼 기준 값 입력됨 (사용자 입력)",
          }
        : {
            dimension: "event_rules" as const,
            label: "행사 규정",
            state: "unstarted" as const,
            detail: "행사 매뉴얼의 허용 높이·전기 용량을 입력하세요",
          },
    officialServicesEntered
      ? {
          dimension: "official_services" as const,
          label: "공식 서비스",
          state: "confirmed" as const,
          detail: "주최측 신청 현황 입력됨 (사용자 자가 체크)",
        }
      : {
          dimension: "official_services" as const,
          label: "공식 서비스",
          state: "unstarted" as const,
          detail: "전기/리깅/인터넷 신청 여부를 체크하세요",
        },
    clientDecision === "approved"
      ? {
          dimension: "client_decision" as const,
          label: "고객 승인",
          state: "confirmed" as const,
          detail: "고객이 제안을 승인함 (시공 확정 아님)",
        }
      : clientDecision === "changes_requested"
        ? {
            dimension: "client_decision" as const,
            label: "고객 승인",
            state: "needs_review" as const,
            detail: "고객 변경 요청 있음 — 반영 후 재공유",
          }
        : {
            dimension: "client_decision" as const,
            label: "고객 승인",
            state: "unstarted" as const,
            detail: "공유 링크에서 고객 결정 대기",
          },
  ];
}

/** 참고용 전체 진행률 — 단독 표시 금지, 항목 리스트와 함께만 노출한다. */
export function readinessPercent(items: ExpoReadinessItem[]): number {
  const score: Record<ExpoReadinessState, number> = {
    unstarted: 0,
    blocked: 0,
    stale: 0,
    assumed: 0.5,
    needs_review: 0.5,
    confirmed: 1,
  };
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + score[item.state], 0);
  return Math.round((total / items.length) * 100);
}
