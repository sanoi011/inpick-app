/**
 * Test: Can Gemini 3 Pro Image Preview generate architectural drawings
 * from an existing clean floor plan image?
 *
 * Tests:
 *   1. Pyeongmyeondo (Architectural Floor Plan)
 *   2. Cheonjeongdo (Reflected Ceiling Plan / RCP)
 *   3. Living Room Elevation Drawing
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '..');

const API_KEY = 'AIzaSyB6t6lpQBYp_V9tSZ49YnYPbJo5Hzddcs0';
const MODEL = 'gemini-3-pro-image-preview';
const IMAGE_URL =
  'https://pyhsjjtxcfmkcqmaxozd.supabase.co/storage/v1/object/public/uploads/floorplans/6165/3/clean.png';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadImage(url) {
  console.log('\n[Download] Fetching clean floor plan from:\n  ' + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed: ' + res.status + ' ' + res.statusText);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('[Download] OK - ' + buf.length + ' bytes (' + (buf.length / 1024).toFixed(1) + ' KB)');
  return buf;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

const TESTS = [
  {
    name: 'Test 1: \ud3c9\uba74\ub3c4 (Architectural Floor Plan)',
    outputFile: '_test_floorplan.png',
    prompt: 'Based on this apartment floor plan image, generate a professional architectural floor plan drawing (\ud3c9\uba74\ub3c4). Include: precise dimension lines (in mm), room labels in Korean, wall thickness representation, door swing arcs, window symbols (double line), and fixture symbols (toilet, sink, bathtub, kitchen sink). Style: clean black and white CAD-style drawing with professional architectural line weights. Scale bar at bottom.',
  },
  {
    name: 'Test 2: \ucc9c\uc815\ub3c4 (Reflected Ceiling Plan / RCP)',
    outputFile: '_test_ceiling.png',
    prompt: 'Based on this apartment floor plan image, generate a professional Reflected Ceiling Plan (\ucc9c\uc815\ub3c4/\ucc9c\uc7a5\ub3c4). Show: ceiling height annotations for each room (2300mm for bathrooms, 2400mm for other rooms), recessed lighting positions (circles), AC cassette positions (squares with X), ceiling molding lines, bulkhead/soffit areas above kitchen and bathroom. Style: clean architectural drawing, dashed lines for ceiling features, solid lines for walls.',
  },
  {
    name: 'Test 3: \uac70\uc2e4 \uc785\uba74\uc804\uac1c\ub3c4 (Living Room Elevation Drawing)',
    outputFile: '_test_elevation.png',
    prompt: 'Based on this apartment floor plan image, generate interior elevation drawings (\uc785\uba74\uc804\uac1c\ub3c4) for the living room. Show all 4 walls unfolded side by side (A-B-C-D walls). Include: wall dimensions (width x height 2400mm), window with dimensions, TV wall with console furniture outline, electrical outlets (at 300mm height), light switches (at 1200mm), AC unit position. Style: professional architectural elevation drawing with dimension lines.',
  },
];


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('======================================================================');
  console.log('  Gemini 3 Pro Image Preview - Architectural Drawing Generation Test');
  console.log('======================================================================');

  // 1. Download the source image
  const imageBuffer = await downloadImage(IMAGE_URL);
  const base64Image = imageBuffer.toString('base64');

  // 2. Initialise SDK
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  console.log('\n[SDK] Initialised - model: ' + MODEL);

  // 3. Run tests sequentially
  const results = [];

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const outputPath = path.join(OUTPUT_DIR, test.outputFile);
    console.log('\n----------------------------------------------------------------------');
    console.log('  ' + test.name);
    console.log('----------------------------------------------------------------------');

    const t0 = Date.now();
    let success = false;
    let imageSize = 0;
    let textResponse = '';
    let errorMsg = '';

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Image,
                },
              },
              { text: test.prompt },
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      });

      // Parse response parts
      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const imgBuf = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(outputPath, imgBuf);
            imageSize = imgBuf.length;
            success = true;
            console.log('  [Image] Saved to ' + outputPath);
            console.log('  [Image] Size: ' + imgBuf.length + ' bytes (' + (imgBuf.length / 1024).toFixed(1) + ' KB)');
          }
          if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!success) {
        errorMsg = 'No image returned in response';
        if (textResponse) {
          errorMsg += ' - model text: ' + textResponse.substring(0, 300);
        }
      }
    } catch (err) {
      errorMsg = '' + (err.message || err);
      if (err.response) {
        try {
          errorMsg += ' | ' + JSON.stringify(err.response).substring(0, 300);
        } catch (_) {}
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    results.push({
      name: test.name,
      success,
      imageSize,
      textResponse: textResponse.substring(0, 500),
      errorMsg,
      elapsed,
    });

    console.log('  [Result]  ' + (success ? 'SUCCESS' : 'FAIL'));
    if (imageSize) console.log('  [Size]    ' + imageSize + ' bytes (' + (imageSize / 1024).toFixed(1) + ' KB)');
    if (textResponse) console.log('  [Text]    ' + textResponse.substring(0, 300));
    if (errorMsg) console.log('  [Error]   ' + errorMsg);
    console.log('  [Time]    ' + elapsed + 's');

    // Wait between tests to avoid rate limits
    if (i < TESTS.length - 1) {
      console.log('\n  Waiting 5 seconds before next test...');
      await sleep(5000);
    }
  }

  // 4. Summary
  console.log('\n======================================================================');
  console.log('  SUMMARY');
  console.log('======================================================================');
  console.log('  Total tests:  ' + results.length);
  console.log('  Succeeded:    ' + results.filter((r) => r.success).length);
  console.log('  Failed:       ' + results.filter((r) => !r.success).length);
  console.log('');

  for (const r of results) {
    const status = r.success ? 'PASS' : 'FAIL';
    const size = r.imageSize ? (r.imageSize / 1024).toFixed(1) + ' KB' : '-';
    console.log('  [' + status + '] ' + r.name);
    console.log('         Time: ' + r.elapsed + 's | Image: ' + size);
    if (r.textResponse) {
      console.log('         Text: ' + r.textResponse.substring(0, 120) + (r.textResponse.length > 120 ? '...' : ''));
    }
    if (r.errorMsg) {
      console.log('         Error: ' + r.errorMsg.substring(0, 200));
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
