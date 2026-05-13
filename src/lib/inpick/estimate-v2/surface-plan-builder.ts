/**
 * SurfacePlan builder — EstimateContext (design_outputs + materialEvidence + userMaterialEdits)에서
 * SurfacePlan[] 합성.
 *
 * 가이드: inpick-construction-trade-estimate-engine-dev-plan-20260512.md §8
 *
 * 우선순위:
 *   1. user_selected_material   (사용자가 이미지 위에서 확정한 자재)
 *   2. vision_confirmed_material (vision 분석 confirmed)
 *   3. vision_recommended_material (vision 분석 recommended)
 *   4. prompt_extracted_material (prompt에서 추출)
 *   5. scope_default_material   (scope 기본값)
 *   6. standard_fallback_material (표준자재)
 */
import type {
  DesignOutput,
  MaterialHint,
} from "@/lib/inpick/estimate-context/types";
import {
  computeRoomQuantityBasis,
  type ComputeRoomQuantityBasisInput,
} from "./quantity-formulas";
import type {
  EvidenceSource,
  ProjectMode,
  RoomQuantityBasis,
  RoomType,
  SurfacePlan,
  SurfaceType,
  WorkAction,
} from "./types";

/** 한국어 방 이름 → RoomType */
export function inferRoomType(name: string): RoomType {
  const n = (name ?? "").toLowerCase();
  if (n.includes("거실") || n.includes("living")) return "living_room";
  if (n.includes("안방") || n.includes("master")) return "master_bedroom";
  if (n.includes("침실") || n.includes("bedroom")) return "bedroom";
  if (n.includes("주방") || n.includes("부엌") || n.includes("kitchen")) return "kitchen";
  if (n.includes("욕실") || n.includes("화장실") || n.includes("bath")) return "bathroom";
  if (n.includes("현관") || n.includes("entry") || n.includes("entrance")) return "entry";
  if (n.includes("발코니") || n.includes("베란다") || n.includes("balcony")) return "balcony";
  if (n.includes("드레스") || n.includes("dress")) return "dress_room";
  if (n.includes("복도") || n.includes("corridor")) return "corridor";
  if (n.includes("다용도") || n.includes("팬트리") || n.includes("utility")) return "utility";
  if (n.includes("zone") || n.includes("commercial")) return "commercial_zone";
  return "unknown";
}

function surfaceFromHint(s: MaterialHint["surfaceType"]): SurfaceType {
  switch (s) {
    case "floor":
      return "floor";
    case "wall":
      return "wall";
    case "ceiling":
      return "ceiling";
    case "door":
      return "door";
    case "window":
      return "window";
    case "counter":
      return "counter";
    case "lighting":
      return "lighting";
    case "built_in_furniture":
      return "cabinet";
    case "signage":
      return "signage";
    case "facade":
      return "facade";
    case "partition":
      return "partition";
    default:
      return "wall";
  }
}

function evidenceSourceFromHint(s: MaterialHint["source"]): EvidenceSource {
  switch (s) {
    case "user_selected":
      return "user_selected_material";
    case "vision_analysis":
      return "vision_recommended_material";
    case "prompt_extract":
      return "prompt_extracted_material";
    case "scope_default":
      return "scope_default_material";
    default:
      return "standard_fallback_material";
  }
}

export interface BuildSurfacePlansInput {
  projectId: string;
  projectMode: ProjectMode;
  designOutputs: DesignOutput[];
  /** 사용자가 부위별로 확정한 자재 — 최우선 */
  userMaterialEdits?: Array<{
    id: string;
    roomId: string;
    roomName: string;
    surfaceType: MaterialHint["surfaceType"];
    materialCategory: string;
    materialNameKo?: string;
    brand?: string;
    sku?: string;
    unitPrice?: number;
  }>;
  /** 추가 vision evidence (analyze 결과) — 이미 design_outputs.material_hints에 병합돼 있을 수 있음 */
  materialEvidence?: unknown[];
  /** Step1에서 가져온 방 면적 (없으면 design_output target_id 기반 추정) */
  roomAreasByName?: Record<string, number>;
}

export interface BuildSurfacePlansResult {
  surfacePlans: SurfacePlan[];
  quantityBasisByRoom: Record<string, RoomQuantityBasis>;
}

