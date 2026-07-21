/**
 * 17공종 + 상가/사무실 확장 공종.
 * 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §3
 */

export interface TradeDefinition {
  code: string;
  nameKo: string;
  /** 견적서 정렬순서 — 시공 순서 따라감 */
  sortOrder: number;
  /** 간접 트레이드 (직접공사비에 포함 X) */
  isIndirect?: boolean;
}

export const CONSTRUCTION_TRADES: TradeDefinition[] = [
  { code: "01", nameKo: "가설·보양공사", sortOrder: 1 },
  { code: "02", nameKo: "철거공사", sortOrder: 2 },
  { code: "03", nameKo: "목공·경량공사", sortOrder: 3 },
  { code: "04", nameKo: "전기공사", sortOrder: 4 },
  { code: "05", nameKo: "설비공사", sortOrder: 5 },
  { code: "06", nameKo: "방수공사", sortOrder: 6 },
  { code: "07", nameKo: "타일공사", sortOrder: 7 },
  { code: "08", nameKo: "도장공사", sortOrder: 8 },
  { code: "09", nameKo: "도배공사", sortOrder: 9 },
  { code: "10", nameKo: "바닥재공사", sortOrder: 10 },
  { code: "11", nameKo: "창호·금속공사", sortOrder: 11 },
  { code: "12", nameKo: "가구·싱크공사", sortOrder: 12 },
  { code: "13", nameKo: "욕실공사", sortOrder: 13 },
  { code: "14", nameKo: "주방공사", sortOrder: 14 },
  { code: "15", nameKo: "폐기물·운반·양중", sortOrder: 15 },
  { code: "16", nameKo: "준공청소", sortOrder: 16 },
  { code: "17", nameKo: "간접비·관리비·이윤·VAT", sortOrder: 17, isIndirect: true },
];

export const COMMERCIAL_EXTRA_TRADES: TradeDefinition[] = [
  { code: "18", nameKo: "간판·파사드공사", sortOrder: 18 },
  { code: "19", nameKo: "소방공사", sortOrder: 19 },
  { code: "20", nameKo: "환기·후드공사", sortOrder: 20 },
  { code: "21", nameKo: "네트워크·통신공사", sortOrder: 21 },
  { code: "22", nameKo: "냉난방공사", sortOrder: 22 },
];

const ALL_TRADES = [...CONSTRUCTION_TRADES, ...COMMERCIAL_EXTRA_TRADES];

export function getTradeByCode(code: string): TradeDefinition | undefined {
  return ALL_TRADES.find((t) => t.code === code);
}

export function getTradeNameKo(code: string): string {
  return getTradeByCode(code)?.nameKo ?? code;
}

export function getTradeSortOrder(code: string): number {
  return getTradeByCode(code)?.sortOrder ?? 99;
}

/** 한국어 RoomType 매핑 */
export const ROOM_TYPE_TO_KO: Record<string, string> = {
  living_room: "거실",
  master_bedroom: "안방",
  bedroom: "침실",
  kitchen: "주방",
  bathroom: "욕실",
  entry: "현관",
  balcony: "발코니",
  dress_room: "드레스룸",
  corridor: "복도",
  utility: "다용도실",
  commercial_zone: "상가공간",
  unknown: "기타",
};
