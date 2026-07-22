import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import KitchenAssemblySelector from "../KitchenAssemblySelector";
import type { KitchenAssembly } from "@/lib/inpick/kitchen-assembly";

const assembly: KitchenAssembly = {
  roomId: "kitchen-room",
  assemblyId: "main-kitchen",
  selections: {
    fridge_cabinet: {
      partCode: "fridge_cabinet",
      product: {
        materialProductId: "fridge-product",
        brand: "Brand F",
        sku: "FRIDGE-001",
        provenance: { source: "catalog", reference: "fridge-row" },
      },
    },
    kimchi_fridge_cabinet: {
      partCode: "kimchi_fridge_cabinet",
      product: {
        materialProductId: "kimchi-product",
        brand: "Brand K",
        sku: "KIMCHI-002",
        provenance: { source: "catalog", reference: "kimchi-row" },
      },
    },
  },
};

test("폭발도 선택기는 접근 가능한 전체 부품 목록과 독립된 선택 요약을 렌더링한다", () => {
  const html = renderToStaticMarkup(
    React.createElement(KitchenAssemblySelector, {
      value: assembly,
      onChange: () => undefined,
      searchCatalog: async () => [],
    }),
  );

  assert.match(html, /aria-label="주방 조립 부품 선택"/);
  assert.match(html, /상부장/);
  assert.match(html, /하부장/);
  assert.match(html, /일반 냉장고장/);
  assert.match(html, /김치냉장고장/);
  assert.match(html, /FRIDGE-001/);
  assert.match(html, /KIMCHI-002/);
});
