// scripts/synthetic-walls.ts
// Generate synthetic walls, doors, windows, fixtures from SPA room polygons

import {
  type Point,
  distance,
  centroid,
  midpoint,
  round,
  findCollinearOverlap,
  isHorizontal,
  isEdgeExterior,
  pointInPolygon,
} from "./geometry-utils";

// ─── Types (matching process-drawings.ts) ───

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

// ─── Edge type ───

interface Edge {
  start: Point;
  end: Point;
  roomId: string;
  roomType: string;
}

// ─── Constants ───

const INTERIOR_WALL_THICKNESS = 0.12;
const EXTERIOR_WALL_THICKNESS = 0.18;
const EDGE_OVERLAP_TOLERANCE = 0.4; // meters
const MIN_OVERLAP_LENGTH = 0.3;
const MIN_DOOR_WIDTH = 0.6;
const MIN_WALL_LENGTH = 0.3;

// Rooms that don't have doors between them (open connection)
const OPEN_CONNECTIONS = new Set(["LIVING-KITCHEN", "KITCHEN-LIVING"]);

// Room types that don't get windows on exterior walls
const NO_WINDOW_ROOMS = new Set(["ENTRANCE", "UTILITY", "CORRIDOR", "DRESSROOM"]);

// ─── Main export ───

export function generateSyntheticStructure(rooms: RoomData[]): {
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  fixtures: FixtureData[];
} {
  const roomsWithPolygons = rooms.filter(
    (r) => r.polygon && r.polygon.length >= 3
  );

  if (roomsWithPolygons.length === 0) {
    return { walls: [], doors: [], windows: [], fixtures: [] };
  }

  const allPolygons = roomsWithPolygons.map((r) => r.polygon);

  // Step 1: Collect all edges from all rooms
  const allEdges: Edge[] = [];
  for (const room of roomsWithPolygons) {
    const poly = room.polygon;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      allEdges.push({
        start: poly[i],
        end: poly[j],
        roomId: room.id,
        roomType: room.type,
      });
    }
  }

  // Step 2: Find shared edges (interior walls) and gaps (doors)
  const walls: WallData[] = [];
  const doors: DoorData[] = [];
  let wallIdx = 0;
  let doorIdx = 0;

  // Track which edges are used as shared interior boundaries
  const sharedEdgeIndices = new Set<number>();

  for (let i = 0; i < allEdges.length; i++) {
    for (let j = i + 1; j < allEdges.length; j++) {
      const ei = allEdges[i];
      const ej = allEdges[j];
      if (ei.roomId === ej.roomId) continue;

      const overlap = findCollinearOverlap(
        ei.start,
        ei.end,
        ej.start,
        ej.end,
        EDGE_OVERLAP_TOLERANCE,
        MIN_OVERLAP_LENGTH
      );

      if (!overlap) continue;

      sharedEdgeIndices.add(i);
      sharedEdgeIndices.add(j);

      const wallLen = distance(overlap[0], overlap[1]);

      // Determine if the edge has a gap large enough for a door
      const fullEdgeLen = distance(ei.start, ei.end);
      const gapSize = fullEdgeLen - wallLen;

      // Create interior wall
      if (wallLen >= MIN_WALL_LENGTH) {
        walls.push({
          id: `wall-i-${wallIdx++}`,
          start: overlap[0],
          end: overlap[1],
          thickness: INTERIOR_WALL_THICKNESS,
          isExterior: false,
        });
      }

      // If the overlap doesn't cover the full edge, the gap is a door
      if (gapSize >= MIN_DOOR_WIDTH) {
        const connectionKey = `${ei.roomType}-${ej.roomType}`;
        // Skip open connections (living-kitchen)
        if (!OPEN_CONNECTIONS.has(connectionKey)) {
          const doorPos = computeDoorPosition(ei, overlap);
          if (doorPos) {
            doors.push({
              id: `door-${doorIdx++}`,
              position: doorPos.position,
              width: round(Math.min(doorPos.width, 1.8)),
              rotation: isHorizontal(ei.start, ei.end) ? 0 : 90,
              type: inferDoorType(ei.roomType, ej.roomType, doorPos.width),
              connectedRooms: [ei.roomId, ej.roomId],
            });
          }
        }
      }
    }
  }

  // Step 3: Non-shared edges → exterior walls
  for (let i = 0; i < allEdges.length; i++) {
    if (sharedEdgeIndices.has(i)) continue;

    const edge = allEdges[i];
    const edgeLen = distance(edge.start, edge.end);
    if (edgeLen < MIN_WALL_LENGTH) continue;

    // Check if this edge is exterior (no room on one side)
    const exterior = isEdgeExterior(edge.start, edge.end, allPolygons, 0.3);
    if (!exterior) {
      // It's an interior edge not shared with another room -
      // still create a wall (interior partition not bordering another room)
      walls.push({
        id: `wall-i-${wallIdx++}`,
        start: edge.start,
        end: edge.end,
        thickness: INTERIOR_WALL_THICKNESS,
        isExterior: false,
      });
      continue;
    }

    walls.push({
      id: `wall-e-${wallIdx++}`,
      start: edge.start,
      end: edge.end,
      thickness: EXTERIOR_WALL_THICKNESS,
      isExterior: true,
    });
  }

  // Step 4: Place doors where rooms should connect but have no shared edge
  // (rooms that are adjacent but polygons don't touch)
  placeMissingDoors(roomsWithPolygons, walls, doors, doorIdx);

  // Step 5: Place windows on exterior walls
  const windows = generateWindows(walls, roomsWithPolygons);

  // Step 6: Place fixtures in rooms
  const fixtures = generateFixtures(roomsWithPolygons);

  return { walls, doors, windows, fixtures };
}

