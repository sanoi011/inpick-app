/**
 * 네이버 부동산 도면 이미지 → AI 레이아웃 인식 → 표준 면적 정규화
 *
 * 네이버 도면 이미지는 렌더링용이라 치수 정확도가 낮으므로,
 * AI로 방 배치 패턴만 인식하고 표준 면적 비율로 정규화합니다.
 *
 * Usage: node scripts/parse-naver-drawing.mjs <image.jpg> <knownArea> <outputName>
 * Example: node scripts/parse-naver-drawing.mjs drawings/naver/hoban-3bl-115a.jpg 84.97 hoban-3bl-115a
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

console.log(`File: ${filePath}`);
console.log(`Known Area: ${knownArea} m²`);
console.log(`Output: ${outputName}`);

// Read image
const fullPath = path.resolve(rootDir, filePath);
const imageBase64 = fs.readFileSync(fullPath).toString('base64');
const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
console.log(`Image size: ${(imageBase64.length * 3 / 4 / 1024).toFixed(0)} KB`);

// ─── Enhanced System Prompt (mm 단위 좌표 출력) ───
const SYSTEM_PROMPT = `당신은 한국 아파트 건축 도면 전문 분석가입니다.
주어진 평면도 이미지를 분석하여 실제 치수의 밀리미터(mm) 단위 좌표로 공간/벽체/문/창/설비 정보를 JSON으로 추출하세요.

## 핵심 규칙
1. **모든 좌표는 밀리미터(mm) 단위**입니다. 예: 거실 폭 5500, 높이 4200 (단위 생략, mm임)
2. 좌상단을 원점(0,0)으로, 우측=x증가, 아래쪽=y증가
3. 전용면적 ${knownArea}m²이므로 발코니 제외 면적 합이 약 ${knownArea}m²
4. area 필드는 m² 단위 (polygon 넓이 ÷ 1,000,000과 일치해야 함)
5. 인접 공간의 공유 벽 좌표는 정확히 동일해야 함

## 84m² 4베이 확장형 아파트 표준 치수 (mm)
전체 가로: 약 10,500~12,000mm
전체 세로: 약 8,500~10,500mm

| 공간 | 가로mm | 세로mm | 면적m² |
|------|--------|--------|--------|
| 거실+식당 | 5,500 | 4,200 | 23.1 |
| 안방 | 3,800 | 3,600 | 13.7 |
| 침실2 | 3,300 | 3,000 | 9.9 |
| 침실3 | 3,000 | 3,000 | 9.0 |
| 주방 | 3,200 | 2,400 | 7.7 |
| 욕실1(안방전용) | 2,000 | 1,800 | 3.6 |
| 욕실2(공용) | 1,800 | 1,600 | 2.9 |
| 현관/복도 | 2,000 | 1,500 | 3.0 |
| 드레스룸 | 1,800 | 1,500 | 2.7 |
| 다용도실 | 1,200 | 1,000 | 1.2 |

## 출력 필드
### rooms
- polygon: mm 좌표 배열 (폐합, 반시계방향)
- area: m² (소수점 1자리, polygon에서 계산한 값)
- type: LIVING/KITCHEN/MASTER_BED/BED/BATHROOM/ENTRANCE/BALCONY/UTILITY/CORRIDOR/DRESSROOM

### walls
- start/end: mm 좌표
- isExterior: boolean
- thicknessMm: 외벽 200, 내벽 120

### doors
- position: mm 좌표 (문 중심)
- widthMm: 현관 950, 방문 900, 미닫이 1800
- type: swing/sliding/entrance

### windows
- position: mm 좌표 (창 중심)
- widthMm/heightMm: 거실창 3000×2100, 일반 1500×1200

### fixtures
- type: toilet/sink/kitchen_sink/bathtub/stove
- position: mm 좌표

### dimensions
- valueMm, startPoint/endPoint: mm 좌표`;

const USER_PROMPT = `이 아파트 평면도를 분석하세요.

조건:
- 전용면적: ${knownArea}m² (84A 타입)
- 4베이 확장형 (발코니 확장 포함)
- 4침실 2욕실 구조

좌표 규칙:
- 모든 polygon, start, end, position 좌표는 mm(밀리미터) 정수로 출력
- 예: 거실 좌상단 (2500, 3000), 우하단 (8000, 7200) → 폭 5500mm, 높이 4200mm
- area는 polygon 면적을 m²로 환산 (polygon 면적 ÷ 1000000)
- 방 하나의 최소 치수는 1200mm 이상

검증:
- 발코니 제외 room area 합 ≈ ${knownArea}m²
- polygon의 면적과 area 필드가 일치해야 함
- 인접 방의 공유 벽 좌표가 동일해야 함`;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

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
            { text: USER_PROMPT }
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
              }, required: ['type','name','polygon','area'] } },
              walls: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                start: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                end: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                isExterior: { type: 'BOOLEAN' }, thicknessMm: { type: 'NUMBER' }
              }, required: ['start','end','isExterior','thicknessMm'] } },
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
                position: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' }, width: { type: 'NUMBER' }, height: { type: 'NUMBER' } }, required: ['x','y'] }
              }, required: ['type','position'] } },
              dimensions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                valueMm: { type: 'NUMBER' },
                startPoint: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] },
                endPoint: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x','y'] }
              }, required: ['valueMm','startPoint','endPoint'] } }
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
    console.log(`Status: ${res.status} (${(elapsed/1000).toFixed(1)}s)`);

    if (!res.ok) {
      const errBody = await res.text();
      console.log('Error:', errBody.substring(0, 500));
      continue;
    }

    const data = await res.json();
    const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed;
    try {
      let jsonText = textPart.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.log('JSON parse failed:', e.message);
      console.log('Text:', textPart.substring(0, 1000));
      continue;
    }

    // ─── Post-process: mm → m 변환 + IDs, materials, positions ───
    const MM_TO_M = 0.001; // mm → m

    const ROOM_MATERIAL = {
      LIVING: 'wood', KITCHEN: 'tile', MASTER_BED: 'wood', BED: 'wood',
      BATHROOM: 'tile', ENTRANCE: 'tile', BALCONY: 'tile', UTILITY: 'tile',
      CORRIDOR: 'wood', DRESSROOM: 'wood'
    };

    const typeCounters = {};
    const rooms = parsed.rooms.map((room) => {
      typeCounters[room.type] = (typeCounters[room.type] || 0) + 1;
      const count = typeCounters[room.type];
      const id = `room-${room.type.toLowerCase()}-${count}`;

      // mm → m 변환
      const polygonM = room.polygon.map(p => ({
        x: parseFloat((p.x * MM_TO_M).toFixed(3)),
        y: parseFloat((p.y * MM_TO_M).toFixed(3))
      }));

      // Compute bounding box in meters
      const xs = polygonM.map(p => p.x);
      const ys = polygonM.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);

      return {
        id,
        type: room.type,
        name: room.name,
        area: room.area, // Already in m²
        position: {
          x: parseFloat(minX.toFixed(3)),
          y: parseFloat(minY.toFixed(3)),
          width: parseFloat((maxX - minX).toFixed(3)),
          height: parseFloat((maxY - minY).toFixed(3)),
        },
        polygon: polygonM,
        material: ROOM_MATERIAL[room.type] || 'unknown'
      };
    });

    // Walls: mm → m
    const walls = parsed.walls.map(w => ({
      start: { x: parseFloat((w.start.x * MM_TO_M).toFixed(3)), y: parseFloat((w.start.y * MM_TO_M).toFixed(3)) },
      end: { x: parseFloat((w.end.x * MM_TO_M).toFixed(3)), y: parseFloat((w.end.y * MM_TO_M).toFixed(3)) },
      thickness: (w.thicknessMm || 100) / 1000,
      isExterior: w.isExterior,
      wallType: w.isExterior ? 'exterior' : 'interior',
      isLoadBearing: w.isExterior,
    }));

    // Doors: mm → m
    const doors = parsed.doors.map(d => ({
      position: { x: parseFloat((d.position.x * MM_TO_M).toFixed(3)), y: parseFloat((d.position.y * MM_TO_M).toFixed(3)) },
      width: (d.widthMm || 800) / 1000,
      rotation: 0,
      type: d.type || 'swing',
      connectedRooms: d.connectedRooms || [],
    }));

    // Windows: mm → m
    const windows = parsed.windows.map(w => ({
      position: { x: parseFloat((w.position.x * MM_TO_M).toFixed(3)), y: parseFloat((w.position.y * MM_TO_M).toFixed(3)) },
      width: (w.widthMm || 1200) / 1000,
      height: (w.heightMm || 1200) / 1000,
      rotation: 0,
    }));

    // Fixtures: mm → m
    const fixtures = parsed.fixtures.map(f => {
      const DEFAULT_SIZES = {
        toilet: { w: 0.4, h: 0.65 }, sink: { w: 0.5, h: 0.45 },
        kitchen_sink: { w: 0.6, h: 0.5 }, bathtub: { w: 0.7, h: 1.5 },
        stove: { w: 0.6, h: 0.5 }
      };
      const sz = DEFAULT_SIZES[f.type] || { w: 0.4, h: 0.4 };
      return {
        type: f.type,
        position: {
          x: parseFloat(((f.position.x || 0) * MM_TO_M).toFixed(3)),
          y: parseFloat(((f.position.y || 0) * MM_TO_M).toFixed(3)),
          width: f.position.width ? parseFloat((f.position.width * MM_TO_M).toFixed(3)) : sz.w,
          height: f.position.height ? parseFloat((f.position.height * MM_TO_M).toFixed(3)) : sz.h,
        }
      };
    });

    // Dimensions: mm → m coordinates (valueMm stays as mm)
    const dimensions = (parsed.dimensions || []).map(d => ({
      valueMm: d.valueMm,
      startPoint: { x: parseFloat((d.startPoint.x * MM_TO_M).toFixed(3)), y: parseFloat((d.startPoint.y * MM_TO_M).toFixed(3)) },
      endPoint: { x: parseFloat((d.endPoint.x * MM_TO_M).toFixed(3)), y: parseFloat((d.endPoint.y * MM_TO_M).toFixed(3)) },
      label: `${d.valueMm}`,
    }));

    // Calculate totals
    const nonBalconyArea = rooms.filter(r => r.type !== 'BALCONY').reduce((s, r) => s + r.area, 0);
    const totalArea = parseFloat(nonBalconyArea.toFixed(1));

    const floorPlan = {
      totalArea,
      rooms,
      walls,
      doors,
      windows,
      fixtures,
      dimensions,
    };

    // ─── Summary ───
    console.log(`\n=== ParsedFloorPlan (미터 단위 직접 출력) ===`);
    console.log(`Total area: ${floorPlan.totalArea} m² (target: ${knownArea} m²)`);
    console.log(`Rooms: ${floorPlan.rooms.length}`);
    floorPlan.rooms.forEach(r => {
      console.log(`  ${r.id}: ${r.name} (${r.type}) ${r.area}m² [${r.position.width.toFixed(1)}×${r.position.height.toFixed(1)}m]`);
    });
    console.log(`Walls: ${floorPlan.walls.length}`);
    console.log(`Doors: ${floorPlan.doors.length}`);
    console.log(`Windows: ${floorPlan.windows.length}`);
    console.log(`Fixtures: ${floorPlan.fixtures.length}`);
    console.log(`Dimensions: ${floorPlan.dimensions.length}`);

    // Area check
    const diff = Math.abs(totalArea - knownArea);
    if (diff > knownArea * 0.1) {
      console.log(`\n⚠ WARNING: Area difference ${diff.toFixed(1)}m² (${(diff/knownArea*100).toFixed(1)}%)`);
    } else {
      console.log(`\n✓ Area accuracy: ${(100 - diff/knownArea*100).toFixed(1)}%`);
    }

    // ─── Save ───
    const outPath = path.join(rootDir, 'public', 'floorplans', `${outputName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(floorPlan, null, 2));
    console.log(`\nSaved: ${outPath}`);

    const refPath = path.join(rootDir, 'drawings', 'naver', `${outputName}-parsed.json`);
    fs.writeFileSync(refPath, JSON.stringify(floorPlan, null, 2));
    console.log(`Reference: ${refPath}`);

    break; // Success
  } catch (err) {
    console.log('Error:', err.message);
  }
}
