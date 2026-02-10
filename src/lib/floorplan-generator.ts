import type { ParsedFloorPlan, RoomData, WallData, DoorData, WindowData, RoomType } from "@/types/floorplan";

interface GeneratorInput {
  exclusiveArea: number;
  roomCount: number;
  bathroomCount: number;
  buildingType: string;
}

// 면적과 방 수 기반으로 도면 자동 생성
export function generateFloorPlan(input: GeneratorInput): ParsedFloorPlan {
  const { exclusiveArea, roomCount, bathroomCount } = input;

  // 전체 비율 기반 공간 배분
  const totalArea = exclusiveArea;
  const scale = Math.sqrt(totalArea / 85); // 85m² 기준 스케일

  // 기본 레이아웃 계산 (가로 x 세로)
  const totalWidth = 10 * scale;
  const totalDepth = 8.5 * scale;

  const rooms: RoomData[] = [];
  const walls: WallData[] = [];
  const doors: DoorData[] = [];
  const windows: WindowData[] = [];

  let roomIdx = 0;

  // 거실 (전체의 ~25%)
  const livingArea = totalArea * 0.25;
  const livingW = totalWidth * 0.6;
  const livingH = totalDepth * 0.5;
  rooms.push({
    id: `room-${roomIdx++}`,
    type: "LIVING",
    name: "거실",
    area: Math.round(livingArea * 10) / 10,
    position: { x: 0, y: 0, width: livingW, height: livingH },
  });

  // 주방 (전체의 ~12%)
  const kitchenArea = totalArea * 0.12;
  const kitchenW = totalWidth - livingW;
  const kitchenH = livingH;
  rooms.push({
    id: `room-${roomIdx++}`,
    type: "KITCHEN",
    name: "주방",
    area: Math.round(kitchenArea * 10) / 10,
    position: { x: livingW, y: 0, width: kitchenW, height: kitchenH },
  });

  // 안방 (전체의 ~18%)
  const masterArea = totalArea * 0.18;
  const masterW = totalWidth * 0.45;
  const masterH = totalDepth - livingH;
  rooms.push({
    id: `room-${roomIdx++}`,
    type: "MASTER_BED",
    name: "안방",
    area: Math.round(masterArea * 10) / 10,
    position: { x: 0, y: livingH, width: masterW, height: masterH },
  });

  // 침실들
  const bedRoomCount = Math.max(0, roomCount - 1);
  if (bedRoomCount > 0) {
    const bedTotalW = totalWidth - masterW;
    const bedW = bedTotalW / bedRoomCount;
    const bedH = (totalDepth - livingH) * 0.65;

    for (let i = 0; i < bedRoomCount; i++) {
      const bedArea = totalArea * (0.12 / bedRoomCount);
      rooms.push({
        id: `room-${roomIdx++}`,
        type: "BED",
        name: `침실${bedRoomCount > 1 ? i + 1 : ""}`,
        area: Math.round(bedArea * 10) / 10,
        position: { x: masterW + bedW * i, y: livingH, width: bedW, height: bedH },
      });
    }

    // 욕실
    for (let i = 0; i < bathroomCount; i++) {
      const bathW = bedTotalW / bathroomCount;
      const bathH = (totalDepth - livingH) - bedH;
      const bathArea = totalArea * (0.05 / bathroomCount);
      rooms.push({
        id: `room-${roomIdx++}`,
        type: "BATHROOM",
        name: `욕실${bathroomCount > 1 ? i + 1 : ""}`,
        area: Math.round(bathArea * 10) / 10,
        position: { x: masterW + bathW * i, y: livingH + bedH, width: bathW, height: bathH },
      });
    }
  }

  // 현관
  const entranceW = totalWidth * 0.15;
  const entranceH = totalDepth * 0.12;
  rooms.push({
    id: `room-${roomIdx++}`,
    type: "ENTRANCE",
    name: "현관",
    area: Math.round(totalArea * 0.03 * 10) / 10,
    position: { x: totalWidth - entranceW, y: totalDepth - entranceH, width: entranceW, height: entranceH },
  });

  // 발코니
  const balconyW = livingW;
  const balconyH = totalDepth * 0.1;
  rooms.push({
    id: `room-${roomIdx++}`,
    type: "BALCONY",
    name: "발코니",
    area: Math.round(totalArea * 0.08 * 10) / 10,
    position: { x: 0, y: -balconyH, width: balconyW, height: balconyH },
  });

  // 외벽 생성
  const wallThickness = 0.2;
  walls.push(
    { id: "wall-top", start: { x: 0, y: 0 }, end: { x: totalWidth, y: 0 }, thickness: wallThickness, isExterior: true },
    { id: "wall-right", start: { x: totalWidth, y: 0 }, end: { x: totalWidth, y: totalDepth }, thickness: wallThickness, isExterior: true },
    { id: "wall-bottom", start: { x: totalWidth, y: totalDepth }, end: { x: 0, y: totalDepth }, thickness: wallThickness, isExterior: true },
    { id: "wall-left", start: { x: 0, y: totalDepth }, end: { x: 0, y: 0 }, thickness: wallThickness, isExterior: true },
  );

  // 내벽 생성 (방 경계)
  rooms.forEach((room, i) => {
    if (room.type === "BALCONY") return;
    walls.push({
      id: `iwall-${i}-h`,
      start: { x: room.position.x, y: room.position.y + room.position.height },
      end: { x: room.position.x + room.position.width, y: room.position.y + room.position.height },
      thickness: 0.12,
      isExterior: false,
    });
    walls.push({
      id: `iwall-${i}-v`,
      start: { x: room.position.x + room.position.width, y: room.position.y },
      end: { x: room.position.x + room.position.width, y: room.position.y + room.position.height },
      thickness: 0.12,
      isExterior: false,
    });
  });

  // 문 생성 (거실↔주방, 거실↔안방, 현관)
  doors.push(
    { id: "door-0", position: { x: livingW, y: livingH * 0.4 }, width: 0.9, rotation: 0, type: "swing", connectedRooms: ["room-0", "room-1"] },
    { id: "door-1", position: { x: masterW * 0.5, y: livingH }, width: 0.9, rotation: 90, type: "swing", connectedRooms: ["room-0", "room-2"] },
    { id: "door-entrance", position: { x: totalWidth - entranceW * 0.5, y: totalDepth }, width: 1.0, rotation: 90, type: "swing", connectedRooms: ["room-entrance", "exterior"] },
  );

  // 창문 생성 (거실, 안방 외벽)
  windows.push(
    { id: "win-0", position: { x: livingW * 0.5, y: 0 }, width: 2.0, height: 1.5, rotation: 0, wallId: "wall-top" },
    { id: "win-1", position: { x: masterW * 0.5, y: totalDepth }, width: 1.5, height: 1.2, rotation: 0, wallId: "wall-bottom" },
  );

  return { totalArea, rooms, walls, doors, windows };
}

// RoomType → Supabase space_types code 매핑
export function roomTypeToSpaceCode(type: RoomType): string {
  const map: Record<RoomType, string> = {
    LIVING: "RES-LIV",
    KITCHEN: "RES-KIT",
    MASTER_BED: "RES-MBR",
    BED: "RES-BR",
    BATHROOM: "RES-BTH",
    ENTRANCE: "RES-ENT",
    BALCONY: "RES-BAL",
    UTILITY: "RES-LIV",
    CORRIDOR: "RES-ENT",
    DRESSROOM: "RES-MBR",
  };
  return map[type];
}
