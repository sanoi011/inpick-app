// src/lib/floor-plan/quantity/synthetic-floorplan.ts
// 도면이 없을 때 면적 기반 한국 아파트 표준 배치 합성 평면도 생성

import type { ParsedFloorPlan, RoomData, WallData, DoorData, WindowData } from '@/types/floorplan';

// 한국 아파트 표준 공간 비율 (면적 대비)
interface RoomTemplate {
  type: RoomData['type'];
  name: string;
  ratio: number;       // 전체 면적 대비 비율
  minArea: number;      // 최소 면적 (m²)
  material?: RoomData['material'];
}

// 59㎡ 이하 소형 (2BR/1BA)
const SMALL_LAYOUT: RoomTemplate[] = [
  { type: 'LIVING', name: '거실', ratio: 0.25, minArea: 10, material: 'wood' },
  { type: 'KITCHEN', name: '주방', ratio: 0.10, minArea: 5, material: 'tile' },
  { type: 'MASTER_BED', name: '안방', ratio: 0.18, minArea: 9, material: 'wood' },
  { type: 'BED', name: '침실', ratio: 0.14, minArea: 7, material: 'wood' },
  { type: 'BATHROOM', name: '욕실1', ratio: 0.07, minArea: 3, material: 'tile' },
  { type: 'BATHROOM', name: '욕실2', ratio: 0.05, minArea: 2.5, material: 'tile' },
  { type: 'ENTRANCE', name: '현관', ratio: 0.04, minArea: 2, material: 'tile' },
  { type: 'BALCONY', name: '발코니', ratio: 0.06, minArea: 3, material: 'tile' },
  { type: 'UTILITY', name: '다용도실', ratio: 0.03, minArea: 1.5, material: 'tile' },
  { type: 'CORRIDOR', name: '복도', ratio: 0.08, minArea: 3, material: 'wood' },
];

// 84㎡ 이상 중형 (3BR/2BA)
const MEDIUM_LAYOUT: RoomTemplate[] = [
  { type: 'LIVING', name: '거실', ratio: 0.22, minArea: 15, material: 'wood' },
  { type: 'KITCHEN', name: '주방', ratio: 0.09, minArea: 6, material: 'tile' },
  { type: 'MASTER_BED', name: '안방', ratio: 0.16, minArea: 12, material: 'wood' },
  { type: 'BED', name: '침실1', ratio: 0.11, minArea: 8, material: 'wood' },
  { type: 'BED', name: '침실2', ratio: 0.09, minArea: 7, material: 'wood' },
  { type: 'BATHROOM', name: '욕실1', ratio: 0.06, minArea: 3.5, material: 'tile' },
  { type: 'BATHROOM', name: '욕실2', ratio: 0.05, minArea: 3, material: 'tile' },
  { type: 'ENTRANCE', name: '현관', ratio: 0.04, minArea: 2.5, material: 'tile' },
  { type: 'BALCONY', name: '발코니', ratio: 0.05, minArea: 4, material: 'tile' },
  { type: 'DRESSROOM', name: '드레스룸', ratio: 0.04, minArea: 2.5, material: 'wood' },
  { type: 'UTILITY', name: '다용도실', ratio: 0.03, minArea: 1.5, material: 'tile' },
  { type: 'CORRIDOR', name: '복도', ratio: 0.06, minArea: 3, material: 'wood' },
];

/**
 * 면적 기반 합성 ParsedFloorPlan 생성
 * @param totalArea - 전용면적 (m²)
 * @param roomCount - 방 수 (optional, 기본 추정)
 * @param bathroomCount - 욕실 수 (optional, 기본 2)
 */
export function generateSyntheticFloorPlan(
  totalArea: number,
  roomCount?: number,
  bathroomCount?: number,
): ParsedFloorPlan {
  const area = totalArea || 84; // 기본 84m²

  // 면적/방수에 따른 레이아웃 템플릿 선택
  const useSmall = (roomCount && roomCount <= 2) || area < 70;
  const baseTemplate = useSmall ? SMALL_LAYOUT : MEDIUM_LAYOUT;

  // bathroomCount에 맞게 욕실 수 조정
  const template = bathroomCount === 1
    ? baseTemplate.filter(t => t.name !== '욕실2')
    : baseTemplate;

  // 방 생성 (면적 비례 배분)
  const rooms: RoomData[] = [];
  let currentX = 0;
  let currentY = 0;
  const rowHeight1 = Math.sqrt(area) * 0.6; // 상단 행 높이
  let rowIdx = 0;

  for (let i = 0; i < template.length; i++) {
    const t = template[i];
    const roomArea = Math.max(area * t.ratio, t.minArea);
    const aspectRatio = t.type === 'CORRIDOR' ? 4.0 : t.type === 'BALCONY' ? 3.0 : 1.3;
    const w = Math.sqrt(roomArea * aspectRatio);
    const h = roomArea / w;

    // 간단한 2행 배치
    if (currentX + w > Math.sqrt(area) * 2.5 && rowIdx === 0) {
      currentX = 0;
      currentY = rowHeight1 + 0.2;
      rowIdx = 1;
    }

    const room: RoomData = {
      id: `room-${i}`,
      type: t.type,
      name: t.name,
      area: Math.round(roomArea * 100) / 100,
      position: {
        x: Math.round(currentX * 1000) / 1000,
        y: Math.round(currentY * 1000) / 1000,
        width: Math.round(w * 1000) / 1000,
        height: Math.round(h * 1000) / 1000,
      },
      material: t.material,
    };

    rooms.push(room);
    currentX += w + 0.15; // 벽 두께 간격
  }

  // 벽 합성: 각 방의 4변을 벽으로 생성
  const walls: WallData[] = [];
  let wallIdx = 0;
  for (const room of rooms) {
    const { x, y, width, height } = room.position;
    const pts = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
    for (let j = 0; j < 4; j++) {
      const start = pts[j];
      const end = pts[(j + 1) % 4];
      walls.push({
        id: `wall-${wallIdx++}`,
        start,
        end,
        thickness: 0.15,
        isExterior: false,
      });
    }
  }

  // 문 합성: 각 방에 1개씩
  const doors: DoorData[] = rooms
    .filter(r => r.type !== 'BALCONY')
    .map((room, i) => ({
      id: `door-${i}`,
      position: {
        x: room.position.x + room.position.width * 0.5,
        y: room.position.y,
      },
      width: room.type === 'ENTRANCE' ? 0.95 : 0.9,
      rotation: 0,
      type: (room.type === 'ENTRANCE' ? 'entrance' : 'swing') as DoorData['type'],
      connectedRooms: ['', ''] as [string, string],
    }));

  // 창문 합성: 외부 접하는 방에 추가
  const windows: WindowData[] = rooms
    .filter(r => ['LIVING', 'MASTER_BED', 'BED', 'BALCONY'].includes(r.type))
    .map((room, i) => ({
      id: `window-${i}`,
      position: {
        x: room.position.x + room.position.width * 0.5,
        y: room.position.y + room.position.height,
      },
      width: room.type === 'LIVING' ? 2.4 : 1.5,
      height: 1.2,
      rotation: 0,
      wallId: '',
    }));

  return {
    totalArea: area,
    rooms,
    walls,
    doors,
    windows,
  };
}
