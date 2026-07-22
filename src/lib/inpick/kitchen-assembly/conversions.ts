import {
  KITCHEN_PART_DEFINITIONS,
  type KitchenAssembly,
  type KitchenPartCode,
  type KitchenProductProvenance,
} from "./types";

export interface KitchenEstimateMaterialSelection {
  selectionKey: string;
  roomId: string;
  assemblyId: string;
  partCode: KitchenPartCode;
  materialProductId: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unitPrice?: number;
  provenance: KitchenProductProvenance;
}

export interface KitchenEstimateRequirement extends KitchenEstimateMaterialSelection {
  requirementCode: `kitchen.${KitchenPartCode}`;
  labelKo: string;
  quantity: number;
  unit: "m" | "m²" | "ea";
}

export interface KitchenAssemblyEstimateMapping {
  materialSelections: KitchenEstimateMaterialSelection[];
  requirements: KitchenEstimateRequirement[];
}

const selectionKey = (assembly: KitchenAssembly, partCode: KitchenPartCode) =>
  `${assembly.roomId}::${assembly.assemblyId}::${partCode}`;

export function buildKitchenAssemblyEstimateMapping(
  assembly: KitchenAssembly,
): KitchenAssemblyEstimateMapping {
  const materialSelections: KitchenEstimateMaterialSelection[] = [];
  const requirements: KitchenEstimateRequirement[] = [];

  for (const definition of KITCHEN_PART_DEFINITIONS) {
    const selected = assembly.selections[definition.partCode];
    if (!selected) continue;
    if (selected.partCode !== definition.partCode) {
      throw new Error(`Kitchen selection key/partCode mismatch: ${definition.partCode}`);
    }

    const base: KitchenEstimateMaterialSelection = {
      selectionKey: selectionKey(assembly, definition.partCode),
      roomId: assembly.roomId,
      assemblyId: assembly.assemblyId,
      partCode: definition.partCode,
      materialProductId: selected.product.materialProductId,
      brand: selected.product.brand,
      sku: selected.product.sku,
      spec: selected.product.spec,
      unitPrice: selected.product.unitPrice,
      provenance: { ...selected.product.provenance },
    };
    materialSelections.push(base);
    requirements.push({
      ...base,
      requirementCode: `kitchen.${definition.partCode}`,
      labelKo: definition.labelKo,
      quantity: selected.quantity ?? definition.defaultQuantity,
      unit: definition.estimateUnit,
    });
  }

  return { materialSelections, requirements };
}

const promptField = (label: string, value: string | undefined) =>
  value ? `${label}: ${value}` : undefined;

/** Deterministic prompt fragment; it only emits catalog facts actually present in the snapshot. */
export function buildKitchenAssemblyRenderPrompt(assembly: KitchenAssembly): string {
  const lines = KITCHEN_PART_DEFINITIONS.flatMap((definition) => {
    const selected = assembly.selections[definition.partCode];
    if (!selected) return [];
    if (selected.partCode !== definition.partCode) {
      throw new Error(`Kitchen selection key/partCode mismatch: ${definition.partCode}`);
    }

    const fields = [
      `materialProductId: ${selected.product.materialProductId}`,
      promptField("brand", selected.product.brand),
      promptField("SKU", selected.product.sku),
      promptField("spec", selected.product.spec),
    ].filter((field): field is string => Boolean(field));

    return `- ${definition.labelKo} (${definition.partCode}) — ${fields.join(", ")}`;
  });

  if (lines.length === 0) return "";
  return [
    `Kitchen assembly ${assembly.assemblyId} in room ${assembly.roomId}:`,
    ...lines,
    "Keep every listed part as an independent product selection; do not substitute or infer missing SKU data.",
  ].join("\n");
}
