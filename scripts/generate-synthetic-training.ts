// 합성 학습 데이터 생성: ParsedFloorPlan JSON → PNG 이미지 + YOLO 라벨
// Usage: npx tsx scripts/generate-synthetic-training.ts
// 출력: datasets/floorplan-yolo/images/ + datasets/floorplan-yolo/labels/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// YOLO 클래스 정의 (8개)
const CLASSES = [
  "door_swing",     // 0
  "door_sliding",   // 1
  "window",         // 2
  "toilet",         // 3
  "sink",           // 4
  "kitchen_sink",   // 5
  "bathtub",        // 6
  "stove",          // 7
] as const;

type YOLOClass = typeof CLASSES[number];

interface BBox {
  cls: number;
  cx: number; // normalized 0-1
  cy: number;
  w: number;
  h: number;
}

interface ParsedFloorPlan {
  totalArea: number;
  rooms: Array<{
    id: string;
    type: string;
    name: string;
    area: number;
    position: { x: number; y: number; width: number; height: number };
    polygon?: { x: number; y: number }[];
  }>;
  walls: Array<{
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness: number;
    isExterior: boolean;
  }>;
  doors: Array<{
    id: string;
    position: { x: number; y: number };
    width: number;
    rotation: number;
    type: string;
  }>;
  windows: Array<{
    id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    rotation: number;
  }>;
  fixtures?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; width: number; height: number };
  }>;
}

const IMG_SIZE = 640; // YOLO standard
const SCALE = 50; // pixels per meter

function loadAllFloorPlans(): { name: string; plan: ParsedFloorPlan }[] {
  const plans: { name: string; plan: ParsedFloorPlan }[] = [];

  // 1. COCO 변환 데이터 (public/floorplans/)
  const fpDir = path.join(rootDir, "public", "floorplans");
  if (fs.existsSync(fpDir)) {
    const files = fs.readdirSync(fpDir).filter(f => f.startsWith("apt-fp-") && f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(fpDir, file), "utf8"));
        plans.push({ name: file.replace(".json", ""), plan: data });
      } catch { /* skip */ }
    }
  }

  // 2. Gemini 테스트 결과
  const testFiles = ["api_parse_result.json", "all_parse_results.json"];
  for (const tf of testFiles) {
    const fp = path.join(rootDir, tf);
    if (!fs.existsSync(fp)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (Array.isArray(data)) {
        data.forEach((d: { floorPlan?: ParsedFloorPlan; name?: string }, i: number) => {
          if (d.floorPlan) plans.push({ name: `gemini-${d.name || i}`, plan: d.floorPlan });
        });
      } else if (data.floorPlan) {
        plans.push({ name: `gemini-${tf}`, plan: data.floorPlan });
      } else if (data.rooms) {
        plans.push({ name: `gemini-${tf}`, plan: data });
      }
    } catch { /* skip */ }
  }

  console.log(`Loaded ${plans.length} floor plans`);
  return plans;
}

