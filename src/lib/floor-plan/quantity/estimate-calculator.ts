// src/lib/floor-plan/quantity/estimate-calculator.ts

import type { QuantityItem, TradeCode } from './types';
import { round, TRADE_NAMES } from './types';
import type { QuantityResult } from './quantity-calculator';
import { findUnitPrice } from './unit-price-db';
import { expandAuxMaterials, findFallbackPrice, type AuxCoefficient, type PriceLookupRow } from './aux-expander';
import type { SelectedMaterial } from '@/types/consumer-project';

export interface QuantityExtensions {
  auxCoefficients?: AuxCoefficient[];
  priceLookup?: PriceLookupRow[];
}

// 자재 카테고리 → 공종 itemCode 매핑 (AI 디자인 자재 연동용)
const CATEGORY_TO_ITEM_MAP: Record<string, string[]> = {
  'FLOORING': ['07.MAIN'],
  'WALLPAPER': ['08.WALLPAPER'],
  'PAINT': ['08.PAINT'],
  'CEILING': ['09.GYPSUM', '09.PAINT'],
  'DOOR_ROOM': ['10.DOOR_SINGLE_DOOR'],
  'SLIDING_PARTITION': ['10.DOOR_SLIDING_DOOR'],
  'ENTRY_DOOR': ['10.DOOR_ENTRANCE_DOOR'],
  'TOILET': ['13.TOILET'],
  'VANITY': ['13.BASIN_CABINET', '13.BASIN'],
  'SHOWER_BATH': ['13.SHOWER_BOOTH', '13.BATHTUB'],
  'BATH_TILE': ['05.FLOOR', '05.WALL'],
  'KITCHEN_SINK': ['15.KITCHEN_SINK'],
  'KITCHEN_CABINET': ['15.KITCHEN_UPPER_CABINET', '15.KITCHEN_LOWER_CABINET'],
  'KITCHEN_TILE': ['05.FLOOR', '05.WALL'],
  'BASEBOARD': ['16.BASEBOARD'],
  'LIGHTING': ['14.LIGHT'],
};

// ─── 견적 라인 ───

export interface EstimateLine {
  tradeCode: TradeCode;
  itemCode: string;
  itemName: string;
  specification: string;
  unit: string;
  quantity: number;

  materialCost: number;
  laborCost: number;
  unitCost: number;

  materialAmount: number;
  laborAmount: number;
  totalAmount: number;

  roomName?: string;
  priceSource: string;
}

// ─── 견적 요약 ───

export interface EstimateSummary {
  directMaterialCost: number;
  directLaborCost: number;
  directCost: number;

  overheadRate: number;
  overheadAmount: number;
  profitRate: number;
  profitAmount: number;

  subtotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;

  heightSurcharge: boolean;
  ceilingHeight: number;

  byTrade: Record<TradeCode, {
    tradeName: string;
    materialAmount: number;
    laborAmount: number;
    totalAmount: number;
  }>;

  byRoom: Record<string, {
    roomName: string;
    totalAmount: number;
  }>;
}

// ─── 견적 결과 ───

export interface EstimateResult {
  projectId: string;
  calculatedAt: string;
  lines: EstimateLine[];
  summary: EstimateSummary;
  unmatchedItems: QuantityItem[];
}

// ─── 견적 산출 함수 ───

