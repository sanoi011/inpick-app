/**
 * 클린된 도면에 Gemini로 내부 치수선만 추가
 *
 * 사용법:
 *   node scripts/add-dimensions.mjs [input] [output]
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// .env.local 로드
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
const inputPath = args[0] ? path.resolve(BASE, args[0]) : null;
const outputPath = args[1] ? path.resolve(BASE, args[1]) : null;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/add-dimensions.mjs [input.png] [output.png]');
  process.exit(1);
}

console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputPath}`);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const PROMPT = `이 깨끗한 아파트 평면도에 내부 치수선만 추가해줘:

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

async function addDimensions() {
  console.log('\n=== Adding dimensions ===');
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
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: PROMPT },
          ],
        }],
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

addDimensions().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
