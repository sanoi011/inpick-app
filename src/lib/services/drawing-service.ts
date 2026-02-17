import type { ParsedFloorPlan } from "@/types/floorplan";

export interface DrawingCatalogEntry {
  id: string;
  fileName: string;
  buildingType: string;
  totalArea: number;
  roomCount: number;
  bathroomCount: number;
  rooms: { type: string; name: string; area: number }[];
}

export interface SampleFloorPlanType extends DrawingCatalogEntry {
  label: string;
  description: string;
}

interface DrawingCatalog {
  version: string;
  generatedAt: string;
  count: number;
  sampleTypes?: SampleFloorPlanType[];
  entries: DrawingCatalogEntry[];
}

// In-memory cache
let catalogCache: DrawingCatalog | null = null;

/** Load the floor plan catalog (cached) */
export async function loadCatalog(): Promise<DrawingCatalog> {
  if (catalogCache) return catalogCache;

  const res = await fetch("/floorplans/index.json");
  if (!res.ok) throw new Error("Failed to load floor plan catalog");

  catalogCache = await res.json();
  return catalogCache!;
}

/** Find the best matching drawing for given building parameters */
export async function findMatchingDrawing(
  exclusiveArea: number,
  roomCount: number,
  buildingType: string = "아파트"
): Promise<DrawingCatalogEntry | null> {
  try {
    const catalog = await loadCatalog();
    if (catalog.entries.length === 0) return null;

    // Score each entry: lower is better
    const scored = catalog.entries.map((entry) => {
      const areaDiff = Math.abs(entry.totalArea - exclusiveArea);
      const roomDiff = Math.abs(entry.roomCount - roomCount);
      const typeBonus = entry.buildingType === buildingType ? 0 : 10;
      const score = areaDiff * 2 + roomDiff * 15 + typeBonus;
      return { entry, score };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0].entry;
  } catch {
    return null;
  }
}

/** Get available sample floor plan types */
export async function getSampleTypes(): Promise<SampleFloorPlanType[]> {
  try {
    const catalog = await loadCatalog();
    return catalog.sampleTypes || [];
  } catch {
    return [];
  }
}

/** Load a specific floor plan by ID */
export async function loadFloorPlan(id: string): Promise<ParsedFloorPlan | null> {
  try {
    // 네이버 도면: naver-{complexNo}-{pyeongNo}
    if (id.startsWith("naver-")) {
      const parts = id.replace("naver-", "").split("-");
      const complexNo = parts[0];
      const pyeongNo = parts[1];
      const res = await fetch(`/floorplans/naver/${complexNo}_${pyeongNo}.json`);
      if (!res.ok) return null;
      return await res.json();
    }

    const res = await fetch(`/floorplans/${id}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 도면 이미지 URL 조회 (네이버 도면 이미지 매니페스트 기반) */
let manifestCache: FloorPlanImageEntry[] | null = null;

interface FloorPlanImageEntry {
  complexNo: string;
  pyeongNo: number;
  imagePath: string;
  exclusiveArea: number;
  processed?: boolean;
  sourceType?: string;
}

export async function getFloorPlanImageUrl(drawingId: string): Promise<string | null> {
  if (!drawingId.startsWith("naver-")) return null;

  try {
    if (!manifestCache) {
      const res = await fetch("/floorplans/images/manifest.json");
      if (!res.ok) return null;
      manifestCache = await res.json();
    }

    const parts = drawingId.replace("naver-", "").split("-");
    const complexNo = parts[0];
    const pyeongNo = parseInt(parts[1]);

    // 1. 정확한 pyeongNo 매칭 (processed만)
    const exact = manifestCache!.find(
      (e) => e.complexNo === complexNo && e.pyeongNo === pyeongNo && e.processed === true
    );
    if (exact) return exact.imagePath;

    // 2. 같은 단지 + 같은 전용면적의 처리된 도면 폴백 (기본형↔확장형 매핑)
    const unprocessed = manifestCache!.find(
      (e) => e.complexNo === complexNo && e.pyeongNo === pyeongNo
    );
    if (unprocessed) {
      const areaFallback = manifestCache!.find(
        (e) => e.complexNo === complexNo
          && Math.abs(e.exclusiveArea - unprocessed.exclusiveArea) < 0.1
          && e.processed === true
      );
      if (areaFallback) return areaFallback.imagePath;
    }

    return null;
  } catch {
    return null;
  }
}
