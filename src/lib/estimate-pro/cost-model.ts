// src/lib/estimate-pro/cost-model.ts
//
// 종합건설사 표준 「공사원가계산서」 구조 (행정안전부 예규 제39호 + 조달청 2025 제비율)
// ─ 순공사원가(재료비·노무비·경비) → 일반관리비 → 이윤 → (공사손해보험료) → 부가세 → 도급금액
//
// 기본 요율 = 조달청 2025년 건축공사 원가계산 간접공사비(제비율) 적용기준.
// 소규모 인테리어 현장 기준이므로 모든 항목은 수정 가능하며, 대부분 "필수 아님"으로 표기.
// 출처: 조달청 시설공사 원가계산 간접공사비(제비율) 적용기준 / 행안부 공사원가계산 예규.

import type { TradeCode } from '@/lib/floor-plan/quantity/types';
import { TRADE_NAMES } from '@/lib/floor-plan/quantity/types';

// ─── 제비(간접) 항목 정의 ───

export type JebiGroup = 'INDIRECT_LABOR' | 'EXPENSE';

// 요율이 곱해지는 기준 금액
export type JebiBase =
  | 'DIRECT_LABOR'   // 직접노무비
  | 'LABOR_SUB'      // 노무비 소계(직접+간접)
  | 'DIRECT_MAT'     // 직접재료비
  | 'MAT_PLUS_DL'    // 재료비 + 직접노무비 (= 직접공사비)
  | 'MAT_PLUS_LSUB'  // 재료비 + 노무비소계
  | 'HEALTH';        // 건강보험료 금액 (노인장기요양 산정용)

export interface JebiItem {
  key: string;
  label: string;        // 비목명
  group: JebiGroup;
  base: JebiBase;
  basisLabel: string;   // UI 산출기준 설명
  rate: number;         // % (편집 가능)
  required: boolean;    // 인테리어 현장 필수 여부
  include: boolean;     // 포함 토글
  note: string;         // 기본 코멘트
  comment: string;      // 사업자 입찰 코멘트 (편집 가능)
  source: string;       // 요율 출처
}

const INTERIOR_NOTE = '인테리어 현장에서는 필수 항목이 아닙니다 (조달청 공공공사 원가계산 기준 항목)';

// 조달청 2025 건축공사 기준 기본 요율 (소규모 인테리어 → 수정 전제)
export function defaultJebiItems(): JebiItem[] {
  return [
    {
      key: 'indirect_labor', label: '간접노무비', group: 'INDIRECT_LABOR',
      base: 'DIRECT_LABOR', basisLabel: '직접노무비 × 요율',
      rate: 15.0, required: false, include: true,
      note: '현장관리·감독 인건비. ' + INTERIOR_NOTE, comment: '',
      source: '조달청 건축 14.5%(규모·기간 평균)',
    },
    {
      key: 'sanjae', label: '산재보험료', group: 'EXPENSE',
      base: 'LABOR_SUB', basisLabel: '노무비(직접+간접) × 요율',
      rate: 3.7, required: false, include: true,
      note: INTERIOR_NOTE, comment: '',
      source: '노동부 고시 산재보험료율(건설업)',
    },
    {
      key: 'goyong', label: '고용보험료', group: 'EXPENSE',
      base: 'LABOR_SUB', basisLabel: '노무비 × 요율',
      rate: 0.87, required: false, include: true,
      note: INTERIOR_NOTE, comment: '',
      source: '고용보험법 시행령',
    },
    {
      key: 'health', label: '국민건강보험료', group: 'EXPENSE',
      base: 'DIRECT_LABOR', basisLabel: '직접노무비 × 요율',
      rate: 3.545, required: false, include: true,
      note: INTERIOR_NOTE, comment: '',
      source: '조달청 직노×3.545',
    },
    {
      key: 'longterm', label: '노인장기요양보험료', group: 'EXPENSE',
      base: 'HEALTH', basisLabel: '건강보험료 × 요율',
      rate: 12.95, required: false, include: true,
      note: INTERIOR_NOTE, comment: '',
      source: '조달청 건강보험료×12.95',
    },
    {
      key: 'pension', label: '국민연금보험료', group: 'EXPENSE',
      base: 'DIRECT_LABOR', basisLabel: '직접노무비 × 요율',
      rate: 4.5, required: false, include: true,
      note: INTERIOR_NOTE, comment: '',
      source: '조달청 직노×4.5',
    },
    {
      key: 'toijik', label: '건설근로자퇴직공제부금비', group: 'EXPENSE',
      base: 'DIRECT_LABOR', basisLabel: '직접노무비 × 요율',
      rate: 2.3, required: false, include: false,
      note: '1억 이상 공사 의무. 소규모 인테리어 통상 미적용. ' + INTERIOR_NOTE, comment: '',
      source: '조달청 직노×2.3',
    },
    {
      key: 'safety', label: '산업안전보건관리비', group: 'EXPENSE',
      base: 'MAT_PLUS_DL', basisLabel: '(재료비+직접노무비) × 요율',
      rate: 2.93, required: false, include: true,
      note: '2천만원 이상 공사 계상. ' + INTERIOR_NOTE, comment: '',
      source: '고용노동부 고시(건축 ~2.93%)',
    },
    {
      key: 'env', label: '환경보전비', group: 'EXPENSE',
      base: 'MAT_PLUS_DL', basisLabel: '직접공사비 × 요율',
      rate: 0.3, required: false, include: false,
      note: INTERIOR_NOTE, comment: '',
      source: '국토부 환경관리비 지침',
    },
    {
      key: 'etc', label: '기타경비', group: 'EXPENSE',
      base: 'MAT_PLUS_LSUB', basisLabel: '(재료비+노무비) × 요율',
      rate: 5.5, required: false, include: true,
      note: '수도광열·운반·소모품·통신·세금과공과 등 묶음. ' + INTERIOR_NOTE, comment: '',
      source: '조달청 분석요율(건축 5.5%대)',
    },
  ];
}

