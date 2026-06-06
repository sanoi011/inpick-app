/**
 * Gemini 원본 도면 → 클리닝 + 공간명/면적/치수선 한번에 처리
 *
 * 사용법:
 *   node scripts/clean-and-annotate.mjs [input] [output]
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
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_GEMINI_API_KEY not found');
  process.exit(1);
}

const BASE = process.cwd();
const args = process.argv.slice(2);
const inputPath = args[0]
  ? path.resolve(BASE, args[0])
  : path.join(BASE, 'drawings', 'naver', 'hoban-3bl-116b.jpg');
const outputPath = args[1]
  ? path.resolve(BASE, args[1])
  : path.join(BASE, 'public', 'floorplans', 'images', 'hoban-3bl-116b-final.png');

console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputPath}`);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const PROMPT = `이 아파트 평면도를 깨끗한 건축 도면으로 변환해줘:

【완전히 제거】
- 욕실의 변기/욕조/세면대 그림 전부
- 주방의 싱크대/가스레인지 그림 전부
- 모든 가구, 바닥색, 바닥 패턴, 격자/해칭 무늬
- 워터마크, 기존 텍스트 전부

【유지】
- 벽선 (검은 굵은 선)
- 문 아크 (90도 곡선)
- 창문 표시 (이중선)

【추가 - 내부 치수선】
각 방(실) 내부에 가로/세로 치수선을 표시해줘:
- 거실, 안방, 침실, 주방, 욕실, 현관, 발코니, 드레스룸 등 모든 실
- 각 방의 내벽 사이 거리를 mm 단위로 표시 (예: 3,600 × 4,200)
- 치수선은 방 내부 벽면 가장자리에 가늘고 얇은 선으로 표시
- 양 끝에 작은 틱마크(|)
- 숫자는 얇고 세련된 폰트, 회색(#555) 또는 진한 회색
- 가로 치수는 방 상단 또는 하단, 세로 치수는 방 좌측 또는 우측에 배치

공간 이름(거실, 안방 등)은 표시하지 마. 치수만 표시해.

【스타일】
- 흰색 배경, 검은 벽선
- 치수선과 숫자는 가늘고 세련되게 (thin, elegant)
- 건축 실시설계 도면 느낌`;

async function cleanAndAnnotate() {
  console.log('\n=== Clean + Annotate (one-shot) ===');
  const startTime = Date.now();

  const imageBuffer = fs.readFileSync(inputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = inputPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const models = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
  ];

  let result = null;

  for (const modelName of models) {
    console.log(`  Trying model: ${modelName}`);
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: PROMPT },
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (part.text) {
            console.log(`  Response: ${part.text.substring(0, 150)}...`);
          }
        }
        for (const part of parts) {
          if (part.inlineData) {
            result = { imageData: part.inlineData, model: modelName };
            break;
          }
        }
      }

      if (result) break;
      console.log(`  No image from ${modelName}`);
    } catch (err) {
      console.log(`  ${modelName} failed: ${err.message}`);
    }
  }

  if (!result) {
    console.error('\nAll models failed.');
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! Model: ${result.model}, Time: ${elapsed}s`);

  const outputBuffer = Buffer.from(result.imageData.data, 'base64');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outputBuffer);
  console.log(`Saved: ${outputPath} (${(outputBuffer.length / 1024).toFixed(0)}KB)`);
}

cleanAndAnnotate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
