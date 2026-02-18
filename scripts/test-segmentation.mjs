/**
 * 세그멘테이션 마스크 생성 테스트
 * 기존 도면 이미지(PNG)를 Gemini Pro에 전달하여 마스크 + JSON 출력 검증
 *
 * Usage: node scripts/test-segmentation.mjs [image_path]
 *   default: drawings/_arch/84d.png
 */
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MODEL = "gemini-3-pro-image-preview";
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GOOGLE_GEMINI_API_KEY not set in .env.local");
  process.exit(1);
}

const imagePath = process.argv[2] || "drawings/_arch/84d.png";
if (!fs.existsSync(imagePath)) {
  console.error(`ERROR: Image not found: ${imagePath}`);
  process.exit(1);
}

const segPrompt = `You are a floor plan analysis AI. Given a clean architectural floor plan image, generate a COLOR-CODED SEGMENTATION MASK image.

INSTRUCTIONS:
1. Output a PNG image of EXACTLY the same pixel dimensions as the input image.
2. Fill each room/space with a SOLID, FLAT color according to this EXACT color mapping:
   - Living Room (거실): #FF0000 (pure red)
   - Bedroom 1 (안방/침실1, largest bedroom): #00FF00 (pure green)
   - Bedroom 2 (침실2): #0000FF (pure blue)
   - Bedroom 3 (침실3): #FFFF00 (yellow)
   - Kitchen (주방): #FF00FF (magenta)
   - Bathroom 1 (욕실1, main): #00FFFF (cyan)
   - Bathroom 2 (욕실2): #FF8000 (orange)
   - Entrance (현관): #8000FF (purple)
   - Balcony 1 (발코니1): #00FF80 (spring green)
   - Balcony 2 (발코니2): #FF0080 (rose)
   - Utility Room (다용도실): #80FF00 (chartreuse)
   - Dressing Room (드레스룸): #0080FF (azure)
   - Hallway/Corridor (복도): #808080 (gray)
   - Walls: #000000 (black)
   - Background/outside: #FFFFFF (white)

3. CRITICAL REQUIREMENTS:
   - Each room must be filled with ONE SOLID color - NO gradients, NO textures, NO anti-aliasing at edges.
   - Use sharp, hard edges between rooms (nearest-neighbor style).
   - The mask must align pixel-perfectly with the input floor plan walls.
   - If a room type appears multiple times, use the numbered variants (Bedroom 1 = largest, Bedroom 2 = second largest).
   - Door openings should be colored as the room they open into.
   - Window areas on walls remain wall color (#000000).
   - Fill the ENTIRE interior area of each room with the solid color.

4. After generating the mask image, output a JSON block listing which rooms you identified:
\`\`\`json
{
  "rooms": [
    {"type": "living", "color": "#FF0000", "label": "거실"},
    {"type": "bedroom1", "color": "#00FF00", "label": "안방"},
    {"type": "kitchen", "color": "#FF00FF", "label": "주방"}
  ]
}
\`\`\`

IMPORTANT: Output the segmentation mask image FIRST, then the JSON block.`;

