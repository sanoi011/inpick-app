import assert from "node:assert/strict";
import test from "node:test";

import { catalogRowToVerifiedProduct } from "../catalog";

const row = {
  id: "product-1",
  product_name: "검증 바닥재",
  brand: "브랜드",
  model_number: "SKU-001",
  specification: "화이트 오크",
  contractor_price: 50000,
  retail_price: 60000,
  thumbnail_url: "https://cdn.example.com/sku.jpg",
  is_verified: true,
  updated_at: "2026-07-22T00:00:00.000Z",
};

test("검증되고 모델번호가 있는 material_products 행만 제품으로 변환한다", () => {
  const product = catalogRowToVerifiedProduct(row);
  assert.ok(product);
  assert.equal(product?.sku, "SKU-001");
  assert.equal(product?.unitPrice, 50000);
  assert.equal(product?.provenance.reference, "material_products:product-1");
  assert.equal(product?.provenance.verifiedAt, row.updated_at);
});

test("미검증, SKU 없음, 검증시점 없음은 노출하지 않는다", () => {
  assert.equal(catalogRowToVerifiedProduct({ ...row, is_verified: false }), null);
  assert.equal(catalogRowToVerifiedProduct({ ...row, model_number: null }), null);
  assert.equal(catalogRowToVerifiedProduct({ ...row, updated_at: null }), null);
});
