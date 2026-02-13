/**
 * 3개 샘플 도면(59, 84A, 84B)을 Gemini Vision으로 파싱하여
 * public/floorplans/sample-*.json으로 저장
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';

const DRAWINGS = [
  { file: 'drawings/_arch/59.png', knownArea: 59, outputId: 'sample-59' },
  { file: 'drawings/_arch/84A.png', knownArea: 84, outputId: 'sample-84a' },
  { file: 'drawings/_arch/84d.png', knownArea: 84, outputId: 'sample-84b' },
];

async function parseDrawing(drawing) {
  console.log(`\n=== Parsing ${drawing.file} (${drawing.knownArea}m²) ===`);
  const startTime = Date.now();

  const filePath = path.resolve(__dirname, '..', drawing.file);
  if (!fs.existsSync(filePath)) {
    console.error(`  File not found: ${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('file', blob, path.basename(drawing.file));
  formData.append('knownArea', String(drawing.knownArea));
  formData.append('source', 'image');

  try {
    const res = await fetch(`${BASE}/api/project/parse-drawing`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const elapsed = Date.now() - startTime;
    console.log(`  Time: ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`  Confidence: ${data.confidence}`);
    console.log(`  Method: ${data.method}`);
    console.log(`  Rooms: ${data.roomCount}, Area: ${data.totalArea}m²`);

    if (data.warnings?.length > 0) {
      console.log(`  Warnings: ${data.warnings.join(', ')}`);
    }

    return data.floorPlan;
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return null;
  }
}

/**
 * Gemini API 응답의 floorPlan을 ParsedFloorPlan 포맷으로 정규화
 */
function normalizeFloorPlan(raw, knownArea) {
  // rooms 정규화
  const rooms = (raw.rooms || []).map((r, i) => {
    const room = {
      id: r.id || `room-${i}`,
      type: r.type || 'UTILITY',
      name: r.name || '기타',
      area: r.area || 0,
      position: r.position || { x: 0, y: 0, width: 1, height: 1 },
    };
    // polygon: [[x,y],...] → [{x,y},...] 변환
    if (r.polygon && Array.isArray(r.polygon)) {
      if (Array.isArray(r.polygon[0])) {
        room.polygon = r.polygon.map(p => ({ x: p[0], y: p[1] }));
      } else {
        room.polygon = r.polygon;
      }
    }
    return room;
  });

  // walls 정규화
  const walls = (raw.walls || []).map((w, i) => {
    const wall = {
      id: w.id || `wall-${i}`,
      start: w.from || w.start || { x: 0, y: 0 },
      end: w.to || w.end || { x: 0, y: 0 },
      thickness: w.thickness || 0.12,
      isExterior: w.isExterior || false,
    };
    if (w.polygon && Array.isArray(w.polygon)) {
      if (Array.isArray(w.polygon[0])) {
        wall.polygon = w.polygon.map(p => ({ x: p[0], y: p[1] }));
      } else {
        wall.polygon = w.polygon;
      }
    }
    return wall;
  });

  // doors 정규화
  const doors = (raw.doors || []).map((d, i) => ({
    id: d.id || `door-${i}`,
    position: d.position || { x: 0, y: 0 },
    width: d.width || 0.9,
    rotation: d.rotation || 0,
    type: d.type || 'swing',
    connectedRooms: d.connectedRooms || [d.roomId || '', ''],
  }));

  // windows 정규화
  const windows = (raw.windows || []).map((w, i) => ({
    id: w.id || `win-${i}`,
    position: w.position || { x: 0, y: 0 },
    width: w.width || 1.0,
    height: w.height || 1.2,
    rotation: w.rotation || 0,
    wallId: w.wallId || '',
  }));

  // fixtures 정규화
  const fixtures = (raw.fixtures || []).map((f, i) => {
    const fix = {
      id: f.id || `fix-${i}`,
      type: f.type || 'toilet',
      roomId: f.roomId || '',
    };
    if (f.position) {
      fix.position = {
        x: f.position.x || 0,
        y: f.position.y || 0,
        width: f.dimensions?.width || f.position.width || 0.5,
        height: f.dimensions?.height || f.position.height || 0.5,
      };
    } else {
      fix.position = { x: 0, y: 0, width: 0.5, height: 0.5 };
    }
    return fix;
  });

  return {
    totalArea: raw.totalArea || knownArea,
    rooms,
    walls,
    doors,
    windows,
    fixtures,
  };
}

async function main() {
  console.log('=== 샘플 도면 Gemini Vision 파싱 시작 ===');

  for (const drawing of DRAWINGS) {
    const rawPlan = await parseDrawing(drawing);
    if (!rawPlan) {
      console.error(`  SKIP: ${drawing.outputId}`);
      continue;
    }

    const normalized = normalizeFloorPlan(rawPlan, drawing.knownArea);
    const outputPath = path.resolve(__dirname, '..', 'public', 'floorplans', `${drawing.outputId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), 'utf-8');
    console.log(`  Saved: ${outputPath}`);
    console.log(`  Rooms: ${normalized.rooms.length}, Walls: ${normalized.walls.length}, Doors: ${normalized.doors.length}, Windows: ${normalized.windows.length}, Fixtures: ${normalized.fixtures.length}`);
  }

  console.log('\n=== 모든 파싱 완료 ===');
}

main().catch(e => console.error('Fatal:', e.message));
