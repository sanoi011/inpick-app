// src/lib/floor-plan/quantity/estimate-calculator.ts

import type { QuantityItem, TradeCode } from './types';
import { round, TRADE_NAMES } from './types';
import type { QuantityResult } from './quantity-calculator';
import { findUnitPrice } from './unit-price-db';

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
  } = {}
): EstimateResult {
  const { overheadRate = 6, profitRate = 5, vatRate = 10 } = options;

  const lines: EstimateLine[] = [];
  const unmatchedItems: QuantityItem[] = [];

  // Step 1: 물량 x 단가 = 금액
  for (const item of qtyResult.items) {
    const price = findUnitPrice(item.itemCode);

    if (!price) {
      unmatchedItems.push(item);
      continue;
    }

    const qty = item.finalQuantity;
    const matAmt = round(qty * price.materialCost);
    const labAmt = round(qty * price.laborCost);

    lines.push({
      tradeCode: item.tradeCode,
      itemCode: item.itemCode,
      itemName: item.itemName,
      specification: item.specification,
      unit: item.unit,
      quantity: qty,
      materialCost: price.materialCost,
      laborCost: price.laborCost,
      unitCost: price.totalUnitCost,
      materialAmount: matAmt,
      laborAmount: labAmt,
      totalAmount: matAmt + labAmt,
      roomName: item.roomName,
      priceSource: price.source,
    });
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
      byTrade, byRoom,
    },
    unmatchedItems,
  };
}
