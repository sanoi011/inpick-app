export type RoomType =
  | 'LIVING'
  | 'KITCHEN'
  | 'MASTER_BED'
  | 'BED'
  | 'BATHROOM'
  | 'ENTRANCE'
  | 'BALCONY'
  | 'UTILITY'
  | 'CORRIDOR'
  | 'DRESSROOM';

export type RoomMaterial = 'wood' | 'tile' | 'unknown';

export interface RoomData {
  id: string;
  type: RoomType;
  name: string;
  area: number;
  position: { x: number; y: number; width: number; height: number };
  polygon?: { x: number; y: number }[];
  holes?: { x: number; y: number }[][];
  center?: { x: number; y: number };
  material?: RoomMaterial;
}

export type WallType = 'exterior' | 'interior' | 'partition';

export interface WallData {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  isExterior: boolean;
  wallType?: WallType;
  polygon?: { x: number; y: number }[];
}

export interface DoorData {
  id: string;
  position: { x: number; y: number };
  width: number;
  rotation: number;
  type: 'swing' | 'sliding' | 'folding';
  connectedRooms: [string, string];
}

export interface WindowData {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  rotation: number;
  wallId: string;
}

export interface FixtureData {
  id: string;
  type: 'toilet' | 'sink' | 'kitchen_sink' | 'bathtub' | 'stove';
  position: { x: number; y: number; width: number; height: number };
  roomId?: string;
}

// 개구부 후보 (도면 인식 결과 검증용)
export interface OpeningCandidate {
  id: string;
  wallId: string;
  typeGuess: 'swing_door' | 'entrance_door' | 'window' | 'opening';
  positionOnWall: number; // mm (벽 시작점에서 중심까지)
  width: number;
  confidence: number; // 0-1
}

// 치수선 데이터 (인식된 치수 정보)
export interface DimensionData {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  valueMm: number;
  label: string;
}

export interface ParsedFloorPlan {
  totalArea: number;
  rooms: RoomData[];
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  fixtures?: FixtureData[];
  dimensions?: DimensionData[];
  openingCandidates?: OpeningCandidate[];
}

export interface FloorPlan {
  id: string;
  buildingInfoId: string;
  source: 'API' | 'UPLOAD' | 'GENERATED' | 'DRAWING';
  imageUrl?: string;
  svgData?: string;
  parsedData: ParsedFloorPlan;
  createdAt: string;
}

export interface MaterialSelection {
  roomId: string;
  areaType: 'wall' | 'floor' | 'ceiling';
  materialId: string;
  materialName: string;
  color?: string;
  textureUrl?: string;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LIVING: '거실',
  KITCHEN: '주방',
  MASTER_BED: '안방',
  BED: '침실',
  BATHROOM: '욕실',
  ENTRANCE: '현관',
  BALCONY: '발코니',
  UTILITY: '다용도실',
  CORRIDOR: '복도',
  DRESSROOM: '드레스룸',
};

export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  LIVING: '#E3F2FD',
  KITCHEN: '#FFF3E0',
  MASTER_BED: '#F3E5F5',
  BED: '#E8EAF6',
  BATHROOM: '#E0F7FA',
  ENTRANCE: '#FBE9E7',
  BALCONY: '#E8F5E9',
  UTILITY: '#F5F5F5',
  CORRIDOR: '#ECEFF1',
  DRESSROOM: '#FCE4EC',
};
