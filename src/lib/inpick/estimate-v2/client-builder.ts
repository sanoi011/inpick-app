/**
 * 클라이언트 측 SurfacePlan / QuantityBasis 빌더.
 *
 * 용도: sessionStorage의 step1/step2만 가지고도 17공종 견적을 만들기 위한 fallback.
 *       contextId 경로(서버 finalize)가 실패해도 견적 페이지에서 v2 표시 가능.
 */
"use client";

import { buildConstructionEstimate } from "./build-construction-estimate";
import { computeRoomQuantityBasis } from "./quantity-formulas";
import { inferRoomType } from "./surface-plan-builder";
import { extractMaterialHintsFromPrompt } from "@/lib/inpick/estimate-context/prompt-hints";
import type { MaterialHint } from "@/lib/inpick/estimate-context/types";
import type {
  ConstructionEstimate,
  EvidenceSource,
  ProjectMode,
  RoomQuantityBasis,
  SurfacePlan,
  SurfaceType,
  WorkAction,
} from "./types";
import type { SiteConditionAnswers } from "./site-condition-answers";

interface MinimalRoom {
  /** "거실" / "안방" / "주방" 등 한국어 이름 */
  roomName: string;
  /** 면적 m² (없으면 평수 기반 추정) */
  areaM2?: number;
  /** Step2 prompt — material hint 자동 추출용 */
  prompts?: string[];
  widthM?: number;
  depthM?: number;
  kitchenPlan?: {
    tallCabinetEa: number;
    tallCabinetLabels: string[];
  };
  /** 사용자 선택 자재 (있으면 user_selected_material 우선) */
  userSelectedMaterials?: Array<{
    surfaceType: MaterialHint["surfaceType"];
    materialCategory: string;
    materialProductId?: string;
    materialNameKo?: string;
    brand?: string;
    sku?: string;
    spec?: string;
    unitPrice?: number;
    priceSource?: string;
    observationId?: string;
    confidence?: number;
  }>;
}

export interface ClientBuildEstimateInput {
  projectId: string;
  projectMode: ProjectMode;
  rooms: MinimalRoom[];
  siteConditions?: SiteConditionAnswers;
}

/**
 * sessionStorage step1/step2만 가지고 클라이언트에서 17공종 견적 생성.
 * 서버 finalize(인증 필요)가 실패해도 동작.
 */
