// scripts/process-str.ts
// Process STR (structure) COCO files to extract wall/door/window data

import * as fs from "fs";
import type { COCOFile, COCOAnnotation } from "./coco-types";
import {
  STR_CATEGORIES,
  FIXTURE_CATEGORIES,
  DOOR_TYPE_MAP,
  WALL_MATERIAL_MAP,
  CATEGORY_TO_ROOM_TYPE,
  SKIP_CATEGORIES,
  CATEGORY_LABELS,
} from "./coco-types";
import {
  type Point,
  flatToPoints,
  boundingBox,
  polygonArea,
  centroid,
  round,
  distance,
  isHorizontal,
  pointInPolygon,
} from "./geometry-utils";

// ─── Types ───

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

interface RoomData {
  id: string;
  type: string;
  name: string;
  area: number;
  position: { x: number; y: number; width: number; height: number };
  polygon: Point[];
}

interface ParsedFloorPlan {
  totalArea: number;
  rooms: RoomData[];
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  fixtures?: FixtureData[];
}

// ─── STR Processing ───

/**
 * Process a single STR COCO file.
 * Returns wall/door/window data if the file also contains room annotations.
 * Returns null if no room data (can't create a complete floorplan without rooms).
 */
export function processOneSTR(filePath: string): {
  plan: ParsedFloorPlan;
  id: string;
} | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const coco: COCOFile = JSON.parse(raw);

  if (!coco.annotations || coco.annotations.length === 0) return null;

  // Separate by category
  const wallAnns = coco.annotations.filter(
    (a) => a.category_id === STR_CATEGORIES.WALL
  );
  const doorAnns = coco.annotations.filter(
    (a) => a.category_id === STR_CATEGORIES.DOOR
  );
  const windowAnns = coco.annotations.filter(
    (a) => a.category_id === STR_CATEGORIES.WINDOW
  );
  const roomAnns = coco.annotations.filter(
    (a) =>
      !SKIP_CATEGORIES.has(a.category_id) &&
      CATEGORY_TO_ROOM_TYPE[a.category_id]
  );

  console.log(
    `  STR: ${wallAnns.length} walls, ${doorAnns.length} doors, ${windowAnns.length} windows, ${roomAnns.length} rooms`
  );

  // Without room data we can't create a useful floorplan
  if (roomAnns.length === 0) {
    console.log("  ⚠ No room annotations in STR file, skipping");
    return null;
  }

  // Estimate scale from wall thickness
  const pixelsPerMeter = estimateScaleFromWalls(wallAnns);
  if (!pixelsPerMeter) {
    console.log("  ⚠ Could not estimate scale, skipping");
    return null;
  }

  // Find global min for coordinate normalization
  let globalMinX = Infinity;
  let globalMinY = Infinity;

  const allAnns = [...wallAnns, ...doorAnns, ...windowAnns, ...roomAnns];
  for (const ann of allAnns) {
    if (!ann.segmentation?.[0]) continue;
    const pts = flatToPoints(ann.segmentation[0]);
    for (const p of pts) {
      if (p.x < globalMinX) globalMinX = p.x;
      if (p.y < globalMinY) globalMinY = p.y;
    }
  }

  const toMeters = (p: Point): Point => ({
    x: round((p.x - globalMinX) / pixelsPerMeter),
    y: round((p.y - globalMinY) / pixelsPerMeter),
  });

  // Convert walls
  const walls: WallData[] = wallAnns.map((ann, i) => {
    const poly = flatToPoints(ann.segmentation[0]);
    const bbox = boundingBox(poly);
    const material =
      (ann.attributes?.["구조_벽체"] as string) || "기타벽";
    const matInfo = WALL_MATERIAL_MAP[material] || {
      isExterior: false,
      thickness: 0.12,
    };

    const isHoriz = bbox.width >= bbox.height;
    const start = toMeters(
      isHoriz
        ? { x: bbox.x, y: bbox.y + bbox.height / 2 }
        : { x: bbox.x + bbox.width / 2, y: bbox.y }
    );
    const end = toMeters(
      isHoriz
        ? { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 }
        : { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height }
    );

    return {
      id: `wall-${i}`,
      start,
      end,
      thickness: round(
        Math.min(bbox.width, bbox.height) / pixelsPerMeter
      ),
      isExterior: matInfo.isExterior,
      polygon: poly.map(toMeters),
    };
  });

  // Convert doors
  const doors: DoorData[] = doorAnns.map((ann, i) => {
    const bbox = ann.bbox;
    const center = toMeters({
      x: bbox[0] + bbox[2] / 2,
      y: bbox[1] + bbox[3] / 2,
    });
    const doorTypeAttr =
      (ann.attributes?.["구조_출입문"] as string) || "기타문";
    const width = round(
      Math.max(bbox[2], bbox[3]) / pixelsPerMeter
    );

    return {
      id: `door-${i}`,
      position: center,
      width: Math.min(width, 2.0),
      rotation: bbox[2] >= bbox[3] ? 0 : 90,
      type: DOOR_TYPE_MAP[doorTypeAttr] || "swing",
      connectedRooms: ["", ""] as [string, string],
    };
  });

  // Convert windows
  const windows: WindowData[] = windowAnns.map((ann, i) => {
    const bbox = ann.bbox;
    const center = toMeters({
      x: bbox[0] + bbox[2] / 2,
      y: bbox[1] + bbox[3] / 2,
    });
    const width = round(
      Math.max(bbox[2], bbox[3]) / pixelsPerMeter
    );

    // Find nearest wall
    let nearestWallId = "";
    let nearestDist = Infinity;
    for (const wall of walls) {
      const wallMid = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2,
      };
      const d = distance(center, wallMid);
      if (d < nearestDist) {
        nearestDist = d;
        nearestWallId = wall.id;
      }
    }

    return {
      id: `win-${i}`,
      position: center,
      width: Math.min(width, 3.0),
      height: 1.2,
      rotation: bbox[2] >= bbox[3] ? 0 : 90,
      wallId: nearestWallId,
    };
  });

  // Process rooms
  const rooms: RoomData[] = [];
  for (let i = 0; i < roomAnns.length; i++) {
    const ann = roomAnns[i];
    if (!ann.segmentation?.[0] || ann.segmentation[0].length < 6)
      continue;

    const pixelPoly = flatToPoints(ann.segmentation[0]);
    const meterPoly = pixelPoly.map(toMeters);
    const area = round(polygonArea(meterPoly), 1);
    const bbox = boundingBox(meterPoly);
    const roomType = CATEGORY_TO_ROOM_TYPE[ann.category_id] || "UTILITY";

    rooms.push({
      id: `room-${i}`,
      type: roomType,
      name: CATEGORY_LABELS[ann.category_id] || "기타",
      area,
      position: {
        x: round(bbox.x),
        y: round(bbox.y),
        width: round(bbox.width),
        height: round(bbox.height),
      },
      polygon: meterPoly,
    });
  }

  // Assign doors to rooms
  for (const door of doors) {
    const sorted = rooms
      .map((r) => ({ id: r.id, dist: distance(door.position, centroid(r.polygon)) }))
      .sort((a, b) => a.dist - b.dist);
    if (sorted.length >= 2) {
      door.connectedRooms = [sorted[0].id, sorted[1].id];
    }
  }

  const totalArea = round(rooms.reduce((sum, r) => sum + r.area, 0), 1);

  // Generate ID from filename
  const match = filePath.match(/(\d{9})/);
  const id = match ? `apt-str-${match[1]}` : `apt-str-${Date.now()}`;

  return {
    plan: { totalArea, rooms, walls, doors, windows },
    id,
  };
}

function estimateScaleFromWalls(
  wallAnns: COCOAnnotation[]
): number | null {
  if (wallAnns.length === 0) return null;

  // Collect wall thicknesses (shorter bbox dimension)
  const thicknesses: number[] = [];
  for (const ann of wallAnns) {
    const [, , w, h] = ann.bbox;
    thicknesses.push(Math.min(w, h));
  }

  thicknesses.sort((a, b) => a - b);
  const medianThicknessPx =
    thicknesses[Math.floor(thicknesses.length / 2)];

  if (medianThicknessPx < 1) return null;

  // Typical wall = 0.15m
  // RC wall = 0.20m, partition = 0.12m, average ~0.15m
  return medianThicknessPx / 0.15;
}