/** 방별 SurfacePlan과 QuantityBasis를 한 번에 빌드 */
export function buildSurfacePlansFromContext(
  input: BuildSurfacePlansInput,
): BuildSurfacePlansResult {
  const plans: SurfacePlan[] = [];
  // 우선순위 처리용 키: roomId + surfaceType
  const claimed = new Map<string, EvidenceSource>();
  const SOURCE_PRIORITY: Record<EvidenceSource, number> = {
    user_selected_material: 1,
    vision_confirmed_material: 2,
    vision_recommended_material: 3,
    prompt_extracted_material: 4,
    scope_default_material: 5,
    standard_fallback_material: 6,
    floorplan_dimension: 99,
    manual_admin_adjustment: 99,
  };

  function tryClaim(key: string, source: EvidenceSource): boolean {
    const existing = claimed.get(key);
    if (!existing) {
      claimed.set(key, source);
      return true;
    }
    if (SOURCE_PRIORITY[source] < SOURCE_PRIORITY[existing]) {
      claimed.set(key, source);
      return true;
    }
    return false;
  }

  // 1순위: userMaterialEdits
  for (const edit of input.userMaterialEdits ?? []) {
    const surfaceType = surfaceFromHint(edit.surfaceType);
    const key = `${edit.roomId}::${surfaceType}`;
    if (!tryClaim(key, "user_selected_material")) continue;
    const roomType = inferRoomType(edit.roomName);
    plans.push({
      id: randomId(),
      projectId: input.projectId,
      projectMode: input.projectMode,
      roomId: edit.roomId,
      roomName: edit.roomName,
      roomType,
      surfaceType,
      action: "replace",
      materialCategory: edit.materialCategory,
      materialNameKo: edit.materialNameKo,
      brand: edit.brand,
      sku: edit.sku,
      selectedMaterialUnitPrice: edit.unitPrice,
      source: "user_selected_material",
      confidence: 1.0,
      evidenceRefs: [{ type: "material_edit", id: edit.id }],
      assumptions: ["사용자가 직접 선택한 자재입니다."],
      warnings: [],
    });
  }

  // 2~4순위: design_outputs.materialHints (vision_analysis / prompt_extract)
  for (const output of input.designOutputs ?? []) {
    if (output.targetType === "whole" || output.targetType === "zone" || output.targetType === "room") {
      const roomId = output.targetId || output.id;
      const roomName = output.targetName;
      const roomType = inferRoomType(roomName);
      for (const hint of output.materialHints ?? []) {
        const surfaceType = surfaceFromHint(hint.surfaceType);
        const key = `${roomId}::${surfaceType}`;
        const source = evidenceSourceFromHint(hint.source);
        if (!tryClaim(key, source)) continue;
        plans.push({
          id: randomId(),
          projectId: input.projectId,
          projectMode: input.projectMode,
          roomId,
          roomName,
          roomType,
          surfaceType,
          action: "replace",
          materialCategory: hint.materialCategory,
          materialNameKo: hint.materialNameKo,
          brand: hint.brand,
          sku: hint.sku,
          source,
          confidence: hint.confidence,
          evidenceRefs: [{ type: "design_output", id: output.id }],
          assumptions: hint.assumptions ?? [],
          warnings: [],
        });
      }
    }
  }

  // 5순위: 각 방의 기본 표준 자재 (design_output에서 안 잡힌 surface 채움)
  const rooms = collectRoomsFromOutputs(input.designOutputs);
  for (const [roomId, roomName] of Array.from(rooms.entries())) {
    const roomType = inferRoomType(roomName);
    const defaultPlans = defaultSurfacePlansForRoom({
      projectId: input.projectId,
      projectMode: input.projectMode,
      roomId,
      roomName,
      roomType,
    });
    for (const dp of defaultPlans) {
      const key = `${dp.roomId}::${dp.surfaceType}`;
      if (!tryClaim(key, dp.source)) continue;
      plans.push(dp);
    }
  }

  // 6순위: design_outputs가 0개인 경우 — 평수 기반 표준 방 셋
  if (rooms.size === 0 && input.roomAreasByName && Object.keys(input.roomAreasByName).length > 0) {
    for (const [name, areaM2] of Object.entries(input.roomAreasByName)) {
      const roomId = `fallback-${name}`;
      const roomType = inferRoomType(name);
      const defaultPlans = defaultSurfacePlansForRoom({
        projectId: input.projectId,
        projectMode: input.projectMode,
        roomId,
        roomName: name,
        roomType,
      });
      for (const dp of defaultPlans) {
        const key = `${dp.roomId}::${dp.surfaceType}`;
        if (!tryClaim(key, dp.source)) continue;
        plans.push(dp);
      }
      rooms.set(roomId, name);
      if (!input.roomAreasByName![roomId]) input.roomAreasByName![roomId] = areaM2;
    }
  }

  // QuantityBasis — 방별로 계산
  const quantityBasisByRoom: Record<string, RoomQuantityBasis> = {};
  for (const [roomId, roomName] of Array.from(rooms.entries())) {
    const roomType = inferRoomType(roomName);
    const areaM2 =
      input.roomAreasByName?.[roomName] ??
      input.roomAreasByName?.[roomId] ??
      defaultAreaForRoomType(roomType);
    const basisInput: ComputeRoomQuantityBasisInput = {
      roomId,
      roomName,
      roomType,
      areaM2,
    };
    quantityBasisByRoom[roomId] = computeRoomQuantityBasis(basisInput);
  }

  return { surfacePlans: plans, quantityBasisByRoom };
}