export function buildConstructionEstimateClientSide(
  input: ClientBuildEstimateInput,
): ConstructionEstimate {
  const surfacePlans: SurfacePlan[] = [];
  const quantityBasisByRoom: Record<string, RoomQuantityBasis> = {};
  const claimed = new Map<string, EvidenceSource>();
  const PRIORITY: Record<EvidenceSource, number> = {
    user_selected_material: 1,
    vision_confirmed_material: 2,
    vision_recommended_material: 3,
    prompt_extracted_material: 4,
    scope_default_material: 5,
    standard_fallback_material: 6,
    floorplan_dimension: 99,
    manual_admin_adjustment: 99,
  };

  for (const room of input.rooms) {
    const roomId = room.roomName;
    const roomType = inferRoomType(room.roomName);
    const areaM2 = room.areaM2 ?? defaultAreaForRoomType(roomType);

    quantityBasisByRoom[roomId] = computeRoomQuantityBasis({
      roomId,
      roomName: room.roomName,
      roomType,
      areaM2,
      widthM: room.widthM,
      depthM: room.depthM,
    });

    const tryClaim = (surfaceType: SurfaceType, src: EvidenceSource): boolean => {
      const k = `${roomId}::${surfaceType}`;
      const prev = claimed.get(k);
      if (!prev || PRIORITY[src] < PRIORITY[prev]) {
        claimed.set(k, src);
        return true;
      }
      return false;
    };

    // 1순위: 사용자 선택 자재
    for (const sel of room.userSelectedMaterials ?? []) {
      const sType = mapSurfaceForClient(sel.surfaceType);
      if (!tryClaim(sType, "user_selected_material")) continue;
      surfacePlans.push({
        id: randomId(),
        projectId: input.projectId,
        projectMode: input.projectMode,
        roomId,
        roomName: room.roomName,
        roomType,
        surfaceType: sType,
        action: "replace",
        materialCategory: sel.materialCategory,
        materialProductId: sel.materialProductId,
        materialNameKo: sel.materialNameKo,
        brand: sel.brand,
        sku: sel.sku,
        spec: sel.spec,
        selectedMaterialUnitPrice: sel.unitPrice,
        selectedMaterialPriceSource:
          sel.priceSource === "contractor_price"
            ? "contractor_price"
            : sel.priceSource === "retail_price" || sel.priceSource === "catalog_price"
              ? "catalog_price"
              : sel.priceSource === "material_price_lookup"
                ? "material_price_lookup"
                : undefined,
        source: "user_selected_material",
        confidence: sel.confidence ?? 1.0,
        evidenceRefs: sel.observationId
          ? [{ type: "vision_observation", id: sel.observationId }]
          : [],
        assumptions: ["사용자가 직접 선택한 자재입니다."],
        warnings: [],
      });
    }

    // 2순위: prompt에서 추출한 material hints
    const hintsByKey = new Map<string, MaterialHint>();
    for (const prompt of room.prompts ?? []) {
      const hints = extractMaterialHintsFromPrompt({
        prompt,
        projectMode: input.projectMode,
        targetName: room.roomName,
      });
      for (const h of hints) {
        const k = `${h.surfaceType}::${h.materialCategory}`;
        const prev = hintsByKey.get(k);
        if (!prev || h.confidence > prev.confidence) hintsByKey.set(k, h);
      }
    }
    for (const h of Array.from(hintsByKey.values())) {
      const sType = mapSurfaceForClient(h.surfaceType);
      if (!tryClaim(sType, "prompt_extracted_material")) continue;
      surfacePlans.push({
        id: randomId(),
        projectId: input.projectId,
        projectMode: input.projectMode,
        roomId,
        roomName: room.roomName,
        roomType,
        surfaceType: sType,
        action: "replace",
        materialCategory: h.materialCategory,
        materialNameKo: h.materialNameKo,
        source: "prompt_extracted_material",
        confidence: h.confidence,
        evidenceRefs: [],
        assumptions: h.assumptions ?? [],
        warnings: [],
      });
    }

    // 3순위: 방 타입별 표준 자재 (안 잡힌 surface 채움)
    for (const dp of defaultSurfacePlans(input.projectId, input.projectMode, roomId, room.roomName, roomType)) {
      if (!tryClaim(dp.surfaceType, "standard_fallback_material")) continue;
      surfacePlans.push(dp);
    }
  }

  return buildConstructionEstimate({
    projectId: input.projectId,
    projectMode: input.projectMode,
    surfacePlans,
    quantityBasisByRoom,
    kitchenPlanOverrides: Object.fromEntries(
      input.rooms
        .filter((room) => room.kitchenPlan)
        .map((room) => [room.roomName, room.kitchenPlan!]),
    ),
    siteConditions: input.siteConditions,
  });
}

function mapSurfaceForClient(s: MaterialHint["surfaceType"]): SurfaceType {
  switch (s) {
    case "floor":
    case "wall":
    case "ceiling":
    case "door":
    case "window":
    case "lighting":
    case "signage":
    case "facade":
    case "partition":
      return s;
    case "counter":
      return "counter";
    case "built_in_furniture":
      return "cabinet";
    default:
      return "wall";
  }
}

function defaultSurfacePlans(
  projectId: string,
  projectMode: ProjectMode,
  roomId: string,
  roomName: string,
  roomType: ReturnType<typeof inferRoomType>,
): SurfacePlan[] {
  const base = (sType: SurfaceType, category: string, name: string, action: WorkAction = "replace"): SurfacePlan => ({
    id: randomId(),
    projectId,
    projectMode,
    roomId,
    roomName,
    roomType,
    surfaceType: sType,
    action,
    materialCategory: category,
    materialNameKo: name,
    source: "standard_fallback_material",
    confidence: 0.4,
    evidenceRefs: [],
    assumptions: ["표준 자재 fallback (사용자/Vision 자재 미선택)"],
    warnings: [],
  });

  if (roomType === "bathroom") {
    return [
      base("floor", "porcelain_tile", "포세린 타일", "demolish_and_new"),
      base("wall", "wall_tile", "벽 타일", "demolish_and_new"),
      base("fixture", "bathroom_full", "욕실 도기·수전"),
    ];
  }
  if (roomType === "kitchen") {
    return [
      base("floor", "engineered_floor", "강마루"),
      base("wall", "silk_wallpaper", "실크 벽지"),
      base("ceiling", "wallpaper", "도배"),
      base("sink", "kitchen_standard", "싱크대"),
    ];
  }
  return [
    base("floor", "engineered_floor", "강마루"),
    base("wall", "silk_wallpaper", "실크 벽지"),
    base("ceiling", "wallpaper", "도배"),
  ];
}

function defaultAreaForRoomType(rt: ReturnType<typeof inferRoomType>): number {
  const m: Record<ReturnType<typeof inferRoomType>, number> = {
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
  return m[rt];
}

function randomId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2, 12);
}
