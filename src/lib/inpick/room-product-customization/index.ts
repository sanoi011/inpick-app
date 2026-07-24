import type { SurfaceType } from "../editable-render/types";
import { materialProductCategoryCodes } from "../material-product-category-codes";
import type { SamSurfaceTarget } from "../sam-surface-prompts";

export type RoomProductKind =
  | "living"
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "entry"
  | "other";

export type RoomProductPartCode =
  | "floor_finish"
  | "wall_finish"
  | "art_wall"
  | "main_lighting"
  | "window_covering"
  | "room_door"
  | "built_in_wardrobe"
  | "floor_tile"
  | "wall_tile"
  | "toilet"
  | "basin"
  | "basin_faucet"
  | "shower_fixture"
  | "entry_door"
  | "middle_door"
  | "shoe_cabinet"
  | "upper_cabinet"
  | "lower_cabinet"
  | "countertop"
  | "backsplash"
  | "sink_bowl"
  | "faucet"
  | "fridge_cabinet"
  | "kimchi_fridge_cabinet"
  | "hood"
  | "cooktop";

export type RoomProductProvenanceSource =
  | "catalog"
  | "manufacturer"
  | "supplier"
  | "user_verified";

export interface RoomProductProvenance {
  source: RoomProductProvenanceSource;
  reference: string;
  verifiedAt: string;
}

export interface RoomCatalogProduct {
  materialProductId: string;
  displayName: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unitPrice?: number;
  thumbnailUrl?: string;
  provenance: Partial<RoomProductProvenance> & Pick<RoomProductProvenance, "source">;
}

export interface RoomProductSelection {
  partCode: RoomProductPartCode;
  product: RoomCatalogProduct;
  quantity?: number;
}

export interface RoomProductRegionSelection {
  /** 경계가 추출된 생성 이미지. 다른 시안의 마스크가 섞이지 않게 하는 식별자 */
  sourceRenderKey: string;
  /** SAM native pixel polygon */
  polygon: number[][];
  imageSize: [number, number];
  maskUrl?: string;
  confidence: number;
  areaPixels: number;
  targetSurface: SamSurfaceTarget;
}

export interface RoomProductCustomization {
  roomId: string;
  roomName: string;
  roomKind: RoomProductKind;
  assemblyId: string;
  /** 선택과 경계 마스크가 어느 생성 이미지 시안에 결합됐는지 식별한다. */
  sourceRenderKey?: string;
  regions?: Partial<Record<RoomProductPartCode, RoomProductRegionSelection>>;
  selections: Partial<Record<RoomProductPartCode, RoomProductSelection>>;
}

const renderKeySuffix = (sourceRenderKey: string): string =>
  sourceRenderKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(-48) || "render";

export function isRoomProductCustomizationBoundToSource(
  customization: RoomProductCustomization,
  sourceRenderKey: string,
): boolean {
  return Boolean(sourceRenderKey) && customization.sourceRenderKey === sourceRenderKey;
}

/**
 * 사용자가 다른 시안을 직접 선택한 경우 호출한다.
 * legacy 상태는 한 번의 사용자 확인으로 현재 시안에 결합하되 기존 선택을 보존하고,
 * 이미 다른 source에 결합된 상태는 잘못된 자동 승계를 막기 위해 선택을 비운다.
 */
export function bindRoomProductCustomizationToSource(
  customization: RoomProductCustomization,
  sourceRenderKey: string,
): RoomProductCustomization {
  if (!sourceRenderKey || customization.sourceRenderKey === sourceRenderKey) return customization;
  if (!customization.sourceRenderKey) {
    return { ...customization, sourceRenderKey };
  }
  return {
    ...customization,
    sourceRenderKey,
    assemblyId: `room-products-${customization.roomId}-${renderKeySuffix(sourceRenderKey)}`,
    regions: {},
    selections: {},
  };
}

