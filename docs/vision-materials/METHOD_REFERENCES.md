# Vision Materials — 방법론 참고 문서

> 작성일: 2026-05-11
> 가이드 본: `c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md` §1
> 정책: Gemini 무사용. Claude/OpenAI/RunPod/Supabase/Python만.

## 0. 한 줄 결론

비전 모델 하나에게 "이 자재가 뭐야?"라고 물어서 바로 SKU를 정하게 하면 안 된다.
**탐지 → 분할 → 특징 추출 → 제품 검색 → 재검증 → 신뢰도 게이트 → 견적 반영** 으로 쪼갠다.

## 1. Open-vocabulary detection + segmentation

### 1-1. Grounding DINO

**역할**: 자연어 카테고리/설명으로 임의 객체를 탐지하는 open-set detector.

InPick에서는 다음 prompt로 후보 박스를 찾는다:
- `wood floor`
- `white wall`
- `bathroom tile`
- `countertop`
- `baseboard`
- `door`
- `window`
- `sink`
- `toilet`
- `cabinet`

장점:
- 사전 정의된 클래스만 보는 closed-set과 달리, 신규 자재 카테고리도 prompt만으로 탐지 가능
- 한국어 prompt도 적당히 동작 (영어 prompt 권장)

### 1-2. SAM 2

**역할**: box/포인트 prompt 기반 promptable segmentation foundation model.

흐름:
1. Grounding DINO가 찾은 box 또는 사용자 클릭 포인트를 SAM2에 입력
2. SAM2가 floor/wall/tile/cabinet 등 영역의 정확한 mask 생성
3. mask를 crop하여 후속 분석 (CLIP/OCR/색상)

장점:
- 클릭 1회로 정확한 영역 분할
- 비디오/이미지 양쪽 지원 (현재 InPick은 이미지)

### 1-3. 적용 원칙

```text
GroundingDINO = 어디에 무엇이 있는지 box 후보를 찾는다.
SAM2 = box 후보를 정확한 mask로 바꾼다.
VLM = mask crop을 보고 의미 설명/검증을 한다.
견적 엔진 = mask와 도면 물량을 결합해 수량/단가를 계산한다.
```

## 2. CLIP / Visual RAG 기반 제품 검색

### 2-1. CLIP 원리

CLIP은 이미지와 텍스트를 같은 embedding 공간에 넣는다 → zero-shot 분류 + 검색.

InPick 활용:
1. 제품 이미지 + 자재명/브랜드/스펙 텍스트를 embedding으로 저장 (`material_product_images.clip_embedding`)
2. 사용자가 선택한 표면 crop의 embedding과 가까운 제품 후보를 Top-K로 찾음
3. cosine similarity 기반 정렬

### 2-2. Visual RAG

제품/SKU 인식 = **fine-grained classification** 문제.

유사한 제품끼리는 색상, 패턴, 규격, 패키지 차이만 다를 수 있어,
"모델이 바로 SKU를 맞힌다"보다 **Visual RAG**가 더 안전:

```text
1. 제품 catalog image/text embedding을 미리 만듦
2. 표면 crop embedding으로 DB에서 Top-K 후보 가져옴
3. 후보를 VLM/규칙/reranker로 재검증
4. Top-1이 불확실하면 Top-3 추천 후보로 소비자에게 보여줌
```

장점:
- 신규 제품을 retraining 없이 추가 가능 (DB row만 추가)
- 모델이 hallucination한 SKU가 견적에 안 들어감

## 3. OCR + Cost DB 통합

### 3-1. 건설 BoM 자동화 연구 패턴

검증된 접근:
- segmentation으로 부재/치수/객체 추출
- OCR로 숫자/텍스트 추출
- cost database와 결합하여 BoM 생성

InPick도 동일한 원칙:

```text
이미지에서 바로 금액을 만들지 않는다.
이미지 → 객체/표면/치수/텍스트 추출
도면 → 물량산출 (17공종 엔진)
DB → 제품/단가 조회 (material_products + material_price_lookup)
견적 엔진 → 금액 계산
```

### 3-2. EasyOCR 활용

InPick 사용 케이스:
- 자재 카탈로그 라벨에서 브랜드/SKU 텍스트 추출
- 도면 치수 (이미 floorplan-ai에서 사용)
- 한/영 동시 인식

## 4. Structured Output + 신뢰도 게이트

### 4-1. JSON Schema 강제

VLM이 설명을 잘해도, 견적서에 들어갈 데이터는 반드시 JSON Schema로 제한.

```text
- 모델 출력은 자유 텍스트 금지
- Zod schema / JSON schema로 검증
- SKU는 material_products.id 또는 sku가 실제 DB에 존재할 때만 채택
- confidence가 낮으면 "추천 후보" 또는 generic fallback으로 처리
```

### 4-2. OpenAI Structured Outputs

OpenAI는 모델 출력이 JSON Schema를 따르도록 보장하는 기능 제공.
InPick에서는 후보 선택 시 사용 — `materialProductId` 필드를 enum으로 제한.

### 4-3. Anthropic Vision 한계

Claude Vision 문서:
- 정밀 위치 측정 한계 있음
- 카운팅 정확도 한계 있음
- 저품질 이미지 해석 한계 있음

→ 고위험 용도(견적서 자동 확정)에서는 별도 검토 필수.

InPick 정책:
- VLM은 보조 검증자로만 사용
- 최종 SKU/단가/PDF 데이터는 반드시 JSON Schema와 DB 조회를 통과

## 5. Vision eval harness

### 5-1. 평가 루프

```text
Inputs → Model → Outputs → Graders → Scores → Feedback → Improvement
```

### 5-2. InPick 자동 metric

- **Surface detection**: mAP@0.5, class recall
- **Segmentation**: mIoU per class
- **Material category**: top-1 / top-3 accuracy
- **Product/SKU**: top-1 / top-5 accuracy
- **No-hallucinated-SKU rate**: 100% 필수
- **High-confidence precision**: ≥ 90%
- **Estimate coverage**: ≥ 70%
- **PDF completeness**: 100%

상세는 `docs/vision-materials/EVALUATION_PROTOCOL.md` 참조.

## 6. 정책 강제 (절대 안 됨)

```text
❌ Gemini 사용 (GOOGLE_GEMINI_API_KEY, @google/genai, gemini-* 등)
❌ AI가 임의 SKU/브랜드 생성
❌ confidence 낮은 제품 자동 확정
❌ 모든 자재를 처음부터 exact SKU로 맞히려 함
❌ Pinterest/불명확 이미지로 학습
❌ Flux 이미지 생성 품질 개선과 vision-materials 작업을 섞음
```

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-11 | 초기 작성 — 가이드 §1 요약 + InPick 적용 |
