import { readFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities, DEFAULT_DEMO_SCOPE } from '../src/lib/floor-plan/quantity/quantity-calculator';
import type { ParsedFloorPlan } from '../src/types/floorplan';

const fp: ParsedFloorPlan = JSON.parse(readFileSync(join(process.cwd(), 'public/floorplans/sample-84b.json'), 'utf-8'));
const project = adaptParsedFloorPlan(fp, 'test', '84B');
const qtyResult = calculateAllQuantities(project, DEFAULT_DEMO_SCOPE);

// 걸레받이/몰딩 항목만 추출
const bbItems = qtyResult.items.filter(i => i.tradeCode === '16_BASEBOARD_MOLDING');

console.log('=== 84B 걸레받이/몰딩 산출 결과 (새 로직) ===\n');

for (const item of bbItems) {
  console.log(`[${item.itemCode}] ${item.itemName}`);
  console.log(`  규격: ${item.specification}`);
  console.log(`  수량: ${item.rawQuantity}m -> 할증 ${item.surchargeRate}% -> ${item.finalQuantity} LM`);
  console.log(`  산출근거: ${item.calculationBasis}`);
  console.log('');
}

// 단가 적용 금액
console.log('=== 금액 ===');
const bbItem = bbItems.find(i => i.itemCode === '16.BASEBOARD');
const crownItem = bbItems.find(i => i.itemCode === '16.CROWN');

if (bbItem) {
  const amt = bbItem.finalQuantity * 7000;
  console.log(`걸레받이: ${bbItem.finalQuantity} LM x 7,000원 = ${amt.toLocaleString()}원 (${Math.round(amt / 10000)}만원)`);
}
if (crownItem) {
  const amt = crownItem.finalQuantity * 24000;
  console.log(`천장몰딩: ${crownItem.finalQuantity} LM x 24,000원 = ${amt.toLocaleString()}원 (${Math.round(amt / 10000)}만원)`);
}
if (bbItem && crownItem) {
  const total = bbItem.finalQuantity * 7000 + crownItem.finalQuantity * 24000;
  console.log(`합계: ${total.toLocaleString()}원 (${Math.round(total / 10000)}만원)`);
}