// ─── Door positioning ───

function computeDoorPosition(
  edge: Edge,
  wallOverlap: [Point, Point]
): { position: Point; width: number } | null {
  // The gap is the part of the edge NOT covered by the wall overlap
  const eDist = distance(edge.start, edge.end);
  const oStart = distance(edge.start, wallOverlap[0]);
  const oEnd = distance(edge.start, wallOverlap[1]);

  // Determine which end of the edge has the gap
  const gapAtStart = Math.min(oStart, oEnd);
  const gapAtEnd = eDist - Math.max(oStart, oEnd);

  let gapWidth: number;
  let gapCenter: Point;

  if (gapAtStart > gapAtEnd && gapAtStart >= MIN_DOOR_WIDTH) {
    gapWidth = gapAtStart;
    // Gap is at the start of the edge
    const dx = (edge.end.x - edge.start.x) / eDist;
    const dy = (edge.end.y - edge.start.y) / eDist;
    gapCenter = {
      x: round(edge.start.x + dx * (gapWidth / 2)),
      y: round(edge.start.y + dy * (gapWidth / 2)),
    };
  } else if (gapAtEnd >= MIN_DOOR_WIDTH) {
    gapWidth = gapAtEnd;
    const dx = (edge.end.x - edge.start.x) / eDist;
    const dy = (edge.end.y - edge.start.y) / eDist;
    gapCenter = {
      x: round(edge.end.x - dx * (gapWidth / 2)),
      y: round(edge.end.y - dy * (gapWidth / 2)),
    };
  } else {
    return null;
  }

  return { position: gapCenter, width: round(gapWidth) };
}

function inferDoorType(
  type1: string,
  type2: string,
  width: number
): "swing" | "sliding" | "folding" {
  const types = [type1, type2];
  if (types.includes("BALCONY")) return "sliding";
  if (width > 1.5) return "sliding";
  return "swing";
}

function placeMissingDoors(
  rooms: RoomData[],
  walls: WallData[],
  doors: DoorData[],
  startIdx: number
): void {
  // Check if rooms that should be connected have doors
  const connectedPairs = new Set(
    doors.map((d) => `${d.connectedRooms[0]}-${d.connectedRooms[1]}`)
  );

  let doorIdx = startIdx;

  // Every non-BALCONY, non-UTILITY room should be reachable
  // For simplicity, ensure BATHROOM/BED rooms have at least one door
  const roomsNeedingDoors = rooms.filter(
    (r) =>
      ["BATHROOM", "BED", "MASTER_BED", "DRESSROOM"].includes(r.type) &&
      !doors.some(
        (d) =>
          d.connectedRooms[0] === r.id || d.connectedRooms[1] === r.id
      )
  );

  for (const room of roomsNeedingDoors) {
    // Find the nearest other room
    const rc = centroid(room.polygon);
    let nearestRoom: RoomData | null = null;
    let nearestDist = Infinity;

    for (const other of rooms) {
      if (other.id === room.id) continue;
      if (other.type === "BALCONY") continue;
      const oc = centroid(other.polygon);
      const d = distance(rc, oc);
      if (d < nearestDist) {
        nearestDist = d;
        nearestRoom = other;
      }
    }

    if (!nearestRoom) continue;

    // Place door between the two room centroids at the boundary
    const doorPos = midpoint(rc, centroid(nearestRoom.polygon));
    const isHoriz = Math.abs(rc.x - centroid(nearestRoom.polygon).x) >
      Math.abs(rc.y - centroid(nearestRoom.polygon).y);

    doors.push({
      id: `door-${doorIdx++}`,
      position: { x: round(doorPos.x), y: round(doorPos.y) },
      width: room.type === "BATHROOM" ? 0.8 : 0.9,
      rotation: isHoriz ? 0 : 90,
      type: "swing",
      connectedRooms: [room.id, nearestRoom.id],
    });
  }
}

