/**
 * deploy-processed.mjs - 처리 완료된 Gemini 도면을 웹사이트에 배포
 *
 * 작업:
 *   1. saved_plans에서 final.png (치수 포함) 또는 clean.png (치수 없음) 탐색
 *   2. public/floorplans/images/{complexNo}-{complexName}/ 에 복사 (원본 교체)
 *   3. manifest.json 업데이트 (imagePath를 .png로 변경)
 *   4. 네이버 데이터와 1:1 크로스체크 리포트 생성
 *
 * 사용법:
 *   node scripts/floorplan-pipeline/deploy-processed.mjs [--watch]
 *   --watch: 배치 처리 중 주기적으로 재실행 (30초 간격)
 */

import fs from 'fs';
import path from 'path';

const SCRIPT_DIR = path.resolve(import.meta.dirname);
const BASE = path.resolve(SCRIPT_DIR, '..', '..');
const SAVED_PLANS = path.join(SCRIPT_DIR, 'saved_plans', '대전유성구');
const PUBLIC_IMAGES = path.join(BASE, 'public', 'floorplans', 'images');
const MANIFEST_PATH = path.join(PUBLIC_IMAGES, 'manifest.json');
const MAP_PATH = path.join(BASE, 'src', 'lib', 'data', 'floor-plan-map.json');

// ─── floor-plan-map.json 로드 (complexName → complexNo 매핑) ───

const mapData = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8'));
const mappings = mapData.complexMappings.mappings;

// complexName → complexNo 역매핑
const nameToNo = {};
for (const [no, info] of Object.entries(mappings)) {
  nameToNo[info.complexName] = no;
}

// complexNo+typeName → floorPlanId 매핑
function getFloorPlanId(complexNo, typeName) {
  const complex = mappings[complexNo];
  if (!complex) return null;
  const type = complex.types.find(t => t.typeName === typeName);
  return type ? type.floorPlanId : null;
}

// floorPlanId에서 pyeongNo 추출 (naver-6041-1 → 1)
function extractPyeongNo(floorPlanId) {
  if (!floorPlanId) return null;
  const parts = floorPlanId.split('-');
  return parts.length >= 3 ? parseInt(parts[2]) : null;
}

// ─── 배포 실행 ───

