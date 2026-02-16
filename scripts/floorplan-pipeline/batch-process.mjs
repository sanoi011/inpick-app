/**
 * batch-process.mjs - 전체 도면 3단계 파이프라인
 *
 * Step 1: Gemini 클린 (원본 → clean.png)
 * Step 2: Gemini 치수 추가 (clean.png → final.png)
 * Step 3: 좌우 반전 자동 생성 (clean.png → clean_mirror.png, final.png → final_mirror.png)
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

// ─── 모델 ───

const CLEAN_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
];

const DIM_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
];

// ─── Gemini 호출 ───

async function callGemini(models, imageBuffer, mimeType, prompt) {
  const base64Image = imageBuffer.toString('base64');

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
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
            return {
              imageData: Buffer.from(part.inlineData.data, 'base64'),
              model: modelName,
            };
          }
        }
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.log(`    Rate limited on ${modelName}, waiting 10s...`);
        await sleep(10000);
      }
      // try next model
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 좌우 반전 (canvas) ───

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
  console.log('  도면 3단계 파이프라인 (Clean + Dimensions + Mirror)');
  console.log('============================================================');
  console.log(`  Total plans: ${tasks.length} (× 2 with mirrors = ${tasks.length * 2})`);

  // 상태 확인
  let needClean = 0;
  let needDim = 0;
  let needMirror = 0;
  let done = 0;

  for (const t of tasks) {
    const hasClean = fs.existsSync(t.cleanPath) && fs.statSync(t.cleanPath).size > 1000;
    const hasFinal = fs.existsSync(t.finalPath) && fs.statSync(t.finalPath).size > 1000;
    const hasMirror = fs.existsSync(t.finalMirrorPath) && fs.statSync(t.finalMirrorPath).size > 1000;
    if (hasFinal && hasMirror) { done++; }
    else if (hasFinal) { needMirror++; }
    else if (hasClean) { needDim++; }
    else { needClean++; }
  }

  console.log(`  Done: ${done} | Need clean: ${needClean} | Need dim: ${needDim} | Need mirror: ${needMirror}`);
  console.log('============================================================\n');

  let processed = 0;
  let cleanOk = 0;
  let cleanFail = 0;
  let dimOk = 0;
  let dimFail = 0;
  let mirrorOk = 0;
  const startTime = Date.now();

  // 결과 로그
  const logPath = path.join(import.meta.dirname, 'batch-results.json');
  const results = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const label = `${t.complexName}/${t.pyeongId}`;
    const hasClean = fs.existsSync(t.cleanPath) && fs.statSync(t.cleanPath).size > 1000;
    const hasFinal = fs.existsSync(t.finalPath) && fs.statSync(t.finalPath).size > 1000;
    const hasMirror = fs.existsSync(t.finalMirrorPath) && fs.statSync(t.finalMirrorPath).size > 1000;

    if (hasFinal && hasMirror) {
      // already fully done (original + mirror)
      continue;
    }

    const progress = `[${i + 1}/${tasks.length}]`;

    // Step 1: Clean
    if (!hasClean) {
      console.log(`${progress} CLEAN: ${label}`);
      const imageBuffer = fs.readFileSync(t.originalPath);
      const mimeType = 'image/jpeg';

      const result = await callGemini(CLEAN_MODELS, imageBuffer, mimeType, CLEAN_PROMPT);
      if (result) {
        fs.writeFileSync(t.cleanPath, result.imageData);
        cleanOk++;
        console.log(`  [OK] ${result.model} (${(result.imageData.length / 1024).toFixed(0)}KB)`);
      } else {
        cleanFail++;
        console.log(`  [FAIL] All models failed`);
        results.push({ label, step: 'clean', success: false });
        continue; // skip dim if clean failed
      }

      await sleep(2000);
    }

    // Step 2: Dimensions
    console.log(`${progress} DIM:   ${label}`);
    const cleanBuffer = fs.readFileSync(t.cleanPath);

    const dimResult = await callGemini(DIM_MODELS, cleanBuffer, 'image/png', DIM_PROMPT);
    if (dimResult) {
      fs.writeFileSync(t.finalPath, dimResult.imageData);
      dimOk++;
      console.log(`  [OK] ${dimResult.model} (${(dimResult.imageData.length / 1024).toFixed(0)}KB)`);
      results.push({ label, step: 'done', success: true });
    } else {
      dimFail++;
      console.log(`  [FAIL] Dimension failed`);
      results.push({ label, step: 'dim', success: false });
      processed++;
      await sleep(2000);
      continue;
    }

    // Step 3: Mirror (좌우 반전) - Gemini 호출 없이 즉시 처리
    if (!hasMirror) {
      try {
        const cleanMirrorSize = await mirrorImage(t.cleanPath, t.cleanMirrorPath);
        const finalMirrorSize = await mirrorImage(t.finalPath, t.finalMirrorPath);
        mirrorOk++;
        console.log(`  [MIRROR] clean_mirror (${(cleanMirrorSize / 1024).toFixed(0)}KB) + final_mirror (${(finalMirrorSize / 1024).toFixed(0)}KB)`);
      } catch (err) {
        console.log(`  [MIRROR FAIL] ${err.message}`);
      }
    }

    processed++;
    await sleep(2000);

    // 매 50개마다 중간 저장
    if (processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`\n--- Progress: ${processed} processed, ${elapsed}min elapsed ---\n`);
      fs.writeFileSync(logPath, JSON.stringify({
        total: tasks.length,
        processed,
        cleanOk,
        cleanFail,
        dimOk,
        dimFail,
        results,
      }, null, 2));
    }
  }

  // 최종 결과 저장
  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  fs.writeFileSync(logPath, JSON.stringify({
    total: tasks.length,
    processed,
    cleanOk,
    cleanFail,
    dimOk,
    dimFail,
    elapsed_min: totalElapsed,
    results,
  }, null, 2));

  console.log('\n============================================================');
  console.log(`  Pipeline complete! (${totalElapsed} min)`);
  console.log(`  Clean:  OK ${cleanOk} / FAIL ${cleanFail}`);
  console.log(`  Dim:    OK ${dimOk} / FAIL ${dimFail}`);
  console.log(`  Mirror: OK ${mirrorOk}`);
  console.log(`  Results: ${logPath}`);
  console.log('============================================================');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
