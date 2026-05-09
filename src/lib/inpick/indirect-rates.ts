/**
 * 2026년 한국 건설업 간접비 표준 요율 + 견적 산출 함수.
 *
 * 가이드: InPick_Quote_System_Spec.md §C-2, C-3
 *
 * 출처:
 *  - 고용노동부 고시 제2025-11호 (2025.2.12 시행) — 산업안전보건관리비
 *  - 한국건설기술연구원(KICT) 2026년 표준품셈 (2025.12.23 발표)
 *  - 한국물가정보(KPI) 원가계산 제비율 적용기준
 *  - 사단법인 한국건물위생관리협회 표준도급비산출표
 *
 * 모든 요율은 사업자 입찰 시 수정 가능 (가이드 §D — bid_indirect_rates 테이블).
 * 단, 산업안전보건관리비는 법정 최저값 — 하향 수정 금지.
 */

export const DEFAULT_INDIRECT_RATES_2026 = {
  // === 1. 가설공사비 (고정 금액 - 면적 기반 가능, 본 spec은 식 단위) ===
  setupCosts: {
    elevatorProtection: 350000, // 엘리베이터 보양 (식)
    entranceProtection: 180000, // 출입구 보양 (식)
    scaffolding: 250000, // 가설자재 (식)
    wasteDisposal: 480000, // 폐기물 처리 (식)
    minLimit: 1260000, // 최저 가설공사비 (4종 합계)
    isEditable: true,
  },

  // === 2. 산업안전보건관리비 (법정 요율) ===
  // 고용노동부 고시 제2025-11호 (2025.2.12 시행)
  // 일반건축공사 — 주거용 인테리어 리모델링은 일반건축공사 분류
  safetyManagement: {
    rateUnder500M: 0.0311, // 5억원 미만 일반건축공사 3.11%
    rateUnder5B: 0.0228, // 5억~50억 미만 일반건축공사 2.28%
    baseUnder5B: 4_325_000, // 5억~50억 미만 기초액
    rateOver5B: 0.0237, // 50억 이상 일반건축공사 2.37%
    targetBase: "direct_cost" as const, // 직접공사비(재료비 + 직접노무비) 기준
    isEditable: false, // 법정 최저값
    isUpwardEditable: true, // 상향은 가능
    legalSource: "고용노동부 고시 제2025-11호 (2025.2.12)",
  },

  // === 3. 일반관리비 (KPI 기준) ===
  // 50억 미만 건설공사 표준 5%, 한도 6%
  generalManagement: {
    rate: 0.05,
    targetBase: "direct_plus_setup" as const, // 직접공사비 + 가설공사비
    maxRate: 0.06,
    isEditable: true,
    legalSource: "한국물가정보 KPI 원가계산 제비율 적용기준",
  },

  // === 4. 이윤 (영업이익) ===
  // 노무비 + 경비 + 일반관리비 합계 기준, 한도 25%
  profit: {
    rate: 0.10, // 권장 10%
    targetBase: "labor_plus_expense_plus_general" as const,
    maxRate: 0.25,
    isEditable: true,
    legalSource: "KPI 원가계산 제비율 — 영업이익 25% 한도",
  },

  // === 5. 부가가치세 ===
  vat: {
    rate: 0.10,
    targetBase: "supply_amount" as const,
    isEditable: false,
    legalSource: "부가가치세법",
  },
} as const;

export type IndirectRates = typeof DEFAULT_INDIRECT_RATES_2026;

// 견적 적용 시 ID → 표시 라벨 매핑
export const INDIRECT_COST_LABELS = {
  elevatorProtection: "엘리베이터 보양",
  entranceProtection: "출입구 보양",
  scaffolding: "가설자재",
  wasteDisposal: "폐기물 처리",
  safetyManagement: "산업안전보건관리비",
  generalManagement: "일반관리비",
  profit: "기업이윤",
  vat: "부가가치세",
} as const;

// ════════════════════════════════════════
// 사업자별 요율 override 입력 (DB bid_indirect_rates에서 불러올 형태)
// ════════════════════════════════════════
export interface BidRateOverride {
  elevator_protection?: number;
  entrance_protection?: number;
  scaffolding?: number;
  waste_disposal?: number;
  safety_rate?: number;
  general_management_rate?: number;
  profit_rate?: number;
}