function getBoundingBox(plan: ParsedFloorPlan): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const room of plan.rooms) {
    if (room.polygon) {
      for (const p of room.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else {
      const { x, y, width, height } = room.position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    }
  }

  return { minX: isFinite(minX) ? minX : 0, minY: isFinite(minY) ? minY : 0, maxX: isFinite(maxX) ? maxX : 10, maxY: isFinite(maxY) ? maxY : 10 };
}

function renderFloorPlanToCanvas(
  plan: ParsedFloorPlan,
  createCanvas: (w: number, h: number) => any,
  augmentation: { flipH?: boolean; flipV?: boolean; noiseLevel?: number; rotation?: number }
): { canvas: any; toImgCoords: (x: number, y: number) => { ix: number; iy: number }; imgW: number; imgH: number } {
  const bb = getBoundingBox(plan);
  const planW = bb.maxX - bb.minX;
  const planH = bb.maxY - bb.minY;

  // Scale to fit IMG_SIZE with padding
  const padding = 20;
  const availW = IMG_SIZE - padding * 2;
  const availH = IMG_SIZE - padding * 2;
  const scale = Math.min(availW / (planW || 1), availH / (planH || 1));

  const canvas = createCanvas(IMG_SIZE, IMG_SIZE);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);

  const toImg = (x: number, y: number) => {
    let ix = (x - bb.minX) * scale + padding;
    let iy = (y - bb.minY) * scale + padding;
    if (augmentation.flipH) ix = IMG_SIZE - ix;
    if (augmentation.flipV) iy = IMG_SIZE - iy;
    return { ix, iy };
  };

  // Draw rooms (light fill)
  const ROOM_COLORS: Record<string, string> = {
    LIVING: "#E8F4FD", KITCHEN: "#FFF3E0", MASTER_BED: "#E8EAF6",
    BED: "#F3E5F5", BATHROOM: "#E0F2F1", ENTRANCE: "#FBE9E7",
    BALCONY: "#F1F8E9", UTILITY: "#ECEFF1", CORRIDOR: "#F5F5F5", DRESSROOM: "#FCE4EC",
  };

  for (const room of plan.rooms) {
    ctx.fillStyle = ROOM_COLORS[room.type] || "#F5F5F5";
    ctx.strokeStyle = "#CCCCCC";
    ctx.lineWidth = 1;

    if (room.polygon && room.polygon.length >= 3) {
      ctx.beginPath();
      const p0 = toImg(room.polygon[0].x, room.polygon[0].y);
      ctx.moveTo(p0.ix, p0.iy);
      for (let i = 1; i < room.polygon.length; i++) {
        const p = toImg(room.polygon[i].x, room.polygon[i].y);
        ctx.lineTo(p.ix, p.iy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const tl = toImg(room.position.x, room.position.y);
      const br = toImg(room.position.x + room.position.width, room.position.y + room.position.height);
      const w = Math.abs(br.ix - tl.ix);
      const h = Math.abs(br.iy - tl.iy);
      ctx.fillRect(Math.min(tl.ix, br.ix), Math.min(tl.iy, br.iy), w, h);
      ctx.strokeRect(Math.min(tl.ix, br.ix), Math.min(tl.iy, br.iy), w, h);
    }

    // Room label
    const cx = room.polygon
      ? room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length
      : room.position.x + room.position.width / 2;
    const cy = room.polygon
      ? room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length
      : room.position.y + room.position.height / 2;
    const labelPos = toImg(cx, cy);
    ctx.fillStyle = "#333333";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(room.name, labelPos.ix, labelPos.iy);
  }

  // Draw walls (dark lines)
  ctx.strokeStyle = "#2D2D3D";
  for (const wall of plan.walls) {
    const s = toImg(wall.start.x, wall.start.y);
    const e = toImg(wall.end.x, wall.end.y);
    ctx.lineWidth = Math.max(wall.isExterior ? 4 : 2, (wall.thickness || 0.15) * scale * 0.5);
    ctx.beginPath();
    ctx.moveTo(s.ix, s.iy);
    ctx.lineTo(e.ix, e.iy);
    ctx.stroke();
  }

  // Draw doors (arc for swing, lines for sliding)
  ctx.strokeStyle = "#E67E22";
  ctx.lineWidth = 2;
  for (const door of plan.doors) {
    const pos = toImg(door.position.x, door.position.y);
    const dw = (door.width || 0.9) * scale;

    if (door.type === "swing") {
      ctx.beginPath();
      ctx.arc(pos.ix, pos.iy, dw / 2, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.ix, pos.iy);
      ctx.lineTo(pos.ix + dw / 2, pos.iy);
      ctx.stroke();
    } else {
      // Sliding door - parallel lines with arrow
      ctx.beginPath();
      ctx.moveTo(pos.ix - dw / 2, pos.iy);
      ctx.lineTo(pos.ix + dw / 2, pos.iy);
      ctx.stroke();
      // Arrow
      ctx.beginPath();
      ctx.moveTo(pos.ix + dw / 4, pos.iy - 3);
      ctx.lineTo(pos.ix + dw / 2, pos.iy);
      ctx.lineTo(pos.ix + dw / 4, pos.iy + 3);
      ctx.stroke();
    }
  }

  // Draw windows (double lines on wall)
  ctx.strokeStyle = "#60A5FA";
  ctx.lineWidth = 2;
  for (const win of plan.windows) {
    const pos = toImg(win.position.x, win.position.y);
    const ww = (win.width || 1.5) * scale;
    ctx.beginPath();
    ctx.moveTo(pos.ix - ww / 2, pos.iy - 2);
    ctx.lineTo(pos.ix + ww / 2, pos.iy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.ix - ww / 2, pos.iy + 2);
    ctx.lineTo(pos.ix + ww / 2, pos.iy + 2);
    ctx.stroke();
  }

  // Draw fixtures (simple symbols)
  for (const fix of plan.fixtures || []) {
    const pos = toImg(fix.position.x, fix.position.y);
    const fw = (fix.position.width || 0.5) * scale;
    const fh = (fix.position.height || 0.5) * scale;

    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1.5;

    switch (fix.type) {
      case "toilet":
        ctx.fillStyle = "#EEEEEE";
        ctx.fillRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.strokeRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.beginPath();
        ctx.ellipse(pos.ix, pos.iy + fh / 6, fw / 3, fh / 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "sink":
        ctx.fillStyle = "#E3F2FD";
        ctx.fillRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.strokeRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.beginPath();
        ctx.arc(pos.ix, pos.iy, fw / 4, 0, Math.PI, false);
        ctx.stroke();
        break;
      case "kitchen_sink":
        ctx.fillStyle = "#E8F5E9";
        ctx.fillRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.strokeRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.strokeRect(pos.ix - fw / 4, pos.iy - fh / 4, fw / 3, fh / 2);
        ctx.strokeRect(pos.ix + fw / 12, pos.iy - fh / 4, fw / 3, fh / 2);
        break;
      case "bathtub":
        ctx.fillStyle = "#E0F7FA";
        const rr = Math.min(fw, fh) / 4;
        ctx.beginPath();
        ctx.moveTo(pos.ix - fw / 2 + rr, pos.iy - fh / 2);
        ctx.lineTo(pos.ix + fw / 2 - rr, pos.iy - fh / 2);
        ctx.arcTo(pos.ix + fw / 2, pos.iy - fh / 2, pos.ix + fw / 2, pos.iy - fh / 2 + rr, rr);
        ctx.lineTo(pos.ix + fw / 2, pos.iy + fh / 2 - rr);
        ctx.arcTo(pos.ix + fw / 2, pos.iy + fh / 2, pos.ix + fw / 2 - rr, pos.iy + fh / 2, rr);
        ctx.lineTo(pos.ix - fw / 2 + rr, pos.iy + fh / 2);
        ctx.arcTo(pos.ix - fw / 2, pos.iy + fh / 2, pos.ix - fw / 2, pos.iy + fh / 2 - rr, rr);
        ctx.lineTo(pos.ix - fw / 2, pos.iy - fh / 2 + rr);
        ctx.arcTo(pos.ix - fw / 2, pos.iy - fh / 2, pos.ix - fw / 2 + rr, pos.iy - fh / 2, rr);
        ctx.fill();
        ctx.stroke();
        break;
      case "stove":
        ctx.fillStyle = "#FFF3E0";
        ctx.fillRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        ctx.strokeRect(pos.ix - fw / 2, pos.iy - fh / 2, fw, fh);
        // 4 burners
        const bsize = Math.min(fw, fh) / 5;
        for (const [bx, by] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) {
          ctx.beginPath();
          ctx.arc(pos.ix + bx * fw, pos.iy + by * fh, bsize, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
    }
  }

  // Optional: add noise
  if (augmentation.noiseLevel && augmentation.noiseLevel > 0) {
    const imageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
    const data = imageData.data;
    const noise = augmentation.noiseLevel;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * noise;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return { canvas, toImgCoords: toImg, imgW: IMG_SIZE, imgH: IMG_SIZE };
}

function extractYOLOLabels(
  plan: ParsedFloorPlan,
  toImg: (x: number, y: number) => { ix: number; iy: number },
  imgW: number,
  imgH: number,
  scale: number,
  bb: { minX: number; minY: number; maxX: number; maxY: number }
): BBox[] {
  const bboxes: BBox[] = [];

  // Doors
  for (const door of plan.doors) {
    const pos = toImg(door.position.x, door.position.y);
    const dw = (door.width || 0.9) * scale;
    const dh = dw; // square-ish bounding box for door symbol
    const cls = door.type === "sliding" ? 1 : 0;
    bboxes.push({
      cls,
      cx: pos.ix / imgW,
      cy: pos.iy / imgH,
      w: Math.min(dw / imgW, 0.3),
      h: Math.min(dh / imgH, 0.3),
    });
  }

  // Windows
  for (const win of plan.windows) {
    const pos = toImg(win.position.x, win.position.y);
    const ww = (win.width || 1.5) * scale;
    const wh = 10; // thin strip
    bboxes.push({
      cls: 2,
      cx: pos.ix / imgW,
      cy: pos.iy / imgH,
      w: Math.min(ww / imgW, 0.4),
      h: Math.min(wh / imgH, 0.1),
    });
  }

  // Fixtures
  for (const fix of plan.fixtures || []) {
    const fixtureClassMap: Record<string, number> = {
      toilet: 3, sink: 4, kitchen_sink: 5, bathtub: 6, stove: 7,
    };
    const cls = fixtureClassMap[fix.type];
    if (cls === undefined) continue;

    const pos = toImg(fix.position.x + (fix.position.width || 0.5) / 2, fix.position.y + (fix.position.height || 0.5) / 2);
    const fw = (fix.position.width || 0.5) * scale;
    const fh = (fix.position.height || 0.5) * scale;
    bboxes.push({
      cls,
      cx: pos.ix / imgW,
      cy: pos.iy / imgH,
      w: Math.min(fw / imgW, 0.3),
      h: Math.min(fh / imgH, 0.3),
    });
  }

  // Filter out-of-bounds
  return bboxes.filter(b =>
    b.cx > 0.01 && b.cx < 0.99 && b.cy > 0.01 && b.cy < 0.99 &&
    b.w > 0.005 && b.h > 0.005
  );
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("canvas");

  const plans = loadAllFloorPlans();
  if (plans.length === 0) {
    console.error("No floor plans found!");
    process.exit(1);
  }

  // Output directories
  const outDir = path.join(rootDir, "datasets", "floorplan-yolo");
  const trainImgDir = path.join(outDir, "images", "train");
  const trainLblDir = path.join(outDir, "labels", "train");
  const valImgDir = path.join(outDir, "images", "val");
  const valLblDir = path.join(outDir, "labels", "val");

  for (const dir of [trainImgDir, trainLblDir, valImgDir, valLblDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Augmentation variants per plan
  const AUGMENTATIONS = [
    { flipH: false, flipV: false, noiseLevel: 0 },
    { flipH: true, flipV: false, noiseLevel: 0 },
    { flipH: false, flipV: true, noiseLevel: 0 },
    { flipH: true, flipV: true, noiseLevel: 0 },
    { flipH: false, flipV: false, noiseLevel: 30 },
    { flipH: true, flipV: false, noiseLevel: 30 },
    { flipH: false, flipV: false, noiseLevel: 60 },
    { flipH: false, flipV: true, noiseLevel: 60 },
  ];

  let totalImages = 0;
  let totalLabels = 0;

  for (let pi = 0; pi < plans.length; pi++) {
    const { name, plan } = plans[pi];

    // Skip plans without detectable objects
    const objCount = plan.doors.length + plan.windows.length + (plan.fixtures?.length || 0);
    if (objCount === 0) {
      console.log(`  Skip ${name}: no objects`);
      continue;
    }

    const bb = getBoundingBox(plan);
    const planW = bb.maxX - bb.minX;
    const planH = bb.maxY - bb.minY;
    const padding = 20;
    const scale = Math.min((IMG_SIZE - padding * 2) / (planW || 1), (IMG_SIZE - padding * 2) / (planH || 1));

    for (let ai = 0; ai < AUGMENTATIONS.length; ai++) {
      const aug = AUGMENTATIONS[ai];
      const { canvas, toImgCoords } = renderFloorPlanToCanvas(plan, createCanvas, aug);
      const labels = extractYOLOLabels(plan, toImgCoords, IMG_SIZE, IMG_SIZE, scale, bb);

      if (labels.length === 0) continue;

      // 80% train, 20% val
      const isVal = ai >= 6;
      const imgDir = isVal ? valImgDir : trainImgDir;
      const lblDir = isVal ? valLblDir : trainLblDir;

      const baseName = `${name}_aug${ai}`;
      const imgPath = path.join(imgDir, `${baseName}.png`);
      const lblPath = path.join(lblDir, `${baseName}.txt`);

      // Save image
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(imgPath, buffer);

      // Save YOLO label
      const labelLines = labels.map(b =>
        `${b.cls} ${b.cx.toFixed(6)} ${b.cy.toFixed(6)} ${b.w.toFixed(6)} ${b.h.toFixed(6)}`
      );
      fs.writeFileSync(lblPath, labelLines.join("\n") + "\n");

      totalImages++;
      totalLabels += labels.length;
    }

    console.log(`  ${name}: ${objCount} objects, ${AUGMENTATIONS.length} augmentations`);
  }

  // Write dataset.yaml for YOLO
  const yamlContent = `# INPICK Floor Plan Symbol Detection
path: ${outDir.replace(/\\/g, "/")}
train: images/train
val: images/val

nc: ${CLASSES.length}
names: [${CLASSES.map(c => `"${c}"`).join(", ")}]
`;
  fs.writeFileSync(path.join(outDir, "dataset.yaml"), yamlContent);

  console.log(`\n=== Complete ===`);
  console.log(`Total images: ${totalImages}`);
  console.log(`Total labels: ${totalLabels}`);
  console.log(`Dataset YAML: ${path.join(outDir, "dataset.yaml")}`);
  console.log(`\nClasses: ${CLASSES.join(", ")}`);
}

main().catch(console.error);
