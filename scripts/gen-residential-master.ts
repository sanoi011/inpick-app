/**
 * 아파트 고정 마스터 내역 생성기.
 * 84B 엔진 결과 + 보강을 공종/품목 단위로 집계하여 정적 마스터(고정값)로 동결.
 * 실행: npx tsx scripts/gen-residential-master.ts  →  src/lib/estimate-pro/residential-master.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { adaptParsedFloorPlan } from '../src/lib/floor-plan/quantity/adapter';
import { calculateAllQuantities } from '../src/lib/floor-plan/quantity/quantity-calculator';
import { calculateEstimate } from '../src/lib/floor-plan/quantity/estimate-calculator';
import { residentialDetailLines, type MasterItem, type DetailLine } from '../src/lib/estimate-pro/detail-model';
import type { ParsedFloorPlan } from '../src/types/floorplan';

const fp: ParsedFloorPlan = JSON.parse(readFileSync(join(process.cwd(), 'public/floorplans/sample-84b.json'), 'utf-8'));
const est = calculateEstimate(calculateAllQuantities(adaptParsedFloorPlan(fp, 'master', '84B')), { ceilingHeight: 2300 });

// 옵션 포함 전체 라인
const flat: DetailLine[] = residentialDetailLines(est, { sash: true, expansionInsulation: true, doorCount: 9, bathCount: 2 });

// 엔진 항목(itemCode≠'')은 itemName|spec로 집계, 보강(itemCode==='')은 그대로
const aggMap = new Map<string, MasterItem & { _qty: number }>();
const supplement: MasterItem[] = [];

const round2 = (n: number) => Math.round(n * 100) / 100;

for (const l of flat) {
  const base: MasterItem = {
    trade: l.trade, order: l.order, itemName: l.itemName, part: l.part,
    spec: l.spec, brand: l.brand, product: l.product,
    priceBand: l.priceBand, imageHint: l.imageHint,
    unit: l.unit, quantity: round2(l.quantity), matUnit: l.matUnit, labUnit: l.labUnit,
    labWas: l.labWas, labNote: l.labNote, optional: l.optional,
    source: l.source || '2025 서울 실거래 기준',
  };
  if (l.itemCode) {
    const key = `${l.itemName}|${l.spec}`;
    const ex = aggMap.get(key);
    if (ex) ex._qty += l.quantity;
    else aggMap.set(key, { ...base, _qty: l.quantity });
  } else {
    supplement.push(base);
  }
}

const aggregated: MasterItem[] = Array.from(aggMap.values()).map(({ _qty, ...m }) => ({ ...m, quantity: round2(_qty) }));

// 합치고 공종 순서 → 품명 정렬
const all = [...aggregated, ...supplement].sort((a, b) =>
  a.order - b.order || a.itemName.localeCompare(b.itemName, 'ko')
);

// TS 직렬화
const body = all.map((m) => '  ' + JSON.stringify(m)).join(',\n');
const out = `// src/lib/estimate-pro/residential-master.ts
// ⚙️ 자동 생성 (scripts/gen-residential-master.ts) — 84B 기준 고정 마스터 내역.
// 모든 견적서 공통 항목셋. 프로젝트별 수량 0/삭제로 운용. 값은 표준 기본(편집 가능).
import type { MasterItem } from './detail-model';

export const RESIDENTIAL_MASTER: MasterItem[] = [
${body},
];
`;

writeFileSync(join(process.cwd(), 'src/lib/estimate-pro/residential-master.ts'), out, 'utf-8');
console.log(`생성 완료: ${all.length}개 마스터 항목 (집계 ${aggregated.length} + 보강 ${supplement.length})`);
console.log(`직접비계: ${Math.round(all.reduce((s, m) => s + m.quantity * (m.matUnit + m.labUnit), 0)).toLocaleString('ko-KR')}원`);
