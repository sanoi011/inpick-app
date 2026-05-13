# Estimate v2 — Product/Price/PDF 연결 감사

> 작성: 2026-05-13
> 기반 MD: `inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md`
> 결론: **기존 인프라(`lookupMaterialProduct` + `vision-materials/price-resolver`)가 이미 있는데 v2 엔진이 안 씀.** 연결만 해주면 됨.

---

## 1. 기존 작동 인프라 (재사용 가능)

| 모듈 | 파일 | 용도 | v2 연결 |
|---|---|---|---|
| MaterialProductLookup | `src/lib/inpick/material-product-lookup.ts` | material_products (253K rows) → brand/sku/spec/contractor_price 매칭. 5-tier 우선순위 (is_verified + popularity_score + price_grade). | ❌ **미연결** |
| Vision Price Resolver | `src/lib/vision-materials/price-resolver.ts` | material_price_lookup → material_price_observations → material_products.contractor_price → KPA fallback 4-tier 우선순위. | ❌ **미연결** |
| Vision Product Retrieval | `src/lib/vision-materials/product-retrieval.ts` | embedding 기반 후보 검색 + popularity rerank | ❌ **미연결** |
| Legacy build-estimate | `src/lib/inpick/estimate.ts` + `route.ts` | `enrichWithBrandSku()` → lookupMaterialProduct 호출 → brand/sku/price 채움 | ✅ legacy 경로만 사용 |
| **estimate-v2 엔진** | `src/lib/inpick/estimate-v2/build-construction-estimate.ts` | **단가 하드코딩 / lookupMaterialProduct 호출 X / price-resolver 호출 X** | ❌ |

---

## 2. 문제 위치

### 2-1. 주방 8,900,000 고정값
**위치**:
1. `src/app/api/inpick/build-estimate/route.ts:67` (legacy defaultSurfacesForRoom)
2. `src/lib/inpick/estimate.ts:101-102` (legacy KPA_PRICE)
3. `src/lib/inpick/estimate-v2/work-package-rules.ts:402+` (KITCHEN_STANDARD_RULE — set 1 패키지)

### 2-2. v2 엔진의 자재 누락
`build-construction-estimate.ts`의 `resolveUnitPrices()`:
```ts
function resolveUnitPrices(template, plan) {
  // 자재 단가: surfacePlan에 선택 자재 단가가 있으면 우선
  let materialUnitPrice = template.costModel.defaultMaterialUnitPrice ?? 0;
  if (template.costModel.materialUnitPriceKey === "selected_material_unit_price"
      && plan.selectedMaterialUnitPrice) {
    materialUnitPrice = plan.selectedMaterialUnitPrice;
  }
  // ❌ material_products / material_price_lookup 조회 없음
  return { materialUnitPrice, laborUnitPrice, expenseUnitPrice };
}
```

→ DB 조회 0건 → 모든 라인이 `template.costModel.defaultMaterialUnitPrice` 사용 → "표준"

### 2-3. PDF가 brand/sku 미출력
`ConstructionEstimateLine` 타입에는 이미 `brand?: string; sku?: string; spec?: string;` 있음. 하지만 build 시 채워지지 않음 (위 #2-2 원인).

PDF generator (`estimate-documents/pdf/estimate-pdf.ts`)는 line.brand/sku를 받으면 출력하지만 input 자체가 없음.

---

## 3. 수정 전략

### 3-1. 기존 인프라 재사용
- `lookupMaterialProduct` → v2의 product resolver로 wrap
- `vision-materials/price-resolver` → v2의 price resolver로 wrap
- v2 엔진에서 await 호출 → line에 brand/sku/spec/source 채움

### 3-2. 주방 분해
- `KITCHEN_STANDARD_RULE`: set 1 → 12개 세부 라인 (하부장 m / 상부장 m / 싱크볼 ea / 수전 ea / 후드 ea / 백스플래시 m² / ...)
- `KitchenPlan` 타입 + `kitchen-plan-builder.ts` 길이 추정
- 면적 기반 default: <5m²=2.4m, 5-8=3.0m, 8-12=3.6m, ≥12=4.2m

### 3-3. snapshot 테이블
- `estimate_line_product_snapshots`: 견적 발행 후 product DB 변경되어도 과거 견적 불변

### 3-4. PDF 분리
- 공종별내역서: 작업 중심 (No/공종/공간/작업/품명·규격/단위/수량/재/노/경/합계/근거)
- 자재집계표: 상품 중심 (No/자재명/제조사/브랜드/납품사/SKU/규격/단위/수량/단가/금액/출처/적용일/신뢰도)

### 3-5. 진단 API
- `/api/admin/estimate-quality?estimateId=...`: fallback 통계 + 고액(>100만원) standard_fallback 경고

---

## 4. 우선순위 (작업 순)

1. **DB 마이그레이션**: construction_estimate_lines 17개 컬럼 추가 + snapshot 테이블
2. **Resolver 모듈**: `estimate-v2/product-resolver.ts` + `price-resolver.ts` (기존 인프라 wrap)
3. **build-construction-estimate.ts 통합**: resolveUnitPrices에서 product/price resolver 호출
4. **주방 KitchenPlan + 12라인 분해**
5. **PDF 자재집계표 분리**
6. **진단 API**

---

## 5. 위험 영역 (기존 코드 보존)

- `src/lib/inpick/estimate.ts` (legacy) — 그대로 유지
- `src/lib/vision-materials/price-resolver.ts` — 그대로 유지
- `src/lib/inpick/material-product-lookup.ts` — 그대로 유지

v2 엔진만 신규 resolver wrapper로 연결. legacy 경로는 회귀 없음.
