import fs from 'fs';

const TILE_ROOMS = new Set(['BATHROOM', 'ENTRANCE', 'BALCONY', 'UTILITY']);
const round = v => Math.round(v * 1000) / 1000;

const files = [
  'public/floorplans/sample-59.json',
  'public/floorplans/sample-84a.json',
  'public/floorplans/sample-84b.json',
];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let modified = false;

  for (const room of data.rooms) {
    if (!room.material) {
      room.material = TILE_ROOMS.has(room.type) ? 'tile' : 'wood';
      modified = true;
    }
    if (!room.center && room.polygon && room.polygon.length >= 3) {
      let cx = 0, cy = 0;
      for (const p of room.polygon) { cx += p.x; cy += p.y; }
      room.center = {
        x: round(cx / room.polygon.length),
        y: round(cy / room.polygon.length),
      };
      modified = true;
    }
  }

  for (const wall of data.walls || []) {
    if (!wall.wallType) {
      wall.wallType = wall.isExterior ? 'exterior' : 'partition';
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`Enriched: ${file} (${data.rooms.length} rooms, ${(data.walls||[]).length} walls)`);
  } else {
    console.log(`Already enriched: ${file}`);
  }
}
