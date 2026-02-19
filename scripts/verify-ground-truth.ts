/**
 * Ground Truth 비교 검증 스크립트
 *
 * 3가지 도면 타입의 파싱 결과를 건축도면 원본 설계 제원(Ground Truth)과 비교
 * - 공간 구성, 면적, 설비, 벽체 구조 검증
 * - DXF 파서 결과와 Gemini 파서 결과 비교 (DXF 파일 존재 시)
 *
 * 실행: npx tsx scripts/verify-ground-truth.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ParsedFloorPlan, RoomData } from '../src/types/floorplan';

// ─── Ground Truth: 대전용산4블럭 건축도면 설계 제원 ───

interface RoomSpec {
  type: string;
  name: string;
  minArea: number;
  maxArea: number;
}

interface GroundTruth {
  name: string;
  file: string;
  dxfFile?: string;
  totalArea: number;
  tolerance: number; // m² 허용 오차
  expectedRoomCount: { min: number; max: number };
  requiredRoomTypes: string[]; // 반드시 존재해야 하는 방 타입
  roomSpecs: RoomSpec[];
  expectedDoorCount: { min: number; max: number };
  expectedWindowCount: { min: number; max: number };
  expectedFixtureTypes: string[]; // 반드시 존재해야 하는 설비 타입
  bathroomCount: number;
  bedroomCount: number; // BED + MASTER_BED
}

const GROUND_TRUTHS: GroundTruth[] = [
  {
    name: '59㎡ 확장형',
    file: 'sample-59.json',
    dxfFile: 'dwg-59.json',
    totalArea: 59.0,
    tolerance: 2.0,
    expectedRoomCount: { min: 8, max: 15 },
    requiredRoomTypes: ['LIVING', 'KITCHEN', 'MASTER_BED', 'BATHROOM', 'ENTRANCE'],
    roomSpecs: [
      { type: 'LIVING', name: '거실', minArea: 10, maxArea: 30 },
      { type: 'KITCHEN', name: '주방', minArea: 3, maxArea: 15 },
      { type: 'MASTER_BED', name: '안방', minArea: 5, maxArea: 15 },
      { type: 'BED', name: '침실', minArea: 3, maxArea: 12 },
      { type: 'BATHROOM', name: '욕실', minArea: 2, maxArea: 7 },
      { type: 'ENTRANCE', name: '현관', minArea: 1.5, maxArea: 6 },
    ],
    expectedDoorCount: { min: 5, max: 15 },
    expectedWindowCount: { min: 3, max: 10 },
    expectedFixtureTypes: ['toilet', 'sink'],
    bathroomCount: 2,
    bedroomCount: 3, // 안방 + 침실2 + 침실3 (59㎡ 확장형)
  },
  {
    name: '84A㎡ 확장형',
    file: 'sample-84a.json',
    dxfFile: 'dwg-84a.json',
    totalArea: 84.0,
    tolerance: 2.0,
    expectedRoomCount: { min: 8, max: 25 },
    requiredRoomTypes: ['LIVING', 'KITCHEN', 'MASTER_BED', 'BATHROOM', 'ENTRANCE'],
    roomSpecs: [
      { type: 'LIVING', name: '거실', minArea: 8, maxArea: 35 }, // LDK 분리 시 10m² 가능
      { type: 'KITCHEN', name: '주방', minArea: 3, maxArea: 18 },
      { type: 'MASTER_BED', name: '안방', minArea: 7, maxArea: 18 },
      { type: 'BED', name: '침실', minArea: 3, maxArea: 14 },
      { type: 'BATHROOM', name: '욕실', minArea: 2, maxArea: 8 },
      { type: 'ENTRANCE', name: '현관', minArea: 2, maxArea: 7 },
    ],
    expectedDoorCount: { min: 6, max: 18 },
    expectedWindowCount: { min: 4, max: 12 },
    expectedFixtureTypes: ['toilet', 'sink'],
    bathroomCount: 2,
    bedroomCount: 4, // 안방 + 침실2~4
  },
  {
    name: '84B㎡ 확장형',
    file: 'sample-84b.json',
    dxfFile: 'dwg-84b.json',
    totalArea: 84.0,
    tolerance: 2.0,
    expectedRoomCount: { min: 8, max: 15 },
    requiredRoomTypes: ['LIVING', 'KITCHEN', 'MASTER_BED', 'BATHROOM', 'ENTRANCE'],
    roomSpecs: [
      { type: 'LIVING', name: '거실', minArea: 15, maxArea: 35 },
      { type: 'KITCHEN', name: '주방', minArea: 5, maxArea: 15 },
      { type: 'MASTER_BED', name: '안방', minArea: 6, maxArea: 15 },
      { type: 'BED', name: '침실', minArea: 3, maxArea: 12 },
      { type: 'BATHROOM', name: '욕실', minArea: 2, maxArea: 7 },
      { type: 'ENTRANCE', name: '현관', minArea: 2, maxArea: 7 },
    ],
    expectedDoorCount: { min: 6, max: 15 },
    expectedWindowCount: { min: 3, max: 10 },
    expectedFixtureTypes: ['toilet', 'sink', 'bathtub'],
    bathroomCount: 2,
    bedroomCount: 3, // 안방 + 침실2 + 침실3
  },
];

// ─── 검증 유틸 ───

function calcPolygonArea(polygon: { x: number; y: number }[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

function check(name: string, passed: boolean, detail: string): CheckResult {
  return { name, passed, detail };
}

// ─── 메인 검증 ───

interface TypeReport {
  typeName: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  allPassed: boolean;
}

const reports: TypeReport[] = [];

console.log('='.repeat(70));
console.log('  INPICK Ground Truth 비교 검증');
console.log('  대전용산4블럭 건축도면 설계 제원 vs 파싱 결과');
console.log('='.repeat(70));

for (const gt of GROUND_TRUTHS) {
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`  [${gt.name}] Ground Truth 검증`);
  console.log('#'.repeat(70));

  const checks: CheckResult[] = [];
  const filePath = join(process.cwd(), 'public/floorplans', gt.file);

  // 파일 로드
  if (!existsSync(filePath)) {
    checks.push(check('파일 존재', false, `${gt.file} not found`));
    reports.push({ typeName: gt.name, checks, passed: 0, failed: 1, allPassed: false });
    continue;
  }

  let plan: ParsedFloorPlan;
  try {
    plan = JSON.parse(readFileSync(filePath, 'utf-8'));
    checks.push(check('파일 로드', true, `${gt.file} loaded`));
  } catch (e: any) {
    checks.push(check('파일 로드', false, e.message));
    reports.push({ typeName: gt.name, checks, passed: 0, failed: 1, allPassed: false });
    continue;
  }

  // 1. 총면적 검증
  const areaDiff = Math.abs(plan.totalArea - gt.totalArea);
  checks.push(check(
    '총면적',
    areaDiff <= gt.tolerance,
    `${plan.totalArea}m² (기준: ${gt.totalArea}m², 차이: ${areaDiff.toFixed(2)}m², 허용: ±${gt.tolerance}m²)`
  ));

  // 2. 방 수 검증
  checks.push(check(
    '방 수',
    plan.rooms.length >= gt.expectedRoomCount.min && plan.rooms.length <= gt.expectedRoomCount.max,
    `${plan.rooms.length}개 (기준: ${gt.expectedRoomCount.min}~${gt.expectedRoomCount.max}개)`
  ));

  // 3. 필수 방 타입 존재 여부
  const roomTypes = new Set(plan.rooms.map(r => r.type));
  const missingTypes = gt.requiredRoomTypes.filter(t => !roomTypes.has(t));
  checks.push(check(
    '필수 방 타입',
    missingTypes.length === 0,
    missingTypes.length === 0
      ? `모두 존재: ${gt.requiredRoomTypes.join(', ')}`
      : `누락: ${missingTypes.join(', ')}`
  ));

  // 4. 욕실 수 검증
  const bathrooms = plan.rooms.filter(r => r.type === 'BATHROOM');
  checks.push(check(
    '욕실 수',
    bathrooms.length >= gt.bathroomCount,
    `${bathrooms.length}개 (기준: ${gt.bathroomCount}개 이상)`
  ));

  // 5. 침실 수 검증 (BED + MASTER_BED)
  const bedrooms = plan.rooms.filter(r => r.type === 'BED' || r.type === 'MASTER_BED');
  checks.push(check(
    '침실 수',
    bedrooms.length >= gt.bedroomCount - 1, // 허용: 1개까지 적어도 OK
    `${bedrooms.length}개 (기준: ~${gt.bedroomCount}개)`
  ));

  // 6. 방별 면적 범위 검증
  let roomAreaErrors = 0;
  const roomAreaDetails: string[] = [];
  for (const spec of gt.roomSpecs) {
    const matching = plan.rooms.filter(r => r.type === spec.type);
    for (const room of matching) {
      const area = room.area || 0;
      if (area < spec.minArea || area > spec.maxArea) {
        roomAreaErrors++;
        roomAreaDetails.push(`${room.name}(${room.type}): ${area}m² (범위: ${spec.minArea}~${spec.maxArea})`);
      }
    }
  }
  checks.push(check(
    '방 면적 범위',
    roomAreaErrors === 0,
    roomAreaErrors === 0
      ? '모든 방 면적이 설계 범위 내'
      : `${roomAreaErrors}건 초과: ${roomAreaDetails.slice(0, 3).join('; ')}${roomAreaErrors > 3 ? ` +${roomAreaErrors - 3}건` : ''}`
  ));

  // 7. 폴리곤 면적 정합성
  let polygonErrors = 0;
  let maxPolyDiff = 0;
  for (const room of plan.rooms) {
    if (room.polygon && room.polygon.length >= 3) {
      const polyArea = calcPolygonArea(room.polygon);
      const diff = Math.abs(polyArea - (room.area || 0));
      maxPolyDiff = Math.max(maxPolyDiff, diff);
      if (diff > 1.0) { // 1m² 이상 차이
        polygonErrors++;
      }
    }
  }
  checks.push(check(
    '폴리곤-면적 정합',
    polygonErrors === 0,
    `최대 차이: ${maxPolyDiff.toFixed(3)}m², 1m² 초과: ${polygonErrors}건`
  ));

  // 8. 면적 합산 검증 (방 면적 합 ≈ 총면적)
  const roomAreaSum = plan.rooms.reduce((s, r) => s + (r.area || 0), 0);
  const sumDiff = Math.abs(roomAreaSum - plan.totalArea);
  checks.push(check(
    '면적 합산',
    sumDiff <= 10.0, // 10m² 허용 (발코니/공용 면적은 전용면적에 미포함)
    `방 합계: ${roomAreaSum.toFixed(1)}m², 총면적: ${plan.totalArea}m², 차이: ${sumDiff.toFixed(1)}m² (발코니 포함 가능)`
  ));

  // 9. 문 수 검증
  const doorCount = plan.doors?.length || 0;
  checks.push(check(
    '문 수',
    doorCount >= gt.expectedDoorCount.min && doorCount <= gt.expectedDoorCount.max,
    `${doorCount}개 (기준: ${gt.expectedDoorCount.min}~${gt.expectedDoorCount.max}개)`
  ));

  // 10. 창문 수 검증
  const windowCount = plan.windows?.length || 0;
  checks.push(check(
    '창문 수',
    windowCount >= gt.expectedWindowCount.min && windowCount <= gt.expectedWindowCount.max,
    `${windowCount}개 (기준: ${gt.expectedWindowCount.min}~${gt.expectedWindowCount.max}개)`
  ));

  // 11. 필수 설비 존재
  const fixtureTypes = new Set((plan.fixtures || []).map(f => f.type));
  const missingFixtures = gt.expectedFixtureTypes.filter(t => !fixtureTypes.has(t));
  checks.push(check(
    '필수 설비',
    missingFixtures.length === 0,
    missingFixtures.length === 0
      ? `모두 존재: ${gt.expectedFixtureTypes.join(', ')}`
      : `누락: ${missingFixtures.join(', ')}`
  ));

  // 12. 벽체 유효성
  const wallCount = plan.walls?.length || 0;
  const invalidWalls = (plan.walls || []).filter(w => {
    const len = Math.sqrt((w.end.x - w.start.x) ** 2 + (w.end.y - w.start.y) ** 2);
    return len < 0.1; // 10cm 미만
  });
  checks.push(check(
    '벽체 유효성',
    wallCount >= 10 && invalidWalls.length === 0,
    `총 ${wallCount}개, 무효(0.1m 미만): ${invalidWalls.length}개`
  ));

  // 13. 설비 roomId 연결 검증
  const roomIds = new Set(plan.rooms.map(r => r.id));
  const orphanFixtures = (plan.fixtures || []).filter(f => f.roomId && !roomIds.has(f.roomId));
  checks.push(check(
    '설비 roomId',
    orphanFixtures.length === 0,
    orphanFixtures.length === 0
      ? '모든 설비가 유효한 방에 연결'
      : `고아 설비: ${orphanFixtures.length}개 (${orphanFixtures.map(f => `${f.type}→${f.roomId}`).join(', ')})`
  ));

  // 14. 문 connectedRooms 검증
  const doorsWithBadRooms = (plan.doors || []).filter(d => {
    if (!d.connectedRooms) return false;
    return d.connectedRooms.some((rt: string) =>
      rt && !['LIVING', 'KITCHEN', 'MASTER_BED', 'BED', 'BATHROOM', 'ENTRANCE',
        'BALCONY', 'UTILITY', 'CORRIDOR', 'DRESSROOM', ''].includes(rt)
    );
  });
  checks.push(check(
    '문 connectedRooms',
    doorsWithBadRooms.length === 0,
    doorsWithBadRooms.length === 0
      ? '모든 문의 connectedRooms 유효'
      : `잘못된 타입: ${doorsWithBadRooms.length}개`
  ));

  // 15. 좌표 범위 검증 (합리적인 아파트 크기)
  const allCoords: { x: number; y: number }[] = [];
  for (const room of plan.rooms) {
    if (room.polygon) {
      for (const p of room.polygon) allCoords.push(p);
    }
  }
  if (allCoords.length > 0) {
    const xs = allCoords.map(p => p.x);
    const ys = allCoords.map(p => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    checks.push(check(
      '좌표 범위',
      width >= 5 && width <= 25 && height >= 5 && height <= 20,
      `${width.toFixed(1)}m x ${height.toFixed(1)}m (합리적 범위: 5~25m x 5~20m)`
    ));
  }

  // DXF 파서 결과 비교 (파일이 있는 경우)
  const dxfPath = join(process.cwd(), 'public/floorplans', gt.dxfFile || '');
  if (gt.dxfFile && existsSync(dxfPath)) {
    console.log(`\n  --- DXF 파서 결과 비교 ---`);
    try {
      const dxfPlan = JSON.parse(readFileSync(dxfPath, 'utf-8'));
      const dxfRooms = dxfPlan.rooms?.length || 0;
      const dxfWalls = dxfPlan.walls?.length || 0;
      const dxfDoors = dxfPlan.doors?.length || 0;
      const dxfArea = dxfPlan.totalArea || 0;

      checks.push(check(
        'DXF 면적 비교',
        Math.abs(dxfArea - plan.totalArea) < 10,
        `DXF: ${dxfArea}m², Gemini: ${plan.totalArea}m², 차이: ${Math.abs(dxfArea - plan.totalArea).toFixed(1)}m²`
      ));
      checks.push(check(
        'DXF 방 수 비교',
        Math.abs(dxfRooms - plan.rooms.length) < 5,
        `DXF: ${dxfRooms}개, Gemini: ${plan.rooms.length}개`
      ));
      console.log(`    DXF 벽: ${dxfWalls}개, Gemini 벽: ${wallCount}개`);
      console.log(`    DXF 문: ${dxfDoors}개, Gemini 문: ${doorCount}개`);
    } catch (e: any) {
      checks.push(check('DXF 비교', false, `DXF 파일 파싱 실패: ${e.message}`));
    }
  }

  // 결과 출력
  console.log('\n  검증 결과:');
  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    const mark = c.passed ? 'OK' : 'NG';
    if (c.passed) passed++;
    else failed++;
    console.log(`    ${mark} ${c.name.padEnd(16)}: ${c.detail}`);
  }

  const allPassed = failed === 0;
  console.log(`\n  종합: ${passed}/${checks.length} 통과 (${failed > 0 ? `${failed}건 실패` : '전체 통과'})`);

  reports.push({ typeName: gt.name, checks, passed, failed, allPassed });
}

// ─── 최종 종합 ───

console.log('\n\n' + '='.repeat(70));
console.log('  Ground Truth 비교 검증 최종 요약');
console.log('='.repeat(70));

console.log('\n  | 타입            | 통과   | 실패  | 결과 |');
console.log('  |-----------------|--------|-------|------|');

for (const r of reports) {
  const mark = r.allPassed ? 'PASS' : 'FAIL';
  console.log(`  | ${r.typeName.padEnd(15)} | ${String(r.passed).padStart(4)}/16 | ${String(r.failed).padStart(5)} | ${mark.padStart(4)} |`);
}

// DXF 파서 상태
console.log('\n  DXF 파서 상태:');
const dxfDir = join(process.cwd(), 'public/floorplans');
let dxfFound = 0;
for (const gt of GROUND_TRUTHS) {
  if (gt.dxfFile && existsSync(join(dxfDir, gt.dxfFile))) {
    dxfFound++;
    console.log(`    OK ${gt.dxfFile}`);
  } else {
    console.log(`    -- ${gt.dxfFile || 'N/A'} (DWG→DXF 변환 필요)`);
  }
}
if (dxfFound === 0) {
  console.log('    ODA File Converter 설치 후 DWG→DXF 변환 필요');
  console.log('    실행: python scripts/convert-dwg.py');
  console.log('    후:   python scripts/parse-dxf.py');
}

const allPassed = reports.every(r => r.allPassed);
console.log('\n' + '='.repeat(70));
console.log(`  최종: ${allPassed ? 'ALL PASS' : 'SOME FAILED'}`);
console.log('='.repeat(70));

process.exit(allPassed ? 0 : 1);