// ─── 마진 항목 (관리비·이윤·보험·세금) ───

export interface MarginRates {
  generalAdmin: number;   // 일반관리비율 %  (순공사원가 기준)
  profit: number;         // 이윤율 %       (노무비+경비+일반관리비 기준)
  lossInsurance: number;  // 공사손해보험료율 % (총원가 기준)
  lossInsuranceInclude: boolean;
  vat: number;            // 부가가치세율 %
}

export function defaultMarginRates(): MarginRates {
  return {
    generalAdmin: 6.0,        // 종합공사 50억 미만 = 6.0% (체감)
    profit: 10.0,             // 조달청 한도 15% 이내, 인테리어 관행 10% 기본
    lossInsurance: 0.0,
    lossInsuranceInclude: false,
    vat: 10.0,
  };
}

// ─── 계산 입력/결과 ───

export interface CostInput {
  directMaterial: number;  // 직접재료비 합계
  directLabor: number;     // 직접노무비 합계
  directExpense?: number;  // 직접경비 합계
  jebi: JebiItem[];
  margins: MarginRates;
  /** 제비용(간접경비) 전체 포함 여부 — 견적서 생성 시 토글 (OFF면 직접비만) */
  includeJebi: boolean;
}

export interface CostRow {
  key: string;
  label: string;
  basisLabel: string;
  base: number;       // 기준금액
  rate: number;       // 적용요율 %
  amount: number;     // 산출금액
  included: boolean;
  required: boolean;
  note: string;
  comment: string;
  source: string;
  group: JebiGroup;
}

export interface CostSheet {
  directMaterial: number;
  directLabor: number;
  directExpense: number;
  indirectLabor: number;
  laborSubtotal: number;       // 노무비 소계
  materialSubtotal: number;    // 재료비 소계 (= 직접재료비, 간접재료비 미사용)
  expenseRows: CostRow[];      // 경비 상세
  indirectLaborRow: CostRow | null;
  indirectExpenseSubtotal: number; // 보험료·안전관리비 등 제경비 소계
  expenseSubtotal: number;     // 직접경비 + 제경비 소계
  netConstructionCost: number; // 순공사원가
  generalAdmin: number;        // 일반관리비
  profit: number;              // 이윤
  totalCost: number;           // 총원가
  lossInsurance: number;       // 공사손해보험료
  supplyPrice: number;         // 공급가액
  vat: number;                 // 부가가치세
  contractPrice: number;       // 도급금액
  margins: MarginRates;
}

function round(n: number): number {
  return Math.round(n);
}

