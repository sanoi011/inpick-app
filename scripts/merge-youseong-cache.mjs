/**
 * 유성구 인덱스 데이터를 naver-cache.json + floor-plan-map.json에 병합
 *
 * 사용법:
 *   node scripts/merge-youseong-cache.mjs
 */

import fs from 'fs';
import path from 'path';

const BASE = process.cwd();
const INDEX_PATH = path.join(BASE, 'drawings', 'naver', 'youseong-index.json');
const CACHE_PATH = path.join(BASE, 'src', 'lib', 'data', 'naver-cache.json');
const MAP_PATH = path.join(BASE, 'src', 'lib', 'data', 'floor-plan-map.json');

console.log('=== 유성구 데이터 병합 ===\n');

// 1. 인덱스 로드
const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
console.log(`인덱스: ${Object.keys(index).length}개 단지`);

// 2. naver-cache.json 병합 (pyeongList + dongList 추가)
const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
let enrichedRegions = 0;
let enrichedComplexes = 0;

for (const [complexNo, complexData] of Object.entries(index)) {
  const cortarNo = complexData.cortarNo;
  if (!cortarNo || !cache[cortarNo]) continue;

  const region = cache[cortarNo];
  const cacheComplex = region.complexes?.find(c => c.complexNo === complexNo);
  if (!cacheComplex) continue;

  // pyeongList 추가/업데이트
  if (complexData.pyeongList && complexData.pyeongList.length > 0) {
    cacheComplex.pyeongList = complexData.pyeongList;
    enrichedComplexes++;
  }

  // dongList 추가/업데이트
  if (complexData.dongList && complexData.dongList.length > 0) {
    cacheComplex.dongList = complexData.dongList;
  }

  // 좌표 추가
  if (complexData.latitude) {
    cacheComplex.latitude = complexData.latitude;
    cacheComplex.longitude = complexData.longitude;
  }
}

fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log(`캐시 업데이트: ${enrichedComplexes}개 단지에 평형 데이터 추가`);

// 3. floor-plan-map.json 업데이트 (complexMappings)
const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8'));

// 도면 파일 존재 여부 확인 함수
const NAVER_FLOORPLAN_DIR = path.join(BASE, 'public', 'floorplans', 'naver');

let mappedComplexes = 0;
let mappedTypes = 0;

for (const [complexNo, complexData] of Object.entries(index)) {
  if (!complexData.pyeongList || complexData.pyeongList.length === 0) continue;

  const types = complexData.pyeongList
    .filter(p => p.grandPlanUrl) // 도면 URL이 있는 평형만
    .map(p => {
      const area = p.exclusiveArea;
      // 면적 범위: ±3 정도
      return {
        typeName: p.pyeongName,
        areaMin: Math.max(0, Math.round(area - 3)),
        areaMax: Math.round(area + 3),
        floorPlanId: `naver-${complexNo}-${p.pyeongNo}`,
      };
    });

  if (types.length > 0) {
    map.complexMappings.mappings[complexNo] = {
      complexName: complexData.complexName,
      types,
    };
    mappedComplexes++;
    mappedTypes += types.length;
  }
}

fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
console.log(`도면 매핑: ${mappedComplexes}개 단지, ${mappedTypes}개 타입 등록`);

// 4. 통계 요약
const withImages = Object.values(index).filter(c =>
  c.pyeongList?.some(p => p.grandPlanUrl)
);

console.log(`\n=== 통계 ===`);
console.log(`  총 단지: ${Object.keys(index).length}`);
console.log(`  도면 보유 단지: ${withImages.length}`);
console.log(`  총 평형: ${Object.values(index).reduce((s, c) => s + (c.pyeongList?.length || 0), 0)}`);
console.log(`  총 도면 URL: ${Object.values(index).reduce((s, c) => s + (c.pyeongList?.filter(p => p.grandPlanUrl)?.length || 0), 0)}`);

// 면적 분포
const areaDist = {};
for (const c of Object.values(index)) {
  for (const p of (c.pyeongList || [])) {
    if (!p.grandPlanUrl) continue;
    const bucket = Math.round(p.exclusiveArea / 10) * 10;
    areaDist[bucket] = (areaDist[bucket] || 0) + 1;
  }
}
console.log(`\n  면적 분포 (도면 보유):`);
for (const [bucket, count] of Object.entries(areaDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`    ~${bucket}㎡: ${count}개`);
}

console.log('\nDone!');