async function main() {
  console.log("=== Segmentation Mask Test ===");
  console.log(`Image: ${imagePath}`);
  console.log(`Model: ${MODEL}`);
  console.log("");

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`MIME: ${mimeType}`);
  console.log("");

  const ai = new GoogleGenAI({ apiKey });

  console.log("[1/3] Calling Gemini Pro for segmentation mask...");
  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: segPrompt },
          ],
        },
      ],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   Gemini responded in ${elapsed}s`);

    // Parse response
    let maskData = null;
    let jsonText = null;
    let parsedRooms = [];

    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content?.parts || [];
      console.log(`   Response parts: ${parts.length}`);

      for (const part of parts) {
        if (part.inlineData) {
          maskData = Buffer.from(part.inlineData.data, "base64");
          console.log(`   Mask image: ${(maskData.length / 1024).toFixed(1)} KB (${part.inlineData.mimeType})`);
        }
        if (part.text) {
          jsonText = part.text;
          const jsonMatch = part.text.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              parsedRooms = parsed.rooms || [];
            } catch (e) {
              console.error("   JSON parse error:", e.message);
            }
          }
        }
      }
    }

    console.log("");

    // [2/3] Validate mask
    console.log("[2/3] Validating mask...");
    if (!maskData) {
      console.error("   FAIL: No mask image in response");
      if (jsonText) console.log("   Text response:", jsonText.substring(0, 200));
      process.exit(1);
    }

    // Save mask
    const outDir = path.dirname(imagePath);
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const maskPath = path.join(outDir, `${baseName}_mask.png`);
    fs.writeFileSync(maskPath, maskData);
    console.log(`   Mask saved: ${maskPath}`);

    // Check dimensions with sharp (if available)
    try {
      const sharp = (await import("sharp")).default;
      const origMeta = await sharp(imageBuffer).metadata();
      const maskMeta = await sharp(maskData).metadata();
      console.log(`   Original: ${origMeta.width}x${origMeta.height}`);
      console.log(`   Mask:     ${maskMeta.width}x${maskMeta.height}`);

      if (origMeta.width !== maskMeta.width || origMeta.height !== maskMeta.height) {
        console.log("   Size mismatch - resizing with nearest-neighbor...");
        const resized = await sharp(maskData)
          .resize(origMeta.width, origMeta.height, { kernel: "nearest" })
          .png()
          .toBuffer();
        const resizedPath = path.join(outDir, `${baseName}_mask_resized.png`);
        fs.writeFileSync(resizedPath, resized);
        console.log(`   Resized mask saved: ${resizedPath}`);
      } else {
        console.log("   Dimensions match!");
      }

      // Analyze mask colors
      const { data, info } = await sharp(maskData).raw().toBuffer({ resolveWithObject: true });
      const colorCounts = {};
      const pixels = info.width * info.height;
      for (let i = 0; i < pixels; i++) {
        const r = data[i * info.channels];
        const g = data[i * info.channels + 1];
        const b = data[i * info.channels + 2];
        const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      // Simulate FloorPlanCanvas matching (same algorithm)
      const expectedColors = {
        living:    { hex: "#FF0000", rgb: [255, 0, 0],     label: "거실" },
        bedroom1:  { hex: "#00FF00", rgb: [0, 255, 0],     label: "침실1" },
        bedroom2:  { hex: "#0000FF", rgb: [0, 0, 255],     label: "침실2" },
        bedroom3:  { hex: "#FFFF00", rgb: [255, 255, 0],   label: "침실3" },
        kitchen:   { hex: "#FF00FF", rgb: [255, 0, 255],   label: "주방" },
        bathroom1: { hex: "#00FFFF", rgb: [0, 255, 255],   label: "욕실1" },
        bathroom2: { hex: "#FF8000", rgb: [255, 128, 0],   label: "욕실2" },
        entrance:  { hex: "#8000FF", rgb: [128, 0, 255],   label: "현관" },
        balcony1:  { hex: "#00FF80", rgb: [0, 255, 128],   label: "발코니1" },
        balcony2:  { hex: "#FF0080", rgb: [255, 0, 128],   label: "발코니2" },
        utility:   { hex: "#80FF00", rgb: [128, 255, 0],   label: "다용도실" },
        dressroom: { hex: "#0080FF", rgb: [0, 128, 255],   label: "드레스룸" },
        hallway:   { hex: "#808080", rgb: [128, 128, 128], label: "복도" },
      };

      // Pixel-level matching (same as FloorPlanCanvas.buildPixelCache)
      const roomPixelCounts = {};
      const colorTargets = Object.entries(expectedColors).map(([type, c]) => ({
        type, r: c.rgb[0], g: c.rgb[1], b: c.rgb[2],
      }));

      let wallPx = 0, bgPx = 0, matchedPx = 0, unmatchedPx = 0;
      for (let i = 0; i < pixels; i++) {
        const pr = data[i * info.channels];
        const pg = data[i * info.channels + 1];
        const pb = data[i * info.channels + 2];

        if (pr < 20 && pg < 20 && pb < 20) { wallPx++; continue; }
        if (pr > 235 && pg > 235 && pb > 235) { bgPx++; continue; }

        let bestDist = Infinity, bestType = null;
        for (const c of colorTargets) {
          const d = (pr-c.r)**2 + (pg-c.g)**2 + (pb-c.b)**2;
          if (d < bestDist) { bestDist = d; bestType = c.type; }
        }
        if (bestType && bestDist < 7500) {
          roomPixelCounts[bestType] = (roomPixelCounts[bestType] || 0) + 1;
          matchedPx++;
        } else {
          unmatchedPx++;
        }
      }

      console.log("");
      console.log("   === Pixel Classification (FloorPlanCanvas algorithm) ===");
      console.log(`   Background (white): ${bgPx.toLocaleString()} px (${((bgPx/pixels)*100).toFixed(1)}%)`);
      console.log(`   Walls (black):      ${wallPx.toLocaleString()} px (${((wallPx/pixels)*100).toFixed(1)}%)`);
      console.log(`   Room matched:       ${matchedPx.toLocaleString()} px (${((matchedPx/pixels)*100).toFixed(1)}%)`);
      console.log(`   Unmatched:          ${unmatchedPx.toLocaleString()} px (${((unmatchedPx/pixels)*100).toFixed(1)}%)`);
      console.log("");

      const sortedRooms = Object.entries(roomPixelCounts)
        .sort((a, b) => b[1] - a[1]);

      if (sortedRooms.length > 0) {
        console.log("   Detected rooms:");
        for (const [type, count] of sortedRooms) {
          const pct = ((count / pixels) * 100).toFixed(1);
          const label = expectedColors[type]?.label || type;
          console.log(`     OK ${expectedColors[type]?.hex} → ${pct}% (${count.toLocaleString()} px) — ${label}`);
        }
      } else {
        console.log("   WARNING: No rooms detected in mask!");
      }
    } catch (e) {
      console.log("   (sharp not available for detailed analysis)");
    }

    console.log("");

    // [3/3] Validate JSON
    console.log("[3/3] Validating room JSON...");
    if (parsedRooms.length === 0) {
      console.log("   No JSON from Gemini - using fallback (all ROOM_TYPE_COLORS)");
      // Same fallback as route.ts: use all known room types
      parsedRooms = Object.entries(expectedColors).map(([type, info]) => ({
        type,
        color: info.hex,
        label: info.label,
      }));
      console.log(`   Fallback: ${parsedRooms.length} room types`);
    } else {
      console.log(`   Detected ${parsedRooms.length} rooms from JSON`);
    }
    for (const room of parsedRooms) {
      const pixelCount = roomPixelCounts[room.type] || 0;
      const marker = pixelCount > 0 ? "OK" : "--";
      console.log(`     ${marker} ${room.type}: ${room.color} (${room.label}) — ${pixelCount.toLocaleString()} px`);
    }

    console.log("");
    console.log("=== Test Complete ===");
    console.log(`Total time: ${elapsed}s`);
    console.log(`Mask: ${maskData ? "YES" : "NO"}`);
    console.log(`Rooms: ${parsedRooms.length}`);
    const detectedCount = Object.keys(roomPixelCounts).length;
    console.log(`Rooms detected in mask: ${detectedCount}`);
    console.log(`Result: ${maskData && detectedCount > 0 ? "PASS" : "PARTIAL"}`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`   FAIL after ${elapsed}s:`, err.message);
    if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
      console.error("   Rate limited - try again in 30s");
    }
    process.exit(1);
  }
}

main();