/** 선택 SKU로 현재 이미지를 편집해 만든 파생 시안에만 기존 선택을 명시적으로 승계한다. */
export function carryRoomProductCustomizationToSource(
  customization: RoomProductCustomization,
  sourceRenderKey: string,
): RoomProductCustomization {
  if (!sourceRenderKey || customization.sourceRenderKey === sourceRenderKey) return customization;
  return {
    ...customization,
    sourceRenderKey,
    regions: Object.fromEntries(
      Object.entries(customization.regions || {}).map(([partCode, region]) => [
        partCode,
        region ? { ...region, sourceRenderKey } : region,
      ]),
    ),
  };
}

export interface RoomProductPartDefinition {
  partCode: RoomProductPartCode;
  labelKo: string;
  helpKo: string;
  targetSurface: SurfaceType;
  categoryCodes: readonly string[];
  estimateUnit: "m" | "m²" | "ea" | "set";
  defaultQuantity: number;
  /** legacy 좌표. UI는 고정 화살표 대신 사용자가 확정한 SAM 경계를 사용한다. */
  target: { x: number; y: number };
  label: { x: number; y: number };
}

const p = (
  partCode: RoomProductPartCode,
  labelKo: string,
  helpKo: string,
  targetSurface: SurfaceType,
  categoryCodes: readonly string[],
  estimateUnit: RoomProductPartDefinition["estimateUnit"],
  defaultQuantity: number,
  target: [number, number],
  label: [number, number],
): RoomProductPartDefinition => ({
  partCode,
  labelKo,
  helpKo,
  targetSurface,
  categoryCodes,
  estimateUnit,
  defaultQuantity,
  target: { x: target[0], y: target[1] },
  label: { x: label[0], y: label[1] },
});

const floorCodes = materialProductCategoryCodes("floor");
const wallCodes = materialProductCategoryCodes("wall");
const lightCodes = materialProductCategoryCodes("lighting");
const doorCodes = materialProductCategoryCodes("door");
const curtainCodes = materialProductCategoryCodes("curtain");
const tileCodes = materialProductCategoryCodes("tile");

