// 도면 인식 직접 테스트 스크립트
// Usage: node scripts/test-gemini-parse.mjs drawings/_arch/59.pdf

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const apiKey = envFile.match(/GOOGLE_GEMINI_API_KEY=(.*)/)?.[1]?.trim();

if (!apiKey) {
  console.error('GOOGLE_GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

const filePath = process.argv[2] || path.join(__dirname, '..', 'drawings', '_arch', '59.pdf');
const knownArea = process.argv[3] || '59';

console.log(`File: ${filePath}`);
console.log(`Known Area: ${knownArea}m²`);

// PDF → PNG 변환 (fmupdf 직접 호출은 어려우니 59.png 사용)
const pngPath = filePath.replace('.pdf', '.png');
let imageBase64, mimeType;

if (fs.existsSync(pngPath)) {
  console.log(`Using pre-converted PNG: ${pngPath}`);
  imageBase64 = fs.readFileSync(pngPath).toString('base64');
  mimeType = 'image/png';
} else if (filePath.endsWith('.png') || filePath.endsWith('.jpg')) {
  imageBase64 = fs.readFileSync(filePath).toString('base64');
  mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
} else {
  console.log('PDF detected - using corresponding PNG (must be pre-converted)');
  console.error('PNG file not found:', pngPath);
  process.exit(1);
}

console.log(`Image size: ${(imageBase64.length * 3 / 4 / 1024).toFixed(0)} KB`);

const SYSTEM_PROMPT = `당신은 한국 아파트 건축 도면 전문 분석가입니다.
주어진 평면도 이미지를 분석하여 정확한 공간/벽체/문/창/설비 정보를 JSON으로 추출하세요.

## 공간(rooms) 인식 규칙
- 폴리곤 꼭짓점 좌표로 공간 경계를 정의합니다 (좌상단=원점, 우→x증가, 아래→y증가)
- 좌표 단위: 이미지 픽셀
- 타입: LIVING/KITCHEN/MASTER_BED/BED/BATHROOM/ENTRANCE/BALCONY/UTILITY/CORRIDOR/DRESSROOM

## 벽체(walls): start/end 좌표(픽셀), isExterior, thicknessMm
## 문(doors): position, widthMm, type(swing/sliding), connectedRooms
## 창(windows): position, widthMm, heightMm
## 설비(fixtures): type(toilet/sink/kitchen_sink/bathtub/stove), position
## 치수선(dimensions): valueMm, start, end 좌표

반드시 JSON으로만 출력하세요.`;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

for (const model of MODELS) {
  console.log(`\n--- Trying model: ${model} ---`);

  try {
    const startTime = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType, data: imageBase64 } },
            { text: `이 건축 도면을 분석하여 JSON으로 출력하세요. 참고: 전용면적 ${knownArea}m²입니다.` }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              rooms: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                type: { type: 'STRING' }, name: { type: 'STRING' },
                polygon: { type: 'ARRAY', items: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] } },
                area: { type: 'NUMBER' }
              }, required: ['type','name','polygon'] } },
              walls: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                start: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                end: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                isExterior: { type: 'BOOLEAN' }, thicknessMm: { type: 'NUMBER' }
              }, required: ['start','end','isExterior'] } },
              doors: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                position: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                widthMm: { type: 'NUMBER' }, type: { type: 'STRING' },
                connectedRooms: { type: 'ARRAY', items: { type: 'STRING' } }
              }, required: ['position','widthMm','type'] } },
              windows: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                position: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                widthMm: { type: 'NUMBER' }, heightMm: { type: 'NUMBER' }
              }, required: ['position','widthMm'] } },
              fixtures: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                type: { type: 'STRING' },
                position: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] }
              }, required: ['type','position'] } },
              dimensions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                valueMm: { type: 'NUMBER' },
                start: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                end: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] }
              }, required: ['valueMm','start','end'] } }
            },
            required: ['rooms','walls','doors','windows','fixtures','dimensions']
          },
          temperature: 0.1,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    const elapsed = Date.now() - startTime;
    console.log(`Status: ${res.status} (${(elapsed/1000).toFixed(1)}초)`);

    if (!res.ok) {
      const errBody = await res.text();
      console.log('Error:', errBody.substring(0, 300));
      if (res.status === 429) {
        console.log('→ Rate limited, trying next model...');
        continue;
      }
      continue;
    }

    const data = await res.json();

    // 응답 구조 확인
    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.log('No candidates in response');
      console.log('Response keys:', Object.keys(data));
      continue;
    }

    const textPart = candidate.content?.parts?.[0]?.text || '';
    console.log(`Response text length: ${textPart.length}`);
    console.log(`First 500 chars:\n${textPart.substring(0, 500)}`);

    // JSON 파싱 시도
    try {
      let jsonText = textPart.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(jsonText);

      console.log(`\n=== 파싱 성공! (${model}) ===`);
      console.log(`공간: ${(parsed.rooms || []).length}개`);
      (parsed.rooms || []).forEach(r => {
        console.log(`  ${r.name || r.type}: polygon ${(r.polygon || []).length}점, area=${r.area || '?'}`);
      });
      console.log(`벽: ${(parsed.walls || []).length}개`);
      console.log(`문: ${(parsed.doors || []).length}개`);
      console.log(`창: ${(parsed.windows || []).length}개`);
      console.log(`설비: ${(parsed.fixtures || []).length}개`);
      console.log(`치수선: ${(parsed.dimensions || []).length}개`);

      // 결과 저장
      const outPath = path.join(__dirname, '..', 'parse_test_result.json');
      fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));
      console.log(`\n결과 저장: ${outPath}`);

      break; // 성공하면 종료
    } catch (e) {
      console.log('JSON 파싱 실패:', e.message);
      console.log('Full response text:', textPart.substring(0, 2000));
    }

  } catch (err) {
    console.log('Error:', err.message);
  }
}
