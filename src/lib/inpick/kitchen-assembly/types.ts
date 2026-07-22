export const KITCHEN_PART_CODES = [
  "upper_cabinet",
  "lower_cabinet",
  "countertop",
  "backsplash",
  "sink_bowl",
  "faucet",
  "fridge_cabinet",
  "kimchi_fridge_cabinet",
  "hood",
  "cooktop",
] as const;

export type KitchenPartCode = (typeof KITCHEN_PART_CODES)[number];

export type KitchenProductProvenanceSource =
  | "catalog"
  | "manufacturer"
  | "supplier"
  | "user_verified";

export interface KitchenProductProvenance {
  source: KitchenProductProvenanceSource;
  reference?: string;
  verifiedAt?: string;
}

/** A point-in-time catalog snapshot. Optional fields stay absent rather than being inferred. */
export interface KitchenProductSnapshot {
  materialProductId: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unitPrice?: number;
  provenance: KitchenProductProvenance;
}

export interface KitchenPartSelection {
  partCode: KitchenPartCode;
  product: KitchenProductSnapshot;
  quantity?: number;
}

export interface KitchenAssembly {
  roomId: string;
  assemblyId: string;
  selections: Partial<Record<KitchenPartCode, KitchenPartSelection>>;
}

export interface KitchenCatalogProduct extends KitchenProductSnapshot {
  displayName: string;
}

export const KITCHEN_PART_DEFINITIONS: ReadonlyArray<{
  partCode: KitchenPartCode;
  labelKo: string;
  estimateUnit: "m" | "m²" | "ea";
  defaultQuantity: number;
}> = [
  { partCode: "upper_cabinet", labelKo: "상부장", estimateUnit: "m", defaultQuantity: 1 },
  { partCode: "lower_cabinet", labelKo: "하부장", estimateUnit: "m", defaultQuantity: 1 },
  { partCode: "countertop", labelKo: "상판", estimateUnit: "m", defaultQuantity: 1 },
  { partCode: "backsplash", labelKo: "백스플래시", estimateUnit: "m²", defaultQuantity: 1 },
  { partCode: "sink_bowl", labelKo: "싱크볼", estimateUnit: "ea", defaultQuantity: 1 },
  { partCode: "faucet", labelKo: "수전", estimateUnit: "ea", defaultQuantity: 1 },
  { partCode: "fridge_cabinet", labelKo: "일반 냉장고장", estimateUnit: "ea", defaultQuantity: 1 },
  { partCode: "kimchi_fridge_cabinet", labelKo: "김치냉장고장", estimateUnit: "ea", defaultQuantity: 1 },
  { partCode: "hood", labelKo: "후드", estimateUnit: "ea", defaultQuantity: 1 },
  { partCode: "cooktop", labelKo: "쿡탑", estimateUnit: "ea", defaultQuantity: 1 },
];