export function computeCostSheet(input: CostInput): CostSheet {
  const {
    directMaterial: M,
    directLabor: DL,
    directExpense: DE = 0,
    jebi,
    margins,
    includeJebi,
  } = input;

  const on = (it: JebiItem) => includeJebi && it.include;

  // 간접노무비
  const ilItem = jebi.find((j) => j.key === 'indirect_labor');
  const IL = ilItem && on(ilItem) ? round(DL * ilItem.rate / 100) : 0;
  const LSUB = DL + IL;

  const indirectLaborRow: CostRow | null = ilItem
    ? {
        key: ilItem.key, label: ilItem.label, basisLabel: ilItem.basisLabel,
        base: DL, rate: ilItem.rate, amount: IL, included: on(ilItem),
        required: ilItem.required, note: ilItem.note, comment: ilItem.comment,
        source: ilItem.source, group: 'INDIRECT_LABOR',
      }
    : null;

  // 경비 항목 (순서 보존, 노인장기요양은 건강보험료 금액 참조)
  const baseValue = (b: JebiBase, healthAmt: number): number => {
    switch (b) {
      case 'DIRECT_LABOR': return DL;
      case 'LABOR_SUB': return LSUB;
      case 'DIRECT_MAT': return M;
      case 'MAT_PLUS_DL': return M + DL;
      case 'MAT_PLUS_LSUB': return M + LSUB;
      case 'HEALTH': return healthAmt;
      default: return 0;
    }
  };

  const expenseRows: CostRow[] = [];
  let healthAmt = 0;
  for (const it of jebi) {
    if (it.group !== 'EXPENSE') continue;
    const base = baseValue(it.base, healthAmt);
    const amount = on(it) ? round(base * it.rate / 100) : 0;
    if (it.key === 'health') healthAmt = amount;
    expenseRows.push({
      key: it.key, label: it.label, basisLabel: it.basisLabel,
      base, rate: it.rate, amount, included: on(it),
      required: it.required, note: it.note, comment: it.comment,
      source: it.source, group: 'EXPENSE',
    });
  }

  const indirectExpenseSubtotal = expenseRows.reduce((s, r) => s + r.amount, 0);
  const expenseSubtotal = DE + indirectExpenseSubtotal;
  const netConstructionCost = M + LSUB + expenseSubtotal;

  const generalAdmin = round(netConstructionCost * margins.generalAdmin / 100);
  const profit = round((LSUB + expenseSubtotal + generalAdmin) * margins.profit / 100);
  const totalCost = netConstructionCost + generalAdmin + profit;
  const lossInsurance = margins.lossInsuranceInclude
    ? round(totalCost * margins.lossInsurance / 100)
    : 0;
  const supplyPrice = totalCost + lossInsurance;
  const vat = round(supplyPrice * margins.vat / 100);
  const contractPrice = supplyPrice + vat;

  return {
    directMaterial: M,
    directLabor: DL,
    directExpense: DE,
    indirectLabor: IL,
    laborSubtotal: LSUB,
    materialSubtotal: M,
    expenseRows,
    indirectLaborRow,
    indirectExpenseSubtotal,
    expenseSubtotal,
    netConstructionCost,
    generalAdmin,
    profit,
    totalCost,
    lossInsurance,
    supplyPrice,
    vat,
    contractPrice,
    margins,
  };
}

// ─── 공종별 집계표 (경비·관리비·이윤을 직접비 비중으로 안분) ───

export interface TradeRollupRow {
  tradeCode: TradeCode;
  tradeName: string;
  material: number;       // 직접재료비
  labor: number;          // 직접노무비
  directExpense: number;  // 직접경비
  indirectExpense: number;// 안분 간접비(간접노무비+제경비+관리비+이윤)
  expense: number;        // 직접경비 + 안분 간접비
  subtotal: number;       // 공급가액 기준 합계
  share: number;          // 구성비 0~1 (공급가액 기준)
}

export interface TradeInput {
  tradeCode: TradeCode;
  material: number;
  labor: number;
  expense?: number;
}

/** 직접비(재료비+노무비+직접경비) 비중으로 간접비 전체를 공종에 안분 */
export function rollupByTrade(trades: TradeInput[], sheet: CostSheet): TradeRollupRow[] {
  const directTotal =
    sheet.directMaterial + sheet.directLabor + sheet.directExpense;
  // 안분 대상 = 공급가액 - 직접비 (간접노무비+경비+관리비+이윤+손해보험)
  const indirectTotal = sheet.supplyPrice - directTotal;

  const rows: TradeRollupRow[] = trades
    .filter((t) => t.material + t.labor + (t.expense ?? 0) > 0)
    .map((t) => {
      const directExpense = t.expense ?? 0;
      const direct = t.material + t.labor + directExpense;
      const ratio = directTotal > 0 ? direct / directTotal : 0;
      const indirectExpense = round(indirectTotal * ratio);
      const expense = directExpense + indirectExpense;
      const subtotal = t.material + t.labor + expense;
      return {
        tradeCode: t.tradeCode,
        tradeName: TRADE_NAMES[t.tradeCode] || t.tradeCode,
        material: t.material,
        labor: t.labor,
        directExpense,
        indirectExpense,
        expense,
        subtotal,
        share: sheet.supplyPrice > 0 ? subtotal / sheet.supplyPrice : 0,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);

  return rows;
}
