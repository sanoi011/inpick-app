/**
 * INPICK EXPO — BoothScene 파라메트릭 씬 (Phase 2, 마스터 지시문 §8/AGENTS).
 *
 * 불변조건:
 *   - 모든 씬 오브젝트는 버전 있는 컴포넌트 카탈로그에서만 온다.
 *   - 오브젝트는 확정/임시 footprint 경계를 벗어날 수 없다 (경계 클램프).
 *   - 이동은 0.5m 그리드 스냅. 겹침은 배치를 막지 않되 경고로 노출한다
 *     (사람이 판단; 자동 임의 수정 금지).
 *   - 모든 연산은 순수 함수 — 새 씬 객체를 반환하고 revision을 올린다.
 *
 * 좌표계: 부스 중심 원점, x=폭 방향, z=깊이 방향(+z가 오픈면/전면),
 * 단위 m. Three.js 캔버스와 동일한 배치 좌표를 공유한다.
 */

export const EXPO_SCENE_SCHEMA_VERSION = 1;
export const EXPO_GRID_SNAP_M = 0.5;
export const EXPO_MAX_COMPONENTS = 40;

export interface ExpoCatalogItem {
  catalogId: string;
  /** 카탈로그 개정 추적용 — BOM 단계에서 단가/사양의 기준이 된다. */
  catalogVersion: number;
  nameKo: string;
  /** footprint 위 배치 크기 (m). heightM은 렌더/높이 규정 검토용. */
  widthM: number;
  depthM: number;
  heightM: number;
  color: string;
}

/** Release 1 기본 카탈로그 — 실측 가능한 일반 규격. 행사 매뉴얼이 우선. */
export const EXPO_BASE_CATALOG: ExpoCatalogItem[] = [
  {
    catalogId: "info_counter",
    catalogVersion: 1,
    nameKo: "안내 카운터",
    widthM: 1,
    depthM: 0.5,
    heightM: 1,
    color: "#3b82f6",
  },
  {
    catalogId: "display_showcase",
    catalogVersion: 1,
    nameKo: "쇼케이스",
    widthM: 0.5,
    depthM: 0.5,
    heightM: 1.8,
    color: "#8b5cf6",
  },
  {
    catalogId: "product_table",
    catalogVersion: 1,
    nameKo: "제품 테이블",
    widthM: 1.5,
    depthM: 0.7,
    heightM: 0.75,
    color: "#0ea5e9",
  },
  {
    catalogId: "signage_tower",
    catalogVersion: 1,
    nameKo: "사이니지 타워",
    widthM: 0.5,
    depthM: 0.5,
    heightM: 2.4,
    color: "#f59e0b",
  },
];

export interface ExpoSceneComponent {
  id: string;
  catalogId: string;
  catalogVersion: number;
  /** 부스 중심 기준 좌표 (m), 0.5m 스냅 */
  x: number;
  z: number;
  /** 0 | 90 | 180 | 270 (도) */
  rotation: number;
}

export interface ExpoBoothScene {
  schemaVersion: typeof EXPO_SCENE_SCHEMA_VERSION;
  revision: number;
  boothWidthM: number;
  boothDepthM: number;
  components: ExpoSceneComponent[];
}

export interface ExpoSceneWarning {
  code: "components_overlap" | "component_touches_wall";
  componentIds: string[];
}

export class ExpoSceneError extends Error {
  constructor(
    public readonly code:
      | "EXPO_SCENE_CATALOG_UNKNOWN"
      | "EXPO_SCENE_COMPONENT_NOT_FOUND"
      | "EXPO_SCENE_COMPONENT_LIMIT"
      | "EXPO_SCENE_BOOTH_TOO_SMALL",
  ) {
    super(code);
    this.name = "ExpoSceneError";
  }
}

export function createExpoScene(
  boothWidthM: number,
  boothDepthM: number,
): ExpoBoothScene {
  if (boothWidthM < 1 || boothDepthM < 1) {
    throw new ExpoSceneError("EXPO_SCENE_BOOTH_TOO_SMALL");
  }
  return {
    schemaVersion: EXPO_SCENE_SCHEMA_VERSION,
    revision: 1,
    boothWidthM: round1(boothWidthM),
    boothDepthM: round1(boothDepthM),
    components: [],
  };
}

export function findCatalogItem(catalogId: string): ExpoCatalogItem | null {
  return (
    EXPO_BASE_CATALOG.find((item) => item.catalogId === catalogId) ?? null
  );
}

/** 컴포넌트의 회전 반영 배치 크기 (footprint 평면 기준). */
export function componentFootprintSize(component: ExpoSceneComponent): {
  w: number;
  d: number;
} {
  const item = findCatalogItem(component.catalogId);
  if (!item) return { w: 0.5, d: 0.5 };
  const rotated = component.rotation % 180 !== 0;
  return rotated
    ? { w: item.depthM, d: item.widthM }
    : { w: item.widthM, d: item.depthM };
}

export function addExpoComponent(
  scene: ExpoBoothScene,
  catalogId: string,
  componentId: string,
): ExpoBoothScene {
  const item = findCatalogItem(catalogId);
  if (!item) throw new ExpoSceneError("EXPO_SCENE_CATALOG_UNKNOWN");
  if (scene.components.length >= EXPO_MAX_COMPONENTS) {
    throw new ExpoSceneError("EXPO_SCENE_COMPONENT_LIMIT");
  }
  const draft: ExpoSceneComponent = {
    id: componentId,
    catalogId,
    catalogVersion: item.catalogVersion,
    x: 0,
    z: 0,
    rotation: 0,
  };
  const placed = clampToBooth(scene, draft);
  return bump({ ...scene, components: [...scene.components, placed] });
}

