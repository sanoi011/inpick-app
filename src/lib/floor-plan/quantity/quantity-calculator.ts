// src/lib/floor-plan/quantity/quantity-calculator.ts

import type { FloorPlanProject } from '@/types/floor-plan';
import type { QuantityItem, DemolitionScope, TradeCode } from './types';
import { TRADE_NAMES } from './types';
import { calculateAllRoomSurfaces, calculateProjectSummary } from './surface-calculator';
import type { RoomSurfaces } from './surface-calculator';

import { calculateDemolitionQty } from './trades/01-demolition';
import { calculateMasonryQty } from './trades/02-masonry';
import { calculatePlasterQty } from './trades/03-plaster';
import { calculateWaterproofQty } from './trades/04-waterproof';
import { calculateTileQty } from './trades/05-tile';
import { calculateWoodworkQty } from './trades/06-woodwork';
import { calculateFlooringQty } from './trades/07-flooring';
import { calculateWallpaperPaintQty } from './trades/08-wallpaper-paint';
import { calculateCeilingQty } from './trades/09-ceiling';
import { calculateDoorWindowQty } from './trades/10-door-window';
import { calculateHardwareQty } from './trades/11-hardware';
import { calculatePlumbingQty } from './trades/12-plumbing';
import { calculateSanitaryQty } from './trades/13-sanitary';
import { calculateElectricalQty } from './trades/14-electrical';
import { calculateFixtureQty } from './trades/15-fixture';
import { calculateBaseboardMoldingQty } from './trades/16-baseboard-molding';
import { calculateCleanupQty } from './trades/17-cleanup';

// ─── 결과 타입 ───

export interface QuantityResult {
  projectId: string;
  calculatedAt: string;
  surfaces: RoomSurfaces[];
  surfaceSummary: ReturnType<typeof calculateProjectSummary>;
  items: QuantityItem[];
  summary: {
    totalItems: number;
    byTrade: Record<TradeCode, {
      tradeName: string;
      itemCount: number;
      items: QuantityItem[];
    }>;
  };
}

// ─── 기본 철거 범위 (올수리) ───

export const DEFAULT_DEMO_SCOPE: DemolitionScope = {
  wallpaper: true, flooring: true, ceiling: true, tile: true,
  doors: true, allDoors: true,
  sanitary: true, allSanitary: true,
  partitionWalls: true, kitchen: true,
};

// ─── 통합 실행 ───

export function calculateAllQuantities(
  project: FloorPlanProject,
  demoScope: DemolitionScope = DEFAULT_DEMO_SCOPE
): QuantityResult {
  // Step 1: 표면적 산출
  const surfaces = calculateAllRoomSurfaces(project);
  const surfaceSummary = calculateProjectSummary(surfaces);

  // Step 2: 전 공종 물량산출
  const allItems: QuantityItem[] = [
    ...calculateDemolitionQty(project, surfaces, demoScope),
    ...calculateMasonryQty(project),
    ...calculatePlasterQty(project, surfaces),
    ...calculateWaterproofQty(surfaces),
    ...calculateTileQty(surfaces),
    ...calculateWoodworkQty(project, surfaces),
    ...calculateFlooringQty(project, surfaces),
    ...calculateWallpaperPaintQty(project, surfaces),
    ...calculateCeilingQty(surfaces),
    ...calculateDoorWindowQty(project),
    ...calculateHardwareQty(surfaces),
    ...calculatePlumbingQty(project),
    ...calculateSanitaryQty(project),
    ...calculateElectricalQty(project, surfaces),
    ...calculateFixtureQty(project),
    ...calculateBaseboardMoldingQty(surfaces),
    ...calculateCleanupQty(surfaces),
  ];

  // Step 3: 공종별 그룹핑
  const byTrade = {} as QuantityResult['summary']['byTrade'];
  for (const code of Object.keys(TRADE_NAMES) as TradeCode[]) {
    const tradeItems = allItems.filter(i => i.tradeCode === code);
    byTrade[code] = {
      tradeName: TRADE_NAMES[code],
      itemCount: tradeItems.length,
      items: tradeItems,
    };
  }

  return {
    projectId: project.id,
    calculatedAt: new Date().toISOString(),
    surfaces,
    surfaceSummary,
    items: allItems,
    summary: {
      totalItems: allItems.length,
      byTrade,
    },
  };
}
