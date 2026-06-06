/**
 * batch-process.mjs - 전체 도면 4단계 파이프라인
 *
 * Step 1: Gemini Pro 클린 (original.jpg → clean.png)
 * Step 2: 좌우 반전 (clean.png → clean_mirror.png) [sharp.flop]
 * Step 3: Gemini Pro 치수 추가 (clean.png → final.png)
 * Step 4: Gemini Pro 치수 추가 (clean_mirror.png → final_mirror.png)
 *
 * 핵심: 치수는 미러 후 각각 추가해야 텍스트가 정방향으로 표시됨
 * (sharp.flop(final)하면 치수 텍스트가 거꾸로 됨)
 *
 * 중단 후 재실행하면 이미 처리된 파일은 건너뜀
 *
 * 사용법:
 *   node scripts/floorplan-pipeline/batch-process.mjs
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

// ─── .env.local 로드 ───
const BASE = path.resolve(import.meta.dirname, '..', '..');
const envPath = path.join(BASE, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
  }
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ─── 프롬프트 ───

const CLEAN_PROMPT = `이 아파트 평면도를 최신 신축 아파트 단위세대 실시설계 도면 스타일로 완전히 다시 그려줘.

【완전히 제거】
- 모든 텍스트/글자 (방 이름, 면적, 치수 숫자 전부)
- 모든 설비 (변기, 세면대, 욕조, 싱크대, 가스레인지, 세탁기)
- 모든 가구 (침대, 소파, 테이블, 의자, 옷장, 신발장)
- 워터마크 (NAVER, BUSINESS PLATFORM 등)
- 기존 바닥색/패턴 전부 제거
- 공용 면적 (엘리베이터 홀, 계단실, 복도 등 세대 밖 공간)은 완전히 제거하고 해당 영역은 흰색 배경으로 처리. 단위세대(전용면적) 내부만 남겨줘.

【벽체】
- 구조벽(외벽): 두꺼운 검은 실선 (굵기 차이로 내벽과 구분)
- 내벽: 약간 얇은 검은 실선
- 벽체 내부는 검은색으로 채워서 솔리드하게 표현

【문 - 최신 건축도면 표기법】
- 여닫이문: 90도 호(arc) + 문짝 선 (열리는 방향 표시)
- 미닫이문: 벽 안에 슬라이딩 표시 (점선 또는 화살표)
- 현관문: 다른 문보다 두꺼운 표현

【창문 - 최신 건축도면 표기법 + 열림방향】
- 창문: 이중 평행선 사이에 유리선 표시
- 모든 창문에 열리는 방향 화살표(▶ 또는 →) 표시
- 프로젝트창(화장실): 작은 화살표로 밖으로 열림 표시
- 거실 대형창: 미서기창 표시 (화살표로 슬라이딩 방향)

【바닥 자재 질감 (고해상도 리얼 텍스처)】
- 거실/방/침실/주방: 고급 우드 마루 텍스처 (따뜻한 베이지/내추럴 우드톤, 나뭇결이 보이는 리얼한 원목 마루 느낌)
- 욕실/화장실: 밝은 라이트 그레이 타일 텍스처 (300×300 정사각 타일, 줄눈 표현)
- 현관: 밝은 그레이 타일 텍스처 (포인트 타일 느낌)
- 발코니/테라스: 밝은 그레이톤 타일 텍스처
- 자재 질감은 사실적이고 고급스럽게, 하지만 벽선보다는 밝게 표현

【스타일】
- 네이버 부동산이나 아키스케치와는 확실히 다른 프리미엄 느낌
- 고해상도, 정밀한 스케일, 선명한 벽선
- 고급 분양 카탈로그에 들어가는 단위세대 평면도 수준
- 자재 질감이 살아있는 고퀄리티 렌더링`;

const DIM_PROMPT = `이 깨끗한 아파트 평면도에 내부 치수선만 추가해줘:

각 방(실) 내부에 가로/세로 치수선을 표시:
- 거실, 안방, 침실, 주방, 욕실, 현관, 발코니, 드레스룸 등 모든 실
- 각 방의 내벽 사이 거리를 mm 단위로 표시 (예: 3,600)
- 치수선은 방 내부 벽면 가장자리에 가늘고 얇은 선으로 표시
- 양 끝에 작은 틱마크(|)
- 숫자는 얇고 세련된 폰트, 회색(#555) 또는 진한 회색
- 가로 치수는 방 상단 또는 하단, 세로 치수는 방 좌측 또는 우측에 배치

중요 규칙:
- 벽선, 문 아크, 창문 표시는 절대 변경하지 마
- 배경은 흰색 그대로 유지
- 공간 이름은 표시하지 마. 치수만 표시해.
- 건축 실시설계 도면 느낌으로`;

// ─── 모델 (Pro만 사용) ───

const MODEL = 'gemini-3-pro-image-preview';

const MAX_RETRIES = 5;
const RATE_LIMIT_WAIT = 30000; // 30초 대기 후 재시도
const INTER_CALL_DELAY = 15000; // Gemini 호출 간 15초 대기 (rate limit 방지)

// ─── Gemini Pro 호출 (재시도 포함) ───

async function callGeminiPro(imageBuffer, mimeType, prompt) {
  const base64Image = imageBuffer.toString('base64');

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: prompt },
          ],
        }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      });

      if (response.candidates && response.candidates[0]) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.log(`    Rate limited (retry ${retry + 1}/${MAX_RETRIES}), waiting ${RATE_LIMIT_WAIT / 1000}s...`);
        await sleep(RATE_LIMIT_WAIT);
        continue;
      }
      console.log(`    Error: ${msg.slice(0, 150)}`);
      break;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 좌우 반전 (sharp) ───

async function mirrorImage(inputPath, outputPath) {
  const buffer = await sharp(inputPath).flop().png().toBuffer();
  fs.writeFileSync(outputPath, buffer);
  return buffer.length;
}

// ─── 파일 스캔 ───

function findAllPlans(savedPlansDir) {
  const tasks = [];

  if (!fs.existsSync(savedPlansDir)) {
    console.error(`Directory not found: ${savedPlansDir}`);
    return tasks;
  }

  // saved_plans/대전유성구/{complexName}/{pyeongId}/original.jpg
  const regionDir = path.join(savedPlansDir, '대전유성구');
  if (!fs.existsSync(regionDir)) return tasks;

  for (const complexName of fs.readdirSync(regionDir)) {
    const complexDir = path.join(regionDir, complexName);
    if (!fs.statSync(complexDir).isDirectory()) continue;

    for (const pyeongId of fs.readdirSync(complexDir)) {
      const planDir = path.join(complexDir, pyeongId);
      if (!fs.statSync(planDir).isDirectory()) continue;

      const originalPath = path.join(planDir, 'original.jpg');
      if (!fs.existsSync(originalPath)) continue;

      tasks.push({
        complexName,
        pyeongId,
        planDir,
        originalPath,
        cleanPath: path.join(planDir, 'clean.png'),
        finalPath: path.join(planDir, 'final.png'),
        cleanMirrorPath: path.join(planDir, 'clean_mirror.png'),
        finalMirrorPath: path.join(planDir, 'final_mirror.png'),
      });
    }
  }

  return tasks;
}

// ─── 메인 ───

async function main() {
  const savedPlansDir = path.join(import.meta.dirname, 'saved_plans');
  const tasks = findAllPlans(savedPlansDir);

  console.log('============================================================');
  console.log('  도면 4단계 파이프라인 (Pro Only)');
  console.log('  Clean → Mirror(clean) → Dim(clean) → Dim(mirror)');
  console.log(`  Model: ${MODEL}`);
  console.log('============================================================');
  console.log(`  Total plans: ${tasks.length}`);

  // 상태 확인
  let needClean = 0;
  let needMirror = 0;
  let needDim = 0;
  let needDimMirror = 0;
  let done = 0;

  for (const t of tasks) {
    const hasClean = fs.existsSync(t.cleanPath) && fs.statSync(t.cleanPath).size > 1000;
    const hasCleanMirror = fs.existsSync(t.cleanMirrorPath) && fs.statSync(t.cleanMirrorPath).size > 1000;
    const hasFinal = fs.existsSync(t.finalPath) && fs.statSync(t.finalPath).size > 1000;
    const hasFinalMirror = fs.existsSync(t.finalMirrorPath) && fs.statSync(t.finalMirrorPath).size > 1000;

    if (hasFinal && hasFinalMirror) { done++; }
    else if (!hasClean) { needClean++; }
    else if (!hasCleanMirror) { needMirror++; }
    else if (!hasFinal) { needDim++; }
    else { needDimMirror++; }
  }

  console.log(`  Done: ${done} | Clean: ${needClean} | Mirror: ${needMirror} | Dim: ${needDim} | DimMirror: ${needDimMirror}`);
  console.log('============================================================\n');

  let processed = 0;
  let cleanOk = 0, cleanFail = 0;
  let dimOk = 0, dimFail = 0;
  let dimMirrorOk = 0, dimMirrorFail = 0;
  let mirrorOk = 0;
  const startTime = Date.now();

  const logPath = path.join(import.meta.dirname, 'batch-results.json');
  const results = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const label = `${t.complexName}/${t.pyeongId}`;
    const progress = `[${i + 1}/${tasks.length}]`;

    const hasClean = fs.existsSync(t.cleanPath) && fs.statSync(t.cleanPath).size > 1000;
    const hasCleanMirror = fs.existsSync(t.cleanMirrorPath) && fs.statSync(t.cleanMirrorPath).size > 1000;
    const hasFinal = fs.existsSync(t.finalPath) && fs.statSync(t.finalPath).size > 1000;
    const hasFinalMirror = fs.existsSync(t.finalMirrorPath) && fs.statSync(t.finalMirrorPath).size > 1000;

    if (hasFinal && hasFinalMirror) continue;

    // Step 1: Clean (original → Gemini Pro → clean.png)
    if (!hasClean) {
      console.log(`${progress} STEP1 CLEAN: ${label}`);
      const imageBuffer = fs.readFileSync(t.originalPath);
      const result = await callGeminiPro(imageBuffer, 'image/jpeg', CLEAN_PROMPT);
      if (result) {
        fs.writeFileSync(t.cleanPath, result);
        cleanOk++;
        console.log(`  [OK] ${(result.length / 1024).toFixed(0)}KB`);
      } else {
        cleanFail++;
        console.log(`  [FAIL]`);
        results.push({ label, step: 'clean', success: false });
        continue;
      }
      await sleep(INTER_CALL_DELAY);
    }

    // Step 2: Mirror clean (clean.png → sharp.flop → clean_mirror.png)
    if (!hasCleanMirror) {
      try {
        const size = await mirrorImage(t.cleanPath, t.cleanMirrorPath);
        mirrorOk++;
        console.log(`${progress} STEP2 MIRROR: ${label} → ${(size / 1024).toFixed(0)}KB`);
      } catch (err) {
        console.log(`${progress} STEP2 MIRROR FAIL: ${err.message}`);
        continue;
      }
    }

    // Step 3: Dim on clean (clean.png → Gemini Pro → final.png)
    if (!hasFinal) {
      console.log(`${progress} STEP3 DIM: ${label}`);
      const cleanBuffer = fs.readFileSync(t.cleanPath);
      const result = await callGeminiPro(cleanBuffer, 'image/png', DIM_PROMPT);
      if (result) {
        fs.writeFileSync(t.finalPath, result);
        dimOk++;
        console.log(`  [OK] ${(result.length / 1024).toFixed(0)}KB`);
      } else {
        dimFail++;
        console.log(`  [FAIL]`);
        results.push({ label, step: 'dim', success: false });
      }
      await sleep(INTER_CALL_DELAY);
    }

    // Step 4: Dim on mirror (clean_mirror.png → Gemini Pro → final_mirror.png)
    if (!hasFinalMirror) {
      console.log(`${progress} STEP4 DIM MIRROR: ${label}`);
      const mirrorBuffer = fs.readFileSync(t.cleanMirrorPath);
      const result = await callGeminiPro(mirrorBuffer, 'image/png', DIM_PROMPT);
      if (result) {
        fs.writeFileSync(t.finalMirrorPath, result);
        dimMirrorOk++;
        console.log(`  [OK] ${(result.length / 1024).toFixed(0)}KB`);
      } else {
        dimMirrorFail++;
        console.log(`  [FAIL]`);
        results.push({ label, step: 'dim_mirror', success: false });
      }
      await sleep(INTER_CALL_DELAY);
    }

    processed++;
    results.push({ label, step: 'done', success: true });

    // 매 10개마다 중간 저장
    if (processed % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`\n--- Progress: ${processed} processed, ${elapsed}min elapsed ---\n`);
      fs.writeFileSync(logPath, JSON.stringify({ total: tasks.length, processed, cleanOk, cleanFail, dimOk, dimFail, dimMirrorOk, dimMirrorFail, results }, null, 2));
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  fs.writeFileSync(logPath, JSON.stringify({
    total: tasks.length, processed, cleanOk, cleanFail, dimOk, dimFail, dimMirrorOk, dimMirrorFail, elapsed_min: totalElapsed, results,
  }, null, 2));

  console.log('\n============================================================');
  console.log(`  Pipeline complete! (${totalElapsed} min)`);
  console.log(`  Clean:      OK ${cleanOk} / FAIL ${cleanFail}`);
  console.log(`  Mirror:     OK ${mirrorOk}`);
  console.log(`  Dim:        OK ${dimOk} / FAIL ${dimFail}`);
  console.log(`  Dim Mirror: OK ${dimMirrorOk} / FAIL ${dimMirrorFail}`);
  console.log(`  Results: ${logPath}`);
  console.log('============================================================');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