// ════════════════════════════════════════
// 검증 — 사업자가 수정한 요율이 법적 한도 안인지
// ════════════════════════════════════════
export function validateRateOverride(
  override: BidRateOverride,
): { ok: true } | { ok: false; error: string; field: string; details?: Record<string, unknown> } {
  if (override.safety_rate !== undefined && override.safety_rate < DEFAULT_INDIRECT_RATES_2026.safetyManagement.rateUnder500M) {
    return {
      ok: false,
      error: "INVALID_SAFETY_RATE",
      field: "safety_rate",
      details: {
        message: "산업안전보건관리비는 법정 최저값(3.11%) 이상이어야 합니다.",
        legalMin: DEFAULT_INDIRECT_RATES_2026.safetyManagement.rateUnder500M,
      },
    };
  }
  if (override.general_management_rate !== undefined) {
    const r = override.general_management_rate;
    if (r < 0 || r > DEFAULT_INDIRECT_RATES_2026.generalManagement.maxRate) {
      return {
        ok: false,
        error: "INVALID_GENERAL_RATE",
        field: "general_management_rate",
        details: { message: "일반관리비는 0% ~ 6% 범위 내에서 설정 가능합니다.", range: [0, 0.06] },
      };
    }
  }
  if (override.profit_rate !== undefined) {
    const r = override.profit_rate;
    if (r < 0 || r > DEFAULT_INDIRECT_RATES_2026.profit.maxRate) {
      return {
        ok: false,
        error: "INVALID_PROFIT_RATE",
        field: "profit_rate",
        details: { message: "이윤은 0% ~ 25% 범위 내에서 설정 가능합니다.", range: [0, 0.25] },
      };
    }
  }
  const setupFields: (keyof BidRateOverride)[] = [
    "elevator_protection",
    "entrance_protection",
    "scaffolding",
    "waste_disposal",
  ];
  for (const f of setupFields) {
    const v = override[f];
    if (typeof v === "number" && v < 0) {
      return {
        ok: false,
        error: "INVALID_SETUP_COST",
        field: f as string,
      };
    }
  }
  return { ok: true };
}

// ════════════════════════════════════════
// 간접비 계산 — direct cost(자재+노무+경비) 받아 총액 계산
// ════════════════════════════════════════
export interface IndirectCostsResult {
  directCost: number;
  setupCost: number;
  safetyCost: number;
  generalManagementCost: number;
  profit: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  breakdown: {
    가설공사비: number;
    산업안전보건관리비: number;
    일반관리비: number;
    기업이윤: number;
    부가가치세: number;
  };
  setupBreakdown: {
    elevatorProtection: number;
    entranceProtection: number;
    scaffolding: number;
    wasteDisposal: number;
  };
  /** 사업자 override가 적용됐는지 */
  modified: boolean;
  appliedRates: {
    safety_rate: number;
    general_management_rate: number;
    profit_rate: number;
  };
}

/**
 * 직접공사비 + (선택) 사업자 override → 간접비 + 총액 계산.
 *
 * spec C-3 그대로 구현. labor+expense 추정은 directCost × 0.60.
 *  (정확한 노무비/경비 합계가 필요하면 옵션 인자로 분리 입력 가능 — 본 함수는 단순화 버전.)
 */
export function calculateIndirectCosts(
  directCost: number,
  override?: BidRateOverride,
  options?: { laborPlusExpense?: number },
): IndirectCostsResult {
  const rates = DEFAULT_INDIRECT_RATES_2026;

  // 1. 가설공사비
  const setupBreakdown = {
    elevatorProtection: override?.elevator_protection ?? rates.setupCosts.elevatorProtection,
    entranceProtection: override?.entrance_protection ?? rates.setupCosts.entranceProtection,
    scaffolding: override?.scaffolding ?? rates.setupCosts.scaffolding,
    wasteDisposal: override?.waste_disposal ?? rates.setupCosts.wasteDisposal,
  };
  const setupCost =
    setupBreakdown.elevatorProtection +
    setupBreakdown.entranceProtection +
    setupBreakdown.scaffolding +
    setupBreakdown.wasteDisposal;

  // 2. 산업안전보건관리비 (구간별 분기)
  const safetyRateApplied =
    override?.safety_rate ?? rates.safetyManagement.rateUnder500M;
  let safetyCost: number;
  if (directCost < 500_000_000) {
    safetyCost = directCost * safetyRateApplied;
  } else if (directCost < 5_000_000_000) {
    safetyCost = directCost * rates.safetyManagement.rateUnder5B + rates.safetyManagement.baseUnder5B;
  } else {
    safetyCost = directCost * rates.safetyManagement.rateOver5B;
  }

  // 3. 일반관리비
  const generalRateApplied = override?.general_management_rate ?? rates.generalManagement.rate;
  const generalBase = directCost + setupCost;
  const generalManagementCost = generalBase * generalRateApplied;

  // 4. 이윤
  const profitRateApplied = override?.profit_rate ?? rates.profit.rate;
  const laborAndExpense = options?.laborPlusExpense ?? directCost * 0.60;
  const profitBase = laborAndExpense + generalManagementCost;
  const profit = profitBase * profitRateApplied;

  // 5. 공급가액
  const supplyAmount = directCost + setupCost + safetyCost + generalManagementCost + profit;

  // 6. 부가세
  const vat = supplyAmount * rates.vat.rate;

  // 7. 총액
  const totalAmount = supplyAmount + vat;

  return {
    directCost,
    setupCost,
    safetyCost,
    generalManagementCost,
    profit,
    supplyAmount,
    vat,
    totalAmount,
    breakdown: {
      가설공사비: setupCost,
      산업안전보건관리비: safetyCost,
      일반관리비: generalManagementCost,
      기업이윤: profit,
      부가가치세: vat,
    },
    setupBreakdown,
    modified: !!override && Object.values(override).some((v) => v !== undefined),
    appliedRates: {
      safety_rate: safetyRateApplied,
      general_management_rate: generalRateApplied,
      profit_rate: profitRateApplied,
    },
  };
}