export function moveExpoComponent(
  scene: ExpoBoothScene,
  componentId: string,
  deltaX: number,
  deltaZ: number,
): ExpoBoothScene {
  const index = scene.components.findIndex((c) => c.id === componentId);
  if (index < 0) throw new ExpoSceneError("EXPO_SCENE_COMPONENT_NOT_FOUND");
  const current = scene.components[index];
  const moved = clampToBooth(scene, {
    ...current,
    x: snap(current.x + deltaX),
    z: snap(current.z + deltaZ),
  });
  const components = [...scene.components];
  components[index] = moved;
  return bump({ ...scene, components });
}

export function rotateExpoComponent(
  scene: ExpoBoothScene,
  componentId: string,
): ExpoBoothScene {
  const index = scene.components.findIndex((c) => c.id === componentId);
  if (index < 0) throw new ExpoSceneError("EXPO_SCENE_COMPONENT_NOT_FOUND");
  const current = scene.components[index];
  const rotated = clampToBooth(scene, {
    ...current,
    rotation: (current.rotation + 90) % 360,
  });
  const components = [...scene.components];
  components[index] = rotated;
  return bump({ ...scene, components });
}

export function removeExpoComponent(
  scene: ExpoBoothScene,
  componentId: string,
): ExpoBoothScene {
  if (!scene.components.some((c) => c.id === componentId)) {
    throw new ExpoSceneError("EXPO_SCENE_COMPONENT_NOT_FOUND");
  }
  return bump({
    ...scene,
    components: scene.components.filter((c) => c.id !== componentId),
  });
}

/** 부스 치수 변경(치수 확정/수정) 시 — 기존 배치는 새 경계로 클램프한다. */
export function resizeExpoScene(
  scene: ExpoBoothScene,
  boothWidthM: number,
  boothDepthM: number,
): ExpoBoothScene {
  if (boothWidthM < 1 || boothDepthM < 1) {
    throw new ExpoSceneError("EXPO_SCENE_BOOTH_TOO_SMALL");
  }
  const next: ExpoBoothScene = {
    ...scene,
    boothWidthM: round1(boothWidthM),
    boothDepthM: round1(boothDepthM),
  };
  return bump({
    ...next,
    components: next.components.map((c) => clampToBooth(next, c)),
  });
}

/** AABB 기준 겹침/벽 접촉 경고 — 배치를 막지 않고 사람이 판단한다. */
export function evaluateExpoScene(scene: ExpoBoothScene): ExpoSceneWarning[] {
  const warnings: ExpoSceneWarning[] = [];
  const boxes = scene.components.map((component) => {
    const size = componentFootprintSize(component);
    return {
      id: component.id,
      minX: component.x - size.w / 2,
      maxX: component.x + size.w / 2,
      minZ: component.z - size.d / 2,
      maxZ: component.z + size.d / 2,
    };
  });
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap =
        a.minX < b.maxX - 1e-6 &&
        a.maxX > b.minX + 1e-6 &&
        a.minZ < b.maxZ - 1e-6 &&
        a.maxZ > b.minZ + 1e-6;
      if (overlap) {
        warnings.push({
          code: "components_overlap",
          componentIds: [a.id, b.id],
        });
      }
    }
  }
  const halfW = scene.boothWidthM / 2;
  const halfD = scene.boothDepthM / 2;
  for (const box of boxes) {
    if (
      box.minX <= -halfW + 1e-6 ||
      box.maxX >= halfW - 1e-6 ||
      box.minZ <= -halfD + 1e-6
    ) {
      warnings.push({ code: "component_touches_wall", componentIds: [box.id] });
    }
  }
  return warnings;
}

export function isExpoBoothScene(value: unknown): value is ExpoBoothScene {
  if (!value || typeof value !== "object") return false;
  const scene = value as ExpoBoothScene;
  return (
    scene.schemaVersion === EXPO_SCENE_SCHEMA_VERSION &&
    typeof scene.revision === "number" &&
    typeof scene.boothWidthM === "number" &&
    typeof scene.boothDepthM === "number" &&
    Array.isArray(scene.components) &&
    scene.components.every(
      (c) =>
        typeof c.id === "string" &&
        typeof c.catalogId === "string" &&
        typeof c.x === "number" &&
        typeof c.z === "number" &&
        typeof c.rotation === "number",
    )
  );
}

function clampToBooth(
  scene: ExpoBoothScene,
  component: ExpoSceneComponent,
): ExpoSceneComponent {
  // 그리드 위에서만 움직이도록: 먼저 스냅하고, 경계는 그리드로 내림한
  // 최댓값으로 자른다 (스냅이 경계 밖으로 되돌리는 것을 방지).
  const size = componentFootprintSize(component);
  const maxX = Math.max(0, floorToGrid(scene.boothWidthM / 2 - size.w / 2));
  const maxZ = Math.max(0, floorToGrid(scene.boothDepthM / 2 - size.d / 2));
  return {
    ...component,
    x: Math.min(maxX, Math.max(-maxX, snap(component.x))),
    z: Math.min(maxZ, Math.max(-maxZ, snap(component.z))),
  };
}

function floorToGrid(value: number): number {
  return Math.floor((value + 1e-9) / EXPO_GRID_SNAP_M) * EXPO_GRID_SNAP_M;
}

function snap(value: number): number {
  return Math.round(value / EXPO_GRID_SNAP_M) * EXPO_GRID_SNAP_M;
}

function bump(scene: ExpoBoothScene): ExpoBoothScene {
  return { ...scene, revision: scene.revision + 1 };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
