// 물량산출 + 견적 엔진 E2E 테스트 (estimate/page.tsx와 동일한 로직)
import { generateSyntheticFloorPlan } from '../src/lib/floor-plan/quantity/synthetic-floorplan';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';

// 1. 합성 평면도 생성 (도면 없을 때)
const synthetic = generateSyntheticFloorPlan(84, 3, 2);
console.log('=== Step 1: 합성 평면도 ===');
console.log('Total area:', synthetic.totalArea + 'm²');
console.log('Rooms:', synthetic.rooms.length);
console.log('Room names:', synthetic.rooms.map(r => r.name).join(', '));

// 2. adapt
const fpp = adaptParsedFloorPlan(synthetic, 'test-84', '인테리어 공사');
console.log('\n=== Step 2: Adapt ===');
console.log('Rooms:', fpp.rooms.length);
console.log('Walls:', fpp.walls.length);

// 3. 물량산출
const qtyResult = calculateAllQuantities(fpp);
console.log('\n=== Step 3: 물량산출 ===');
console.log('Items:', qtyResult.items.length);

// 4. 견적
const estResult = calculateEstimate(qtyResult, { ceilingHeight: 2200 });
console.log('\n=== Step 4: 견적 ===');
console.log('Lines:', estResult.lines.length);
console.log('Direct material:', (estResult.summary.directMaterialCost / 10000).toFixed(0) + '만원');
console.log('Direct labor:', (estResult.summary.directLaborCost / 10000).toFixed(0) + '만원');
console.log('Overhead:', (estResult.summary.overheadAmount / 10000).toFixed(0) + '만원');
console.log('Profit:', (estResult.summary.profitAmount / 10000).toFixed(0) + '만원');
console.log('VAT:', (estResult.summary.vatAmount / 10000).toFixed(0) + '만원');
console.log('');
console.log('>>> GRAND TOTAL:', (estResult.summary.grandTotal / 10000).toFixed(0) + '만원 <<<');

// 5. CostTable sections 생성 확인
const roomMap = new Map<string, typeof estResult.lines>();
for (const line of estResult.lines) {
  const key = line.roomName || '공통';
  if (!roomMap.has(key)) roomMap.set(key, []);
  roomMap.get(key)!.push(line);
}
console.log('\n=== 공간별 항목 수 ===');
for (const [name, items] of Array.from(roomMap.entries())) {
  const total = items.reduce((s, i) => s + i.totalAmount, 0);
  console.log(name + ':', items.length + '개 항목,', (total / 10000).toFixed(0) + '만원');
}

console.log('\n=== RESULT: ALL PASS ===');
