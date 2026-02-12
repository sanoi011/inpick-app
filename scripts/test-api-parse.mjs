// Test the /api/project/parse-drawing endpoint
// Usage: node scripts/test-api-parse.mjs [port]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.argv[2] || '3001';

const pngPath = path.join(__dirname, '..', 'drawings', '_arch', '59.png');
if (!fs.existsSync(pngPath)) {
  console.error('59.png not found');
  process.exit(1);
}

console.log(`Using 59.png, size: ${(fs.statSync(pngPath).size / 1024).toFixed(0)} KB`);

const fileBuffer = fs.readFileSync(pngPath);
const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

let body = '';
body += '--' + boundary + '\r\n';
body += 'Content-Disposition: form-data; name="knownArea"\r\n\r\n';
body += '59\r\n';
body += '--' + boundary + '\r\n';
body += 'Content-Disposition: form-data; name="file"; filename="59.png"\r\n';
body += 'Content-Type: image/png\r\n\r\n';

const bodyStart = Buffer.from(body, 'utf8');
const bodyEnd = Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8');
const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

console.log(`Sending request to http://localhost:${port}/api/project/parse-drawing ...`);
console.log('(This may take 30-60 seconds)');
const startTime = Date.now();

const res = await fetch(`http://localhost:${port}/api/project/parse-drawing`, {
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
  },
  body: fullBody,
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nStatus: ${res.status} (${elapsed}s)`);

const data = await res.json();
console.log('Method:', data.method);
console.log('Confidence:', data.confidence);
console.log('Warnings:', JSON.stringify(data.warnings));
console.log('Processing time:', data.processingTimeMs, 'ms');

if (data.floorPlan) {
  const fp = data.floorPlan;
  console.log('\n=== FloorPlan Result ===');
  console.log('Total area:', fp.totalArea, 'm²');
  console.log('Rooms:', (fp.rooms || []).length);
  (fp.rooms || []).forEach(r => {
    console.log(`  ${r.id}: ${r.name} (${r.type}) area=${r.area}m² pos=[${r.position.x.toFixed(1)},${r.position.y.toFixed(1)} ${r.position.width.toFixed(1)}x${r.position.height.toFixed(1)}]`);
  });
  console.log('Walls:', (fp.walls || []).length);
  console.log('Doors:', (fp.doors || []).length);
  console.log('Windows:', (fp.windows || []).length);
  console.log('Fixtures:', (fp.fixtures || []).length);

  // Save result
  const outPath = path.join(__dirname, '..', 'api_parse_result.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nResult saved to: ${outPath}`);
}
