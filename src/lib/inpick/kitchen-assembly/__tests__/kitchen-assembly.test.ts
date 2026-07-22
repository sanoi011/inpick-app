import assert from "node:assert/strict";
import test from "node:test";

import {
  KITCHEN_PART_CODES,
  buildKitchenAssemblyEstimateMapping,
  buildKitchenAssemblyRenderPrompt,
  type KitchenAssembly,
  type KitchenPartCode,
} from "../index";

const selection = (partCode: KitchenPartCode, index: number) => ({
  partCode,
  quantity: index + 1,
  product: {
    materialProductId: `product-${partCode}`,
    brand: `brand-${index}`,
    sku: `sku-${partCode}`,
    spec: `spec-${index}`,
    unitPrice: (index + 1) * 10_000,
    provenance: {
      source: "catalog" as const,
      reference: `catalog-row-${index}`,
      verifiedAt: "2026-07-22T00:00:00.000Z",
    },
  },
});

const assembly: KitchenAssembly = {
  roomId: "room-kitchen",
  assemblyId: "main-kitchen",
  selections: Object.fromEntries(
    KITCHEN_PART_CODES.map((partCode, index) => [partCode, selection(partCode, index)]),
  ),
};

test("냉장고장과 김치냉장고장은 독립된 부품·제품·견적 요구사항으로 유지된다", () => {
  const mapping = buildKitchenAssemblyEstimateMapping(assembly);
  const fridge = mapping.materialSelections.find((item) => item.partCode === "fridge_cabinet");
  const kimchi = mapping.materialSelections.find((item) => item.partCode === "kimchi_fridge_cabinet");

  assert.equal(fridge?.materialProductId, "product-fridge_cabinet");
  assert.equal(kimchi?.materialProductId, "product-kimchi_fridge_cabinet");
  assert.notEqual(fridge?.selectionKey, kimchi?.selectionKey);
  assert.notEqual(
    mapping.requirements.find((item) => item.partCode === "fridge_cabinet")?.requirementCode,
    mapping.requirements.find((item) => item.partCode === "kimchi_fridge_cabinet")?.requirementCode,
  );
});

test("모든 주방 부품 선택이 고정 순서로 렌더 프롬프트와 견적 매핑에 들어간다", () => {
  const prompt = buildKitchenAssemblyRenderPrompt(assembly);
  const mapping = buildKitchenAssemblyEstimateMapping(assembly);

  assert.deepEqual(mapping.materialSelections.map((item) => item.partCode), KITCHEN_PART_CODES);
  assert.deepEqual(mapping.requirements.map((item) => item.partCode), KITCHEN_PART_CODES);

  for (const partCode of KITCHEN_PART_CODES) {
    assert.match(prompt, new RegExp(`sku-${partCode}`));
    assert.equal(
      mapping.requirements.find((item) => item.partCode === partCode)?.materialProductId,
      `product-${partCode}`,
    );
  }
});

test("SKU가 없는 카탈로그 행에는 SKU를 만들어 내지 않는다", () => {
  const noSkuAssembly: KitchenAssembly = {
    roomId: "room-kitchen",
    assemblyId: "secondary-kitchen",
    selections: {
      faucet: {
        partCode: "faucet",
        product: {
          materialProductId: "catalog-faucet-without-model-number",
          brand: "검증 브랜드",
          provenance: { source: "catalog", reference: "row-without-model-number" },
        },
      },
    },
  };

  const prompt = buildKitchenAssemblyRenderPrompt(noSkuAssembly);
  const [mapped] = buildKitchenAssemblyEstimateMapping(noSkuAssembly).materialSelections;

  assert.doesNotMatch(prompt, /SKU:/);
  assert.equal(mapped.sku, undefined);
});