const PARTS: Record<RoomProductKind, readonly RoomProductPartDefinition[]> = {
  living: [
    p("floor_finish", "바닥", "강마루·타일·LVT", "floor", floorCodes, "m²", 1, [50, 78], [11, 89]),
    p("art_wall", "아트월", "거실 포인트 벽 마감", "wall", wallCodes, "m²", 1, [51, 40], [10, 28]),
    p("wall_finish", "벽 마감", "벽지·도장·패널", "wall", wallCodes, "m²", 1, [75, 45], [88, 29]),
    p("main_lighting", "조명", "메인등·다운라이트", "fixture", lightCodes, "ea", 1, [52, 16], [86, 8]),
    p("window_covering", "커튼·블라인드", "창호 가림 제품", "window", curtainCodes, "set", 1, [24, 38], [9, 12]),
  ],
  bedroom: [
    p("floor_finish", "바닥", "강마루·LVT·카펫", "floor", floorCodes, "m²", 1, [50, 80], [10, 89]),
    p("wall_finish", "벽 마감", "벽지·도장", "wall", wallCodes, "m²", 1, [64, 42], [87, 29]),
    p("art_wall", "침대 헤드월", "헤드보드 배경 벽", "wall", wallCodes, "m²", 1, [45, 43], [9, 28]),
    p("main_lighting", "조명", "메인등·다운라이트", "fixture", lightCodes, "ea", 1, [52, 15], [87, 8]),
    p("built_in_wardrobe", "붙박이장", "도어·내부 모듈", "cabinet", ["FUR-STO-WARDROBE"], "m", 1, [78, 48], [89, 65]),
    p("window_covering", "커튼·블라인드", "창호 가림 제품", "window", curtainCodes, "set", 1, [22, 37], [8, 11]),
  ],
  bathroom: [
    p("floor_tile", "바닥 타일", "욕실용 미끄럼 저항 타일", "floor", tileCodes, "m²", 1, [49, 82], [9, 90]),
    p("wall_tile", "벽 타일", "욕실 벽 타일", "tile_wall", tileCodes, "m²", 1, [61, 42], [87, 29]),
    p("toilet", "양변기", "모델번호가 확인된 양변기", "fixture", ["MEC-SAN-TOILET", "MECH_SANITARY_WC", "TOILET"], "ea", 1, [72, 72], [89, 84]),
    p("basin", "세면대", "세면대·하부장", "fixture", ["MEC-SAN-BASIN", "MECH_SANITARY_BASIN", "VANITY"], "ea", 1, [26, 61], [8, 73]),
    p("basin_faucet", "세면 수전", "세면대 수전", "fixture", ["MEC-FAU-BASIN", "MECH_FAUCET"], "ea", 1, [31, 49], [8, 39]),
    p("shower_fixture", "샤워 수전", "샤워기·샤워수전", "fixture", ["MEC-FAU-SHOWER", "MECH_FAUCET_SHOWER", "SHOWER_BATH"], "set", 1, [77, 42], [89, 16]),
    p("main_lighting", "욕실 조명", "방습등·다운라이트", "fixture", lightCodes, "ea", 1, [50, 14], [10, 7]),
  ],
  entry: [
    p("floor_tile", "현관 바닥", "현관용 타일", "floor", tileCodes, "m²", 1, [50, 82], [9, 90]),
    p("wall_finish", "벽 마감", "벽지·도장·패널", "wall", wallCodes, "m²", 1, [66, 42], [88, 28]),
    p("entry_door", "현관문", "현관문·도어락", "door", ["ARCH_DOOR_ENTRY", "ENTRY_DOOR", "DOOR_ENTRANCE", "ELE-SEC-DOORLOCK"], "ea", 1, [25, 43], [8, 26]),
    p("middle_door", "중문", "슬라이딩·여닫이 중문", "door", ["ARCH_DOOR_SLIDE", "ARCH_DOOR_FOLD", "DOOR_ROOM"], "set", 1, [53, 45], [10, 62]),
    p("shoe_cabinet", "신발장", "현관 신발 수납장", "cabinet", ["FUR-STO-SHOERACK", "STORAGE"], "ea", 1, [77, 52], [89, 68]),
    p("main_lighting", "현관 조명", "센서등·다운라이트", "fixture", lightCodes, "ea", 1, [52, 14], [87, 7]),
  ],
  kitchen: [
    p("upper_cabinet", "상부장", "주방 상부장", "cabinet", ["FUR-KIT-UPPER-CAB"], "m", 1, [47, 30], [9, 14]),
    p("lower_cabinet", "하부장", "주방 하부장", "cabinet", ["FUR-KIT-LOWER-CAB"], "m", 1, [45, 70], [9, 84]),
    p("countertop", "상판", "주방 상판", "counter", ["FUR-KIT-COUNTERTOP", ...materialProductCategoryCodes("countertop")], "m", 1, [48, 59], [88, 70]),
    p("backsplash", "백스플래시", "상판 위 벽 마감", "tile_wall", ["FUR-KIT-BACKSPLASH", "KITCHEN_TILE"], "m²", 1, [49, 48], [88, 37]),
    p("sink_bowl", "싱크볼", "싱크볼", "fixture", ["FUR-KIT-SINKBOWL", "ARCH_KITCHEN_SINK", "KITCHEN_SINK"], "ea", 1, [37, 58], [9, 53]),
    p("faucet", "수전", "주방 수전", "fixture", ["MEC-FAU-KITCHEN", "MECH_FAUCET"], "ea", 1, [38, 47], [9, 34]),
    p("fridge_cabinet", "냉장고장", "일반 냉장고장", "cabinet", ["FUR-KIT-TALL-CAB"], "ea", 1, [78, 42], [88, 19]),
    p("kimchi_fridge_cabinet", "김치냉장고장", "김치냉장고장", "cabinet", ["FUR-KIT-TALL-CAB"], "ea", 1, [79, 62], [89, 84]),
    p("hood", "후드", "주방 후드", "fixture", ["FUR-KIT-HOOD", "ARCH_KITCHEN_HOOD"], "ea", 1, [54, 30], [68, 9]),
    p("cooktop", "쿡탑", "인덕션·가스 쿡탑", "fixture", ["FUR-KIT-COOKTOP"], "ea", 1, [54, 57], [71, 83]),
  ],
  other: [
    p("floor_finish", "바닥", "바닥 마감", "floor", floorCodes, "m²", 1, [50, 80], [10, 89]),
    p("wall_finish", "벽 마감", "벽지·도장·패널", "wall", wallCodes, "m²", 1, [65, 42], [88, 28]),
    p("main_lighting", "조명", "메인등·다운라이트", "fixture", lightCodes, "ea", 1, [52, 15], [87, 8]),
    p("room_door", "문", "실내 방문", "door", doorCodes, "ea", 1, [20, 48], [8, 31]),
  ],
};

