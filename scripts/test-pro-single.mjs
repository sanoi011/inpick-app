/**
 * Pro 모델 단일 테스트 - 1개 도면으로 품질 확인
 */
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const BASE = path.resolve(import.meta.dirname, '..');
const envPath = path.join(BASE, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (t.length === 0 || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

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

const MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3-pro-preview',
];

async function testModel(modelName, imageBuffer, mimeType) {
  console.log(`\nTesting: ${modelName}`);
  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
          { text: CLEAN_PROMPT },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    if (response.candidates && response.candidates[0]) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buf = Buffer.from(part.inlineData.data, 'base64');
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`  OK: ${(buf.length / 1024).toFixed(0)}KB in ${elapsed}s`);
          return buf;
        }
      }
    }
    console.log('  No image in response');
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  Error (${elapsed}s): ${err.message?.slice(0, 100)}`);
  }
  return null;
}

// Find a test image
import glob from 'fast-glob';
const originals = await glob('scripts/floorplan-pipeline/saved_plans/*/*/*/original.jpg');
console.log(`Found ${originals.length} originals`);

// Pick a medium complexity floor plan (index 100)
const testPath = originals[100] || originals[0];
console.log(`Test: ${testPath}`);

const imageBuffer = fs.readFileSync(testPath);
console.log(`Image: ${(imageBuffer.length / 1024).toFixed(0)}KB`);

// Test both Pro models
for (const model of MODELS) {
  const result = await testModel(model, imageBuffer, 'image/jpeg');
  if (result) {
    const outName = `_pro_test_${model.replace(/[^a-z0-9]/g, '_')}.png`;
    fs.writeFileSync(outName, result);
    console.log(`  Saved: ${outName}`);
  }
}

// Also save original for comparison
fs.copyFileSync(testPath, '_pro_test_original.jpg');
console.log('\nDone! Compare _pro_test_original.jpg vs _pro_test_*.png');
