/**
 * 유성구 아파트 네이버 부동산 도면 일괄 수집 + Gemini 데이터화
 *
 * 3단계 파이프라인:
 *   Step 1: 네이버 API → 단지 상세 + 평형별 도면 URL 수집
 *   Step 2: 도면 이미지 다운로드
 *   Step 3: Gemini Vision → ParsedFloorPlan JSON 생성
 *
 * 사용법:
 *   node scripts/collect-youseong-floorplans.mjs [--step=1|2|3|all] [--force] [--limit=10] [--delay=2000]
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// ─── .env.local 로드 ───
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      process.env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  }
}

const BASE = process.cwd();
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.substring(2).split('=');
    return [k, v || 'true'];
  })
);

const STEP = flags.step || 'all';
const FORCE = flags.force === 'true';
const LIMIT = parseInt(flags.limit || '0', 10);
const DELAY = parseInt(flags.delay || '1500', 10);

// ─── 경로 설정 ───
const CACHE_PATH = path.join(BASE, 'src', 'lib', 'data', 'naver-cache.json');
const INDEX_PATH = path.join(BASE, 'drawings', 'naver', 'youseong-index.json');
const IMAGES_DIR = path.join(BASE, 'drawings', 'naver', 'youseong');
const OUTPUT_DIR = path.join(BASE, 'public', 'floorplans', 'naver');

// ─── 네이버 API ───
const NAVER_API = 'https://new.land.naver.com/api';
const MAIN_PAGE = 'https://new.land.naver.com/';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

let _cookies = null;

async function getCookies() {
  if (_cookies) return _cookies;
  try {
    const res = await fetch(MAIN_PAGE, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html' },
      redirect: 'follow',
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    _cookies = setCookies.map(c => c.split(';')[0].trim()).join('; ');
    await res.text();
    console.log(`  Cookie: ${_cookies ? _cookies.substring(0, 60) + '...' : '(empty)'}`);
  } catch (err) {
    console.log(`  Cookie fetch failed: ${err.message}`);
    _cookies = '';
  }
  return _cookies;
}

async function naverFetch(url, retries = 2) {
  const cookie = await getCookies();
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'application/json',
      Referer: MAIN_PAGE,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      Cookie: cookie,
    },
  });

  if (res.status === 429 && retries > 0) {
    console.log(`  429 Rate limited, waiting 30s...`);
    _cookies = null;
    await sleep(30000);
    return naverFetch(url, retries - 1);
  }

  return res;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────
// Step 1: 네이버 API에서 단지 상세 + 도면 URL 수집
// ─────────────────────────────────────────────
async function step1_collectIndex() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Step 1: 네이버 API → 단지 상세 수집      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));

  // 유성구 (cortarNo 3020*) 추출
  const youseongComplexes = [];
  for (const [cortarNo, region] of Object.entries(cache)) {
    if (!cortarNo.startsWith('3020')) continue;
    for (const c of (region.complexes || [])) {
      youseongComplexes.push({
        complexNo: c.complexNo,
        complexName: c.complexName,
        cortarNo,
        address: c.address,
        totalHouseholdCount: c.totalHouseholdCount,
        totalDongCount: c.totalDongCount,
        approvalDate: c.approvalDate,
      });
    }
  }

  // 세대수 기준 정렬 (큰 단지 우선)
  youseongComplexes.sort((a, b) => b.totalHouseholdCount - a.totalHouseholdCount);
  console.log(`  유성구 단지 수: ${youseongComplexes.length}`);

  // 기존 인덱스 로드 (resume 지원)
  let index = {};
  if (fs.existsSync(INDEX_PATH) && !FORCE) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    console.log(`  기존 인덱스: ${Object.keys(index).length}개 단지`);
  }

  const toProcess = LIMIT
    ? youseongComplexes.slice(0, LIMIT)
    : youseongComplexes;

  let processed = 0;
  let newCount = 0;
  let totalPyeong = 0;
  let totalImages = 0;

  for (const complex of toProcess) {
    processed++;

    // 이미 수집됨?
    if (index[complex.complexNo] && !FORCE) {
      const cached = index[complex.complexNo];
      totalPyeong += (cached.pyeongList || []).length;
      totalImages += (cached.pyeongList || []).filter(p => p.grandPlanUrl).length;
      continue;
    }

    console.log(`  [${processed}/${toProcess.length}] ${complex.complexName} (${complex.complexNo}, ${complex.totalHouseholdCount}세대)`);

    try {
      // overview API 사용 (인증 불필요)
      const url = `${NAVER_API}/complexes/overview/${complex.complexNo}`;
      const res = await naverFetch(url);

      if (!res.ok) {
        console.log(`    → HTTP ${res.status}`);
        index[complex.complexNo] = { ...complex, pyeongList: [], dongList: [], error: `HTTP ${res.status}`, fetchedAt: new Date().toISOString() };
      } else {
        const data = await res.json();
        const IMAGE_BASE = 'https://landthumb-phinf.pstatic.net';

        const pyeongList = (data.pyeongs || []).map(p => ({
          pyeongNo: Number(p.pyeongNo || 0),
          pyeongName: String(p.pyeongName || ''),
          pyeongName2: String(p.pyeongName2 || ''),
          exclusiveArea: parseFloat(p.exclusiveArea || '0'),
          supplyArea: parseFloat(p.supplyArea || '0'),
          grandPlanUrl: p.grandPlanUrl ? IMAGE_BASE + p.grandPlanUrl : null,
        }));

        const dongList = (data.dongs || []).map(d => ({
          dongNo: d.dongNo,
          dongName: d.bildName || d.dongNo,
        }));

        // overview에서 추가 데이터
        const overviewMeta = {
          latitude: data.latitude,
          longitude: data.longitude,
          minArea: data.minArea,
          maxArea: data.maxArea,
          useApproveYmd: data.useApproveYmd,
        };

        const withImages = pyeongList.filter(p => p.grandPlanUrl);
        totalPyeong += pyeongList.length;
        totalImages += withImages.length;

        console.log(`    → 평형 ${pyeongList.length}개, 도면 ${withImages.length}개, 동 ${dongList.length}개`);
        if (pyeongList.length > 0) {
          pyeongList.forEach(p => {
            console.log(`      ${p.pyeongName} (전용 ${p.exclusiveArea}㎡) ${p.grandPlanUrl ? '✓' : '✗'}`);
          });
        }

        index[complex.complexNo] = {
          ...complex,
          ...overviewMeta,
          pyeongList,
          dongList,
          fetchedAt: new Date().toISOString(),
        };
        newCount++;
      }
    } catch (err) {
      console.log(`    → Error: ${err.message}`);
      index[complex.complexNo] = { ...complex, pyeongList: [], error: err.message, fetchedAt: new Date().toISOString() };
    }

    // 중간 저장 (10개마다)
    if (newCount > 0 && newCount % 10 === 0) {
      fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
      fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    }

    await sleep(DELAY);
  }

  // 최종 저장
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  console.log(`\n  ✓ Step 1 완료`);
  console.log(`    신규 수집: ${newCount}개`);
  console.log(`    총 단지: ${Object.keys(index).length}개`);
  console.log(`    총 평형: ${totalPyeong}개`);
  console.log(`    도면 URL: ${totalImages}개`);
  console.log(`    저장: ${INDEX_PATH}`);

  return index;
}

// ─────────────────────────────────────────────
// Step 2: 도면 이미지 다운로드
// ─────────────────────────────────────────────
async function step2_downloadImages() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Step 2: 도면 이미지 다운로드             ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!fs.existsSync(INDEX_PATH)) {
    console.log('  인덱스 파일 없음. Step 1을 먼저 실행하세요.');
    return;
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let total = 0;

  const entries = Object.values(index);
  for (const complex of entries) {
    if (!complex.pyeongList || complex.pyeongList.length === 0) continue;

    for (const pyeong of complex.pyeongList) {
      if (!pyeong.grandPlanUrl) continue;
      total++;

      const filename = `${complex.complexNo}_${pyeong.pyeongNo}_${pyeong.pyeongName}.jpg`;
      const filepath = path.join(IMAGES_DIR, filename);

      if (fs.existsSync(filepath) && !FORCE) {
        skipped++;
        continue;
      }

      try {
        const res = await fetch(pyeong.grandPlanUrl, {
          headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(filepath, buffer);
          downloaded++;
          console.log(`  ✓ ${complex.complexName} ${pyeong.pyeongName}평 (${(buffer.length / 1024).toFixed(0)}KB)`);
        } else {
          failed++;
          console.log(`  ✗ ${complex.complexName} ${pyeong.pyeongName}평 → HTTP ${res.status}`);
        }
      } catch (err) {
        failed++;
        console.log(`  ✗ ${complex.complexName} ${pyeong.pyeongName}평 → ${err.message}`);
      }

      await sleep(500); // 이미지 다운로드는 빠르게
    }
  }

  console.log(`\n  ✓ Step 2 완료`);
  console.log(`    다운로드: ${downloaded}개`);
  console.log(`    스킵: ${skipped}개`);
  console.log(`    실패: ${failed}개`);
  console.log(`    총 도면: ${total}개`);
}

// ─────────────────────────────────────────────
// Step 3: Gemini Vision → ParsedFloorPlan JSON
// ─────────────────────────────────────────────
async function step3_processWithGemini() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Step 3: Gemini Vision → 도면 데이터화    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('  GOOGLE_GEMINI_API_KEY not found');
    return;
  }

  if (!fs.existsSync(INDEX_PATH)) {
    console.log('  인덱스 파일 없음. Step 1을 먼저 실행하세요.');
    return;
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  const ai = new GoogleGenAI({ apiKey });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let total = 0;

  const entries = Object.values(index);
  const processLimit = LIMIT || Infinity;

  for (const complex of entries) {
    if (!complex.pyeongList) continue;

    for (const pyeong of complex.pyeongList) {
      if (!pyeong.grandPlanUrl) continue;
      total++;

      if (processed >= processLimit) continue;

      const imageName = `${complex.complexNo}_${pyeong.pyeongNo}_${pyeong.pyeongName}.jpg`;
      const imagePath = path.join(IMAGES_DIR, imageName);
      const outputName = `${complex.complexNo}_${pyeong.pyeongNo}.json`;
      const outputPath = path.join(OUTPUT_DIR, outputName);

      // 이미 처리됨?
      if (fs.existsSync(outputPath) && !FORCE) {
        skipped++;
        continue;
      }

      // 이미지 존재?
      if (!fs.existsSync(imagePath)) {
        continue;
      }

      console.log(`  [${processed + 1}] ${complex.complexName} ${pyeong.pyeongName}평 (${pyeong.exclusiveArea}㎡)`);

      try {
        const result = await extractFloorPlan(ai, imagePath, pyeong.exclusiveArea, {
          complexNo: complex.complexNo,
          complexName: complex.complexName,
          pyeongName: pyeong.pyeongName,
          exclusiveArea: pyeong.exclusiveArea,
          supplyArea: pyeong.supplyArea,
          roomCnt: pyeong.roomCnt,
          bathroomCnt: pyeong.bathroomCnt,
          address: complex.address,
        });

        if (result) {
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
          console.log(`    → ${result.rooms.length}개 공간, ${result.totalArea}㎡`);
          processed++;
        } else {
          failed++;
          console.log(`    → 추출 실패`);
        }
      } catch (err) {
        failed++;
        console.log(`    → Error: ${err.message}`);
      }

      await sleep(2000); // Gemini API rate limit
    }
  }

  console.log(`\n  ✓ Step 3 완료`);
  console.log(`    처리: ${processed}개`);
  console.log(`    스킵: ${skipped}개`);
  console.log(`    실패: ${failed}개`);
  console.log(`    총 도면: ${total}개`);
}

// ─── Gemini Vision 도면 데이터 추출 ───
async function extractFloorPlan(ai, imagePath, knownArea, meta) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `이 네이버 부동산 아파트 평면도 이미지를 분석해서 정확한 공간 데이터를 JSON으로 반환해줘.

이미지에 적힌 한글 텍스트(거실, 안방, 침실, 주방, 욕실, 현관, 발코니 등)와 공간의 상대적 크기/비율을 정확히 읽어.

반환 형식 (JSON):
{
  "totalArea": ${knownArea || '전용면적 추정값(㎡)'},
  "rooms": [
    {
      "name": "거실",
      "type": "LIVING",
      "widthMm": 4200,
      "heightMm": 5100,
      "area": 21.42,
      "relativeX": 0.35,
      "relativeY": 0.55,
      "material": "wood"
    }
  ]
}

규칙:
- name: 이미지에 적힌 원래 한글 이름 그대로
- type: LIVING/MASTER_BED/BED/KITCHEN/BATHROOM/ENTRANCE/BALCONY/DRESSROOM/UTILITY/CORRIDOR 중 하나
- widthMm/heightMm: 방의 내부 가로/세로 치수 (mm). 이미지의 비례를 보고 정확하게 추정.${knownArea ? ` 전용면적 ${knownArea}㎡ 기준으로 각 방 치수 보정.` : ''}
- area: widthMm × heightMm / 1,000,000 (㎡)
- relativeX/relativeY: 방 중심의 상대 위치 (0~1, 이미지 좌상단 기준)
- material: 욕실/현관/발코니/주방은 "tile", 나머지 "wood"

안방이 가장 큰 침실이어야 해. 침실이 여러 개면 침실1, 침실2로 구분.
모든 방을 빠짐없이 포함해. 복도나 팬트리 같은 작은 공간도.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const data = JSON.parse(text);

  // 면적 보정
  if (knownArea && data.rooms) {
    const sumArea = data.rooms.reduce((s, r) => s + (r.type !== 'BALCONY' ? r.area : 0), 0);
    if (sumArea > 0 && Math.abs(sumArea - knownArea) / knownArea > 0.1) {
      const scale = Math.sqrt(knownArea / sumArea);
      data.rooms.forEach(r => {
        r.widthMm = Math.round(r.widthMm * scale);
        r.heightMm = Math.round(r.heightMm * scale);
        r.area = parseFloat((r.widthMm * r.heightMm / 1_000_000).toFixed(2));
      });
    }
    data.totalArea = knownArea;
  }

  // ParsedFloorPlan 변환
  return convertToFloorPlan(data, meta);
}

function convertToFloorPlan(data, meta) {
  const rooms = data.rooms.map((r, i) => {
    const wM = r.widthMm / 1000;
    const hM = r.heightMm / 1000;
    const area = parseFloat((wM * hM).toFixed(2));
    const cx = r.relativeX * 12;
    const cy = r.relativeY * 10;
    const x = cx - wM / 2;
    const y = cy - hM / 2;

    return {
      id: `room-${i}`,
      type: r.type,
      name: r.name,
      area,
      position: { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)), width: wM, height: hM },
      polygon: [
        { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) },
        { x: parseFloat((x + wM).toFixed(3)), y: parseFloat(y.toFixed(3)) },
        { x: parseFloat((x + wM).toFixed(3)), y: parseFloat((y + hM).toFixed(3)) },
        { x: parseFloat(x.toFixed(3)), y: parseFloat((y + hM).toFixed(3)) },
      ],
      center: { x: parseFloat(cx.toFixed(3)), y: parseFloat(cy.toFixed(3)) },
      material: r.material || 'wood',
    };
  });

  return {
    totalArea: data.totalArea || rooms.reduce((s, r) => s + r.area, 0),
    rooms,
    walls: [],
    doors: [],
    windows: [],
    fixtures: [],
    meta: {
      source: 'naver_land',
      complexNo: meta?.complexNo,
      complexName: meta?.complexName,
      pyeongName: meta?.pyeongName,
      exclusiveArea: meta?.exclusiveArea,
      supplyArea: meta?.supplyArea,
      roomCnt: meta?.roomCnt,
      bathroomCnt: meta?.bathroomCnt,
      address: meta?.address,
      processedAt: new Date().toISOString(),
    },
  };
}

// ─── 메인 ───
(async () => {
  console.log('=== 유성구 아파트 도면 수집 파이프라인 ===');
  console.log(`  Step: ${STEP}, Force: ${FORCE}, Limit: ${LIMIT || 'all'}, Delay: ${DELAY}ms`);

  const startTime = Date.now();

  if (STEP === '1' || STEP === 'all') {
    await step1_collectIndex();
  }

  if (STEP === '2' || STEP === 'all') {
    await step2_downloadImages();
  }

  if (STEP === '3' || STEP === 'all') {
    await step3_processWithGemini();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n총 소요시간: ${elapsed}s`);
  console.log('Done!');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
