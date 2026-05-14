/**
 * Missing Info Engine — 견적 정밀도 향상을 위해 사용자에게 던질 질문 자동 생성.
 * 가이드: inpick-ultra-precision-estimate-engine-v3-dev-plan-20260513.md §9
 *
 * 견적 라인 분석 → 누락/모호한 정보 식별 → 질문 task 반환.
 * 사용자 답변 → 견적 재계산 (L1→L2 또는 L2→L3 격상).
 */
import type { ConstructionEstimate, ConstructionEstimateLine } from "@/lib/inpick/estimate-v2/types";
import type { EstimatePrecisionLevel } from "./precision-level";

export type QuestionSeverity = "blocking" | "high" | "medium" | "low";
export type QuestionCategory =
  | "quantity"
  | "material"
  | "system"
  | "fixture"
  | "demolition"
  | "site_condition"
  | "price";

export interface EstimateQuestionTask {
  id: string;
  severity: QuestionSeverity;
  category: QuestionCategory;
  /** 어느 line/공간/공종에 대한 질문인지 */
  targetLabel: string;
  questionKo: string;
  /** 선택지 (있으면 ChoiceModal, 없으면 자유 입력) */
  options?: Array<{ label: string; value: string; effect?: Record<string, unknown> }>;
  defaultValue?: string;
  /** 이 질문이 해소되면 도달 가능한 정밀도 레벨 */
  unlocksLevel: EstimatePrecisionLevel;
  /** 견적 금액에 미칠 예상 영향 (KRW, 추정) */
  potentialImpactWon?: number;
}

/**
 * 메인 — 견적에서 누락 정보를 찾아 질문 task 생성.
 */
