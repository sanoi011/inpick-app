// src/lib/floor-plan/quantity/surface-calculator.ts

import type {
  FloorPlanProject, Room, Opening, EntityId
} from '@/types/floor-plan';
import { round } from './types';
import {
  calcPolygonArea, calcPolygonPerimeter, calcWallLength,
  calcCentroid, determineWallSide
} from './geometry';

// ─── 결과 타입 ───

export interface RoomSurfaces {
  roomId: EntityId;
  roomName: string;
  roomType: string;

  floor: {
    grossArea: number;       // ㎡ 총 바닥면적
    netArea: number;         // ㎡ 순 바닥면적 (기둥 공제)
    perimeter: number;       // m 바닥 둘레
  };

  ceiling: {
    flatArea: number;        // ㎡ 평천장
    recessSideArea: number;  // ㎡ 우물천장 측면
    totalArea: number;       // ㎡ 합계
    hasRecess: boolean;
  };

  walls: {
    grossArea: number;         // ㎡ 총 벽면적
    openingDeduction: number;  // ㎡ 개구부 공제
    baseboardDeduction: number;// ㎡ 걸레받이 공제
    netArea: number;           // ㎡ 순 벽면적
    wallDetails: WallSurfaceDetail[];
  };

  openingJambs: {
    totalArea: number;         // ㎡ 잼 면적 합계
    details: JambDetail[];
  };

  baseboard: {
    totalLength: number;       // m 총 길이
    deductions: number;        // m 개구부 구간 공제
    netLength: number;         // m 순 설치 길이
  };

  molding: {
    totalLength: number;       // m
    netLength: number;         // m
  };

  wetArea?: {
    floorWaterproofArea: number;  // ㎡ 바닥 방수
    wallWaterproofArea: number;   // ㎡ 벽 방수 (바닥+1800mm)
    wallTileArea: number;         // ㎡ 벽타일
    floorTileArea: number;        // ㎡ 바닥타일
    wallTileHeight: number;       // mm 벽타일 시공 높이
    curbArea: number;             // ㎡ 턱(단차) 면적
  };
}

export interface WallSurfaceDetail {
  wallId: EntityId;
  wallSide: 'LEFT' | 'RIGHT';
  grossArea: number;
  openingArea: number;
  netArea: number;
  length: number;        // m
  height: number;        // mm
}

export interface JambDetail {
  openingId: EntityId;
  openingType: string;
  leftJamb: number;      // ㎡
  rightJamb: number;     // ㎡
  topJamb: number;       // ㎡
  totalJamb: number;     // ㎡
}

// ─── 산출 함수 ───

/** 걸레받이 순 설치 길이 (mm) — 바닥에 닿는 개구부 구간 공제 */
function calcBaseboardNetLength(room: Room, openings: Opening[]): number {
  const perimeter = calcPolygonPerimeter(room.polygon);
  const doorWidths = openings
    .filter(o => o.sillHeight === 0)
    .reduce((sum, o) => sum + o.width, 0);
  return perimeter - doorWidths;
}