function deployProcessed() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // manifest를 complexNo+pyeongNo로 인덱싱
  const manifestIndex = {};
  for (let i = 0; i < manifest.length; i++) {
    const key = `${manifest[i].complexNo}-${manifest[i].pyeongNo}`;
    manifestIndex[key] = i;
  }

  const complexDirs = fs.readdirSync(SAVED_PLANS).filter(d =>
    fs.statSync(path.join(SAVED_PLANS, d)).isDirectory()
  );

  let deployed = 0;
  let skipped = 0;
  let errors = 0;
  const report = [];

  for (const complexName of complexDirs) {
    const complexNo = nameToNo[complexName];
    if (!complexNo) {
      errors++;
      report.push({ complexName, error: 'complexNo not found' });
      continue;
    }

    const complexDir = path.join(SAVED_PLANS, complexName);
    const typeDirs = fs.readdirSync(complexDir).filter(d =>
      fs.statSync(path.join(complexDir, d)).isDirectory()
    );

    for (const typeDir of typeDirs) {
      const planDir = path.join(complexDir, typeDir);

      // final.png 우선, 없으면 clean.png
      const finalPath = path.join(planDir, 'final.png');
      const cleanPath = path.join(planDir, 'clean.png');

      let sourcePath = null;
      let sourceType = null;
      if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1000) {
        sourcePath = finalPath;
        sourceType = 'final';
      } else if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).size > 1000) {
        sourcePath = cleanPath;
        sourceType = 'clean';
      } else {
        skipped++;
        continue; // 아직 처리 안 됨
      }

      // typeName 추출: "93_74.94m2" → "93"
      const typeName = typeDir.split('_')[0];
      const areaStr = typeDir.split('_')[1]?.replace('m2', '');

      // floorPlanId와 pyeongNo 조회
      const floorPlanId = getFloorPlanId(complexNo, typeName);
      const pyeongNo = extractPyeongNo(floorPlanId);

      if (!floorPlanId || pyeongNo === null) {
        errors++;
        report.push({ complexName, typeName, error: 'floorPlanId/pyeongNo not found' });
        continue;
      }

      // 대상 경로: public/floorplans/images/{complexNo}-{complexName}/{typeName}_{area}m2.png
      const destDir = path.join(PUBLIC_IMAGES, `${complexNo}-${complexName}`);
      const destFilename = `${typeDir}.png`; // 원본 폴더명 유지 + .png 확장자
      const destPath = path.join(destDir, destFilename);

      // 이미 배포된 경우 건너뛰기 (같은 크기면 스킵)
      if (fs.existsSync(destPath)) {
        const srcSize = fs.statSync(sourcePath).size;
        const dstSize = fs.statSync(destPath).size;
        if (srcSize === dstSize) {
          skipped++;
          continue;
        }
      }

      // 복사
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(sourcePath, destPath);

      // manifest 업데이트
      const manifestKey = `${complexNo}-${pyeongNo}`;
      const imagePath = `/floorplans/images/${complexNo}-${complexName}/${destFilename}`;

      if (manifestIndex[manifestKey] !== undefined) {
        const idx = manifestIndex[manifestKey];
        manifest[idx].imagePath = imagePath;
        manifest[idx].processed = true;
        manifest[idx].sourceType = sourceType;
      }

      // ─── 좌우 반전(mirror) 배포 ───
      const finalMirrorPath = path.join(planDir, 'final_mirror.png');
      const cleanMirrorPath = path.join(planDir, 'clean_mirror.png');

      let mirrorSource = null;
      if (fs.existsSync(finalMirrorPath) && fs.statSync(finalMirrorPath).size > 1000) {
        mirrorSource = finalMirrorPath;
      } else if (fs.existsSync(cleanMirrorPath) && fs.statSync(cleanMirrorPath).size > 1000) {
        mirrorSource = cleanMirrorPath;
      }

      if (mirrorSource) {
        const mirrorFilename = `${typeDir}_mirror.png`;
        const mirrorDestPath = path.join(destDir, mirrorFilename);

        // 새 파일이거나 크기 다르면 복사
        if (!fs.existsSync(mirrorDestPath) || fs.statSync(mirrorSource).size !== fs.statSync(mirrorDestPath).size) {
          fs.copyFileSync(mirrorSource, mirrorDestPath);

          // manifest에 mirror 엔트리 추가 (없으면 새로 추가)
          const mirrorManifestKey = `${complexNo}-${pyeongNo}-mirror`;
          const mirrorImagePath = `/floorplans/images/${complexNo}-${complexName}/${mirrorFilename}`;

          if (manifestIndex[mirrorManifestKey] === undefined) {
            // 새 엔트리 추가
            const mirrorEntry = {
              complexNo,
              complexName,
              pyeongNo,
              pyeongName: typeName,
              exclusiveArea: parseFloat(areaStr) || 0,
              imagePath: mirrorImagePath,
              processed: true,
              sourceType: sourceType + '_mirror',
              mirror: true,
            };
            manifestIndex[mirrorManifestKey] = manifest.length;
            manifest.push(mirrorEntry);
          } else {
            const idx = manifestIndex[mirrorManifestKey];
            manifest[idx].imagePath = mirrorImagePath;
          }
        }
      }

      deployed++;
      report.push({
        complexName,
        complexNo,
        typeName,
        pyeongNo,
        floorPlanId,
        sourceType,
        size: `${(fs.statSync(sourcePath).length / 1024).toFixed(0)}KB`,
      });
    }
  }

  // manifest 저장
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return { deployed, skipped, errors, report };
}