function collectRoomsFromOutputs(outputs: DesignOutput[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of outputs ?? []) {
    if (o.targetType === "surface") continue;
    const roomId = o.targetId || o.id;
    if (!m.has(roomId)) m.set(roomId, o.targetName);
  }
  return m;
}

/** 방 종류별 기본 SurfacePlan 셋 (floor/wall/ceiling) */
function defaultSurfacePlansForRoom(input: {
  projectId: string;
  projectMode: ProjectMode;
  roomId: string;
  roomName: string;
  roomType: RoomType;
}): SurfacePlan[] {
  const { projectId, projectMode, roomId, roomName, roomType } = input;
  const baseRef = (planId: string) => ({
    id: planId,
    projectId,
    projectMode,
    roomId,
    roomName,
    roomType,
    action: "replace" as WorkAction,
    source: "standard_fallback_material" as EvidenceSource,
    confidence: 0.4,
    evidenceRefs: [],
    assumptions: ["표준 자재 fallback (사용자/Vision 자재 미선택)"],
    warnings: [],
  });

  if (roomType === "bathroom") {
    return [
      {
        ...baseRef(randomId()),
        surfaceType: "floor",
        materialCategory: "porcelain_tile",
        materialNameKo: "포세린 타일",
        action: "demolish_and_new",
      },
      {
        ...baseRef(randomId()),
        surfaceType: "wall",
        materialCategory: "wall_tile",
        materialNameKo: "벽 타일",
        action: "demolish_and_new",
      },
      {
        ...baseRef(randomId()),
        surfaceType: "fixture",
        materialCategory: "bathroom_full",
        materialNameKo: "욕실 도기·수전",
        action: "replace",
      },
    ];
  }
  if (roomType === "kitchen") {
    return [
      {
        ...baseRef(randomId()),
        surfaceType: "floor",
        materialCategory: "engineered_floor",
        materialNameKo: "강마루",
      },
      {
        ...baseRef(randomId()),
        surfaceType: "wall",
        materialCategory: "silk_wallpaper",
        materialNameKo: "실크 벽지",
      },
      {
        ...baseRef(randomId()),
        surfaceType: "ceiling",
        materialCategory: "wallpaper",
        materialNameKo: "도배",
      },
      {
        ...baseRef(randomId()),
        surfaceType: "sink",
        materialCategory: "kitchen_standard",
        materialNameKo: "싱크대",
      },
    ];
  }
  // 거주공간 일반
  return [
    {
      ...baseRef(randomId()),
      surfaceType: "floor",
      materialCategory: "engineered_floor",
      materialNameKo: "강마루",
    },
    {
      ...baseRef(randomId()),
      surfaceType: "wall",
      materialCategory: "silk_wallpaper",
      materialNameKo: "실크 벽지",
    },
    {
      ...baseRef(randomId()),
      surfaceType: "ceiling",
      materialCategory: "wallpaper",
      materialNameKo: "도배",
    },
  ];
}

function defaultAreaForRoomType(roomType: RoomType): number {
  const m: Record<RoomType, number> = {
    living_room: 22,
    master_bedroom: 12,
    bedroom: 9,
    kitchen: 8,
    bathroom: 4,
    entry: 3,
    balcony: 6,
    dress_room: 5,
    corridor: 4,
    utility: 4,
    commercial_zone: 15,
    unknown: 10,
  };
  return m[roomType];
}

function randomId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2, 12);
}