export function calculateEstimate(
  qtyResult: QuantityResult,
  options: {
    overheadRate?: number;
    profitRate?: number;
    vatRate?: number;
    ceilingHeight?: number;
    materialOverrides?: SelectedMaterial[];
    extensions?: QuantityExtensions;
  } = {}
): EstimateResult {
  const { overheadRate = 6, profitRate = 5, vatRate = 10, ceilingHeight = 2200, materialOverrides, extensions } = options;
  const heightSurcharge = ceilingHeight > 2500;
  const laborMultiplier = heightSurcharge ? 1.5 : 1.0;

  // 자재 오버라이드 인덱스 구축 (categoryCode → SelectedMaterial)
  const overrideIndex = new Map<string, SelectedMaterial>();
  if (materialOverrides) {
    for (const mat of materialOverrides) {
      if (mat.categoryCode && mat.confirmed) {
        const itemCodes = CATEGORY_TO_ITEM_MAP[mat.categoryCode];
        if (itemCodes) {
          for (const code of itemCodes) {
            overrideIndex.set(code, mat);
          }
        }
      }
    }
  }

  const lines: EstimateLine[] = [];
  const unmatchedItems: QuantityItem[] = [];
  const priceLookup = extensions?.priceLookup || [];

  // Step 1: 물량 x 단가 = 금액
  for (const item of qtyResult.items) {
    let basePrice = findUnitPrice(item.itemCode);

    // Fallback: material_price_lookup (G2B median) 기반 단가
    if (!basePrice && priceLookup.length > 0) {
      const fb = findFallbackPrice(item.itemCode, priceLookup);
      if (fb) {
        basePrice = {
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
          materialCost: fb.materialCost,
          laborCost: fb.laborCost,
          totalUnitCost: fb.materialCost + fb.laborCost,
          source: fb.source,
          updatedAt: new Date().toISOString().slice(0, 7),
          priceGrade: 'standard',
          priceReference: fb.source,
        };
      }
    }

    if (!basePrice) {
      unmatchedItems.push(item);
      continue;
    }

    // 자재 오버라이드 적용 (음수/0 방어)
    const override = overrideIndex.get(item.itemCode);
    const matCostPerUnit = Math.max(0, override?.unitPrice ?? basePrice.materialCost);
    const labCostPerUnit = Math.max(0, override?.laborPrice ?? basePrice.laborCost);
    const source = override
      ? `${override.materialName} (${override.priceSource || '사용자 선택'})`
      : basePrice.source;

    const qty = item.finalQuantity;
    const matAmt = round(qty * matCostPerUnit);
    const labAmt = round(qty * labCostPerUnit * laborMultiplier);

    lines.push({
      tradeCode: item.tradeCode,
      itemCode: item.itemCode,
      itemName: override ? override.materialName : item.itemName,
      specification: override ? override.specification : item.specification,
      unit: item.unit,
      quantity: qty,
      materialCost: matCostPerUnit,
      laborCost: round(labCostPerUnit * laborMultiplier),
      unitCost: matCostPerUnit + round(labCostPerUnit * laborMultiplier),
      materialAmount: matAmt,
      laborAmount: labAmt,
      totalAmount: matAmt + labAmt,
      roomName: item.roomName,
      priceSource: source,
    });
  }

  // Step 1.5: 부자재 자동 확장 (aux_material_coefficients)
  if (extensions?.auxCoefficients && extensions.auxCoefficients.length > 0) {
    const auxLines = expandAuxMaterials(lines, extensions.auxCoefficients, priceLookup);
    lines.push(...auxLines);
  }

  // Step 2: 집계
  const directMaterialCost = lines.reduce((s, l) => s + l.materialAmount, 0);
  const directLaborCost = lines.reduce((s, l) => s + l.laborAmount, 0);
  const directCost = directMaterialCost + directLaborCost;

  const overheadAmount = round(directCost * overheadRate / 100);
  const profitAmount = round((directCost + overheadAmount) * profitRate / 100);
  const subtotal = directCost + overheadAmount + profitAmount;
  const vatAmount = round(subtotal * vatRate / 100);
  const grandTotal = subtotal + vatAmount;

  // 공종별 소계
  const byTrade = {} as EstimateSummary['byTrade'];
  for (const code of Object.keys(TRADE_NAMES) as TradeCode[]) {
    const tradeLines = lines.filter(l => l.tradeCode === code);
    byTrade[code] = {
      tradeName: TRADE_NAMES[code],
      materialAmount: tradeLines.reduce((s, l) => s + l.materialAmount, 0),
      laborAmount: tradeLines.reduce((s, l) => s + l.laborAmount, 0),
      totalAmount: tradeLines.reduce((s, l) => s + l.totalAmount, 0),
    };
  }

  // 실별 소계
  const byRoom: Record<string, { roomName: string; totalAmount: number }> = {};
  for (const line of lines) {
    const key = line.roomName || '공통';
    if (!byRoom[key]) byRoom[key] = { roomName: key, totalAmount: 0 };
    byRoom[key].totalAmount += line.totalAmount;
  }

  return {
    projectId: qtyResult.projectId,
    calculatedAt: new Date().toISOString(),
    lines,
    summary: {
      directMaterialCost, directLaborCost, directCost,
      overheadRate, overheadAmount,
      profitRate, profitAmount,
      subtotal, vatRate, vatAmount, grandTotal,
      heightSurcharge, ceilingHeight,
      byTrade, byRoom,
    },
    unmatchedItems,
  };
}
