/**
 * 현재 17공종 엔진이 84㎡에서 실제로 뽑는 "공사 내역" 전체 덤프.
 * 실행: npx tsx scripts/dump-estimate-detail.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';
import { TRADE_NAMES, type TradeCode } from '../src/lib/floor-plan/quantity/types';
import type { ParsedFloorPlan } from '../src/types/floorplan';

const samplePath = join(process.cwd(), 'public/floorplans/sample-84b.json');
const floorPlan: ParsedFloorPlan = JSON.parse(readFileSync(samplePath, 'utf-8'));

const project = adaptParsedFloorPlan(floorPlan, 'dump-84b', '84B 인테리어');
const qty = calculateAllQuantities(project);
const est = calculateEstimate(qty, { ceilingHeight: 2300 });

const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

console.log('\n================ 84㎡(84B) 현재 엔진 공사 내역 ================');
console.log(`라인 수: ${est.lines.length} / 미매칭: ${est.unmatchedItems.length}`);
console.log(`직접재료비 ${won(est.summary.directMaterialCost)} / 직접노무비 ${won(est.summary.directLaborCost)} / 도급 ${won(est.summary.grandTotal)}`);

// 공종별 그룹
const byTrade = new Map<TradeCode, typeof est.lines>();
for (const l of est.lines) {
  if (!byTrade.has(l.tradeCode)) byTrade.set(l.tradeCode, []);
  byTrade.get(l.tradeCode)!.push(l);
}

const order = Object.keys(TRADE_NAMES) as TradeCode[];
for (const code of order) {
  const lines = byTrade.get(code);
  console.log(`\n■ ${code} ${TRADE_NAMES[code]}  ${lines ? `(${lines.length}건)` : '(0건 — 미산출)'}`);
  if (!lines) continue;
  for (const l of lines) {
    console.log(
      `   - ${l.itemName} | ${l.specification || '-'} | ${l.quantity}${l.unit} ` +
      `| 재단가 ${won(l.materialCost)} 노단가 ${won(l.laborCost)} | 금액 ${won(l.totalAmount)} | ${l.roomName || '공통'}`
    );
  }
}

if (est.unmatchedItems.length) {
  console.log('\n■ 미매칭(단가 없음):');
  for (const u of est.unmatchedItems) {
    console.log(`   - [${u.tradeCode}] ${u.itemName} | ${u.specification} | ${u.finalQuantity}${u.unit}`);
  }
}

// 고유 itemName 목록 (커버리지 점검용)
const names = new Set(est.lines.map((l) => `${l.tradeCode}|${l.itemName}`));
console.log(`\n================ 고유 품목 종류: ${names.size}종 ================`);