export function inferRoomProductKind(roomName: string): RoomProductKind {
  const name = roomName.toLocaleLowerCase("ko");
  if (/주방|부엌|kitchen/.test(name)) return "kitchen";
  if (/욕실|화장실|bath|restroom/.test(name)) return "bathroom";
  if (/현관|입구|entry|entrance|foyer/.test(name)) return "entry";
  if (/안방|침실|bedroom|master|드레스/.test(name)) return "bedroom";
  if (/거실|다이닝|living|main_hall|홀/.test(name)) return "living";
  return "other";
}

export function getRoomProductParts(kind: RoomProductKind): readonly RoomProductPartDefinition[] {
  return PARTS[kind];
}

export function findRoomProductPart(
  kind: RoomProductKind,
  partCode: RoomProductPartCode,
): RoomProductPartDefinition | undefined {
  return PARTS[kind].find((part) => part.partCode === partCode);
}

function assertVerifiedSku(product: RoomCatalogProduct): asserts product is RoomCatalogProduct & {
  sku: string;
  provenance: RoomProductProvenance;
} {
  if (!product.sku?.trim() || !product.provenance.reference || !product.provenance.verifiedAt) {
    throw new Error("VERIFIED_SKU_REQUIRED");
  }
}

export function buildRoomProductPromptMarkdown(
  customization: RoomProductCustomization,
  onlyPartCode?: RoomProductPartCode,
): string {
  const selected = getRoomProductParts(customization.roomKind).flatMap((definition) => {
    if (onlyPartCode && definition.partCode !== onlyPartCode) return [];
    const selection = customization.selections[definition.partCode];
    if (!selection) return [];
    if (selection.partCode !== definition.partCode) throw new Error("ROOM_PRODUCT_PART_MISMATCH");
    assertVerifiedSku(selection.product);
    const region = customization.regions?.[definition.partCode];
    if (
      onlyPartCode &&
      (!region ||
        !customization.sourceRenderKey ||
        region.sourceRenderKey !== customization.sourceRenderKey)
    ) {
      throw new Error("ROOM_PRODUCT_REGION_REQUIRED");
    }
    return [{ definition, selection, region }];
  });
  if (selected.length === 0) return "";

  const lines = selected.flatMap(({ definition, selection, region }) => {
    const coverage = region
      ? ((region.areaPixels / Math.max(1, region.imageSize[0] * region.imageSize[1])) * 100).toFixed(2)
      : null;
    return [
      `### ${definition.labelKo} (${definition.partCode})`,
      `- materialProductId: ${selection.product.materialProductId}`,
      `- product: ${selection.product.displayName}`,
      `- brand: ${selection.product.brand || "not provided"}`,
      `- SKU: ${selection.product.sku}`,
      `- specification: ${selection.product.spec || "not provided"}`,
      `- verified source: ${selection.product.provenance.reference}`,
      `- verified at: ${selection.product.provenance.verifiedAt}`,
      ...(onlyPartCode && region
        ? [
            `- edit boundary: attached SAM mask for ${region.targetSurface}`,
            `- boundary confidence: ${region.confidence.toFixed(4)}`,
            `- boundary coverage: ${coverage}% of source image`,
            `- boundary source render: ${region.sourceRenderKey}`,
          ]
        : []),
    ];
  });

  return [
    "# InPick Product Restyle",
    "",
    "## Source room",
    `- roomId: ${customization.roomId}`,
    `- roomName: ${customization.roomName}`,
    `- roomKind: ${customization.roomKind}`,
    "",
    "## Verified SKU selections",
    ...lines,
    "",
    "## Image edit instructions",
    "- Preserve the current room geometry, perspective, camera position, openings, ceiling height, and unselected objects.",
    onlyPartCode
      ? "- Restyle only the pixels inside the attached SAM boundary using the listed product facts; never invent or substitute a SKU."
      : "- Restyle only the named parts using the listed product facts; never invent or substitute a SKU.",
    onlyPartCode
      ? "- Treat pixels outside the attached boundary as immutable source pixels."
      : "- Preserve every unselected surface and object.",
    "- Match the listed product's documented material, color, finish, proportions, and visible details as closely as the source facts allow.",
    "- Keep every listed part as an independent selection and do not merge products.",
    "- Produce a clean photorealistic interior image without arrows, labels, text, watermarks, or logos.",
    "",
    "## Truth boundary",
    "- This is a visual preview guided by verified SKU facts, not proof that every pixel exactly reproduces the manufactured product.",
    "- Do not infer product details that are not present above.",
  ].join("\n");
}

