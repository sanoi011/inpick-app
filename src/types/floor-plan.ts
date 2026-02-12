// QTY 엔진용 타입 정의 (FloorPlanProject BIM JSON)

export type EntityId = string;

export interface Point2D {
  x: number; // mm
  y: number; // mm
}

export type Polygon2D = Point2D[];

// ─── Room ───

export interface Room {
  id: EntityId;
  name: string;
  type: string; // LIVING_ROOM, BEDROOM, MASTER_BEDROOM, KITCHEN, BATHROOM, ENTRANCE, BALCONY, UTILITY, CORRIDOR, DRESSROOM, STUDY, DINING
  polygon: Polygon2D; // mm 좌표
  ceilingHeight: number; // mm (기본 2700)
  isWetArea: boolean;
  floorLevelOffset: number; // mm (습식 공간 단차, 기본 0)
  boundaryWallIds: EntityId[];
  heatingType?: 'ONDOL' | 'RADIATOR' | 'NONE';

  // 마감재 참조
  floorFinishId?: EntityId;
  wallFinishId?: EntityId;
  ceilingFinishId?: EntityId;

  // 걸레받이
  baseboard?: {
    height: number; // mm (기본 80)
    material: string;
  };

  // 우물천장
  ceilingRecess?: {
    polygon: Polygon2D;
    depth: number; // mm
    hasIndirectLighting: boolean;
  };
}

// ─── Wall ───

export interface Wall {
  id: EntityId;
  start: Point2D; // mm
  end: Point2D; // mm
  thickness: number; // mm
  height: number; // mm
  material: 'CONCRETE' | 'BLOCK' | 'DRYWALL' | 'WOOD';
  isExterior: boolean;
  constructionStatus: 'EXISTING' | 'DEMOLISH' | 'NEW';
}

// ─── Opening (문/창문) ───

export interface Opening {
  id: EntityId;
  wallId: EntityId;
  type: string; // SINGLE_DOOR, DOUBLE_DOOR, SLIDING_DOOR, POCKET_DOOR, FOLDING_DOOR, ENTRANCE_DOOR, FIRE_DOOR, WINDOW, SLIDING_WINDOW, FIXED_WINDOW, BALCONY_WINDOW, BALCONY_DOOR
  width: number; // mm
  height: number; // mm
  sillHeight: number; // mm (문=0, 창문=바닥에서 하단까지)
  spec: {
    kind: 'DOOR' | 'WINDOW';
  };
  constructionStatus: 'EXISTING' | 'DEMOLISH' | 'NEW';
}

// ─── Fixture (설비) ───

export interface Fixture {
  id: EntityId;
  type: string; // TOILET, BIDET, BASIN, BASIN_CABINET, BATHTUB, SHOWER_BOOTH, SHOWER_HEAD, KITCHEN_SINK, KITCHEN_UPPER_CABINET, KITCHEN_LOWER_CABINET, KITCHEN_COUNTER, GAS_RANGE, INDUCTION, RANGE_HOOD, SHOE_CABINET, WARDROBE, AC_INDOOR, BOILER
  roomId: EntityId;
  boundingBox: {
    x: number; // mm
    y: number; // mm
    width: number; // mm
    height: number; // mm
  };
  constructionStatus: 'EXISTING' | 'DEMOLISH' | 'NEW';
  requiresWaterSupply: boolean;
  requiresDrain: boolean;
  requiresGas: boolean;
  requiresElectrical: boolean;
}

// ─── FinishSpec (마감재 사양) ───

export interface FinishSpec {
  id: EntityId;
  name: string;
  category: string; // WOOD_FLOORING, LAMINATE_FLOORING, VINYL_FLOORING, TILE_FLOORING, WALLPAPER, PAINT, etc.
}

// ─── Structure (기둥/보) ───

export interface Structure {
  id: EntityId;
  type: 'COLUMN' | 'BEAM';
  sectionWidth: number; // mm
  sectionDepth: number; // mm
  affectedRoomIds: EntityId[];
}

// ─── FloorPlanProject (최상위 BIM 데이터) ───

export interface FloorPlanProject {
  id: string;
  name: string;
  totalArea: number; // m²
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  fixtures: Fixture[];
  finishSpecs?: FinishSpec[];
  structures?: Structure[];
}
