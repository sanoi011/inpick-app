/**
 * FloorplanAIResult → ParsedFloorPlan 변환기
 *
 * Python floorplan-ai 파이프라인 출력(mm 좌표)을
 * INPICK ParsedFloorPlan 형식(m 좌표)으로 변환
 */
import type {
  ParsedFloorPlan,
  RoomData,
  RoomType,
  WallData,
  DoorData,
  WindowData,
  FixtureData,
  DimensionData,
} from '@/types/floorplan';
import type { FloorplanAIResult } from './floorplan-ai-client';

// mm → m
function mmToM(mm: number): number {
  return Math.round((mm / 1000) * 10000) / 10000;
}

// 한글 방 이름 → RoomType
const ROOM_NAME_MAP: Record<string, RoomType> = {
  '안방': 'MASTER_BED',
  '마스터': 'MASTER_BED',
  'MBR': 'MASTER_BED',
  '거실': 'LIVING',
  'LR': 'LIVING',
  '주방': 'KITCHEN',
  '주방/식당': 'KITCHEN',
  '부엌': 'KITCHEN',
  'KIT': 'KITCHEN',
  '욕실': 'BATHROOM',
  '화장실': 'BATHROOM',
  'BATH': 'BATHROOM',
  '침실': 'BED',
  '방': 'BED',
  'BR': 'BED',
  '현관': 'ENTRANCE',
  'ENT': 'ENTRANCE',
  '발코니': 'BALCONY',
  '베란다': 'BALCONY',
  'BAL': 'BALCONY',
  '드레스룸': 'DRESSROOM',
  '다용도실': 'UTILITY',
  '세탁실': 'UTILITY',
  '복도': 'CORRIDOR',
  '서재': 'BED',
  '알파룸': 'BED',
  '팬트리': 'UTILITY',
  '식당': 'KITCHEN',
  '다이닝': 'KITCHEN',
};

function classifyRoomType(name: string | null): RoomType {
  if (!name) return 'LIVING';
  const cleaned = name.replace(/\s+/g, '').replace(/\d+/g, '').trim();
  for (const [keyword, roomType] of Object.entries(ROOM_NAME_MAP)) {
    if (cleaned.includes(keyword)) return roomType;
  }
  return 'LIVING';
}

function getRoomMaterial(type: RoomType): 'wood' | 'tile' {
  const tileRooms: RoomType[] = ['BATHROOM', 'ENTRANCE', 'BALCONY', 'UTILITY'];
  return tileRooms.includes(type) ? 'tile' : 'wood';
}

// 심볼 타입 분류
type SymbolCategory = 'door' | 'window' | 'fixture' | 'dimension' | 'ignore';

function categorizeSymbol(type: string): SymbolCategory {
  if (type.startsWith('door_')) return 'door';
  if (type === 'window') return 'window';
  if (['toilet', 'bathtub', 'sink', 'kitchen_sink'].includes(type)) return 'fixture';
  if (type === 'dimension_line') return 'dimension';
  return 'ignore'; // wall, column, stairs, elevator
}

function mapDoorType(symbolType: string): 'swing' | 'sliding' | 'folding' {
  if (symbolType === 'door_sliding') return 'sliding';
  return 'swing';
}

function mapFixtureType(symbolType: string): FixtureData['type'] {
  const map: Record<string, FixtureData['type']> = {
    'toilet': 'toilet',
    'bathtub': 'bathtub',
    'sink': 'sink',
    'kitchen_sink': 'kitchen_sink',
  };
  return map[symbolType] || 'toilet';
}

