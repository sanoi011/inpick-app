/**
 * 59/84A/84B 3가지 도면 타입 물량산출 + 견적 엔진 통합 검증
 * 실행: npx tsx scripts/verify-all-types-qty.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities, DEFAULT_DEMO_SCOPE } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';
import type { ParsedFloorPlan } from '../src/types/floorplan';

const TRADE_NAMES_KR: Record<string, string> = {
  '01_DEMOLITION': '철거', '02_MASONRY': '조적', '03_PLASTER': '미장',
  '04_WATERPROOF': '방수', '05_TILE': '타일', '06_WOODWORK': '목공',
  '07_FLOORING': '바닥재', '08_WALLPAPER_PAINT': '도배/도장',
  '09_CEILING': '천장', '10_DOOR_WINDOW': '창호', '11_HARDWARE': '잡철',
  '12_PLUMBING': '배관', '13_SANITARY': '위생도기', '14_ELECTRICAL': '전기',
  '15_FIXTURE': '고정설비', '16_BASEBOARD_MOLDING': '걸레받이', '17_CLEANUP': '정리'
};

const TRADE_ORDER = [
  '01_DEMOLITION', '02_MASONRY', '03_PLASTER', '04_WATERPROOF',
  '05_TILE', '06_WOODWORK', '07_FLOORING', '08_WALLPAPER_PAINT',
  '09_CEILING', '10_DOOR_WINDOW', '11_HARDWARE', '12_PLUMBING',
  '13_SANITARY', '14_ELECTRICAL', '15_FIXTURE', '16_BASEBOARD_MOLDING',
  '17_CLEANUP'
] as const;

interface TypeConfig {
  name: string;
  file: string;
  expectedArea: number;
  minRooms: number;
  minEstimate: number; // 만원
  maxEstimate: number; // 만원
}

const TYPES: TypeConfig[] = [
  { name: '59㎡', file: 'sample-59.json', expectedArea: 59, minRooms: 8, minEstimate: 3500, maxEstimate: 7500 },
  { name: '84A㎡', file: 'sample-84a.json', expectedArea: 84, minRooms: 8, minEstimate: 4500, maxEstimate: 9000 },
  { name: '84B㎡', file: 'sample-84b.json', expectedArea: 84, minRooms: 8, minEstimate: 4500, maxEstimate: 8500 },
];

interface TypeResult {
  name: string;
  success: boolean;
  rooms: number;
  walls: number;
  openings: number;
  fixtures: number;
  wetRooms: number;
  qtyItems: number;
  tradeCount: number;
  estimateLines: number;
  unmatchedItems: number;
  grandTotal: number;
  perM2: number;
  perPyeong: number;
  materialCost: number;
  laborCost: number;
  errors: string[];
}

const results: TypeResult[] = [];

console.log('='.repeat(70));
console.log('  INPICK 3가지 도면 타입 물량산출 + 견적 엔진 통합 검증');
console.log('='.repeat(70));

for (const typeConfig of TYPES) {
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`  [${typeConfig.name}] 검증 시작`);
  console.log('#'.repeat(70));

  const result: TypeResult = {
    name: typeConfig.name,
    success: true,
    rooms: 0, walls: 0, openings: 0, fixtures: 0, wetRooms: 0,
    qtyItems: 0, tradeCount: 0,
    estimateLines: 0, unmatchedItems: 0,
    grandTotal: 0, perM2: 0, perPyeong: 0,
    materialCost: 0, laborCost: 0,
    errors: [],
  };

  // Load floor plan
  const samplePath = join(process.cwd(), 'public/floorplans', typeConfig.file);
  let floorPlan: ParsedFloorPlan;
  try {
    floorPlan = JSON.parse(readFileSync(samplePath, 'utf-8'));
  } catch (e: any) {
    result.success = false;
    result.errors.push(`파일 로드 실패: ${e.message}`);
    results.push(result);
    continue;
  }

  // Step 1: Adapt
  console.log(`\n  [Step 1] adaptParsedFloorPlan()`);
  let project;
  try {
    const testId = `test-${typeConfig.file.replace('.json', '')}`;
    project = adaptParsedFloorPlan(floorPlan, testId, `${typeConfig.name} 인테리어`);
    result.rooms = project.rooms.length;
    result.walls = project.walls.length;
    result.openings = project.openings.length;
    result.fixtures = project.fixtures.length;
    result.wetRooms = project.rooms.filter(r => r.isWetArea).length;

    console.log(`    OK 방: ${result.rooms}개, 벽: ${result.walls}개, 개구부: ${result.openings}개, 설비: ${result.fixtures}개`);
    console.log(`    습식: ${result.wetRooms}개 (${project.rooms.filter(r => r.isWetArea).map(r => r.name).join(', ')})`);

    if (result.rooms < typeConfig.minRooms) {
      result.errors.push(`방 수 부족: ${result.rooms} < ${typeConfig.minRooms}`);
    }
  } catch (e: any) {
    result.success = false;
    result.errors.push(`adapt 실패: ${e.message}`);
    results.push(result);
    continue;
  }

  // Step 2: Calculate Quantities
  console.log(`  [Step 2] calculateAllQuantities()`);
  let qtyResult;
  try {
    qtyResult = calculateAllQuantities(project, DEFAULT_DEMO_SCOPE);
    result.qtyItems = qtyResult.items.length;

    let activeTrades = 0;
    for (const tc of TRADE_ORDER) {
      const tradeData = qtyResult.summary.byTrade[tc];
      const count = tradeData ? tradeData.itemCount : 0;
      if (count > 0) activeTrades++;
    }
    result.tradeCount = activeTrades;

    console.log(`    OK 아이템: ${result.qtyItems}개, 활성 공종: ${result.tradeCount}/17`);

    // 공종별 요약 (간략)
    for (const tc of TRADE_ORDER) {
      const tradeData = qtyResult.summary.byTrade[tc];
      const count = tradeData ? tradeData.itemCount : 0;
      const mark = count > 0 ? 'O' : '-';
      process.stdout.write(`    ${mark} ${(TRADE_NAMES_KR[tc] || tc).padEnd(6)}:${String(count).padStart(3)}  `);
      if (TRADE_ORDER.indexOf(tc) % 4 === 3) console.log();
    }
    if (TRADE_ORDER.length % 4 !== 0) console.log();

    if (result.qtyItems === 0) {
      result.errors.push('물량 아이템이 0개');
    }
  } catch (e: any) {
    result.success = false;
    result.errors.push(`quantity 실패: ${e.message}`);
    results.push(result);
    continue;
  }

  // Step 3: Calculate Estimate
  console.log(`  [Step 3] calculateEstimate()`);
  try {
    const estimate = calculateEstimate(qtyResult);
    result.estimateLines = estimate.lines.length;
    result.unmatchedItems = estimate.unmatchedItems.length;

    const s = estimate.summary;
    result.grandTotal = s.grandTotal;
    result.materialCost = s.directMaterialCost;
    result.laborCost = s.directLaborCost;
    result.perM2 = s.grandTotal / floorPlan.totalArea;
    result.perPyeong = result.perM2 * 3.3058;

    console.log(`    OK 라인: ${result.estimateLines}개, 미매칭: ${result.unmatchedItems}개`);
    console.log(`    재료비: ${(result.materialCost / 10000).toFixed(0)}만원`);
    console.log(`    노무비: ${(result.laborCost / 10000).toFixed(0)}만원`);
    console.log(`    관리비(${s.overheadRate}%): ${(s.overheadAmount / 10000).toFixed(0)}만원`);
    console.log(`    이윤(${s.profitRate}%): ${(s.profitAmount / 10000).toFixed(0)}만원`);
    console.log(`    부가세(${s.vatRate}%): ${(s.vatAmount / 10000).toFixed(0)}만원`);
    console.log(`    === 총합계: ${(result.grandTotal / 10000).toFixed(0)}만원 ===`);
    console.log(`    m2당: ${(result.perM2 / 10000).toFixed(1)}만원/m2, 평당: ${(result.perPyeong / 10000).toFixed(1)}만원/평`);

    // 합리성 검증
    const totalManwon = result.grandTotal / 10000;
    if (totalManwon < typeConfig.minEstimate || totalManwon > typeConfig.maxEstimate) {
      result.errors.push(`견적 범위 초과: ${totalManwon.toFixed(0)}만원 (${typeConfig.minEstimate}~${typeConfig.maxEstimate}만원)`);
    }

    if (result.unmatchedItems > 0) {
      console.log(`    ! 미매칭:`);
      for (const item of estimate.unmatchedItems.slice(0, 5)) {
        console.log(`      - [${item.tradeCode}] ${item.itemCode}: ${item.itemName}`);
      }
    }

    // 공종별 금액 top 5
    const tradeAmounts: { name: string; amount: number }[] = [];
    for (const [tc, data] of Object.entries(s.byTrade)) {
      const amt = (data as any).totalAmount || 0;
      if (amt > 0) tradeAmounts.push({ name: TRADE_NAMES_KR[tc] || tc, amount: amt });
    }
    tradeAmounts.sort((a, b) => b.amount - a.amount);
    console.log(`    공종별 TOP 5:`);
    for (const t of tradeAmounts.slice(0, 5)) {
      console.log(`      ${t.name}: ${(t.amount / 10000).toFixed(0)}만원`);
    }

  } catch (e: any) {
    result.success = false;
    result.errors.push(`estimate 실패: ${e.message}`);
  }

  if (result.errors.length > 0) result.success = false;
  results.push(result);
}

// Final Summary
console.log('\n\n' + '='.repeat(70));
console.log('  통합 검증 결과 요약');
console.log('='.repeat(70));

console.log('\n  | 타입    | 방  | 벽  | 개구부 | 설비 | 습식 | QTY  | 공종 | 라인 | 미매칭 | 총합계(만원) | m2당(만원) | 평당(만원) | 결과 |');
console.log('  |---------|-----|-----|--------|------|------|------|------|------|--------|-------------|-----------|-----------|------|');

for (const r of results) {
  const mark = r.success ? 'PASS' : 'FAIL';
  console.log(
    `  | ${r.name.padEnd(7)} | ${String(r.rooms).padStart(3)} | ${String(r.walls).padStart(3)} | ${String(r.openings).padStart(6)} | ${String(r.fixtures).padStart(4)} | ${String(r.wetRooms).padStart(4)} | ${String(r.qtyItems).padStart(4)} | ${String(r.tradeCount).padStart(4)} | ${String(r.estimateLines).padStart(4)} | ${String(r.unmatchedItems).padStart(6)} | ${String((r.grandTotal / 10000).toFixed(0)).padStart(11)} | ${String((r.perM2 / 10000).toFixed(1)).padStart(9)} | ${String((r.perPyeong / 10000).toFixed(1)).padStart(9)} | ${mark.padStart(4)} |`
  );
}

// Errors
const failedTypes = results.filter(r => !r.success);
if (failedTypes.length > 0) {
  console.log('\n  ERRORS:');
  for (const r of failedTypes) {
    for (const err of r.errors) {
      console.log(`    [${r.name}] ${err}`);
    }
  }
}

const allPassed = results.every(r => r.success);
console.log('\n' + '='.repeat(70));
console.log(`  최종 결과: ${allPassed ? 'ALL PASS' : 'SOME FAILED'}`);
console.log('='.repeat(70));

process.exit(allPassed ? 0 : 1);
