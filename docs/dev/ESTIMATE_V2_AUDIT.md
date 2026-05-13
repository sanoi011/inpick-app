# Estimate v2 (공종별 실행내역서) 도입 감사

> 작성: 2026-05-13
> 기반 MD: `inpick-construction-trade-estimate-engine-dev-plan-20260512.md`
> 목적: 기존 견적 시스템 분석 + 신규 estimate-v2 도입 영향 평가

---

## 1. 기존 견적 시스템 위치

| 파일 | 역할 | estimate-v2 영향 |
|---|---|---|
| `src/app/api/inpick/build-estimate/route.ts` | 견적 API (rooms/contextId 둘 다 처리) | **확장**: `estimateVersion` 분기 추가 |
| `src/lib/inpick/estimate.ts` | `buildRoomEstimate`, `MaterialItem`, `RoomEstimate`, `MOLIT_LABOR`, `KPA_PRICE` | **유지** — legacy 호환 |
| `src/lib/inpick/estimate-context/build-estimate-from-context.ts` | P2 contextId 경로 견적 합성 (lines 형식) | **유지** — `estimate-v2/build-construction-estimate`가 대체 가능하나 호환 |
| `src/lib/inpick/quote-pdf.tsx` | InPick 견적서 PDF (12공종 + 5간접비) | **유지** — 별도 construction-estimate-pdf.ts 추가 |
| `src/lib/inpick/quote-section-mapping.ts` | 자재→공종 매핑 (기존 12공종) | **참조** — v2 trades.ts에 반영, deprecated 표시 |
| `src/lib/inpick/estimate-documents/snapshot-builder.ts` | EstimateDocumentPackage 빌더 (PDF용) | **유지** — 기존 PDF 흐름 그대로 |
| `src/app/api/inpick/segmentation-estimate/route.ts` | 세그멘테이션 기반 견적 | **유지** — 사용 위치 한정 |
| `src/components/workflow/MaterialEditor.tsx` | 자재 영역 분석 + 견적 | **참조 안 함** |
| `src/app/workflow/estimate/page.tsx` | 견적 페이지 UI | **확장**: 공종별 보기 탭 추가, 기본을 공종별로 |

---

## 2. 현재 견적 페이지가 "천장/바닥/도배"로 그룹핑하는 위치

`src/app/workflow/estimate/page.tsx`의 `inferTrade()` 함수 (78-94줄):
```ts
function inferTrade(surface: string, materialName: string): string {
  if (n.includes("철거") || n.includes("폐기")) return "철거";
  if (s.includes("바닥") || ...) return "바닥";  // ← 공종이 아니라 부위
  if (s.includes("천장") || s.includes("ceil")) return "천장";
  if (s.includes("창호") || ...) return "창호/문";
  if (n.includes("주방") || ...) return "주방";
  if (n.includes("욕실") || ...) return "욕실";
  ...
}
```
+ `TRADE_ORDER` 상수가 "철거/목공/천장/바닥/도배/..." 혼재 — 공종/부위 섞임.

**v2 진행 방식**: `inferTrade` 결과는 부위별 탭에서만 사용. 공종별 탭은 `constructionEstimate.tradeSummaries`에서 직접 가져옴.

---

## 3. 67,322,609원 같은 반복 금액 원인 (이전 P5에서 추적)

- **하드코딩 없음** (grep 0건)
- 원인: legacy build-estimate가 `defaultSurfacesForRoom`만 사용 + 같은 평수/같은 자재 → 같은 결과
- **v2 해결**: SurfacePlan 우선순위 + 17공종 전개로 라인이 6배+ 분화되어 자연스럽게 변동 폭 확대

---

## 4. estimate-v2 도입 전략

### 4-1. 신규 디렉토리
```
src/lib/inpick/estimate-v2/
  types.ts                                 (SurfacePlan, WorkPackageRule, ConstructionEstimateLine, ...)
  trades.ts                                (CONSTRUCTION_TRADES 17공종 + commercial extras)
  quantity-formulas.ts                     (computeRoomQuantityBasis, resolveQuantity)
  work-package-rules.ts                    (5개 규칙: 강마루/도배/타일/욕실/주방)
  build-construction-estimate.ts           (메인 엔진)
  surface-plan-builder.ts                  (context → SurfacePlan[])
```

### 4-2. API 분기 (build-estimate route 확장)
```
body.estimateVersion === "construction_trade_v2"  OR  body.contextId + 기본값 v2
  → buildSurfacePlansFromContext(ctx)
  → buildConstructionEstimate(...)
  → { constructionEstimate, estimates: legacyShapeConverted, grandTotal }
```

### 4-3. 견적 페이지 UI 추가
- 상단 탭: `[공종별][공간별][부위별][자재별]`
- 기본 보기: 공종별
- 기존 `tradeGroups` (부위 inferTrade) → "부위별" 탭으로 이동
- 공종별 탭은 `constructionEstimate.tradeSummaries + lines` 사용

### 4-4. legacy 보존 정책
- `estimate.ts`, `quote-pdf.tsx`, `quote-section-mapping.ts` 모두 유지
- v2 도입은 추가형 — `estimateVersion` 미지정 시 legacy 동일 동작

---

## 5. 5개 핵심 WorkPackageRule

| Rule | match.surfaceTypes | match.materialCategories | 전개되는 line 수 |
|---|---|---|---|
| `WOOD_FLOOR_RULE` | floor | wood_floor/engineered_floor/강마루/원목마루 | 6 (철거→바탕→부자재→시공→걸레받이→폐기물) |
| `WALLPAPER_RULE` | wall, ceiling | wallpaper/silk_wallpaper/합지/실크벽지/도배 | 4 (제거→바탕→초배→도배) |
| `PORCELAIN_TILE_RULE` | floor, wall | porcelain_tile/tile/포세린타일 | 4 (철거→방수→타일→줄눈) |
| `BATHROOM_FULL_REMODEL_RULE` | bathroom 전체 | bathroom_full/욕실전체 | 6 (철거→설비→방수→타일→도기→천장) |
| `KITCHEN_STANDARD_RULE` | kitchen 전체 | kitchen_standard/싱크대 | 5 (철거→설비→전기→싱크→상판) |

---

## 6. 기존 17공종 QTY 엔진 재사용

이전 작업물 `src/lib/floor-plan/quantity/` (CLAUDE.md 기록)는 별개 시스템:
- 도면 기반 QTY 엔진 (BIM 데이터 → 면적 산출)
- `floor-plan/quantity/trades/01~17` 모듈 존재

**현재 결정**: estimate-v2는 quantity-formulas.ts (간단 면적 산출)로 시작.
기존 floor-plan/quantity 엔진은 도면이 정밀할 때만 동작. 호환 매핑은 후속 작업으로.

---

## 7. 우선순위 (이번 작업)

- **P7-1**: 타입 + 공종 + 수량 공식 (이번)
- **P7-2**: WorkPackageRule 5종 + 엔진 + SurfacePlan builder
- **P7-3**: API 분기 + DB 마이그레이션
- **P7-4**: 견적 페이지 공종별 UI

PDF v2는 P8로 미룸. 상가 확장은 P9.