export interface RoomProductEstimateRequirement {
  selectionKey: string;
  roomId: string;
  roomName: string;
  assemblyId: string;
  partCode: RoomProductPartCode;
  labelKo: string;
  materialProductId: string;
  materialNameKo: string;
  brand?: string;
  sku: string;
  spec?: string;
  unitPrice?: number;
  quantity: number;
  unit: RoomProductPartDefinition["estimateUnit"];
  targetSurface: SurfaceType;
  provenance: RoomProductProvenance;
}

export function buildRoomProductEstimateMapping(
  customization: RoomProductCustomization,
): { requirements: RoomProductEstimateRequirement[] } {
  const requirements = getRoomProductParts(customization.roomKind).flatMap((definition) => {
    const selection = customization.selections[definition.partCode];
    if (!selection) return [];
    if (selection.partCode !== definition.partCode) throw new Error("ROOM_PRODUCT_PART_MISMATCH");
    assertVerifiedSku(selection.product);
    return [{
      selectionKey: `${customization.roomId}::${customization.assemblyId}::${definition.partCode}`,
      roomId: customization.roomId,
      roomName: customization.roomName,
      assemblyId: customization.assemblyId,
      partCode: definition.partCode,
      labelKo: definition.labelKo,
      materialProductId: selection.product.materialProductId,
      materialNameKo: selection.product.displayName,
      brand: selection.product.brand,
      sku: selection.product.sku,
      spec: selection.product.spec,
      unitPrice: selection.product.unitPrice,
      quantity: selection.quantity ?? definition.defaultQuantity,
      unit: definition.estimateUnit,
      targetSurface: definition.targetSurface,
      provenance: selection.product.provenance,
    }];
  });
  return { requirements };
}

export function listTargetSurfaces(customization: RoomProductCustomization): SurfaceType[] {
  return Array.from(new Set(
    getRoomProductParts(customization.roomKind)
      .filter((definition) => Boolean(customization.selections[definition.partCode]))
      .map((definition) => definition.targetSurface),
  ));
}
