/**
 * 사업자 입찰 시 간접비 요율 override — DB 스키마 + DTO.
 *
 * 가이드: InPick_Quote_System_Spec.md §D-3, §D-4
 * 마이그레이션: supabase/migrations/20260510000000_bid_indirect_rates.sql
 *
 * 정책 모듈: src/lib/inpick/indirect-rates.ts (DEFAULT_INDIRECT_RATES_2026, validateRateOverride)
 */

// ─── DB row (snake_case) ───
export interface BidIndirectRatesRow {
  id: string;
  bid_id: string;

  // 가설공사비 (KRW)
  elevator_protection: number;
  entrance_protection: number;
  scaffolding: number;
  waste_disposal: number;

  // 요율 (소수, 0.0311 = 3.11%)
  safety_rate: number;
  general_management_rate: number;
  profit_rate: number;

  // 메타
  is_modified_from_default: boolean;
  modification_reason: string | null;

  created_at: string;
  updated_at: string;
}

// ─── 클라이언트 DTO (camelCase) ───
export interface BidIndirectRates {
  id: string;
  bidId: string;

  setupCosts: {
    elevatorProtection: number;
    entranceProtection: number;
    scaffolding: number;
    wasteDisposal: number;
  };
  rates: {
    safetyRate: number;
    generalManagementRate: number;
    profitRate: number;
  };

  isModifiedFromDefault: boolean;
  modificationReason: string | null;

  createdAt: string;
  updatedAt: string;
}

export function mapDbBidRates(row: BidIndirectRatesRow): BidIndirectRates {
  return {
    id: row.id,
    bidId: row.bid_id,
    setupCosts: {
      elevatorProtection: Number(row.elevator_protection),
      entranceProtection: Number(row.entrance_protection),
      scaffolding: Number(row.scaffolding),
      wasteDisposal: Number(row.waste_disposal),
    },
    rates: {
      safetyRate: Number(row.safety_rate),
      generalManagementRate: Number(row.general_management_rate),
      profitRate: Number(row.profit_rate),
    },
    isModifiedFromDefault: row.is_modified_from_default,
    modificationReason: row.modification_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── PUT 요청 body — 변경할 필드만 ───
export interface UpdateBidRatesRequest {
  elevator_protection?: number;
  entrance_protection?: number;
  scaffolding?: number;
  waste_disposal?: number;
  safety_rate?: number;
  general_management_rate?: number;
  profit_rate?: number;
  modification_reason?: string;
}
