/**
 * process-selected.mjs - 선택된 도면만 Pro 모델로 처리
 *
 * 대상: 반석2단지계룡리슈빌 전체 + 네이처뷰 확장형(A1/B1)
 * 파이프라인: clean → mirror(clean) → dimensions
 * 모델: gemini-3-pro-image-preview (Pro only, no Flash fallback)
 *
 * 사용법: node scripts/floorplan-pipeline/process-selected.mjs
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
- 워터마크 (NAVER, BUSINESS PLATFORM, NBP 등 모든 로고/텍스트)
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

// ─── 대상 도면 ───

const SAVED_PLANS = path.join(import.meta.dirname, 'saved_plans', '대전유성구');

const TARGETS = [
  // 반석2단지계룡리슈빌 - 전체 3타입
  { complex: '반석2단지계룡리슈빌', type: '130_97.36m2' },
  { complex: '반석2단지계룡리슈빌', type: '162_132.31m2' },
  { complex: '반석2단지계룡리슈빌', type: '189_150.01m2' },
  // 네이처뷰 - 확장형(A1/B1)만
  { complex: '네이처뷰', type: '74A1_51.88m2' },
  { complex: '네이처뷰', type: '85A1_59.69m2' },
  { complex: '네이처뷰', type: '85B1_59.99m2' },
];

// ─── Gemini Pro 호출 ───

// Pro only (유료 플랜)
const MODELS = [
  'gemini-3-pro-image-preview',   // Pro (paid tier)
];
const MAX_RETRIES = 5;
const RATE_LIMIT_WAIT = 30000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(imageBuffer, mimeType, prompt) {
  const base64Image = imageBuffer.toString('base64');

  for (const modelName of MODELS) {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
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
              return { data: Buffer.from(part.inlineData.data, 'base64'), model: modelName };
            }
          }
        }
        console.log(`    No image in response from ${modelName}`);
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('limit: 0') || msg.includes('DAILY')) {
          console.log(`    ${modelName}: daily quota exhausted, trying next model...`);
          break; // skip retries, go to next model
        }
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.log(`    ${modelName}: rate limited (retry ${retry + 1}/${MAX_RETRIES}), waiting ${RATE_LIMIT_WAIT / 1000}s...`);
          await sleep(RATE_LIMIT_WAIT);
          continue;
        }
        console.log(`    ${modelName} error: ${msg.slice(0, 150)}`);
        break; // non-retryable error, try next model
      }
    }
  }
  return null;
}

// ─── 메인 ───

async function main() {
  console.log('============================================================');
  console.log('  Pro 모델 도면 처리 (Clean + Mirror + Dimensions)');
  console.log(`  Models: ${MODELS.join(', ')}`);
  console.log(`  Targets: ${TARGETS.length} plans`);
  console.log('============================================================\n');

  const startTime = Date.now();
  let cleanOk = 0, cleanFail = 0, dimOk = 0, dimFail = 0, mirrorOk = 0;

  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const planDir = path.join(SAVED_PLANS, t.complex, t.type);
    const originalPath = path.join(planDir, 'original.jpg');
    const cleanPath = path.join(planDir, 'clean.png');
    const cleanMirrorPath = path.join(planDir, 'clean_mirror.png');
    const finalPath = path.join(planDir, 'final.png');
    const finalMirrorPath = path.join(planDir, 'final_mirror.png');

    const label = `${t.complex}/${t.type}`;
    const progress = `[${i + 1}/${TARGETS.length}]`;

    if (!fs.existsSync(originalPath)) {
      console.log(`${progress} SKIP (no original): ${label}`);
      continue;
    }

    // Check if already done
    const hasClean = fs.existsSync(cleanPath) && fs.statSync(cleanPath).size > 1000;
    const hasFinal = fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1000;
    const hasMirror = fs.existsSync(cleanMirrorPath) && fs.statSync(cleanMirrorPath).size > 1000;

    // Step 1: Clean
    if (!hasClean) {
      console.log(`${progress} CLEAN: ${label}`);
      const imageBuffer = fs.readFileSync(originalPath);
      const result = await callGemini(imageBuffer, 'image/jpeg', CLEAN_PROMPT);
      if (result) {
        fs.writeFileSync(cleanPath, result.data);
        cleanOk++;
        console.log(`  [OK] ${result.model} (${(result.data.length / 1024).toFixed(0)}KB)`);
      } else {
        cleanFail++;
        console.log(`  [FAIL] Clean failed`);
        continue;
      }
      await sleep(15000); // 15s rate limit buffer between calls
    } else {
      console.log(`${progress} CLEAN SKIP (exists): ${label}`);
    }

    // Step 2: Mirror (clean only - no text to flip backwards)
    if (!hasMirror) {
      try {
        const cleanBuf = await sharp(cleanPath).flop().png().toBuffer();
        fs.writeFileSync(cleanMirrorPath, cleanBuf);
        mirrorOk++;
        console.log(`  [MIRROR] clean_mirror: ${(cleanBuf.length / 1024).toFixed(0)}KB`);
      } catch (err) {
        console.log(`  [MIRROR FAIL] ${err.message}`);
      }
    }

    // Step 3: Dimensions (on clean, NOT on mirror)
    if (!hasFinal) {
      console.log(`${progress} DIM:   ${label}`);
      const cleanBuffer = fs.readFileSync(cleanPath);
      const dimResult = await callGemini(cleanBuffer, 'image/png', DIM_PROMPT);
      if (dimResult) {
        fs.writeFileSync(finalPath, dimResult.data);
        dimOk++;
        console.log(`  [OK] ${dimResult.model} (${(dimResult.data.length / 1024).toFixed(0)}KB)`);
      } else {
        dimFail++;
        console.log(`  [FAIL] Dimensions failed`);
      }
      await sleep(15000);
    } else {
      console.log(`${progress} DIM SKIP (exists): ${label}`);
    }

    // Step 4: Mirror final (dimensions version) - mirror has backwards text
    // but user may still want it for comparison
    if (hasFinal || fs.existsSync(finalPath)) {
      if (!fs.existsSync(finalMirrorPath) || fs.statSync(finalMirrorPath).size < 1000) {
        try {
          const finalBuf = await sharp(finalPath).flop().png().toBuffer();
          fs.writeFileSync(finalMirrorPath, finalBuf);
          console.log(`  [MIRROR] final_mirror: ${(finalBuf.length / 1024).toFixed(0)}KB`);
        } catch (err) {
          console.log(`  [MIRROR FAIL] final: ${err.message}`);
        }
      }
    }

    console.log('');
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('============================================================');
  console.log(`  Complete! (${elapsed} min)`);
  console.log(`  Clean:  OK ${cleanOk} / FAIL ${cleanFail}`);
  console.log(`  Dim:    OK ${dimOk} / FAIL ${dimFail}`);
  console.log(`  Mirror: OK ${mirrorOk}`);
  console.log('============================================================');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
