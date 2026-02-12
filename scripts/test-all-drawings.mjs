// Test all 3 drawings through the parse-drawing API
// Usage: node scripts/test-all-drawings.mjs [port]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.argv[2] || '3001';

const DRAWINGS = [
  { file: '59.png', knownArea: 59, name: '59㎡형' },
  { file: '84A.png', knownArea: 84, name: '84㎡A형' },
  { file: '84d.png', knownArea: 84, name: '84㎡B형' },
];

async function testDrawing({ file, knownArea, name }) {
  const pngPath = path.join(__dirname, '..', 'drawings', '_arch', file);
  if (!fs.existsSync(pngPath)) {
    console.error(`  [SKIP] ${file} not found`);
    return null;
  }

  const fileBuffer = fs.readFileSync(pngPath);
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

  let body = '';
  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="knownArea"\r\n\r\n';
  body += knownArea + '\r\n';
  body += '--' + boundary + '\r\n';
  body += `Content-Disposition: form-data; name="file"; filename="${file}"\r\n`;
  body += 'Content-Type: image/png\r\n\r\n';

  const bodyStart = Buffer.from(body, 'utf8');
  const bodyEnd = Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8');
  const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

  const startTime = Date.now();
  const res = await fetch(`http://localhost:${port}/api/project/parse-drawing`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body: fullBody,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!res.ok) {
    console.error(`  [ERROR] Status ${res.status} (${elapsed}s)`);
    const err = await res.text();
    console.error(`  ${err.substring(0, 200)}`);
    return null;
  }

  const data = await res.json();
  return { ...data, elapsed, name, file };
}

// Wait for dev server
console.log(`Waiting for dev server on port ${port}...`);
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`http://localhost:${port}`);
    break;
  } catch {
    await new Promise(r => setTimeout(r, 1000));
  }
}

console.log('\n========================================');
console.log('  INPICK 도면 인식 테스트');
console.log('========================================\n');

const results = [];

for (const drawing of DRAWINGS) {
  console.log(`\n--- ${drawing.name} (${drawing.file}, ${drawing.knownArea}m²) ---`);
  console.log('  Sending...');

  const result = await testDrawing(drawing);
  if (!result) continue;

  results.push(result);

  console.log(`  Status: ${result.method} (${result.elapsed}s, ${result.processingTimeMs}ms)`);
  console.log(`  Confidence: ${result.confidence}`);
  if (result.warnings?.length > 0) {
    console.log(`  Warnings: ${result.warnings.join(', ')}`);
  }

  const fp = result.floorPlan;
  console.log(`  Total area: ${fp.totalArea}m² (expected: ${drawing.knownArea}m²)`);
  console.log(`  Rooms: ${fp.rooms?.length || 0}`);
  (fp.rooms || []).forEach(r => {
    const pos = r.position;
    console.log(`    ${r.id}: ${r.name} (${r.type}) ${r.area}m² [${pos.x.toFixed(1)},${pos.y.toFixed(1)} ${pos.width.toFixed(1)}x${pos.height.toFixed(1)}]`);
  });
  console.log(`  Walls: ${fp.walls?.length || 0}, Doors: ${fp.doors?.length || 0}, Windows: ${fp.windows?.length || 0}, Fixtures: ${fp.fixtures?.length || 0}`);
}

// Summary
console.log('\n========================================');
console.log('  요약');
console.log('========================================\n');

for (const r of results) {
  const fp = r.floorPlan;
  const areaError = Math.abs(fp.totalArea - r.confidence).toFixed(1);
  console.log(`${r.name}: ${r.method} | ${r.elapsed}s | conf=${r.confidence} | ${fp.rooms?.length}실 ${fp.walls?.length}벽 ${fp.doors?.length}문 ${fp.windows?.length}창 ${fp.fixtures?.length}설비 | ${fp.totalArea}m²`);
}

// Save all results
const outPath = path.join(__dirname, '..', 'all_parse_results.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults saved to: ${outPath}`);
