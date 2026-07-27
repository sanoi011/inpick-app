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
  /** 벽 요소 — 경계까지 밀착 배치를 허용하고 벽접촉 경고에서 제외한다. */
  wallMounted?: boolean;
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
  {
    catalogId: "graphic_wall",
    catalogVersion: 1,
    nameKo: "그래픽 월(3m)",
    widthM: 3,
    depthM: 0.1,
    heightM: 2.4,
    color: "#10b981",
    wallMounted: true,
  },
  {
    catalogId: "lightbox_panel",
    catalogVersion: 1,
    nameKo: "라이트박스(1m)",
    widthM: 1,
    depthM: 0.15,
    heightM: 2,
    color: "#f43f5e",
    wallMounted: true,
  },
  {
    catalogId: "brochure_stand",
    catalogVersion: 1,
    nameKo: "브로슈어 랙",
    widthM: 0.4,
    depthM: 0.4,
    heightM: 1.5,
    color: "#64748b",
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
  /** 카탈로그 기본 크기 덮어쓰기 (m) — 미지정 시 카탈로그 값 */
  widthM?: number;
  depthM?: number;
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
  const baseW = component.widthM ?? item.widthM;
  const baseD = component.depthM ?? item.depthM;
  const rotated = component.rotation % 180 !== 0;
  return rotated ? { w: baseD, d: baseW } : { w: baseW, d: baseD };
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

/** 컴포넌트 크기 변경 (0.1–20m, 0.1m 단위 반올림) — 위치는 새 크기로 재클램프 */
export function resizeExpoComponent(
  scene: ExpoBoothScene,
  componentId: string,
  widthM: number,
  depthM: number,
): ExpoBoothScene {
  const index = scene.components.findIndex((c) => c.id === componentId);
  if (index < 0) throw new ExpoSceneError("EXPO_SCENE_COMPONENT_NOT_FOUND");
  const clampSize = (value: number) =>
    Math.min(20, Math.max(0.1, Math.round(value * 10) / 10));
  const current = scene.components[index];
  const resized = clampToBooth(scene, {
    ...current,
    widthM: clampSize(widthM),
    depthM: clampSize(depthM),
  });
  const components = [...scene.components];
  components[index] = resized;
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
    const component = scene.components.find((c) => c.id === box.id);
    if (component && findCatalogItem(component.catalogId)?.wallMounted) continue;
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

export interface ExpoDecalPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  faceWidth: number;
  faceHeight: number;
}

/**
 * 벽 요소 정면(로고 데칼) 배치 — 렌더러 독립 순수 계산.
 * rotation 0=+z(부스 안쪽), 90=+x, 180=-z, 270=-x 방향 면.
 */
export function expoDecalPlacement(
  component: ExpoSceneComponent,
  item: ExpoCatalogItem,
): ExpoDecalPlacement {
  const size = componentFootprintSize(component);
  const gap = 0.012;
  const rot = (((component.rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const offsets: Record<number, { dx: number; dz: number; ry: number }> = {
    0: { dx: 0, dz: size.d / 2 + gap, ry: 0 },
    90: { dx: size.w / 2 + gap, dz: 0, ry: Math.PI / 2 },
    180: { dx: 0, dz: -(size.d / 2 + gap), ry: Math.PI },
    270: { dx: -(size.w / 2 + gap), dz: 0, ry: -Math.PI / 2 },
  };
  const offset = offsets[rot] ?? offsets[0];
  return {
    x: component.x + offset.dx,
    y: item.heightM / 2,
    z: component.z + offset.dz,
    rotationY: offset.ry,
    faceWidth: rot % 180 === 0 ? size.w : size.d,
    faceHeight: item.heightM,
  };
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
  const wallMounted = findCatalogItem(component.catalogId)?.wallMounted ?? false;
  // 벽 요소는 벽면 밀착이 목적이므로 그리드로 내리지 않고 정확한 한계까지 허용
  const limit = (half: number, extent: number) =>
    wallMounted
      ? Math.max(0, round2(half - extent))
      : Math.max(0, floorToGrid(half - extent));
  const maxX = limit(scene.boothWidthM / 2, size.w / 2);
  const maxZ = limit(scene.boothDepthM / 2, size.d / 2);
  return {
    ...component,
    x: Math.min(maxX, Math.max(-maxX, snap(component.x))),
    z: Math.min(maxZ, Math.max(-maxZ, snap(component.z))),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

/** 프롬프트에 벽/월 언급이 있는가 — 프롬프트 발 벽 생성 트리거 */
export function promptMentionsWall(prompt: string): boolean {
  return /벽|백월|그래픽\s*월|월(?![요화수목금토일])|backwall|graphic\s*wall|\bwall/i.test(
    prompt,
  );
}

/**
 * 프롬프트가 벽을 요구할 때 그래픽 월 1장을 뒷면에 배치한다 (Phase 3
 * prompt-to-scene 최소 연산). 이미 벽 요소가 있으면 그대로 둔다.
 * 히스토리로 되돌릴 수 있는 일반 씬 연산이다 — 자동 확정이 아니다.
 */
export function addWallFromPrompt(
  scene: ExpoBoothScene,
  componentId: string,
): ExpoBoothScene {
  const hasWallElement = scene.components.some(
    (component) => findCatalogItem(component.catalogId)?.wallMounted,
  );
  if (hasWallElement) return scene;
  const withWall = addExpoComponent(scene, "graphic_wall", componentId);
  // 뒷면(-z)으로 밀어 벽면 위치에 배치 — wallMounted 클램프가 한계를 잡는다
  return moveExpoComponent(withWall, componentId, 0, -100);
}

export interface ExpoConceptSuggestion {
  catalogId: string;
  count: number;
}

/**
 * 컨셉 이미지 비전 분석 결과를 씬에 반영한다 (Phase 3 image-to-scene 제안).
 * - 카탈로그에 없는 id는 무시, 종류당 최대 4개·씬 한도 준수.
 * - 이미 있는 수량은 유지하고 부족분만 추가 — 사용자 배치를 덮지 않는다.
 * - 결과는 일반 씬 연산 하나로 적용돼 되돌리기 1번으로 취소된다.
 */
export function applyConceptSuggestions(
  scene: ExpoBoothScene,
  suggestions: ExpoConceptSuggestion[],
  idPrefix: string,
): ExpoBoothScene {
  let next = scene;
  let placed = 0;
  let wallPlaced = 0;
  for (const suggestion of suggestions) {
    const item = findCatalogItem(suggestion.catalogId);
    if (!item) continue;
    const want = Math.min(Math.max(0, Math.floor(suggestion.count)), 4);
    const have = next.components.filter(
      (component) => component.catalogId === suggestion.catalogId,
    ).length;
    for (let index = have; index < want; index += 1) {
      if (next.components.length >= EXPO_MAX_COMPONENTS) return next;
      const id = `${idPrefix}_${suggestion.catalogId}_${index}`;
      next = addExpoComponent(next, suggestion.catalogId, id);
      if (item.wallMounted) {
        // 벽 요소는 뒷면에 나란히
        next = moveExpoComponent(next, id, (wallPlaced - 1) * 1.5, -100);
        wallPlaced += 1;
      } else {
        // 바닥 요소는 3열 그리드로 간단히 스태거
        const column = placed % 3;
        const row = Math.floor(placed / 3);
        next = moveExpoComponent(next, id, (column - 1) * 1.5, 0.5 + row);
        placed += 1;
      }
    }
  }
  return next;
}
