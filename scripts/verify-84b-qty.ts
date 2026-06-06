/**
 * 84B 물량산출 + 견적 엔진 실제 실행 검증
 * 실행: npx tsx scripts/verify-84b-qty.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities, DEFAULT_DEMO_SCOPE } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';
import type { ParsedFloorPlan } from '../src/types/floorplan';

// Load sample-84b.json
const samplePath = join(process.cwd(), 'public/floorplans/sample-84b.json');
const floorPlan: ParsedFloorPlan = JSON.parse(readFileSync(samplePath, 'utf-8'));

console.log('='.repeat(70));
console.log('  84B 물량산출 + 견적 엔진 실행 검증');
console.log('='.repeat(70));

// Step 1: Adapt
console.log('\n[Step 1] adaptParsedFloorPlan()');
console.log('-'.repeat(40));

let project;
try {
  project = adaptParsedFloorPlan(floorPlan, 'test-84b', '84B 인테리어');
  console.log(`  ✅ 변환 성공`);
  console.log(`  프로젝트: ${project.name}`);
  console.log(`  방: ${project.rooms.length}개`);
  console.log(`  벽: ${project.walls.length}개`);
  console.log(`  개구부: ${project.openings.length}개`);
  console.log(`  설비: ${project.fixtures.length}개`);

  // 습식 공간 확인
  const wetRooms = project.rooms.filter(r => r.isWetArea);
  console.log(`  습식 공간: ${wetRooms.length}개 (${wetRooms.map(r => r.name).join(', ')})`);

  // boundaryWallIds 확인
  for (const room of project.rooms) {
    console.log(`    ${room.name}: boundaryWallIds=${room.boundaryWallIds.length}개`);
  }
} catch (e: any) {
  console.log(`  ❌ 변환 실패: ${e.message}`);
  process.exit(1);
}

// Step 2: Calculate Quantities
console.log('\n[Step 2] calculateAllQuantities()');
console.log('-'.repeat(40));

let qtyResult;
try {
  qtyResult = calculateAllQuantities(project, DEFAULT_DEMO_SCOPE);
  console.log(`  ✅ 산출 성공`);
  console.log(`  총 아이템: ${qtyResult.items.length}개`);

  // 공종별 요약
  console.log('\n  공종별 아이템 수:');
  const tradeOrder = [
    '01_DEMOLITION', '02_MASONRY', '03_PLASTER', '04_WATERPROOF',
    '05_TILE', '06_WOODWORK', '07_FLOORING', '08_WALLPAPER_PAINT',
    '09_CEILING', '10_DOOR_WINDOW', '11_HARDWARE', '12_PLUMBING',
    '13_SANITARY', '14_ELECTRICAL', '15_FIXTURE', '16_BASEBOARD_MOLDING',
    '17_CLEANUP'
  ] as const;

  const TRADE_NAMES_KR: Record<string, string> = {
    '01_DEMOLITION': '철거', '02_MASONRY': '조적', '03_PLASTER': '미장',
    '04_WATERPROOF': '방수', '05_TILE': '타일', '06_WOODWORK': '목공',
    '07_FLOORING': '바닥재', '08_WALLPAPER_PAINT': '도배/도장',
    '09_CEILING': '천장', '10_DOOR_WINDOW': '창호', '11_HARDWARE': '잡철',
    '12_PLUMBING': '배관', '13_SANITARY': '위생도기', '14_ELECTRICAL': '전기',
    '15_FIXTURE': '고정설비', '16_BASEBOARD_MOLDING': '걸레받이', '17_CLEANUP': '정리'
  };

  for (const tc of tradeOrder) {
    const tradeData = qtyResult.summary.byTrade[tc];
    const count = tradeData ? tradeData.itemCount : 0;
    const status = count > 0 ? '✅' : '⚠️';
    console.log(`    ${status} ${TRADE_NAMES_KR[tc]?.padEnd(8)} (${tc}): ${count}개`);

    // 상세 아이템 (처음 3개만)
    if (tradeData && tradeData.items) {
      for (const item of tradeData.items.slice(0, 3)) {
        console.log(`       - ${item.itemName} ${item.finalQuantity.toFixed(2)} ${item.unit}`);
      }
      if (tradeData.items.length > 3) {
        console.log(`       ... +${tradeData.items.length - 3}개 더`);
      }
    }
  }

  // 표면적 요약
  if (qtyResult.surfaceSummary) {
    console.log('\n  표면적 요약:');
    const ss = qtyResult.surfaceSummary;
    console.log(`    총 바닥면적: ${ss.totalFloorArea?.toFixed(2) || 'N/A'}m²`);
    console.log(`    총 벽면적: ${ss.totalWallArea?.toFixed(2) || 'N/A'}m²`);
    console.log(`    총 천장면적: ${ss.totalCeilingArea?.toFixed(2) || 'N/A'}m²`);
  }
} catch (e: any) {
  console.log(`  ❌ 산출 실패: ${e.message}`);
  console.log(`  스택: ${e.stack}`);
  process.exit(1);
}

// Step 3: Calculate Estimate
console.log('\n[Step 3] calculateEstimate()');
console.log('-'.repeat(40));

let estimate;
try {
  estimate = calculateEstimate(qtyResult);
  console.log(`  ✅ 견적 산출 성공`);
  console.log(`  견적 라인: ${estimate.lines.length}개`);
  console.log(`  미매칭 아이템: ${estimate.unmatchedItems.length}개`);

  const s = estimate.summary;
  console.log(`\n  견적 요약:`);
  console.log(`    직접 재료비: ${(s.directMaterialCost / 10000).toFixed(0)}만원`);
  console.log(`    직접 노무비: ${(s.directLaborCost / 10000).toFixed(0)}만원`);
  console.log(`    직접비 소계: ${(s.directCost / 10000).toFixed(0)}만원`);
  console.log(`    관리비 (${s.overheadRate}%): ${(s.overheadAmount / 10000).toFixed(0)}만원`);
  console.log(`    이윤 (${s.profitRate}%): ${(s.profitAmount / 10000).toFixed(0)}만원`);
  console.log(`    소계: ${(s.subtotal / 10000).toFixed(0)}만원`);
  console.log(`    부가세 (${s.vatRate}%): ${(s.vatAmount / 10000).toFixed(0)}만원`);
  console.log(`    =====================`);
  console.log(`    총합계: ${(s.grandTotal / 10000).toFixed(0)}만원 (${s.grandTotal.toLocaleString()}원)`);

  // 공종별 금액
  const TN: Record<string, string> = {
    '01_DEMOLITION': '철거', '02_MASONRY': '조적', '03_PLASTER': '미장',
    '04_WATERPROOF': '방수', '05_TILE': '타일', '06_WOODWORK': '목공',
    '07_FLOORING': '바닥재', '08_WALLPAPER_PAINT': '도배/도장',
    '09_CEILING': '천장', '10_DOOR_WINDOW': '창호', '11_HARDWARE': '잡철',
    '12_PLUMBING': '배관', '13_SANITARY': '위생도기', '14_ELECTRICAL': '전기',
    '15_FIXTURE': '고정설비', '16_BASEBOARD_MOLDING': '걸레받이', '17_CLEANUP': '정리'
  };

  console.log('\n  공종별 금액:');
  for (const [tc, data] of Object.entries(s.byTrade)) {
    if ((data as any).totalAmount > 0) {
      console.log(`    ${(TN[tc] || tc).padEnd(8)}: ${((data as any).totalAmount / 10000).toFixed(0)}만원`);
    }
  }

  // 방별 금액
  console.log('\n  방별 금액:');
  for (const [rn, data] of Object.entries(s.byRoom)) {
    if ((data as any).totalAmount > 0) {
      console.log(`    ${rn.padEnd(12)}: ${((data as any).totalAmount / 10000).toFixed(0)}만원`);
    }
  }

  // 미매칭 아이템 상세
  if (estimate.unmatchedItems.length > 0) {
    console.log(`\n  ⚠️ 미매칭 아이템 (단가DB에 없는 항목):`);
    for (const item of estimate.unmatchedItems.slice(0, 10)) {
      console.log(`    - [${item.tradeCode}] ${item.itemCode}: ${item.itemName} (${item.finalQuantity.toFixed(2)} ${item.unit})`);
    }
    if (estimate.unmatchedItems.length > 10) {
      console.log(`    ... +${estimate.unmatchedItems.length - 10}개 더`);
    }
  }

  // 합리성 검증
  console.log('\n  합리성 검증:');
  const perM2 = s.grandTotal / floorPlan.totalArea;
  console.log(`    m²당 단가: ${(perM2 / 10000).toFixed(1)}만원/m²`);
  console.log(`    평당 단가: ${(perM2 * 3.3058 / 10000).toFixed(1)}만원/평`);

  // 84m² 아파트 인테리어 합리적 범위: 2000~6000만원
  if (s.grandTotal >= 15000000 && s.grandTotal <= 80000000) {
    console.log(`    ✅ 합리적 범위 (1500~8000만원) 내`);
  } else {
    console.log(`    ⚠️ 범위 확인 필요: ${(s.grandTotal / 10000).toFixed(0)}만원`);
  }

} catch (e: any) {
  console.log(`  ❌ 견적 산출 실패: ${e.message}`);
  console.log(`  스택: ${e.stack}`);
  process.exit(1);
}

// 종합
console.log('\n' + '='.repeat(70));
console.log('  84B 물량산출 + 견적 엔진 검증 완료');
console.log('='.repeat(70));
console.log(`  adapt:     ✅ ${project.rooms.length}방, ${project.walls.length}벽, ${project.openings.length}개구부, ${project.fixtures.length}설비`);
console.log(`  quantity:  ✅ ${qtyResult.items.length}개 아이템, 17공종`);
console.log(`  estimate:  ✅ ${estimate.lines.length}개 라인, 총 ${(estimate.summary.grandTotal / 10000).toFixed(0)}만원`);
console.log('='.repeat(70));