export function buildMissingQuestions(
  estimate: ConstructionEstimate | null,
): EstimateQuestionTask[] {
  if (!estimate || estimate.lines.length === 0) {
    return [
      {
        id: "q-no-estimate",
        severity: "blocking",
        category: "quantity",
        targetLabel: "전체",
        questionKo: "공사 면적 또는 평수를 알려주세요.",
        unlocksLevel: "L0_AREA_ONLY",
      },
    ];
  }

  const questions: EstimateQuestionTask[] = [];
  const lines = estimate.lines as ConstructionEstimateLine[];

  // ─── 주방 라인 점검 ─────────────────────────────────────────
  const kitchenLines = lines.filter((l) => l.roomType === "kitchen");
  if (kitchenLines.length > 0) {
    // 카운터 길이 추정 source 확인
    const kitchenCabinet = kitchenLines.find((l) => l.tradeCode === "12" && l.subTradeCode === "12-11");
    const isFallbackLength = kitchenCabinet?.quantityFormulaKo?.includes("area_inference") || kitchenCabinet?.quantityFormulaKo?.includes("default_inferred");
    if (kitchenCabinet && isFallbackLength) {
      questions.push({
        id: "q-kitchen-counter-length",
        severity: "high",
        category: "quantity",
        targetLabel: "주방 카운터",
        questionKo: "주방 싱크대 길이를 알려주세요.",
        options: [
          { label: "2.4m 이하 (소형)", value: "2.4" },
          { label: "2.4~3.0m (표준)", value: "3.0" },
          { label: "3.0~3.6m (중형)", value: "3.6" },
          { label: "3.6m 이상 (대형)", value: "4.2" },
          { label: "잘 모르겠음", value: "skip" },
        ],
        unlocksLevel: "L3_DB_PRODUCT_LOCKED",
        potentialImpactWon: 500_000,
      });
    }
    // 후드/쿡탑 교체 여부
    const hoodLine = kitchenLines.find((l) => l.subTradeCode === "12-17");
    if (hoodLine && hoodLine.source === "standard_fallback_material") {
      questions.push({
        id: "q-kitchen-hood-cooktop",
        severity: "high",
        category: "fixture",
        targetLabel: "주방 후드·쿡탑",
        questionKo: "주방 후드와 쿡탑도 교체하나요?",
        options: [
          { label: "둘 다 교체", value: "both" },
          { label: "후드만", value: "hood_only" },
          { label: "쿡탑만", value: "cooktop_only" },
          { label: "교체 안 함", value: "none" },
        ],
        unlocksLevel: "L4_USER_CONFIRMED",
        potentialImpactWon: hoodLine.totalAmount,
      });
    }
  }

  // ─── 욕실 라인 점검 ─────────────────────────────────────────
  const bathroomLines = lines.filter((l) => l.roomType === "bathroom");
  if (bathroomLines.length > 0) {
    // 전체 철거 vs 부분 교체
    const demolitionLine = bathroomLines.find((l) => l.subTradeCode === "02-10");
    const hasFullDemolition = demolitionLine?.included && demolitionLine.totalAmount > 100_000;
    if (!hasFullDemolition) {
      questions.push({
        id: "q-bathroom-scope",
        severity: "high",
        category: "demolition",
        targetLabel: "욕실 공사범위",
        questionKo: "욕실은 어떻게 시공하시나요?",
        options: [
          { label: "전체 철거 후 재시공", value: "full_demo" },
          { label: "도기·수전만 교체", value: "fixture_only" },
          { label: "타일 덧방 + 도기 교체", value: "tile_overlay" },
          { label: "잘 모르겠음", value: "skip" },
        ],
        unlocksLevel: "L3_DB_PRODUCT_LOCKED",
        potentialImpactWon: 1_500_000,
      });
    }
    // 샤워부스
    const hasShower = bathroomLines.some((l) => l.itemNameKo.includes("샤워"));
    if (!hasShower) {
      questions.push({
        id: "q-bathroom-shower",
        severity: "medium",
        category: "fixture",
        targetLabel: "욕실 샤워부스",
        questionKo: "샤워부스가 필요한가요?",
        options: [
          { label: "필요 없음", value: "none" },
          { label: "욕조 철거 후 파티션", value: "partition" },
          { label: "유리 샤워부스", value: "glass_booth" },
          { label: "잘 모르겠음", value: "skip" },
        ],
        unlocksLevel: "L4_USER_CONFIRMED",
        potentialImpactWon: 950_000,
      });
    }
  }

  // ─── 전기 라인 점검 ─────────────────────────────────────────
  const electricalLines = lines.filter((l) => l.tradeCode === "04");
  if (electricalLines.length === 0) {
    // 전기 라인 자체가 없으면 질문
    questions.push({
      id: "q-electrical-needed",
      severity: "medium",
      category: "system",
      targetLabel: "전기공사",
      questionKo: "전기/조명 공사가 필요한가요?",
      options: [
        { label: "기존 유지 — 전기 공사 X", value: "none" },
        { label: "조명만 교체", value: "lighting" },
        { label: "콘센트 추가 + 조명", value: "outlet_lighting" },
        { label: "전체 교체 (배선 포함)", value: "full" },
      ],
      unlocksLevel: "L3_DB_PRODUCT_LOCKED",
      potentialImpactWon: 1_200_000,
    });
  }

  // ─── 고액 fallback 라인 점검 ──────────────────────────────
  const HIGH_VALUE = 500_000;
  const highValueFallback = lines.filter(
    (l) =>
      l.totalAmount >= HIGH_VALUE &&
      (l.productMatchStatus === "standard_fallback" || l.productMatchStatus === "category_default"),
  );
  for (const l of highValueFallback.slice(0, 3)) {
    // 최대 3개만 (질문 폭주 방지)
    questions.push({
      id: `q-high-value-fallback-${l.id}`,
      severity: "high",
      category: "material",
      targetLabel: `${l.tradeNameKo} / ${l.taskNameKo}`,
      questionKo: `${l.itemNameKo}의 등급을 선택해주세요. (현재 표준값 ₩${l.totalAmount.toLocaleString()})`,
      options: [
        { label: "기본형 (낮은 단가)", value: "basic", effect: { grade: "basic" } },
        { label: "표준 (시장 평균)", value: "standard", effect: { grade: "standard" } },
        { label: "프리미엄 (고급 자재)", value: "premium", effect: { grade: "premium" } },
        { label: "사업자 견적 받기로 보류", value: "defer" },
      ],
      unlocksLevel: "L4_USER_CONFIRMED",
      potentialImpactWon: l.totalAmount * 0.4, // 등급별 단가 폭 ±40%
    });
  }

  // ─── 정렬: blocking → high → medium → low + 영향 큰 순 ─────
  const sevRank: Record<QuestionSeverity, number> = { blocking: 1, high: 2, medium: 3, low: 4 };
  questions.sort((a, b) => {
    const sev = sevRank[a.severity] - sevRank[b.severity];
    if (sev !== 0) return sev;
    return (b.potentialImpactWon ?? 0) - (a.potentialImpactWon ?? 0);
  });

  return questions;
}