export function calculateRoomSurfaces(
  room: Room,
  project: FloorPlanProject
): RoomSurfaces {
  const walls = project.walls.filter(w => room.boundaryWallIds.includes(w.id));
  const openings = project.openings.filter(o =>
    walls.some(w => w.id === o.wallId)
  );
  const structures = (project.structures || []).filter(s =>
    s.affectedRoomIds?.includes(room.id)
  );

  // 1. 바닥 면적
  const grossFloorArea = calcPolygonArea(room.polygon);
  const structureDeduction = structures.reduce((sum, s) =>
    sum + (s.sectionWidth * s.sectionDepth) / 1_000_000, 0
  );
  const netFloorArea = grossFloorArea - structureDeduction;
  const floorPerimeter = calcPolygonPerimeter(room.polygon) / 1000; // m

  // 2. 천장 면적
  let recessSideArea = 0;
  if (room.ceilingRecess) {
    const recessPerimeterM = calcPolygonPerimeter(room.ceilingRecess.polygon) / 1000;
    const recessDepthM = room.ceilingRecess.depth / 1000;
    recessSideArea = recessPerimeterM * recessDepthM;
  }

  // 3. 벽면 면적
  const roomCenter = calcCentroid(room.polygon);
  const wallDetails: WallSurfaceDetail[] = [];
  let totalOpeningDeduction = 0;

  for (const wall of walls) {
    const wallLengthM = calcWallLength(wall) / 1000;
    const wallHeightM = room.ceilingHeight / 1000;
    const wallOpenings = openings.filter(o => o.wallId === wall.id);
    const openingArea = wallOpenings.reduce((sum, o) =>
      sum + (o.width * o.height) / 1_000_000, 0
    );
    const grossArea = wallLengthM * wallHeightM;
    const netArea = Math.max(0, grossArea - openingArea);
    const wallSide = determineWallSide(wall, roomCenter);

    wallDetails.push({
      wallId: wall.id,
      wallSide,
      grossArea: round(grossArea),
      openingArea: round(openingArea),
      netArea: round(netArea),
      length: round(wallLengthM, 3),
      height: room.ceilingHeight,
    });
    totalOpeningDeduction += openingArea;
  }

  const wallGrossArea = wallDetails.reduce((s, d) => s + d.grossArea, 0);
  const wallNetArea = wallDetails.reduce((s, d) => s + d.netArea, 0);

  // 4. 걸레받이 공제 (도배/페인트 면적에서 차감)
  const baseboardHeight = room.baseboard?.height || 0;
  const baseboardLengthM = calcBaseboardNetLength(room, openings) / 1000;
  const baseboardDeduction = baseboardHeight > 0
    ? baseboardLengthM * (baseboardHeight / 1000)
    : 0;

  // 5. 개구부 잼(측면) 면적
  const jambDetails: JambDetail[] = openings.map(opening => {
    const wall = walls.find(w => w.id === opening.wallId);
    if (!wall) return null;
    const tM = wall.thickness / 1000;
    const hM = opening.height / 1000;
    const wM = opening.width / 1000;
    const leftJamb = round(tM * hM);
    const rightJamb = round(tM * hM);
    const topJamb = round(tM * wM);
    return {
      openingId: opening.id,
      openingType: opening.type,
      leftJamb, rightJamb, topJamb,
      totalJamb: round(leftJamb + rightJamb + topJamb),
    };
  }).filter(Boolean) as JambDetail[];

  // 6. 걸레받이/몰딩 길이
  const doorDeductionM = openings
    .filter(o => o.sillHeight === 0)
    .reduce((sum, o) => sum + o.width, 0) / 1000;
  const baseboardNetLength = Math.max(0, floorPerimeter - doorDeductionM);

  // 7. 습식 공간
  let wetArea: RoomSurfaces['wetArea'];
  if (room.isWetArea) {
    const WATERPROOF_WALL_H = 1800; // mm
    const wallPerimeterM = wallDetails.reduce((s, d) => s + d.length, 0);
    const curbHeight = Math.abs(room.floorLevelOffset) / 1000;

    wetArea = {
      floorWaterproofArea: round(netFloorArea),
      wallWaterproofArea: round(wallPerimeterM * (WATERPROOF_WALL_H / 1000)),
      wallTileArea: round(wallNetArea),
      floorTileArea: round(netFloorArea),
      wallTileHeight: room.ceilingHeight,
      curbArea: round(curbHeight > 0 ? curbHeight * doorDeductionM : 0),
    };
  }

  return {
    roomId: room.id,
    roomName: room.name,
    roomType: room.type,
    floor: {
      grossArea: round(grossFloorArea),
      netArea: round(netFloorArea),
      perimeter: round(floorPerimeter, 3),
    },
    ceiling: {
      flatArea: round(netFloorArea),
      recessSideArea: round(recessSideArea),
      totalArea: round(netFloorArea + recessSideArea),
      hasRecess: !!room.ceilingRecess,
    },
    walls: {
      grossArea: round(wallGrossArea),
      openingDeduction: round(totalOpeningDeduction),
      baseboardDeduction: round(baseboardDeduction),
      netArea: round(Math.max(0, wallNetArea - baseboardDeduction)),
      wallDetails,
    },
    openingJambs: {
      totalArea: round(jambDetails.reduce((s, j) => s + j.totalJamb, 0)),
      details: jambDetails,
    },
    baseboard: {
      totalLength: round(floorPerimeter, 3),
      deductions: round(doorDeductionM, 3),
      netLength: round(baseboardNetLength, 3),
    },
    molding: {
      totalLength: round(floorPerimeter, 3),
      netLength: round(floorPerimeter, 3),
    },
    wetArea,
  };
}

// ─── 전체 프로젝트 산출 ───

export function calculateAllRoomSurfaces(
  project: FloorPlanProject
): RoomSurfaces[] {
  return project.rooms.map(room => calculateRoomSurfaces(room, project));
}

export interface ProjectSurfaceSummary {
  totalFloorArea: number;
  totalCeilingArea: number;
  totalWallArea: number;
  totalOpeningDeduction: number;
  totalJambArea: number;
  totalBaseboardLength: number;
  totalMoldingLength: number;
  wetRoomCount: number;
  dryRoomCount: number;
  roomCount: number;
}

export function calculateProjectSummary(
  surfaces: RoomSurfaces[]
): ProjectSurfaceSummary {
  return {
    totalFloorArea: round(surfaces.reduce((s, r) => s + r.floor.netArea, 0)),
    totalCeilingArea: round(surfaces.reduce((s, r) => s + r.ceiling.totalArea, 0)),
    totalWallArea: round(surfaces.reduce((s, r) => s + r.walls.netArea, 0)),
    totalOpeningDeduction: round(surfaces.reduce((s, r) => s + r.walls.openingDeduction, 0)),
    totalJambArea: round(surfaces.reduce((s, r) => s + r.openingJambs.totalArea, 0)),
    totalBaseboardLength: round(surfaces.reduce((s, r) => s + r.baseboard.netLength, 0)),
    totalMoldingLength: round(surfaces.reduce((s, r) => s + r.molding.netLength, 0)),
    wetRoomCount: surfaces.filter(r => r.wetArea).length,
    dryRoomCount: surfaces.filter(r => !r.wetArea).length,
    roomCount: surfaces.length,
  };
}
