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
    case "fixture":
      return "fixture";
    case "sink":
      return "sink";
    case "signage":
      return "signage";
    case "facade":
      return "facade";
    case "partition":
      return "partition";
    default:
      // 분석 결과가 부위를 특정하지 못한 경우 설비로 오인하지 않는다.
      // Step2의 실별 제품 선택은 workflow-evidence 경계에서 명시적인 부위로 보정된다.
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
    materialProductId?: string;
    materialNameKo?: string;
    brand?: string;
    sku?: string;
    spec?: string;
    unitPrice?: number;
    priceSource?: string;
    observationId?: string;
    confidence?: number;
    assemblyId?: string;
    partCode?: string;
  }>;
  /** 추가 vision evidence (analyze 결과) — 이미 design_outputs.material_hints에 병합돼 있을 수 있음 */
  materialEvidence?: unknown[];
  /** Step1에서 가져온 방 면적 (없으면 design_output target_id 기반 추정) */
  roomAreasByName?: Record<string, number>;
  /** P14-1: 도면 치수 (mm) — Step1 normalizedFloorplan.rooms 기반 */
  floorplanDimsByName?: Record<string, { widthMm?: number; depthMm?: number }>;
  /** photo_only Step1에서 요청한 실. 이미지 저장/분석 실패와 무관하게 실별 fallback을 만든다. */
  requestedRooms?: Array<{ roomId: string; roomName: string }>;
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
    const key = `${edit.roomId}::${surfaceType}${
      edit.partCode ? `::${edit.partCode}` : ""
    }`;
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
      materialProductId: edit.materialProductId,
      materialNameKo: edit.materialNameKo,
      brand: edit.brand,
      sku: edit.sku,
      spec: edit.spec,
      selectedMaterialUnitPrice: edit.unitPrice,
      selectedMaterialPriceSource: normalizeMaterialPriceSource(edit.priceSource),
      source: "user_selected_material",
      confidence: edit.confidence ?? 1.0,
      evidenceRefs: [
        { type: "material_edit", id: edit.id },
        ...(edit.observationId
          ? [{ type: "vision_observation" as const, id: edit.observationId }]
          : []),
      ],
      assumptions: ["사용자가 직접 선택한 자재입니다."],
      warnings: [],
    });
  }

  // 2~3순위: finalize에서 제품/결정까지 수화한 vision evidence.
  // 과거 design_output에 분석 hint가 기록되지 않은 프로젝트도 observation으로 복구한다.
  for (const rawEvidence of input.materialEvidence ?? []) {
    if (!rawEvidence || typeof rawEvidence !== "object") continue;
    const evidence = rawEvidence as Record<string, unknown>;
    const materialProductId = asOptionalString(evidence.materialProductId);
    const roomId = asOptionalString(evidence.roomId);
    const roomName = asOptionalString(evidence.roomName);
    const rawSurface = asOptionalString(evidence.surfaceType);
    const matchStatus = asOptionalString(evidence.matchStatus);
    if (!materialProductId || !roomId || !roomName || !rawSurface) continue;
    if (matchStatus !== "confirmed" && matchStatus !== "recommended") continue;
    const surfaceType = surfaceFromHint(mapEvidenceSurfaceToHint(rawSurface));
    const source: EvidenceSource =
      matchStatus === "confirmed"
        ? "vision_confirmed_material"
        : "vision_recommended_material";
    const key = `${roomId}::${surfaceType}`;
    if (!tryClaim(key, source)) continue;
    const observationId = asOptionalString(evidence.observationId);
    plans.push({
      id: randomId(),
      projectId: input.projectId,
      projectMode: input.projectMode,
      roomId,
      roomName,
      roomType: inferRoomType(roomName),
      surfaceType,
      action: "replace",
      materialCategory:
        asOptionalString(evidence.materialCategory) || rawSurface,
      materialProductId,
      materialNameKo: asOptionalString(evidence.materialNameKo),
      brand: asOptionalString(evidence.brand),
      sku: asOptionalString(evidence.sku),
      spec: asOptionalString(evidence.spec),
      selectedMaterialUnitPrice: asOptionalPositiveNumber(evidence.unitPrice),
      selectedMaterialPriceSource: normalizeMaterialPriceSource(
        asOptionalString(evidence.priceSource),
      ),
      source,
      confidence: asConfidence(evidence.confidence),
      evidenceRefs: observationId
        ? [{ type: "vision_observation", id: observationId }]
        : [],
      assumptions: [
        matchStatus === "confirmed"
          ? "이미지 분석 결과에서 확정된 실제 제품입니다."
          : "이미지 분석 제품 후보 중 최상위 추천입니다.",
      ],
      warnings:
        matchStatus === "recommended"
          ? ["추천 자재는 사용자 또는 사업자 확인 전까지 확정 제품이 아닙니다."]
          : [],
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
        const source =
          hint.source === "vision_analysis" && hint.matchStatus === "confirmed"
            ? "vision_confirmed_material"
            : evidenceSourceFromHint(hint.source);
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
          materialProductId: hint.materialProductId,
          materialNameKo: hint.materialNameKo,
          brand: hint.brand,
          sku: hint.sku,
          spec: hint.spec,
          selectedMaterialUnitPrice: hint.unitPrice,
          selectedMaterialPriceSource: normalizeMaterialPriceSource(hint.priceSource),
          source,
          confidence: hint.confidence,
          evidenceRefs: [
            { type: "design_output", id: output.id },
            ...(hint.observationId
              ? [{ type: "vision_observation" as const, id: hint.observationId }]
              : []),
          ],
          assumptions: hint.assumptions ?? [],
          warnings: [],
        });
      }
    }
  }

  // 5순위: 각 방의 기본 표준 자재 (design_output에서 안 잡힌 surface 채움)
  const rooms = collectRoomsFromOutputs(input.designOutputs, input.requestedRooms);
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
      if (
        Array.from(claimed.keys()).some(
          (claimedKey) =>
            claimedKey === key || claimedKey.startsWith(`${key}::`),
        )
      ) {
        continue;
      }
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
  // P14-1: 도면 치수 lookup (room name 기반)
  const floorplanDimsByName = input.floorplanDimsByName || {};
  for (const [roomId, roomName] of Array.from(rooms.entries())) {
    const roomType = inferRoomType(roomName);
    const areaM2 =
      input.roomAreasByName?.[roomName] ??
      input.roomAreasByName?.[roomId] ??
      defaultAreaForRoomType(roomType);
    const dims = floorplanDimsByName[roomName] || floorplanDimsByName[roomId];
    const basisInput: ComputeRoomQuantityBasisInput = {
      roomId,
      roomName,
      roomType,
      areaM2,
      widthM: dims?.widthMm ? dims.widthMm / 1000 : undefined,
      depthM: dims?.depthMm ? dims.depthMm / 1000 : undefined,
      basisSource: dims ? "floorplan_asset" : undefined,
    };
    quantityBasisByRoom[roomId] = computeRoomQuantityBasis(basisInput);
  }

  return { surfacePlans: plans, quantityBasisByRoom };
}

