/**
 * 건축도면 COCO 데이터 → INPICK ParsedFloorPlan 변환 스크립트
 *
 * 실행: npx tsx scripts/process-drawings.ts
 *
 * 입력: drawings/_extract/SPA/APT_FP_SPA_*.json
 * 출력: public/floorplans/index.json + public/floorplans/{id}.json
 */

import * as fs from "fs";
import * as path from "path";
import type { COCOFile, COCOAnnotation } from "./coco-types";
import { CATEGORY_TO_ROOM_TYPE, SKIP_CATEGORIES, CATEGORY_LABELS } from "./coco-types";

// ─── Types matching src/types/floorplan.ts ───

interface Point {
  x: number;
  y: number;
}

interface RoomData {
  id: string;
  type: string;
  name: string;
  area: number;
  position: { x: number; y: number; width: number; height: number };
  polygon: Point[];
}

interface WallData {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  isExterior: boolean;
  polygon?: Point[];
}

interface DoorData {
  id: string;
  position: Point;
  width: number;
  rotation: number;
  type: "swing" | "sliding" | "folding";
  connectedRooms: [string, string];
}

interface WindowData {
  id: string;
  position: Point;
  width: number;
  height: number;
  rotation: number;
  wallId: string;
}

interface FixtureData {
  id: string;
  type: "toilet" | "sink" | "kitchen_sink" | "bathtub" | "stove";
  position: { x: number; y: number; width: number; height: number };
  roomId?: string;
}

interface ParsedFloorPlan {
  totalArea: number;
  rooms: RoomData[];
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  fixtures?: FixtureData[];
}

interface CatalogEntry {
  id: string;
  fileName: string;
  buildingType: string;
  totalArea: number;
  roomCount: number;
  bathroomCount: number;
  rooms: { type: string; name: string; area: number }[];
}

// ─── Geometry utilities ───

function shoelaceArea(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

function centroid(polygon: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / polygon.length, y: cy / polygon.length };
}

