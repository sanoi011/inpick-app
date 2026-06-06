/**
 * Gemini로 깨끗한 도면에 공간명 + 면적 + 치수선 추가
 *
 * 사용법:
 *   node scripts/annotate-floorplan.mjs [input] [output]
 *
 * 예시:
 *   node scripts/annotate-floorplan.mjs public/floorplans/images/hoban-3bl-116b-gemini.png public/floorplans/images/hoban-3bl-116b-annotated.png
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
  console.error('GOOGLE_GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

// ─── 설정 ───
const BASE = process.cwd();
const args = process.argv.slice(2);
const inputPath = args[0]
  ? path.resolve(BASE, args[0])
  : path.join(BASE, 'public', 'floorplans', 'images', 'hoban-3bl-116b-gemini.png');
const outputPath = args[1]
  ? path.resolve(BASE, args[1])
  : inputPath.replace('-gemini.png', '-annotated.png');

console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputPath}`);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const PROMPT = `이 깨끗한 아파트 평면도 이미지에 다음을 추가해줘:

1. **공간 이름**: 각 방의 중앙에 한글로 공간 이름 표시
   - 거실, 안방, 침실, 주방, 욕실, 현관, 발코니, 드레스룸, 다용도실, 복도 등
   - 글자는 검은색, 깔끔한 고딕체, 적당한 크기

2. **면적 표시**: 공간 이름 바로 아래에 면적 표시
   - 형식: "XX.0㎡" (정수 + .0)
   - 면적은 방의 크기를 보고 합리적으로 추정
   - 소수점은 .0으로 통일

3. **외곽 치수선**: 도면 바깥에 치수선 추가
   - 가로/세로 주요 치수를 mm 단위로 표시 (예: 3,600 / 4,200)
   - 치수선 스타일: 가는 선 + 양쪽 화살표 또는 틱마크 + 숫자
   - 도면 외부에 깔끔하게 배치

중요 규칙:
- 벽선, 문 아크, 창문 표시는 절대 변경하지 마
- 배경은 흰색 그대로 유지
- 전체적으로 건축 도면 느낌의 깔끔한 스타일로`;

async function annotateFloorPlan() {
  console.log('\n=== Annotating floor plan ===');
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

annotateFloorPlan().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
