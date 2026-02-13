/**
 * Apple RoomPlan JSON 데이터 타입 정의
 * iOS RoomPlan API (iPhone 12 Pro+ LiDAR) 출력 포맷
 */

export interface RoomPlanVector3 {
  x: number;
  y: number;
  z: number;
}

export interface RoomPlanWall {
  identifier: string;
  dimensions: RoomPlanVector3; // width, height, depth(thickness)
  transform: number[];         // 4x4 변환 행렬 (16개 float)
  category?: string;
}

export interface RoomPlanDoor {
  identifier: string;
  dimensions: RoomPlanVector3;
  transform: number[];
  category?: 'door' | 'opening';
  attributes?: string[];       // 'single', 'double', 'sliding'
  parentIdentifier?: string;   // wall identifier
}

export interface RoomPlanWindow {
  identifier: string;
  dimensions: RoomPlanVector3;
  transform: number[];
  parentIdentifier?: string;
}

export interface RoomPlanObject {
  identifier: string;
  category: string;            // 'sofa', 'table', 'chair', 'bed', 'storage', 'refrigerator', ...
  dimensions: RoomPlanVector3;
  transform: number[];
  attributes?: string[];
}

export interface RoomPlanFloor {
  identifier: string;
  polygonCorners: { x: number; z: number }[];
}

export interface RoomPlanSection {
  identifier: string;
  label?: string;
  center?: RoomPlanVector3;
}

export interface RoomPlanCapturedRoom {
  identifier?: string;
  walls: RoomPlanWall[];
  doors: RoomPlanDoor[];
  windows: RoomPlanWindow[];
  objects: RoomPlanObject[];
  floors: RoomPlanFloor[];
  sections?: RoomPlanSection[];
}

/**
 * 스캔에서 감지된 기존 가구 (AI 디자인 추천에 활용)
 */
export interface ScannedFurniture {
  id: string;
  category: string;
  roomId: string;
  position: { x: number; y: number };
  dimensions: { width: number; depth: number; height: number };
  keepOrReplace: 'keep' | 'replace' | 'undecided';
}