function boundingBox(polygon: Point[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Convert flat [x1,y1,x2,y2,...] to Point[] */
function flatToPoints(flat: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length - 1; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

// ─── Main processing ───

function processOneSPA(filePath: string): { plan: ParsedFloorPlan; catalog: CatalogEntry } | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const coco: COCOFile = JSON.parse(raw);

  if (!coco.annotations || coco.annotations.length === 0) return null;

  // Filter annotations: only room spaces (skip background, common areas)
  const roomAnnotations = coco.annotations.filter(
    (a) => !SKIP_CATEGORIES.has(a.category_id) && CATEGORY_TO_ROOM_TYPE[a.category_id]
  );

  if (roomAnnotations.length === 0) return null;

  // Collect all polygon points in pixel space
  const allPixelPolygons: { ann: COCOAnnotation; polygon: Point[] }[] = [];
  for (const ann of roomAnnotations) {
    if (!ann.segmentation || ann.segmentation.length === 0 || ann.segmentation[0].length < 6) {
      continue;
    }
    const polygon = flatToPoints(ann.segmentation[0]);
    allPixelPolygons.push({ ann, polygon });
  }

  if (allPixelPolygons.length === 0) return null;

  // Compute total pixel area of all rooms (for scale estimation)
  let totalPixelArea = 0;
  for (const { polygon } of allPixelPolygons) {
    totalPixelArea += shoelaceArea(polygon);
  }

  // Estimate real-world area: typical Korean apartment ~59-134m²
  // Use annotation count to guess size: more rooms/spaces = larger apartment
  const uniqueRoomTypes = new Set(allPixelPolygons.map((p) => p.ann.category_id));
  const bedCount = allPixelPolygons.filter((p) => p.ann.category_id === 14).length;
  const bathCount = allPixelPolygons.filter((p) => p.ann.category_id === 18).length;

  // Estimate total m² based on room composition
  let estimatedM2: number;
  if (bedCount >= 4) estimatedM2 = 134;
  else if (bedCount >= 3) estimatedM2 = 99;
  else if (bedCount >= 2) estimatedM2 = 84;
  else if (bedCount >= 1) estimatedM2 = 59;
  else estimatedM2 = 49;

  // Add area for balconies, utility, etc.
  const hasBalcony = allPixelPolygons.some((p) => p.ann.category_id === 17);
  if (hasBalcony) estimatedM2 += 10;

  // Compute pixels per meter
  const pixelsPerMeter = Math.sqrt(totalPixelArea / estimatedM2);

  // Find global min for coordinate normalization
  let globalMinX = Infinity;
  let globalMinY = Infinity;
  for (const { polygon } of allPixelPolygons) {
    for (const p of polygon) {
      if (p.x < globalMinX) globalMinX = p.x;
      if (p.y < globalMinY) globalMinY = p.y;
    }
  }

  // Convert to meter-space coordinates
  const rooms: RoomData[] = [];
  let roomIdx = 0;
  const bedrooms: { idx: number; area: number }[] = [];

  for (const { ann, polygon: pixelPoly } of allPixelPolygons) {
    const roomType = CATEGORY_TO_ROOM_TYPE[ann.category_id];
    if (!roomType) continue;

    // Convert to meters
    const meterPoly = pixelPoly.map((p) => ({
      x: Math.round(((p.x - globalMinX) / pixelsPerMeter) * 100) / 100,
      y: Math.round(((p.y - globalMinY) / pixelsPerMeter) * 100) / 100,
    }));

    const areaM2 = Math.round(shoelaceArea(meterPoly) * 10) / 10;
    const bbox = boundingBox(meterPoly);
    const label = CATEGORY_LABELS[ann.category_id] || "기타";

    const room: RoomData = {
      id: `room-${roomIdx}`,
      type: roomType,
      name: label,
      area: areaM2,
      position: {
        x: Math.round(bbox.x * 100) / 100,
        y: Math.round(bbox.y * 100) / 100,
        width: Math.round(bbox.width * 100) / 100,
        height: Math.round(bbox.height * 100) / 100,
      },
      polygon: meterPoly,
    };

    if (roomType === "BED") {
      bedrooms.push({ idx: roomIdx, area: areaM2 });
    }

    rooms.push(room);
    roomIdx++;
  }

  // Largest bedroom becomes MASTER_BED
  if (bedrooms.length > 0) {
    bedrooms.sort((a, b) => b.area - a.area);
    const masterIdx = bedrooms[0].idx;
    rooms[masterIdx].type = "MASTER_BED";
    rooms[masterIdx].name = "안방";

    // Number other bedrooms
    let bedNum = 1;
    for (let i = 1; i < bedrooms.length; i++) {
      rooms[bedrooms[i].idx].name = `침실${bedrooms.length > 2 ? bedNum : ""}`;
      bedNum++;
    }
  }

  // Number bathrooms if multiple
  const bathrooms = rooms.filter((r) => r.type === "BATHROOM");
  if (bathrooms.length > 1) {
    bathrooms.forEach((r, i) => {
      r.name = `욕실${i + 1}`;
    });
  }

  // Generate simple walls from room boundaries (exterior hull)
  const walls = generateWallsFromRooms(rooms);

  // Compute total area
  const totalArea = Math.round(rooms.reduce((sum, r) => sum + r.area, 0) * 10) / 10;

  // File metadata
  const fileName = path.basename(filePath, ".json");
  const idMatch = fileName.match(/(\d{9})$/);
  const id = idMatch ? `apt-fp-${idMatch[1]}` : `apt-fp-${roomIdx}`;

  const plan: ParsedFloorPlan = {
    totalArea,
    rooms,
    walls,
    doors: [],
    windows: [],
  };

  const catalog: CatalogEntry = {
    id,
    fileName,
    buildingType: "APT",
    totalArea,
    roomCount: bedrooms.length + (rooms.some((r) => r.type === "LIVING") ? 1 : 0),
    bathroomCount: bathCount,
    rooms: rooms.map((r) => ({ type: r.type, name: r.name, area: r.area })),
  };

  return { plan, catalog };
}

function generateWallsFromRooms(rooms: RoomData[]): WallData[] {
  const walls: WallData[] = [];

  // Find overall bounding box of all rooms
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of rooms) {
    if (room.polygon) {
      for (const p of room.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  const t = 0.15; // wall thickness

  // Exterior walls
  walls.push(
    { id: "wall-top", start: { x: minX, y: minY }, end: { x: maxX, y: minY }, thickness: t, isExterior: true },
    { id: "wall-right", start: { x: maxX, y: minY }, end: { x: maxX, y: maxY }, thickness: t, isExterior: true },
    { id: "wall-bottom", start: { x: maxX, y: maxY }, end: { x: minX, y: maxY }, thickness: t, isExterior: true },
    { id: "wall-left", start: { x: minX, y: maxY }, end: { x: minX, y: minY }, thickness: t, isExterior: true },
  );

  return walls;
}

// ─── Main execution ───

function main() {
  const extractDir = path.resolve(__dirname, "../drawings/_extract/SPA");
  const outputDir = path.resolve(__dirname, "../public/floorplans");

  if (!fs.existsSync(extractDir)) {
    console.error("❌ SPA extract directory not found:", extractDir);
    process.exit(1);
  }

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(extractDir).filter((f) => f.startsWith("APT_FP_SPA_") && f.endsWith(".json"));
  console.log(`Found ${files.length} APT_FP SPA files`);

  const catalogEntries: CatalogEntry[] = [];

  for (const file of files) {
    const filePath = path.join(extractDir, file);
    console.log(`Processing: ${file}`);

    try {
      const result = processOneSPA(filePath);
      if (!result) {
        console.log(`  ⚠ Skipped (no valid room annotations)`);
        continue;
      }

      const { plan, catalog } = result;

      // Write individual floor plan
      const outPath = path.join(outputDir, `${catalog.id}.json`);
      fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));
      console.log(`  ✓ ${catalog.id}: ${catalog.totalArea}m², ${catalog.roomCount}rooms, ${catalog.bathroomCount}bath, ${plan.rooms.length} spaces`);

      catalogEntries.push(catalog);
    } catch (err) {
      console.error(`  ✗ Error: ${err}`);
    }
  }

  // Write catalog
  const catalogPath = path.join(outputDir, "index.json");
  const catalog = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    count: catalogEntries.length,
    entries: catalogEntries.sort((a, b) => a.totalArea - b.totalArea),
  };
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  console.log(`\n✅ Done! ${catalogEntries.length} floor plans written to ${outputDir}`);
  console.log("   Catalog: index.json");
  console.log("   Area range:", Math.min(...catalogEntries.map((e) => e.totalArea)), "~", Math.max(...catalogEntries.map((e) => e.totalArea)), "m²");
}

main();