// 폴리곤 바운딩 박스 계산
function boundingBox(vertices: { x: number; y: number }[]): {
  x: number; y: number; width: number; height: number;
} {
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

// 폴리곤 면적 (Shoelace)
function polygonArea(vertices: { x: number; y: number }[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * FloorplanAIResult → ParsedFloorPlan 변환
 */
export function convertFloorplanAIResult(
  aiResult: FloorplanAIResult,
  knownArea?: number,
): ParsedFloorPlan {
  const vd = aiResult.vector_data;

  // --- Rooms ---
  const rooms: RoomData[] = vd.rooms.map((r, i) => {
    const polygonM = r.vertices.map(v => ({
      x: mmToM(v.x),
      y: mmToM(v.y),
    }));
    const type = classifyRoomType(r.name);
    const areaM2 = r.area_m2 > 0 ? r.area_m2 : polygonArea(polygonM);
    const bbox = boundingBox(polygonM);

    // 방 이름: OCR에서 인식된 이름 우선, 없으면 타입 기반 생성
    let name = r.name || '';
    if (!name) {
      const typeLabels: Record<string, string> = {
        LIVING: '거실', KITCHEN: '주방', MASTER_BED: '안방', BED: '침실',
        BATHROOM: '욕실', ENTRANCE: '현관', BALCONY: '발코니', UTILITY: '다용도실',
        CORRIDOR: '복도', DRESSROOM: '드레스룸',
      };
      name = typeLabels[type] || type;
    }

    return {
      id: `room-${i}`,
      type,
      name,
      area: Math.round(areaM2 * 100) / 100,
      position: bbox,
      polygon: polygonM,
      center: { x: mmToM(r.center.x), y: mmToM(r.center.y) },
      material: getRoomMaterial(type),
    };
  });

  // --- Walls ---
  const walls: WallData[] = vd.walls.map((w, i) => {
    const thicknessMm = w.thickness || 5;
    const isExterior = thicknessMm >= 150;
    const wallType = thicknessMm >= 150 ? 'exterior' as const
      : thicknessMm >= 100 ? 'interior' as const
      : 'partition' as const;

    return {
      id: `wall-${i}`,
      start: { x: mmToM(w.start.x), y: mmToM(w.start.y) },
      end: { x: mmToM(w.end.x), y: mmToM(w.end.y) },
      thickness: mmToM(thicknessMm),
      isExterior,
      wallType,
    };
  });

  // --- Symbols → Doors / Windows / Fixtures ---
  const doors: DoorData[] = [];
  const windows: WindowData[] = [];
  const fixtures: FixtureData[] = [];
  const dimensions: DimensionData[] = [];

  let doorIdx = 0, winIdx = 0, fixIdx = 0, dimIdx = 0;

  for (const sym of vd.symbols) {
    const category = categorizeSymbol(sym.type);
    const bboxMm = sym.bbox;
    const widthMm = bboxMm.x2 - bboxMm.x1;
    const heightMm = bboxMm.y2 - bboxMm.y1;
    const centerX = mmToM((bboxMm.x1 + bboxMm.x2) / 2);
    const centerY = mmToM((bboxMm.y1 + bboxMm.y2) / 2);

    switch (category) {
      case 'door':
        doors.push({
          id: `door-${doorIdx++}`,
          position: { x: centerX, y: centerY },
          width: mmToM(Math.max(widthMm, heightMm)),
          rotation: 0,
          type: mapDoorType(sym.type),
          connectedRooms: ['', ''],
        });
        break;

      case 'window':
        windows.push({
          id: `win-${winIdx++}`,
          position: { x: centerX, y: centerY },
          width: mmToM(Math.max(widthMm, heightMm)),
          height: mmToM(Math.min(widthMm, heightMm)),
          rotation: 0,
          wallId: '',
        });
        break;

      case 'fixture':
        fixtures.push({
          id: `fix-${fixIdx++}`,
          type: mapFixtureType(sym.type),
          position: {
            x: mmToM(bboxMm.x1),
            y: mmToM(bboxMm.y1),
            width: mmToM(widthMm),
            height: mmToM(heightMm),
          },
          roomId: '',
        });
        break;

      case 'dimension':
        dimensions.push({
          id: `dim-${dimIdx++}`,
          startPoint: { x: mmToM(bboxMm.x1), y: mmToM((bboxMm.y1 + bboxMm.y2) / 2) },
          endPoint: { x: mmToM(bboxMm.x2), y: mmToM((bboxMm.y1 + bboxMm.y2) / 2) },
          valueMm: Math.round(widthMm),
          label: `${Math.round(widthMm)}`,
        });
        break;
    }
  }

  // OCR 텍스트에서 치수 추가
  for (const txt of vd.texts) {
    if (txt.category === 'dimension') {
      const valueMm = parseInt(txt.text.replace(/[,.\s]/g, ''), 10);
      if (valueMm >= 100 && valueMm <= 20000) {
        dimensions.push({
          id: `dim-${dimIdx++}`,
          startPoint: { x: mmToM(txt.bbox.x1), y: mmToM((txt.bbox.y1 + txt.bbox.y2) / 2) },
          endPoint: { x: mmToM(txt.bbox.x2), y: mmToM((txt.bbox.y1 + txt.bbox.y2) / 2) },
          valueMm,
          label: txt.text,
        });
      }
    }
  }

  // --- fixture에 roomId 할당 (point-in-polygon 대략적) ---
  for (const fix of fixtures) {
    const fx = fix.position.x + fix.position.width / 2;
    const fy = fix.position.y + fix.position.height / 2;
    for (const room of rooms) {
      const bb = room.position;
      if (fx >= bb.x && fx <= bb.x + bb.width && fy >= bb.y && fy <= bb.y + bb.height) {
        fix.roomId = room.id;
        break;
      }
    }
  }

  // --- window에 가장 가까운 벽 할당 ---
  for (const win of windows) {
    let minDist = Infinity;
    for (const wall of walls) {
      const wmx = (wall.start.x + wall.end.x) / 2;
      const wmy = (wall.start.y + wall.end.y) / 2;
      const d = Math.sqrt((win.position.x - wmx) ** 2 + (win.position.y - wmy) ** 2);
      if (d < minDist) {
        minDist = d;
        win.wallId = wall.id;
      }
    }
  }

  // --- door에 connectedRooms 할당 ---
  for (const door of doors) {
    const nearby: string[] = [];
    for (const room of rooms) {
      const bb = room.position;
      const expanded = 0.5; // 0.5m 확장
      if (
        door.position.x >= bb.x - expanded &&
        door.position.x <= bb.x + bb.width + expanded &&
        door.position.y >= bb.y - expanded &&
        door.position.y <= bb.y + bb.height + expanded
      ) {
        nearby.push(room.name);
      }
    }
    if (nearby.length >= 2) {
      door.connectedRooms = [nearby[0], nearby[1]];
    } else if (nearby.length === 1) {
      door.connectedRooms = [nearby[0], ''];
    }
  }

  // --- totalArea ---
  const totalArea = knownArea || rooms.reduce((sum, r) => sum + r.area, 0);

  return {
    totalArea: Math.round(totalArea * 100) / 100,
    rooms,
    walls,
    doors,
    windows,
    fixtures,
    dimensions,
  };
}