function mapEvidenceSurfaceToHint(surfaceType: string): MaterialHint["surfaceType"] {
  if (["floor", "wall", "ceiling", "door", "window", "lighting"].includes(surfaceType)) {
    return surfaceType as MaterialHint["surfaceType"];
  }
  if (surfaceType === "cabinet") return "built_in_furniture";
  if (surfaceType === "countertop") return "counter";
  if (surfaceType === "tile") return "wall";
  return "unknown";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asOptionalPositiveNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function asConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.5;
}

function normalizeMaterialPriceSource(
  source: string | undefined,
): SurfacePlan["selectedMaterialPriceSource"] {
  switch (source) {
    case "contractor_price":
      return "contractor_price";
    case "retail_price":
    case "catalog_price":
      return "catalog_price";
    case "material_price_lookup":
      return "material_price_lookup";
    case "manual_override":
      return "manual_override";
    default:
      return undefined;
  }
}

function collectRoomsFromOutputs(
  outputs: DesignOutput[],
  requestedRooms: Array<{ roomId: string; roomName: string }> = [],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of outputs ?? []) {
    if (o.targetType === "surface") continue;
    const roomId = o.targetId || o.id;
    if (!m.has(roomId)) m.set(roomId, o.targetName);
  }
  for (const room of requestedRooms) {
    if (room.roomId && room.roomName) {
      // Step1의 현재 실 선택은 오래된 design_output의 "전체" 같은
      // 잘못된 targetName보다 우선한다. 이미지 분석 힌트는 roomId로 유지된다.
      m.set(room.roomId, room.roomName);
    }
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
