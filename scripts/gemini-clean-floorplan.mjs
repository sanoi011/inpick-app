/**
 * Gemini Diffusion Model로 도면에서 설비/텍스트 제거
 *
 * 사용법:
 *   node scripts/gemini-clean-floorplan.mjs [input] [output]
 *
 * 예시:
 *   node scripts/gemini-clean-floorplan.mjs drawings/naver/hoban-3bl-115a.jpg public/floorplans/images/hoban-3bl-115a-gemini.png
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
console.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND'}`);
if (!apiKey) {
  console.error('GOOGLE_GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

// ─── 설정 ───
const BASE = process.cwd();
const args = process.argv.slice(2);
const inputPath = args[0]
  ? path.resolve(BASE, args[0])
  : path.join(BASE, 'drawings', 'naver', 'hoban-3bl-115a.jpg');
const outputPath = args[1]
  ? path.resolve(BASE, args[1])
  : path.join(BASE, 'public', 'floorplans', 'images', 'hoban-3bl-115a-gemini.png');

console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputPath}`);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

// ─── Gemini 클라이언트 ───
const ai = new GoogleGenAI({ apiKey });

// 프롬프트: 클린 + 건축도면 표기법 + 고급 자재 질감
const PROMPT_PASS1 = `이 아파트 평면도를 최신 신축 아파트 단위세대 실시설계 도면 스타일로 완전히 다시 그려줘.

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

async function generateWithModel(modelName, base64Image, mimeType, prompt) {
  console.log(`  Trying model: ${modelName}`);

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  if (response.candidates && response.candidates[0]) {
    const parts = response.candidates[0].content.parts;

    // 텍스트 응답 출력
    for (const part of parts) {
      if (part.text) {
        console.log(`  Model response: ${part.text.substring(0, 100)}...`);
      }
    }

    for (const part of parts) {
      if (part.inlineData) {
        return { imageData: part.inlineData, model: modelName };
      }
    }
  }

  console.log(`  No image in response from ${modelName}`);
  return null;
}

async function cleanFloorPlan() {
  console.log('\n=== Pass 1: Initial cleaning ===');
  const startTime = Date.now();

  const imageBuffer = fs.readFileSync(inputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = inputPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // 이미지 생성 지원 모델 (Pro 먼저!)
  const models = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp-image-generation',
  ];

  let pass1Result = null;

  for (const modelName of models) {
    try {
      pass1Result = await generateWithModel(modelName, base64Image, mimeType, PROMPT_PASS1);
      if (pass1Result) break;
    } catch (err) {
      console.log(`  ${modelName} failed: ${err.message}`);
    }
  }

  if (!pass1Result) {
    console.error('\nAll models failed on Pass 1.');
    process.exit(1);
  }

  const pass1Time = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPass 1 done! Model: ${pass1Result.model}, Time: ${pass1Time}s`);

  // 저장 (Pass 1만 사용 - Pass 2는 벽선 파괴하므로 제거)
  const outputBuffer = Buffer.from(pass1Result.imageData.data, 'base64');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outputBuffer);
  console.log(`Saved: ${outputPath} (${(outputBuffer.length / 1024).toFixed(0)}KB)`);
}

cleanFloorPlan().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
