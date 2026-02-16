/**
 * 네이버 부동산 도면 인식 결과 → ParsedFloorPlan JSON 변환
 *
 * Usage: node scripts/convert-naver-parse.mjs <input.json> <knownArea> <outputName>
 * Example: node scripts/convert-naver-parse.mjs parse_test_result.json 84.97 hoban-3bl-115a
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const inputFile = process.argv[2] || 'parse_test_result.json';
const knownArea = parseFloat(process.argv[3] || '84.97');
const outputName = process.argv[4] || 'hoban-3bl-115a';

console.log(`Input: ${inputFile}`);
console.log(`Known Area: ${knownArea} m²`);
console.log(`Output Name: ${outputName}`);

const raw = JSON.parse(fs.readFileSync(path.join(rootDir, inputFile), 'utf8'));

// ─── Step 1: Calculate scale factor ───
// Sum non-balcony room areas in pixel space
function polygonArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

let totalPixelArea = 0;
const roomAreas = [];
for (const room of raw.rooms) {
  const pxArea = polygonArea(room.polygon);
  roomAreas.push({ name: room.name, type: room.type, pxArea });
  if (room.type !== 'BALCONY') {
    totalPixelArea += pxArea;
  }
}

const scale = Math.sqrt(knownArea / totalPixelArea); // meters per pixel
console.log(`\nTotal non-balcony pixel area: ${totalPixelArea.toFixed(0)} px²`);
console.log(`Scale factor: ${scale.toFixed(6)} m/px`);

// ─── Step 2: Convert coordinates ───
function convertPoint(pt) {
  return {
    x: parseFloat((pt.x * scale).toFixed(3)),
    y: parseFloat((pt.y * scale).toFixed(3))
  };
}

function convertPolygon(pts) {
  return pts.map(convertPoint);
}

// ─── Step 3: Generate rooms ───
const ROOM_TYPE_ORDER = ['LIVING', 'KITCHEN', 'MASTER_BED', 'BED', 'BATHROOM', 'ENTRANCE', 'BALCONY', 'UTILITY', 'CORRIDOR', 'DRESSROOM'];
const ROOM_MATERIAL_MAP = {
  LIVING: 'wood', KITCHEN: 'tile', MASTER_BED: 'wood', BED: 'wood',
  BATHROOM: 'tile', ENTRANCE: 'tile', BALCONY: 'tile', UTILITY: 'tile',
  CORRIDOR: 'wood', DRESSROOM: 'wood'
};

// Track counts for unique naming
const typeCounters = {};
const rooms = raw.rooms.map((room) => {
  const polygon = convertPolygon(room.polygon);
  const pxArea = polygonArea(room.polygon);
  const area = parseFloat((pxArea * scale * scale).toFixed(1));

  // Calculate bounding box in meters
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Generate unique name
  typeCounters[room.type] = (typeCounters[room.type] || 0) + 1;
  const count = typeCounters[room.type];

  let name = room.name;
  if (room.type === 'MASTER_BED') name = '안방';
  else if (room.type === 'BED') name = count <= 1 ? '침실2' : `침실${count + 1}`;
  else if (room.type === 'BATHROOM') name = count <= 1 ? '욕실1' : `욕실${count}`;
  else if (room.type === 'BALCONY') name = count <= 1 ? '발코니1' : `발코니${count}`;

  const id = `room-${room.type.toLowerCase()}-${count}`;

  return {
    id,
    type: room.type,
    name,
    area,
    position: {
      x: parseFloat(minX.toFixed(3)),
      y: parseFloat(minY.toFixed(3)),
      width: parseFloat((maxX - minX).toFixed(3)),
      height: parseFloat((maxY - minY).toFixed(3)),
    },
    polygon,
    material: ROOM_MATERIAL_MAP[room.type] || 'unknown'
  };
});

// ─── Step 4: Generate walls ───
const walls = raw.walls.map((wall, idx) => ({
  start: convertPoint(wall.start),
  end: convertPoint(wall.end),
  thickness: (wall.thicknessMm || 100) / 1000,
  isExterior: wall.isExterior,
  wallType: wall.isExterior ? 'exterior' : 'interior',
  isLoadBearing: wall.isExterior,
}));

// Deduplicate walls (same start+end within tolerance)
const uniqueWalls = [];
for (const wall of walls) {
  const isDup = uniqueWalls.some(w => {
    const d1 = Math.hypot(w.start.x - wall.start.x, w.start.y - wall.start.y) +
               Math.hypot(w.end.x - wall.end.x, w.end.y - wall.end.y);
    const d2 = Math.hypot(w.start.x - wall.end.x, w.start.y - wall.end.y) +
               Math.hypot(w.end.x - wall.start.x, w.end.y - wall.start.y);
    return Math.min(d1, d2) < 0.05;
  });
  if (!isDup) uniqueWalls.push(wall);
}

// ─── Step 5: Generate doors ───
const doors = raw.doors.map((door, idx) => ({
  position: convertPoint(door.position),
  width: (door.widthMm || 800) / 1000,
  rotation: 0,
  type: door.type || 'swing',
  connectedRooms: door.connectedRooms || [],
}));

// ─── Step 6: Generate windows ───
const windows = raw.windows.map((win, idx) => ({
  position: convertPoint(win.position),
  width: (win.widthMm || 1000) / 1000,
  height: (win.heightMm || 1200) / 1000,
  rotation: 0,
}));

// ─── Step 7: Generate fixtures ───
const fixtures = raw.fixtures.map((fix, idx) => {
  const pos = convertPoint(fix.position);
  return {
    type: fix.type,
    position: {
      x: pos.x,
      y: pos.y,
      width: fix.type === 'bathtub' ? 0.7 : fix.type === 'kitchen_sink' ? 0.6 : 0.4,
      height: fix.type === 'bathtub' ? 1.5 : fix.type === 'kitchen_sink' ? 0.5 : 0.5,
    }
  };
});

// ─── Step 8: Assemble ParsedFloorPlan ───
const totalArea = parseFloat(rooms.filter(r => r.type !== 'BALCONY').reduce((sum, r) => sum + r.area, 0).toFixed(1));

const floorPlan = {
  totalArea,
  rooms,
  walls: uniqueWalls,
  doors,
  windows,
  fixtures,
  dimensions: [],
};

// ─── Print summary ───
console.log(`\n=== ParsedFloorPlan Summary ===`);
console.log(`Total area: ${floorPlan.totalArea} m² (target: ${knownArea} m²)`);
console.log(`Rooms: ${floorPlan.rooms.length}`);
floorPlan.rooms.forEach(r => {
  console.log(`  ${r.id}: ${r.name} (${r.type}) ${r.area}m² [${r.position.width.toFixed(1)}×${r.position.height.toFixed(1)}m]`);
});
console.log(`Walls: ${floorPlan.walls.length} (deduped from ${walls.length})`);
console.log(`Doors: ${floorPlan.doors.length}`);
console.log(`Windows: ${floorPlan.windows.length}`);
console.log(`Fixtures: ${floorPlan.fixtures.length}`);

// ─── Save ───
const outPath = path.join(rootDir, 'public', 'floorplans', `${outputName}.json`);
fs.writeFileSync(outPath, JSON.stringify(floorPlan, null, 2));
console.log(`\nSaved: ${outPath}`);

// Also save to drawings/naver/ for reference
const refPath = path.join(rootDir, 'drawings', 'naver', `${outputName}-parsed.json`);
fs.writeFileSync(refPath, JSON.stringify(floorPlan, null, 2));
console.log(`Reference: ${refPath}`);
