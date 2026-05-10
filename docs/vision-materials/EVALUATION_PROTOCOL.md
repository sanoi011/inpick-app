# Vision Materials — 평가 프로토콜

> 작성일: 2026-05-11
> 가이드 본: `c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md` §11

## 0. 출시 게이트

```text
VISION_MATERIALS_EVAL_PASSED=true
```

이 환경변수는 다음 조건을 모두 통과하기 전에는 production에서 켜지 않는다:

1. **no-hallucinated-SKU rate = 100%** (DB에 없는 SKU 0건)
2. **high-confidence auto precision ≥ 90%** (자동 확정 정확도)
3. **estimate PDF smoke test pass** (59/84A/84B 모두)
4. **GOOGLE_GEMINI_API_KEY 없이 build/runtime pass**
5. **17공종 견적 엔진 ALL PASS** (기존 검증 유지)

## 1. Gold dataset

### 1-1. 최소 평가 데이터

- 59㎡ / 84A㎡ / 84B㎡ 샘플별 방 이미지
- 거실, 주방, 안방, 욕실, 현관, 발코니
- 표면별 label: floor / wall / ceiling / tile / cabinet / countertop / sanitary
- 제품 label: category, brand, productName, SKU (가능한 경우만)
- 견적 label: 수량, 단위, 단가, 공종

### 1-2. 목표 수량

| 단계 | 방 이미지 | surface observation |
|---|---|---|
| 초기 | 30 | 150 |
| 1차 출시 | 100 | 500 |
| 2차 | 300 | 1500 |

### 1-3. DB 저장

```sql
INSERT INTO vision_eval_cases (
  dataset_name, project_id, room_id, image_url,
  expected_surfaces, expected_materials, expected_products,
  expected_estimate_lines, split
) VALUES (...)
```

## 2. 자동 metric (vision_eval_results.metrics JSONB)

### 2-1. Surface detection

| Metric | 목표 |
|---|---|
| mAP@0.5 (전체) | ≥ 0.70 |
| floor recall | ≥ 0.80 |
| wall recall | ≥ 0.80 |
| tile recall | ≥ 0.80 |
| cabinet recall | ≥ 0.80 |

### 2-2. Segmentation

| Metric | 목표 |
|---|---|
| floor mIoU | ≥ 0.75 |
| wall mIoU | ≥ 0.75 |
| tile mIoU | ≥ 0.75 |
| cabinet mIoU | ≥ 0.60 |
| countertop mIoU | ≥ 0.60 |
| fixture mIoU | ≥ 0.60 |

### 2-3. Material category

| Metric | 목표 |
|---|---|
| top-1 category accuracy | ≥ 0.80 |
| top-3 category accuracy | ≥ 0.92 |

### 2-4. Product / SKU

| Metric | 초기 목표 | 1차 출시 |
|---|---|---|
| top-1 exact SKU | ≥ 0.45 | ≥ 0.55 |
| top-5 SKU | ≥ 0.75 | ≥ 0.85 |
| no-hallucinated-SKU rate | 100% | 100% |

### 2-5. Estimate

| Metric | 목표 |
|---|---|
| material coverage (common lines) | ≥ 70% |
| high-confidence auto precision | ≥ 90% |
| fallback lines have fallbackReason | 100% |
| PDF required fields | 100% 완전성 |

## 3. 평가 실행

```bash
# 평가 harness (Phase 8 후속에서 작성)
npx tsx scripts/eval-vision-materials.ts \
  --dataset gold-v1 \
  --runId vm-2026-05-11 \
  --out reports/vision-materials/run-2026-05-11.jsonl

# 결과 조회
curl https://inpick.kr/api/admin/vision-materials/eval
```

## 4. Hallucinated SKU 자동 검증

매 평가 케이스마다:

```ts
for (const candidate of result.candidates) {
  // material_products에 실제 row인지 확인
  const exists = await admin
    .from("material_products")
    .select("id")
    .eq("id", candidate.materialProductId)
    .maybeSingle();
  if (!exists.data) {
    metrics.hallucinatedSkuCount++;
    metrics.violations.push({
      caseId,
      materialProductId: candidate.materialProductId,
      reason: "DB에 존재하지 않는 SKU",
    });
  }
}

// no-hallucinated-SKU rate = 1 - (hallucinatedSkuCount / totalCandidateCount)
// 출시 게이트: 1.00 (100%)
```

## 5. 카테고리 호환성 자동 검증

욕실 floor에 강마루(FLOORING)가 top1으로 나오면 incompatible.

```ts
import { isCategoryCompatibleWithRoom } from "@/lib/vision-materials/category-map";

for (const observation of result.observations) {
  const top1 = observation.candidates[0];
  if (!top1) continue;
  const compatible = isCategoryCompatibleWithRoom(
    top1.category || "",
    observation.observation.surfaceType,
    observation.observation.roomType,
  );
  if (!compatible && observation.recommendation.status === "confirmed") {
    metrics.violations.push({
      caseId,
      reason: "CATEGORY_ROOM_INCOMPATIBLE in confirmed recommendation",
    });
  }
}
```

## 6. 운영 루프 (active learning)

평가 외에도 사용자 행동 데이터로 지속 개선:

```text
user_selected → positive pair (해당 candidate가 정답)
user_rejected → hard negative (해당 candidate는 오답)
contractor_changed → correction label (사업자가 수정한 자재)
```

저장 위치: `material_match_decisions.metadata`

주기적 작업:
1. hard negative 수집 → reranker weight 조정
2. category alias 보강 (사용자 입력 → category_aliases)
3. 제품 이미지 추가 수집
4. eval 재실행

## 7. 우선 개선 카테고리 (가이드 §15-2)

```text
1. 바닥재: 강마루, 장판, 타일
2. 벽: 벽지, 도장, 타일
3. 욕실: 타일, 위생도기, 수전
4. 주방: 상판, 싱크대, 타일
5. 도어/창호/걸레받이
6. 조명/스위치/부자재
```

이유:
- 바닥/벽/타일은 이미지에서 면적이 커서 vision 정확도가 높음
- 위생도기/수전은 형태가 뚜렷
- 조명/스위치/부자재는 작고 다양 → 후순위

## 8. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-11 | 초기 작성 — 출시 게이트 + 자동 metric |