// ─── 크로스체크 리포트 ───

function crossCheckReport(report) {
  // naver-cache.json 로드해서 검증
  const cachePath = path.join(BASE, 'src', 'lib', 'data', 'naver-cache.json');
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    console.log('  naver-cache.json not loadable, skipping cross-check');
    return;
  }

  // 대전유성구 cortarNo 범위 (30200 prefix)
  const daejeonKeys = Object.keys(cache).filter(k => k.startsWith('30200'));
  console.log(`\n  Naver cache: ${daejeonKeys.length} regions for 대전유성구`);

  // 모든 캐시 단지 수집
  const cacheComplexes = {};
  for (const key of daejeonKeys) {
    for (const c of cache[key]?.complexes || []) {
      cacheComplexes[c.complexNo] = {
        name: c.complexName,
        pyeongCount: c.pyeongList?.length || 0,
        pyeongs: (c.pyeongList || []).map(p => ({
          no: p.pyeongNo,
          name: p.pyeongName,
          area: p.exclusiveArea,
        })),
      };
    }
  }

  // 배포된 도면과 네이버 캐시 비교
  const deployedByComplex = {};
  for (const r of report) {
    if (r.error) continue;
    if (!deployedByComplex[r.complexNo]) deployedByComplex[r.complexNo] = [];
    deployedByComplex[r.complexNo].push(r);
  }

  let matches = 0;
  let mismatches = 0;

  for (const [complexNo, items] of Object.entries(deployedByComplex)) {
    const naverComplex = cacheComplexes[complexNo];
    if (!naverComplex) {
      mismatches += items.length;
      console.log(`  [WARN] ${items[0].complexName} (${complexNo}): not in naver cache`);
      continue;
    }

    for (const item of items) {
      const naverPyeong = naverComplex.pyeongs.find(p => p.no === item.pyeongNo);
      if (naverPyeong) {
        // 평형 이름이 타입명과 일치하는지 확인
        if (naverPyeong.name === item.typeName) {
          matches++;
        } else {
          mismatches++;
          console.log(`  [MISMATCH] ${item.complexName} pyeong ${item.pyeongNo}: map="${item.typeName}" naver="${naverPyeong.name}"`);
        }
      } else {
        mismatches++;
        console.log(`  [WARN] ${item.complexName} pyeong ${item.pyeongNo}: not in naver pyeongList`);
      }
    }
  }

  console.log(`\n  Cross-check: ${matches} matches, ${mismatches} mismatches`);
}

// ─── 메인 ───

const isWatch = process.argv.includes('--watch');

async function main() {
  console.log('============================================================');
  console.log('  Deploy Processed Floor Plans');
  console.log('============================================================');

  const { deployed, skipped, errors, report } = deployProcessed();

  console.log(`  Deployed: ${deployed}`);
  console.log(`  Skipped (not ready or unchanged): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (errors > 0) {
    const errItems = report.filter(r => r.error);
    for (const e of errItems.slice(0, 5)) {
      console.log(`    ERROR: ${e.complexName}/${e.typeName || ''} - ${e.error}`);
    }
  }

  crossCheckReport(report);

  // 결과 저장
  const logPath = path.join(SCRIPT_DIR, 'deploy-results.json');
  fs.writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    deployed,
    skipped,
    errors,
    report: report.filter(r => !r.error),
    errorReport: report.filter(r => r.error),
  }, null, 2));
  console.log(`\n  Results: ${logPath}`);
  console.log('============================================================');

  return deployed;
}

if (isWatch) {
  console.log('Watch mode: checking every 30 seconds...\n');
  let lastDeployed = 0;
  const interval = setInterval(async () => {
    const deployed = await main();
    if (deployed > lastDeployed) {
      lastDeployed = deployed;
      console.log(`\n  New deployments since last check!\n`);
    }
  }, 30000);

  // 첫 실행
  await main();
} else {
  await main();
}
