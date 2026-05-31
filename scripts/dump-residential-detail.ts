/** 보강된 아파트 상세내역서 검증. 실행: npx tsx scripts/dump-residential-detail.ts */
import { readFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';
import { buildResidentialDetail } from '../src/lib/estimate-pro/detail-model';
import type { ParsedFloorPlan } from '../src/types/floorplan';

const fp: ParsedFloorPlan = JSON.parse(readFileSync(join(process.cwd(), 'public/floorplans/sample-84b.json'), 'utf-8'));
const est = calculateEstimate(calculateAllQuantities(adaptParsedFloorPlan(fp, 'd', '84B')), { ceilingHeight: 2300 });
const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

for (const [label, opts] of [
  ['옵션 OFF (샷시·단열 제외)', { sash: false, expansionInsulation: false }],
  ['옵션 ON  (샷시·단열 포함)', { sash: true, expansionInsulation: true }],
] as const) {
  const sheet = buildResidentialDetail(est, opts);
  console.log(`\n===== ${label} =====`);
  console.log(`라인 ${sheet.lineCount} / 직접재료 ${won(sheet.directMaterial)} / 직접노무 ${won(sheet.directLabor)} / 직접비계 ${won(sheet.directTotal)}`);
  console.log('공종별 합계:');
  for (const g of sheet.groups) {
    const added = g.lines.filter((l) => l.added).length;
    console.log(`  ${String(g.order).padStart(2)} ${g.trade.padEnd(14)} ${won(g.sum).padStart(12)}원  (${g.lines.length}건${added ? `, 보강 ${added}` : ''})`);
  }
}
