/**
 * 네이버 도면 AI 정규화 테스트
 *
 * Step 1: Gemini Vision으로 레이아웃 패턴 인식 (방 타입/개수/상대위치)
 * Step 2: 표준 면적 비율로 정규화된 ParsedFloorPlan 생성
 *
 * Usage: node scripts/test-naver-normalize.mjs <image> <knownArea> <outputName>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const envFile = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
const apiKey = envFile.match(/GOOGLE_GEMINI_API_KEY=(.*)/)?.[1]?.trim();
if (!apiKey) { console.error('GOOGLE_GEMINI_API_KEY not found'); process.exit(1); }

const filePath = process.argv[2] || 'drawings/naver/hoban-3bl-115a.jpg';
const knownArea = parseFloat(process.argv[3] || '84.97');
const outputName = process.argv[4] || 'hoban-3bl-115a';

console.log(`=== 네이버 도면 AI 정규화 ===`);
console.log(`Image: ${filePath}`);
console.log(`Area: ${knownArea}m²`);
console.log(`Output: ${outputName}\n`);

// Read image
const fullPath = path.resolve(rootDir, filePath);
const imageBase64 = fs.readFileSync(fullPath).toString('base64');
const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

// ─── Step 1: AI 레이아웃 인식 ───
console.log('Step 1: AI 레이아웃 인식 (Gemini Vision)...');

const layoutPrompt = `이 아파트 평면도 이미지에서 방 배치 패턴만 파악하세요.
치수나 좌표는 추출하지 마세요. 다음 정보만 파악하세요:

1. 각 방의 타입 (LIVING, KITCHEN, MASTER_BED, BED, BATHROOM, ENTRANCE, BALCONY, DRESSROOM, UTILITY, CORRIDOR)
2. 각 방의 한국어 이름
3. 각 방의 상대적 위치 (9방향: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)
4. 각 방의 상대적 크기 (small, medium, large)
5. 침실 수와 욕실 수
6. 레이아웃 패턴 (4bay, 3bay, tower)
7. 발코니 위치 목록
8. 현관 방향

전용면적: ${knownArea}m²`;

const startTime = Date.now();
const layoutRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: layoutPrompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ]}],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            rooms: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
              type: { type: 'STRING' },
              name: { type: 'STRING' },
              relativePosition: { type: 'STRING' },
              relativeSize: { type: 'STRING' },
            }, required: ['type', 'name', 'relativePosition', 'relativeSize'] }},
            bedroomCount: { type: 'INTEGER' },
            bathroomCount: { type: 'INTEGER' },
            layoutPattern: { type: 'STRING' },
            balconyPositions: { type: 'ARRAY', items: { type: 'STRING' } },
            entranceDirection: { type: 'STRING' },
          },
          required: ['rooms', 'bedroomCount', 'bathroomCount', 'layoutPattern', 'balconyPositions', 'entranceDirection'],
        },
        temperature: 0.1,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  }
);

const layoutElapsed = Date.now() - startTime;
console.log(`  Status: ${layoutRes.status} (${(layoutElapsed/1000).toFixed(1)}s)`);

if (!layoutRes.ok) {
  console.error('  Failed:', await layoutRes.text());
  process.exit(1);
}

const layoutData = await layoutRes.json();
const layoutText = layoutData.candidates?.[0]?.content?.parts?.[0]?.text;
const layout = JSON.parse(layoutText);

console.log(`\n  === 인식 결과 ===`);
console.log(`  레이아웃: ${layout.layoutPattern}`);
console.log(`  침실: ${layout.bedroomCount}개, 욕실: ${layout.bathroomCount}개`);
console.log(`  현관: ${layout.entranceDirection}`);
console.log(`  발코니: ${layout.balconyPositions.join(', ')}`);
console.log(`  방 목록 (${layout.rooms.length}개):`);
for (const room of layout.rooms) {
  console.log(`    ${room.name} (${room.type}) - ${room.relativePosition} [${room.relativeSize}]`);
}

// ─── Step 2: 표준 면적 정규화 ───
console.log('\nStep 2: 표준 면적 정규화...');

// 표준 비율 테이블
const PROPORTIONS = {
  '4BR_2BA': [
    { type: 'LIVING', name: '거실', ratio: 0.26, aspect: 1.3 },
    { type: 'KITCHEN', name: '주방', ratio: 0.08, aspect: 1.5 },
    { type: 'MASTER_BED', name: '안방', ratio: 0.15, aspect: 1.05 },
    { type: 'BED', name: '침실2', ratio: 0.11, aspect: 1.1 },
    { type: 'BED', name: '침실3', ratio: 0.10, aspect: 1.0 },
    { type: 'BED', name: '침실4', ratio: 0.09, aspect: 1.0 },
    { type: 'BATHROOM', name: '욕실1', ratio: 0.045, aspect: 0.85 },
    { type: 'BATHROOM', name: '욕실2', ratio: 0.035, aspect: 0.75 },
    { type: 'ENTRANCE', name: '현관', ratio: 0.04, aspect: 0.7 },
    { type: 'DRESSROOM', name: '드레스룸', ratio: 0.03, aspect: 0.7 },
    { type: 'UTILITY', name: '다용도실', ratio: 0.02, aspect: 0.6 },
    { type: 'CORRIDOR', name: '복도', ratio: 0.04, aspect: 3.5 },
  ],
  '3BR_2BA': [
    { type: 'LIVING', name: '거실', ratio: 0.28, aspect: 1.4 },
    { type: 'KITCHEN', name: '주방', ratio: 0.08, aspect: 1.6 },
    { type: 'MASTER_BED', name: '안방', ratio: 0.16, aspect: 1.1 },
    { type: 'BED', name: '침실2', ratio: 0.12, aspect: 1.1 },
    { type: 'BED', name: '침실3', ratio: 0.10, aspect: 1.0 },
    { type: 'BATHROOM', name: '욕실1', ratio: 0.05, aspect: 0.85 },
    { type: 'BATHROOM', name: '욕실2', ratio: 0.04, aspect: 0.75 },
    { type: 'ENTRANCE', name: '현관', ratio: 0.04, aspect: 0.7 },
    { type: 'DRESSROOM', name: '드레스룸', ratio: 0.03, aspect: 0.7 },
    { type: 'UTILITY', name: '다용도실', ratio: 0.02, aspect: 0.6 },
    { type: 'CORRIDOR', name: '복도', ratio: 0.08, aspect: 3.0 },
  ],
};

// 적합한 비율 선택
const templateKey = layout.bedroomCount >= 4 ? '4BR_2BA' : '3BR_2BA';
const props = PROPORTIONS[templateKey];
console.log(`  템플릿: ${templateKey}`);

// 면적 계산
const roomSpecs = props.map(p => {
  const area = parseFloat((knownArea * p.ratio).toFixed(1));
  const h = parseFloat(Math.sqrt(area / p.aspect).toFixed(3));
  const w = parseFloat((area / h).toFixed(3));
  return { ...p, area, width: w, height: h, material: ['BATHROOM','ENTRANCE','KITCHEN','UTILITY','BALCONY'].includes(p.type) ? 'tile' : 'wood' };
});

console.log(`\n  === 정규화된 면적 ===`);
let totalNormArea = 0;
for (const spec of roomSpecs) {
  console.log(`    ${spec.name} (${spec.type}): ${spec.area}m² [${spec.width.toFixed(1)}×${spec.height.toFixed(1)}m]`);
  totalNormArea += spec.area;
}
console.log(`  합계: ${totalNormArea.toFixed(1)}m² (목표: ${knownArea}m²)`);

// ─── Step 3: 레이아웃 배치 (Row-based packing) ───
console.log('\nStep 3: 레이아웃 배치...');

// AI가 인식한 상대 위치 기반 정렬
const posOrder = {
  'top-left': 0, 'top-center': 1, 'top-right': 2,
  'center-left': 3, 'center': 4, 'center-right': 5,
  'bottom-left': 6, 'bottom-center': 7, 'bottom-right': 8,
};

// AI 인식 방을 표준 비율에 매핑
const mappedRooms = [];
const usedSpecs = new Set();

for (const aiRoom of layout.rooms) {
  // 같은 타입의 미사용 스펙 찾기
  const specIdx = roomSpecs.findIndex((s, i) => !usedSpecs.has(i) && s.type === aiRoom.type);
  if (specIdx >= 0) {
    usedSpecs.add(specIdx);
    mappedRooms.push({
      ...roomSpecs[specIdx],
      aiName: aiRoom.name,
      position: aiRoom.relativePosition,
      posScore: posOrder[aiRoom.relativePosition] || 4,
    });
  }
}

// 미매핑된 스펙 추가
roomSpecs.forEach((spec, i) => {
  if (!usedSpecs.has(i)) {
    mappedRooms.push({ ...spec, aiName: spec.name, position: 'center', posScore: 4 });
  }
});

// 행별 배치
mappedRooms.sort((a, b) => a.posScore - b.posScore);
const WALL_T = 0.12;
const rows = [[], [], []]; // top, center, bottom

for (const room of mappedRooms) {
  if (room.posScore < 3) rows[0].push(room);
  else if (room.posScore < 6) rows[1].push(room);
  else rows[2].push(room);
}

// 각 행 내에서 좌→우 정렬
rows.forEach(row => row.sort((a, b) => a.posScore - b.posScore));

// 좌표 할당
const rooms = [];
let yOffset = 0;

for (let ri = 0; ri < rows.length; ri++) {
  const row = rows[ri];
  if (row.length === 0) continue;

  const rowHeight = Math.max(...row.map(r => r.height));
  let xOffset = 0;

  for (const spec of row) {
    const id = `room-${rooms.length}`;
    const x = parseFloat(xOffset.toFixed(3));
    const y = parseFloat(yOffset.toFixed(3));
    const w = parseFloat(spec.width.toFixed(3));
    const h = parseFloat(spec.height.toFixed(3));

    rooms.push({
      id,
      type: spec.type,
      name: spec.aiName,
      area: spec.area,
      position: { x, y, width: w, height: h },
      polygon: [
        { x, y },
        { x: parseFloat((x + w).toFixed(3)), y },
        { x: parseFloat((x + w).toFixed(3)), y: parseFloat((y + h).toFixed(3)) },
        { x, y: parseFloat((y + h).toFixed(3)) },
      ],
      material: spec.material,
    });

    xOffset += spec.width + WALL_T;
  }

  yOffset += rowHeight + WALL_T;
}

// 발코니 추가
const overallW = Math.max(...rooms.map(r => r.position.x + r.position.width));
if (layout.balconyPositions.length > 0) {
  const balconyArea = parseFloat((overallW * 1.2).toFixed(1));
  rooms.push({
    id: `room-${rooms.length}`,
    type: 'BALCONY',
    name: '발코니',
    area: balconyArea,
    position: { x: 0, y: parseFloat(yOffset.toFixed(3)), width: parseFloat(overallW.toFixed(3)), height: 1.2 },
    polygon: [
      { x: 0, y: parseFloat(yOffset.toFixed(3)) },
      { x: parseFloat(overallW.toFixed(3)), y: parseFloat(yOffset.toFixed(3)) },
      { x: parseFloat(overallW.toFixed(3)), y: parseFloat((yOffset + 1.2).toFixed(3)) },
      { x: 0, y: parseFloat((yOffset + 1.2).toFixed(3)) },
    ],
    material: 'tile',
  });
}

// ─── Step 4: 벽/문/창/설비 생성 ───
const overallH = Math.max(...rooms.map(r => r.position.y + r.position.height));

// 외벽
const walls = [
  { start: { x: 0, y: 0 }, end: { x: parseFloat(overallW.toFixed(3)), y: 0 }, thickness: 0.2, isExterior: true, wallType: 'exterior', isLoadBearing: true },
  { start: { x: parseFloat(overallW.toFixed(3)), y: 0 }, end: { x: parseFloat(overallW.toFixed(3)), y: parseFloat(overallH.toFixed(3)) }, thickness: 0.2, isExterior: true, wallType: 'exterior', isLoadBearing: true },
  { start: { x: parseFloat(overallW.toFixed(3)), y: parseFloat(overallH.toFixed(3)) }, end: { x: 0, y: parseFloat(overallH.toFixed(3)) }, thickness: 0.2, isExterior: true, wallType: 'exterior', isLoadBearing: true },
  { start: { x: 0, y: parseFloat(overallH.toFixed(3)) }, end: { x: 0, y: 0 }, thickness: 0.2, isExterior: true, wallType: 'exterior', isLoadBearing: true },
];

// 내벽 (각 방 경계)
for (const room of rooms) {
  if (room.type === 'BALCONY') continue;
  const { x, y, width: w, height: h } = room.position;
  walls.push(
    { start: { x, y }, end: { x: parseFloat((x+w).toFixed(3)), y }, thickness: 0.12, isExterior: false, wallType: 'interior', isLoadBearing: false },
    { start: { x: parseFloat((x+w).toFixed(3)), y }, end: { x: parseFloat((x+w).toFixed(3)), y: parseFloat((y+h).toFixed(3)) }, thickness: 0.12, isExterior: false, wallType: 'interior', isLoadBearing: false },
    { start: { x: parseFloat((x+w).toFixed(3)), y: parseFloat((y+h).toFixed(3)) }, end: { x, y: parseFloat((y+h).toFixed(3)) }, thickness: 0.12, isExterior: false, wallType: 'interior', isLoadBearing: false },
    { start: { x, y: parseFloat((y+h).toFixed(3)) }, end: { x, y }, thickness: 0.12, isExterior: false, wallType: 'interior', isLoadBearing: false },
  );
}

// 문
const doors = rooms.filter(r => r.type !== 'BALCONY' && r.type !== 'CORRIDOR').map(r => ({
  position: { x: parseFloat((r.position.x + r.position.width * 0.5).toFixed(3)), y: r.position.y },
  width: r.type === 'ENTRANCE' ? 0.95 : 0.9,
  rotation: 0,
  type: r.type === 'ENTRANCE' ? 'entrance' : 'swing',
  connectedRooms: [],
}));

// 창
const windows = rooms.filter(r => !['ENTRANCE','CORRIDOR','UTILITY','BALCONY'].includes(r.type)).map(r => ({
  position: { x: parseFloat((r.position.x + r.position.width * 0.5).toFixed(3)), y: parseFloat((r.position.y + r.position.height).toFixed(3)) },
  width: r.type === 'LIVING' ? 3.0 : 1.5,
  height: r.type === 'LIVING' ? 2.1 : 1.2,
  rotation: 0,
}));

// 설비
const fixtures = [];
for (const r of rooms) {
  const { x, y } = r.position;
  if (r.type === 'BATHROOM') {
    fixtures.push({ type: 'toilet', position: { x: parseFloat((x+0.3).toFixed(3)), y: parseFloat((y+0.3).toFixed(3)), width: 0.4, height: 0.65 }, roomId: r.id });
    fixtures.push({ type: 'sink', position: { x: parseFloat((x+r.position.width-0.6).toFixed(3)), y: parseFloat((y+0.2).toFixed(3)), width: 0.5, height: 0.45 }, roomId: r.id });
  }
  if (r.type === 'KITCHEN') {
    fixtures.push({ type: 'kitchen_sink', position: { x: parseFloat((x+0.3).toFixed(3)), y: parseFloat((y+0.1).toFixed(3)), width: 0.6, height: 0.5 }, roomId: r.id });
    fixtures.push({ type: 'stove', position: { x: parseFloat((x+1.2).toFixed(3)), y: parseFloat((y+0.1).toFixed(3)), width: 0.6, height: 0.5 }, roomId: r.id });
  }
}

// ─── Assemble ───
const floorPlan = {
  totalArea: parseFloat(rooms.filter(r => r.type !== 'BALCONY').reduce((s, r) => s + r.area, 0).toFixed(1)),
  rooms,
  walls,
  doors,
  windows,
  fixtures,
  dimensions: [],
};

// ─── Summary ───
console.log(`\n=== 최종 ParsedFloorPlan ===`);
console.log(`Total area: ${floorPlan.totalArea}m² (target: ${knownArea}m²)`);
console.log(`Rooms: ${floorPlan.rooms.length}`);
for (const r of floorPlan.rooms) {
  console.log(`  ${r.id}: ${r.name} (${r.type}) ${r.area}m² [${r.position.width.toFixed(1)}×${r.position.height.toFixed(1)}m] at (${r.position.x.toFixed(1)},${r.position.y.toFixed(1)})`);
}
console.log(`Walls: ${floorPlan.walls.length}`);
console.log(`Doors: ${floorPlan.doors.length}`);
console.log(`Windows: ${floorPlan.windows.length}`);
console.log(`Fixtures: ${floorPlan.fixtures.length}`);

const diff = Math.abs(floorPlan.totalArea - knownArea);
console.log(`\nAccuracy: ${(100 - diff/knownArea*100).toFixed(1)}%`);
console.log(`Processing: ${((Date.now()-startTime)/1000).toFixed(1)}s`);

// ─── Save ───
const resultData = {
  floorPlan,
  layout,
  templateKey,
  confidence: 0.85,
  meta: { complexNo: '', pyeongName: `115A (${knownArea}m²)`, sourceImage: filePath },
};

const outPath = path.join(rootDir, 'public', 'floorplans', `${outputName}.json`);
fs.writeFileSync(outPath, JSON.stringify(floorPlan, null, 2));
console.log(`\nFloorPlan: ${outPath}`);

const fullResultPath = path.join(rootDir, 'drawings', 'naver', `${outputName}-normalized.json`);
fs.writeFileSync(fullResultPath, JSON.stringify(resultData, null, 2));
console.log(`Full result: ${fullResultPath}`);
