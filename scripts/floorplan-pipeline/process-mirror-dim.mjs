/**
 * process-mirror-dim.mjs - clean_mirror.png에 Gemini Pro로 치수 추가
 *
 * clean_mirror.png → (Gemini Pro 치수) → final_mirror.png
 * 이렇게 하면 치수 텍스트가 정상 방향으로 표시됨
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

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

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

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

const SAVED_PLANS = path.join(import.meta.dirname, 'saved_plans', '대전유성구');

const TARGETS = [
  { complex: '반석2단지계룡리슈빌', type: '130_97.36m2' },
  { complex: '반석2단지계룡리슈빌', type: '162_132.31m2' },
  { complex: '반석2단지계룡리슈빌', type: '189_150.01m2' },
  { complex: '네이처뷰', type: '74A1_51.88m2' },
  { complex: '네이처뷰', type: '85A1_59.69m2' },
  { complex: '네이처뷰', type: '85B1_59.99m2' },
];

const MODEL = 'gemini-3-pro-image-preview';
const MAX_RETRIES = 5;
const RATE_LIMIT_WAIT = 30000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function main() {
  console.log('============================================================');
  console.log('  미러 도면 치수 추가 (clean_mirror → final_mirror)');
  console.log(`  Model: ${MODEL}`);
  console.log('============================================================\n');

  const startTime = Date.now();
  let ok = 0, fail = 0;

  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const planDir = path.join(SAVED_PLANS, t.complex, t.type);
    const cleanMirrorPath = path.join(planDir, 'clean_mirror.png');
    const finalMirrorPath = path.join(planDir, 'final_mirror.png');
    const label = `${t.complex}/${t.type}`;
    const progress = `[${i + 1}/${TARGETS.length}]`;

    if (!fs.existsSync(cleanMirrorPath)) {
      console.log(`${progress} SKIP (no clean_mirror): ${label}`);
      continue;
    }

    if (fs.existsSync(finalMirrorPath) && fs.statSync(finalMirrorPath).size > 1000) {
      console.log(`${progress} SKIP (exists): ${label}`);
      continue;
    }

    console.log(`${progress} DIM MIRROR: ${label}`);
    const mirrorBuffer = fs.readFileSync(cleanMirrorPath);
    const result = await callGeminiPro(mirrorBuffer, 'image/png', DIM_PROMPT);

    if (result) {
      fs.writeFileSync(finalMirrorPath, result);
      ok++;
      console.log(`  [OK] ${(result.length / 1024).toFixed(0)}KB`);
    } else {
      fail++;
      console.log(`  [FAIL]`);
    }

    await sleep(15000);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n============================================================`);
  console.log(`  Complete! (${elapsed} min) OK: ${ok} / FAIL: ${fail}`);
  console.log('============================================================');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