// ─── Window generation ───

function generateWindows(
  walls: WallData[],
  rooms: RoomData[]
): WindowData[] {
  const windows: WindowData[] = [];
  let winIdx = 0;

  const exteriorWalls = walls.filter((w) => w.isExterior);
  const allPolygons = rooms.map((r) => r.polygon);

  for (const wall of exteriorWalls) {
    const wallLen = distance(wall.start, wall.end);
    if (wallLen < 1.0) continue;

    // Find which room this wall is adjacent to
    const wallMid = midpoint(wall.start, wall.end);
    let adjacentRoom: RoomData | null = null;
    let minDist = Infinity;

    for (const room of rooms) {
      const rc = centroid(room.polygon);
      const d = distance(wallMid, rc);
      if (d < minDist) {
        minDist = d;
        adjacentRoom = room;
      }
    }

    if (!adjacentRoom || NO_WINDOW_ROOMS.has(adjacentRoom.type)) continue;

    // Determine window width based on room type
    let widthRatio: number;
    let maxWidth: number;

    switch (adjacentRoom.type) {
      case "LIVING":
      case "MASTER_BED":
        widthRatio = 0.6;
        maxWidth = 2.4;
        break;
      case "BED":
        widthRatio = 0.5;
        maxWidth = 1.8;
        break;
      case "KITCHEN":
        widthRatio = 0.4;
        maxWidth = 1.5;
        break;
      case "BATHROOM":
        widthRatio = 0.3;
        maxWidth = 0.8;
        break;
      case "BALCONY":
        widthRatio = 0.7;
        maxWidth = 3.0;
        break;
      default:
        continue;
    }

    const windowWidth = round(Math.min(wallLen * widthRatio, maxWidth), 1);
    if (windowWidth < 0.5) continue;

    const rotation = isHorizontal(wall.start, wall.end) ? 0 : 90;

    windows.push({
      id: `win-${winIdx++}`,
      position: { x: round(wallMid.x), y: round(wallMid.y) },
      width: windowWidth,
      height: adjacentRoom.type === "BATHROOM" ? 0.6 : 1.2,
      rotation,
      wallId: wall.id,
    });
  }

  return windows;
}

// ─── Fixture generation ───

function generateFixtures(rooms: RoomData[]): FixtureData[] {
  const fixtures: FixtureData[] = [];
  let fixIdx = 0;

  for (const room of rooms) {
    const c = centroid(room.polygon);
    const pos = room.position;

    switch (room.type) {
      case "BATHROOM": {
        // Toilet: lower part of bathroom
        fixtures.push({
          id: `fix-${fixIdx++}`,
          type: "toilet",
          position: {
            x: round(pos.x + pos.width * 0.25),
            y: round(pos.y + pos.height * 0.65),
            width: 0.4,
            height: 0.6,
          },
          roomId: room.id,
        });
        // Sink: upper part of bathroom
        fixtures.push({
          id: `fix-${fixIdx++}`,
          type: "sink",
          position: {
            x: round(pos.x + pos.width * 0.65),
            y: round(pos.y + pos.height * 0.2),
            width: 0.5,
            height: 0.4,
          },
          roomId: room.id,
        });
        // Bathtub only in larger bathrooms (> 4m2)
        if (room.area > 4) {
          fixtures.push({
            id: `fix-${fixIdx++}`,
            type: "bathtub",
            position: {
              x: round(pos.x + pos.width * 0.05),
              y: round(pos.y + pos.height * 0.1),
              width: 0.7,
              height: 1.5,
            },
            roomId: room.id,
          });
        }
        break;
      }

      case "KITCHEN": {
        // Kitchen sink: along one wall
        fixtures.push({
          id: `fix-${fixIdx++}`,
          type: "kitchen_sink",
          position: {
            x: round(pos.x + pos.width * 0.2),
            y: round(pos.y + 0.05),
            width: 0.8,
            height: 0.6,
          },
          roomId: room.id,
        });
        // Stove: next to sink
        fixtures.push({
          id: `fix-${fixIdx++}`,
          type: "stove",
          position: {
            x: round(pos.x + pos.width * 0.6),
            y: round(pos.y + 0.05),
            width: 0.6,
            height: 0.6,
          },
          roomId: room.id,
        });
        break;
      }

      default:
        break;
    }
  }

  return fixtures;
}
