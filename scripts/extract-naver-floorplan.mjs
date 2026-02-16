/**
 * 네이버 부동산 도면에서 정확한 공간 데이터 추출 (Gemini Vision)
 * 원본 이미지의 텍스트/치수/레이아웃을 읽어서 ParsedFloorPlan JSON 생성
 *
 * 사용법:
 *   node scripts/extract-naver-floorplan.mjs [input] [output-json] [--known-area=84]
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
      process.env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  }
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) { console.error('GOOGLE_GEMINI_API_KEY not found'); process.exit(1); }

const BASE = process.cwd();
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const knownArea = parseFloat((flags.find(f => f.startsWith('--known-area=')) || '').split('=')[1] || '0');
const inputPath = positional[0] ? path.resolve(BASE, positional[0]) : path.join(BASE, 'drawings', 'naver', 'hoban-3bl-116b.jpg');
const outputJson = positional[1] ? path.resolve(BASE, positional[1]) : inputPath.replace(/\.(jpg|png)$/, '-floorplan.json');

console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputJson}`);
if (knownArea) console.log(`Known area: ${knownArea}㎡`);

if (!fs.existsSync(inputPath)) { console.error(`File not found: ${inputPath}`); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const EXTRACT_PROMPT = `이 네이버 부동산 아파트 평면도 이미지를 분석해서 정확한 공간 데이터를 JSON으로 반환해줘.

이미지에 적힌 한글 텍스트(거실, 안방, 침실, 주방, 욕실, 현관, 발코니 등)와 공간의 상대적 크기/비율을 정확히 읽어.

반환 형식 (JSON):
{
  "totalArea": ${knownArea || '전용면적 추정값(㎡)'},
  "rooms": [
    {
      "name": "거실",
      "type": "LIVING",
      "widthMm": 4200,
      "heightMm": 5100,
      "area": 21.42,
      "relativeX": 0.35,
      "relativeY": 0.55,
      "material": "wood"
    }
  ]
}

규칙:
- name: 이미지에 적힌 원래 한글 이름 그대로
- type: LIVING/MASTER_BED/BED/KITCHEN/BATHROOM/ENTRANCE/BALCONY/DRESSROOM/UTILITY/CORRIDOR 중 하나
- widthMm/heightMm: 방의 내부 가로/세로 치수 (mm). 이미지의 비례를 보고 정확하게 추정.${knownArea ? ` 전용면적 ${knownArea}㎡ 기준으로 각 방 치수 보정.` : ''}
- area: widthMm × heightMm / 1,000,000 (㎡)
- relativeX/relativeY: 방 중심의 상대 위치 (0~1, 이미지 좌상단 기준)
- material: 욕실/현관/발코니/주방은 "tile", 나머지 "wood"

안방이 가장 큰 침실이어야 해. 침실이 여러 개면 침실1, 침실2로 구분.
모든 방을 빠짐없이 포함해. 복도나 팬트리 같은 작은 공간도.`;

async function extractFloorPlan() {
  console.log('\n=== Extracting floor plan data ===');
  const startTime = Date.now();

  const imageBuffer = fs.readFileSync(inputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = inputPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: EXTRACT_PROMPT },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.candidates[0].content.parts[0].text;
  const data = JSON.parse(text);

  // 면적 보정
  if (knownArea && data.rooms) {
    const sumArea = data.rooms.reduce((s, r) => s + (r.type !== 'BALCONY' ? r.area : 0), 0);
    if (sumArea > 0 && Math.abs(sumArea - knownArea) / knownArea > 0.1) {
      const scale = Math.sqrt(knownArea / sumArea);
      console.log(`  Area correction: ${sumArea.toFixed(1)}㎡ → ${knownArea}㎡ (scale: ${scale.toFixed(3)})`);
      data.rooms.forEach(r => {
        r.widthMm = Math.round(r.widthMm * scale);
        r.heightMm = Math.round(r.heightMm * scale);
        r.area = parseFloat((r.widthMm * r.heightMm / 1_000_000).toFixed(2));
      });
    }
    data.totalArea = knownArea;
  }

  // ParsedFloorPlan 형식으로 변환
  const floorPlan = convertToFloorPlan(data);

  fs.writeFileSync(outputJson, JSON.stringify(floorPlan, null, 2));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  Rooms: ${floorPlan.rooms.length}`);
  console.log(`  Total area: ${floorPlan.totalArea}㎡`);
  floorPlan.rooms.forEach(r => {
    console.log(`    ${r.name}: ${r.position.width.toFixed(1)}m × ${r.position.height.toFixed(1)}m = ${r.area.toFixed(1)}㎡`);
  });
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Saved: ${outputJson}`);
  return floorPlan;
}

function convertToFloorPlan(data) {
  const rooms = data.rooms.map((r, i) => {
    const wM = r.widthMm / 1000;
    const hM = r.heightMm / 1000;
    const area = parseFloat((wM * hM).toFixed(2));
    // relativeX/Y로 대략적 좌표 생성 (10m × 10m 정규화 공간)
    const cx = r.relativeX * 12;
    const cy = r.relativeY * 10;
    const x = cx - wM / 2;
    const y = cy - hM / 2;

    return {
      id: `room-${i}`,
      type: r.type,
      name: r.name,
      area,
      position: { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)), width: wM, height: hM },
      polygon: [
        { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) },
        { x: parseFloat((x + wM).toFixed(3)), y: parseFloat(y.toFixed(3)) },
        { x: parseFloat((x + wM).toFixed(3)), y: parseFloat((y + hM).toFixed(3)) },
        { x: parseFloat(x.toFixed(3)), y: parseFloat((y + hM).toFixed(3)) },
      ],
      center: { x: parseFloat(cx.toFixed(3)), y: parseFloat(cy.toFixed(3)) },
      material: r.material || 'wood',
    };
  });

  return {
    totalArea: data.totalArea || rooms.reduce((s, r) => s + r.area, 0),
    rooms,
    walls: [],
    doors: [],
    windows: [],
    fixtures: [],
  };
}

// ─── 클린 + 내부치수 이미지 생성 ───
async function generateCleanImage(floorPlan) {
  const cleanPath = inputPath.replace(/\.(jpg|png)$/, '-clean.png');
  console.log('\n=== Generating clean image with accurate dimensions ===');

  const imageBuffer = fs.readFileSync(inputPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = inputPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // 정확한 치수 데이터로 프롬프트 생성
  const dimLines = floorPlan.rooms.map(r => {
    const w = Math.round(r.position.width * 1000);
    const h = Math.round(r.position.height * 1000);
    return `- ${r.name}: ${w.toLocaleString()} × ${h.toLocaleString()}mm`;
  }).join('\n');

  const prompt = `이 아파트 평면도를 깨끗한 건축 도면으로 변환해줘:

【완전히 제거】
- 모든 설비 (변기/욕조/세면대/싱크대/가스레인지) - 흔적도 없이
- 모든 가구, 바닥색, 바닥 패턴, 격자/해칭 무늬
- 워터마크, 기존 텍스트 전부

【유지】
- 벽선 (검은 굵은 선), 문 아크, 창문 표시

【추가 - 정확한 내부 치수선】
각 방 내부에 아래 치수를 정확히 표시해:
${dimLines}

치수선 스타일:
- 매우 가늘고 세련된 선 (0.3pt 정도)
- 양 끝 작은 틱마크(|)
- 숫자는 얇고 작은 산세리프 폰트, 연한 회색(#666)
- 가로 치수는 방 상단/하단, 세로 치수는 방 좌/우측에 벽면 가장자리 배치
- 공간 이름은 표시하지 마, 치수만

【스타일】 흰색 배경, 검은 벽선, 가늘고 세련된 치수`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt },
      ],
    }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  if (response.candidates?.[0]) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const buf = Buffer.from(part.inlineData.data, 'base64');
        fs.writeFileSync(cleanPath, buf);
        console.log(`  Saved: ${cleanPath} (${(buf.length / 1024).toFixed(0)}KB)`);
        return cleanPath;
      }
    }
  }
  console.log('  Failed to generate clean image');
  return null;
}

// ─── 메인 ───
(async () => {
  const floorPlan = await extractFloorPlan();
  await generateCleanImage(floorPlan);
  console.log('\nDone!');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
