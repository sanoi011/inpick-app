export type RoomType =
  | 'LIVING'
  | 'KITCHEN'
  | 'MASTER_BED'
  | 'BED'
  | 'BATHROOM'
  | 'ENTRANCE'
  | 'BALCONY'
  | 'UTILITY'
  | 'CORRIDOR';

export interface RoomData {
  id: string;
  type: RoomType;
  name: string;
  area: number;
  position: { x: number; y: number; width: number; height: number };
  polygon?: { x: number; y: number }[];
}

export interface WallData {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  isExterior: boolean;
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

export interface ParsedFloorPlan {
  totalArea: number;
  rooms: RoomData[];
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
}

export interface FloorPlan {
  id: string;
  buildingInfoId: string;
  source: 'API' | 'UPLOAD' | 'GENERATED';
  imageUrl?: string;
  svgData?: string;
  parsedData: ParsedFloorPlan;
  createdAt: string;
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
};
