import assert from "node:assert/strict";
import test from "node:test";

import {
  bindRoomProductCustomizationToSource,
  buildRoomProductEstimateMapping,
  buildRoomProductPromptMarkdown,
  carryRoomProductCustomizationToSource,
  getRoomProductParts,
  inferRoomProductKind,
  isRoomProductCustomizationBoundToSource,
  listTargetSurfaces,
  type RoomProductCustomization,
} from "../index";

const verifiedProduct = {
  materialProductId: "product-123",
  displayName: "포세린 타일 화이트 600",
  brand: "테스트브랜드",
  sku: "REAL-SKU-600-WH",
  spec: "600×600 mm",
  unitPrice: 78000,
  thumbnailUrl: "https://cdn.example.com/product.jpg",
  provenance: {
    source: "catalog" as const,
    reference: "material_products:product-123",
    verifiedAt: "2026-07-22T00:00:00.000Z",
  },
};

test("실 이름별로 이미지 위에 표시할 핵심 부위를 제공한다", () => {
  assert.equal(inferRoomProductKind("거실/다이닝"), "living");
  assert.equal(inferRoomProductKind("욕실1"), "bathroom");
  assert.equal(inferRoomProductKind("안방"), "bedroom");
  assert.equal(inferRoomProductKind("현관"), "entry");
  assert.equal(inferRoomProductKind("주방"), "kitchen");

  const livingCodes = getRoomProductParts("living").map((part) => part.partCode);
  assert.ok(livingCodes.includes("floor_finish"));
  assert.ok(livingCodes.includes("art_wall"));
  assert.ok(livingCodes.includes("main_lighting"));

  const bathCodes = getRoomProductParts("bathroom").map((part) => part.partCode);
  assert.ok(bathCodes.includes("floor_tile"));
  assert.ok(bathCodes.includes("wall_tile"));
  assert.ok(bathCodes.includes("toilet"));
  assert.ok(bathCodes.includes("basin"));

  const entryCodes = getRoomProductParts("entry").map((part) => part.partCode);
  assert.ok(entryCodes.includes("entry_door"));
  assert.ok(entryCodes.includes("shoe_cabinet"));
});

test("실제 SKU 선택만 Prompt MD와 견적 매핑에 들어간다", () => {
  const customization: RoomProductCustomization = {
    roomId: "living",
    roomName: "거실",
    roomKind: "living",
    assemblyId: "room-products-living",
    selections: {
      floor_finish: {
        partCode: "floor_finish",
        product: verifiedProduct,
      },
    },
  };

  const markdown = buildRoomProductPromptMarkdown(customization);
  assert.match(markdown, /^# InPick Product Restyle/m);
  assert.match(markdown, /## Verified SKU selections/);
  assert.match(markdown, /REAL-SKU-600-WH/);
  assert.match(markdown, /materialProductId: product-123/);
  assert.match(markdown, /Preserve the current room geometry/i);
  assert.match(markdown, /visual preview/i);

  const mapping = buildRoomProductEstimateMapping(customization);
  assert.equal(mapping.requirements.length, 1);
  assert.equal(mapping.requirements[0].selectionKey, "living::room-products-living::floor_finish");
  assert.equal(mapping.requirements[0].materialProductId, "product-123");
  assert.equal(mapping.requirements[0].sku, "REAL-SKU-600-WH");
  assert.deepEqual(listTargetSurfaces(customization), ["floor"]);
});

test("SKU나 검증 시점이 없는 상품은 exact product 재생성에 사용할 수 없다", () => {
  const customization: RoomProductCustomization = {
    roomId: "bath",
    roomName: "욕실",
    roomKind: "bathroom",
    assemblyId: "room-products-bath",
    selections: {
      toilet: {
        partCode: "toilet",
        product: {
          ...verifiedProduct,
          sku: undefined,
          provenance: { source: "catalog", reference: "material_products:product-123" },
        },
      },
    },
  };

  assert.throws(
    () => buildRoomProductPromptMarkdown(customization),
    /VERIFIED_SKU_REQUIRED/,
  );
  assert.throws(
    () => buildRoomProductEstimateMapping(customization),
    /VERIFIED_SKU_REQUIRED/,
  );
});

test("주방 부품은 기존 독립 SKU 단위를 유지한다", () => {
  const kitchenCodes = getRoomProductParts("kitchen").map((part) => part.partCode);
  assert.ok(kitchenCodes.includes("upper_cabinet"));
  assert.ok(kitchenCodes.includes("lower_cabinet"));
  assert.ok(kitchenCodes.includes("countertop"));
  assert.ok(kitchenCodes.includes("sink_bowl"));
  assert.ok(kitchenCodes.includes("faucet"));
  assert.ok(kitchenCodes.includes("fridge_cabinet"));
  assert.ok(kitchenCodes.includes("kimchi_fridge_cabinet"));
});

test("다른 생성 시안으로 전환하면 기존 SKU를 자동 승계하지 않고 새 source render에 재결합한다", () => {
  const original: RoomProductCustomization = {
    roomId: "living",
    roomName: "거실",
    roomKind: "living",
    assemblyId: "room-products-living-render-a",
    sourceRenderKey: "render-a",
    selections: {
      floor_finish: { partCode: "floor_finish", product: verifiedProduct },
    },
  };

  assert.equal(isRoomProductCustomizationBoundToSource(original, "render-a"), true);
  assert.equal(isRoomProductCustomizationBoundToSource(original, "render-b"), false);

  const rebound = bindRoomProductCustomizationToSource(original, "render-b");
  assert.equal(rebound.sourceRenderKey, "render-b");
  assert.notEqual(rebound.assemblyId, original.assemblyId);
  assert.deepEqual(rebound.selections, {});
});

test("선택 SKU로 image edit한 새 시안은 같은 선택을 새 source render identity로 승계한다", () => {
  const original: RoomProductCustomization = {
    roomId: "bath",
    roomName: "욕실",
    roomKind: "bathroom",
    assemblyId: "room-products-bath-render-a",
    sourceRenderKey: "render-a",
    selections: {
      toilet: { partCode: "toilet", product: verifiedProduct },
    },
  };

  const carried = carryRoomProductCustomizationToSource(original, "render-b");
  assert.equal(carried.sourceRenderKey, "render-b");
  assert.equal(carried.assemblyId, original.assemblyId);
  assert.equal(carried.selections.toilet?.product.sku, "REAL-SKU-600-WH");
});
