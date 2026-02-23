// src/types/construction-drawing.ts
// AI 시공도면 생성 시스템 타입 정의

import type { EntityId, Point2D } from '@/types/floor-plan';

// ─── 도면 유형 ───

export type DrawingType =
  | 'cover_page'
  | 'furniture_layout'
  | 'electrical_plan'
  | 'elevation_living'
  | 'elevation_kitchen'
  | 'elevation_master_bed'
  | 'elevation_bathroom1'
  | 'elevation_bathroom2'
  | 'elevation_bed';

export type DrawingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DrawingSetStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ─── 개별 도면 ───

export interface ConstructionDrawing {
  id: string;
  setId: string;
  drawingType: DrawingType;
  status: DrawingStatus;
  svgUrl?: string;
  aiEnhancedUrl?: string;
  finalUrl?: string;
  metadata: DrawingMetadata;
  errorMessage?: string;
  processingTimeMs?: number;
  sortOrder: number;
  createdAt: string;
}

export interface DrawingMetadata {
  roomId?: string;
  roomName?: string;
  wallLabel?: string;        // A, B, C, D
  wallLengthMm?: number;
  wallHeightMm?: number;
  svgWidth?: number;
  svgHeight?: number;
  scale?: number;
}

// ─── 도면 세트 (전체 패키지) ───

export interface ConstructionDrawingSet {
  id: string;
  contractId: string;
  consumerProjectId?: string;
  status: DrawingSetStatus;
  pdfUrl?: string;
  totalPages: number;
  progress: number;            // 0-100
  errorMessage?: string;
  processingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 입면도 데이터 ───

export interface WallElevation {
  wallId: EntityId;
  wallLabel: 'A' | 'B' | 'C' | 'D';
  wallLengthMm: number;
  wallHeightMm: number;
  openings: ElevationOpening[];
  fixtures: ElevationFixture[];
  materials: ElevationMaterial[];
  electricalPlacements: ElectricalPlacement[];
}

export interface ElevationOpening {
  type: 'door' | 'window' | 'sliding_door' | 'entrance_door';
  positionFromLeftMm: number;   // 벽면 왼쪽에서의 거리
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;         // 바닥에서 하단까지 (문=0, 창=900)
  label?: string;
}

export interface ElevationFixture {
  type: string;
  positionFromLeftMm: number;
  heightFromFloorMm: number;
  widthMm: number;
  heightMm: number;
  label?: string;
}

export interface ElevationMaterial {
  area: 'floor' | 'wall' | 'ceiling';
  name: string;
  specification?: string;
  positionFromLeftMm?: number;
  widthMm?: number;
  heightMm?: number;
}

// ─── 전기 배치 ───

export type ElectricalType =
  | 'outlet'              // 일반 콘센트
  | 'outlet_double'       // 2구 콘센트
  | 'outlet_grounded'     // 접지 콘센트
  | 'switch_single'       // 1로 스위치
  | 'switch_double'       // 2로 스위치
  | 'switch_three_way'    // 3로 스위치
  | 'tv_outlet'           // TV 단자
  | 'data_outlet'         // 데이터/통신 단자
  | 'ac_outlet'           // 에어컨 전용 콘센트
  | 'gas_valve'           // 가스 밸브
  | 'exhaust_fan'         // 환풍기
  | 'intercom'            // 인터폰
  | 'doorbell'            // 초인종
  | 'fire_detector'       // 화재감지기
  | 'light_switch';       // 조명 스위치

export interface ElectricalPlacement {
  id: string;
  type: ElectricalType;
  wallId: EntityId;
  positionFromLeftMm: number;
  heightFromFloorMm: number;
  label: string;
  specification?: string;
}

// ─── 가구 심볼 ───

export type FurnitureType =
  | 'sofa_3seat' | 'sofa_2seat' | 'sofa_l_shape'
  | 'coffee_table' | 'side_table'
  | 'dining_table_4' | 'dining_table_6' | 'dining_chair'
  | 'queen_bed' | 'single_bed' | 'super_single_bed'
  | 'nightstand'
  | 'desk' | 'desk_chair'
  | 'wardrobe_2door' | 'wardrobe_3door'
  | 'bookshelf'
  | 'tv_stand' | 'tv_wall_mount'
  | 'shoe_cabinet'
  | 'washing_machine' | 'dryer'
  | 'refrigerator'
  | 'kitchen_island';

export interface FurnitureSymbol {
  type: FurnitureType;
  roomId: EntityId;
  positionMm: Point2D;
  widthMm: number;
  heightMm: number;       // depth in plan view
  rotation: number;        // degrees
  label?: string;
}

// ─── 입면도 계산 결과 ───

export interface ElevationData {
  roomId: string;
  roomName: string;
  roomType: string;
  elevations: WallElevation[];
}

// ─── DB → 프론트엔드 변환 ───

export function mapDbDrawing(db: Record<string, unknown>): ConstructionDrawing {
  return {
    id: db.id as string,
    setId: db.set_id as string,
    drawingType: db.drawing_type as DrawingType,
    status: db.status as DrawingStatus,
    svgUrl: db.svg_url as string | undefined,
    aiEnhancedUrl: db.ai_enhanced_url as string | undefined,
    finalUrl: db.final_url as string | undefined,
    metadata: (db.metadata as DrawingMetadata) || {},
    errorMessage: db.error_message as string | undefined,
    processingTimeMs: db.processing_time_ms as number | undefined,
    sortOrder: (db.sort_order as number) || 0,
    createdAt: db.created_at as string,
  };
}

export function mapDbDrawingSet(db: Record<string, unknown>): ConstructionDrawingSet {
  return {
    id: db.id as string,
    contractId: db.contract_id as string,
    consumerProjectId: db.consumer_project_id as string | undefined,
    status: db.status as DrawingSetStatus,
    pdfUrl: db.pdf_url as string | undefined,
    totalPages: (db.total_pages as number) || 0,
    progress: (db.progress as number) || 0,
    errorMessage: db.error_message as string | undefined,
    processingTimeMs: db.processing_time_ms as number | undefined,
    createdAt: db.created_at as string,
    updatedAt: db.updated_at as string,
  };
}

// ─── 라벨/색상 상수 ───

export const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  cover_page: '표지',
  furniture_layout: '가구배치도',
  electrical_plan: '전기배선도',
  elevation_living: '거실 입면전개도',
  elevation_kitchen: '주방 입면전개도',
  elevation_master_bed: '안방 입면전개도',
  elevation_bathroom1: '욕실1 입면전개도',
  elevation_bathroom2: '욕실2 입면전개도',
  elevation_bed: '침실 입면전개도',
};

export const DRAWING_STATUS_LABELS: Record<DrawingStatus, string> = {
  pending: '대기',
  processing: '생성 중',
  completed: '완료',
  failed: '실패',
};

export const DRAWING_STATUS_COLORS: Record<DrawingStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};
