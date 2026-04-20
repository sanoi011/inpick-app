# INPICK Vision 기반 정밀 견적 시스템 개발 로드맵

> 작성일: 2026-04-10
> 목표: AI 생성 인테리어 이미지 → 자재 자동 식별 → 정밀 물량산출 → 실견적
> 원칙: **최고 성능 API 우선 → 이후 내재화**(자체 모델 전환)

---

## 1. 현재 상태 (AS-IS)

### 1-1. 파이프라인 구조
```
[현재]
사용자 → AI 디자인 상담 → AI 이미지 생성 (4컷)
                                    ↓
                          이미지는 "보여주기"용
                          견적과 연결 안 됨
                                    ↓
사용자 → 수동 자재 선택 (카탈로그) → 물량산출 엔진 → 견적서
```

### 1-2. 문제점
| 문제 | 설명 |
|------|------|
| AI 이미지 ↔ 견적 단절 | AI가 만든 이미지와 실제 견적이 따로 놀음 |
| 수동 자재 선택 | 사용자가 16개 카테고리를 일일이 골라야 함 |
| 자재 식별 정확도 부족 | Gemini Vision은 범용 모델이라 건자재 전문성 약함 |
| 실제 제품 매칭 없음 | "강마루"라고만 나오지, 어떤 브랜드 어떤 제품인지 모름 |

### 1-3. 현재 보유 기술 자산
| 자산 | 상태 | 경로 |
|------|------|------|
| Gemini Vision 분석 API | 구현 완료 (2026-04-10) | `/api/project/analyze-design-image` |
| Vision → SelectedMaterial 변환기 | 구현 완료 | `src/lib/services/vision-material-converter.ts` |
| 17개 공종 물량산출 엔진 | 운영 중 | `src/lib/floor-plan/quantity/` |
| 60+ 항목 단가 DB | 운영 중 (2025-03 기준) | `src/lib/floor-plan/quantity/unit-price-db.ts` |
| YOLO 도면 심볼 감지 모델 (v8) | 학습 완료 (mAP50: 0.913) | `public/models/floorplan-yolo.onnx` |
| 자재 카탈로그 DB | Mock 데이터 | `src/lib/data/material-catalog-v2.ts` |

---

## 2. 목표 상태 (TO-BE)

```
[목표]
AI 생성 인테리어 이미지 (4컷: 거실/주방/침실/욕실)
    │
    ├─ [Layer 1] Gemini 2.5 Pro Vision ──── 전체 맥락/스타일/색감 분석
    │
    ├─ [Layer 2] YOLOv11x 커스텀 모델 ──── 30개 클래스 자재/설비 정밀 감지
    │
    ├─ [Layer 3] OpenAI CLIP → pgvector ── 건자재 DB 실제 제품 1:1 매칭
    │
    └─ [Layer 4] 결과 융합 엔진 ─────────── SelectedMaterial[] → 물량산출 → 견적
```

---

## 3. 스테이지별 기술 스택

### Stage 1: 건자재 이미지 DB 구축

#### 기술 스택

| 역할 | 선택 기술 | 선택 근거 | 내재화 계획 |
|------|----------|----------|------------|
| **DB** | Supabase PostgreSQL + pgvector | 이미 운영 중, 벡터 검색 내장 | 유지 |
| **Storage** | Supabase Storage | 이미 운영 중, CDN 포함 | 유지 |
| **크롤링 엔진** | Playwright + Crawlee | JS 렌더링 대응, 안티봇 우회 | 자체 운영 |
| **이미지 전처리** | Sharp (Node.js) | 리사이즈/크롭/포맷 변환 | 자체 운영 |
| **데이터 정제** | Gemini 2.5 Pro | 크롤링 데이터에서 제품명/규격/가격 구조화 추출 | 내재화 불필요 |
| **카탈로그 PDF 파싱** | PyMuPDF + Gemini Vision | PDF에서 제품 이미지+스펙 추출 | 자체 운영 |

#### 수집 대상 (1,000개 제품 목표)

| 카테고리 | 목표 | 주요 소스 | 크롤링 난이도 |
|----------|------|----------|-------------|
| 바닥재 | 200개 | 한샘, LX하우시스, 동화자연마루, 대림 | 중 |
| 타일 | 200개 | 동서타일, 이눅스, 국보타일 | 중 |
| 위생도기 | 100개 | TOTO, 대림바스, 아메리칸스탠다드 | 쉬움 |
| 주방 | 100개 | 한샘, 에넥스, 리바트 | 중 |
| 벽지 | 150개 | 신한벽지, LG하우시스, 벽산 | 쉬움 |
| 문/창호 | 80개 | 영림도어, KCC | 쉬움 |
| 조명 | 100개 | 필립스, KS조명 | 쉬움 |
| 가구(빌트인) | 70개 | 한샘, 리바트 | 중 |

#### DB 스키마

```sql
CREATE TABLE material_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT NOT NULL,        -- FLOORING, WALLPAPER, BATH_TILE...
  sub_category TEXT,                  -- laminate, engineered_wood, SPC...
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_number TEXT,
  specification TEXT,                 -- 1200x190x8mm T
  retail_price INTEGER,               -- 소비자가 (원)
  contractor_price INTEGER,           -- 시공가 (원)
  labor_price INTEGER,                -- 시공비 (원)
  unit TEXT NOT NULL,                 -- m², EA, SET, LM
  price_grade TEXT DEFAULT 'standard',
  thumbnail_url TEXT,
  texture_url TEXT,                   -- 텍스처 이미지 (CLIP 매칭용)
  installed_photo_urls TEXT[],        -- 시공사진 (YOLO 학습용)
  dominant_colors TEXT[],             -- 주요 색상 HEX
  pattern_type TEXT,                  -- herringbone, straight, mosaic...
  surface_finish TEXT,                -- matte, gloss, textured
  is_verified BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE material_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES material_products(id),
  embedding VECTOR(768),              -- OpenAI CLIP ViT-L/14 (768차원)
  source_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_material_embeddings_cosine
  ON material_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

### Stage 2: YOLOv11 커스텀 자재 감지 모델

#### 기술 스택

| 역할 | 선택 기술 | 선택 근거 | 내재화 계획 |
|------|----------|----------|------------|
| **감지 모델** | **YOLOv11x** (Ultralytics, 2025.10) | 최신 SOTA, v8 대비 mAP +2~3%, 추론 속도 개선 | 자체 모델 (핵심 자산) |
| **학습 프레임워크** | Ultralytics + PyTorch 2.x | YOLOv11 공식 지원 | 자체 운영 |
| **학습 GPU** | **Lambda Cloud A100 80GB** | 대규모 데이터셋 고속 학습, $1.29/hr | 초기 학습용 |
| **합성 데이터 생성** | **Gemini Imagen 3** | 포토리얼 인테리어 이미지 대량 생성 | API 유지 |
| **자동 라벨링** | **Gemini 2.5 Pro Vision** | 바운딩박스 + 클래스 자동 라벨링 | API 유지 |
| **라벨링 검수** | **Roboflow** (유료) | 팀 라벨링, 데이터 증강, 버전 관리 원스톱 | $249/월 Team |
| **ONNX 변환** | `ultralytics export format=onnx` | 브라우저(onnxruntime-web) + 서버 양쪽 배포 | 자체 운영 |
| **서버 추론** | **NVIDIA Triton Inference Server** | 고성능 배치 추론, 모델 버전 관리 | 내재화 핵심 |

#### YOLOv11x vs 이전 버전 비교

| 항목 | YOLOv8m (현재 보유) | YOLOv11x (목표) |
|------|-------------------|----------------|
| 파라미터 | 25.9M | 56.9M |
| mAP50 (COCO) | 50.2 | 54.7 |
| 추론 속도 | 234ms (CPU) | 462ms (CPU) / 12ms (GPU) |
| 입력 크기 | 640 | 1024 (커스텀) |
| 특징 | 범용 | C2PSA 어텐션, 대형 객체 감지 강화 |

> YOLOv11x는 인테리어 이미지처럼 다양한 크기의 객체가 혼재하는 장면에 적합.
> `x` 사이즈 선택 이유: 정확도 최우선 (서버 추론 기준, GPU 사용)

#### 감지 클래스 (30개)

```yaml
# dataset.yaml
names:
  # 바닥재 (5)
  0: wood_floor_straight
  1: wood_floor_herringbone
  2: tile_floor_large
  3: tile_floor_small
  4: marble_floor
  # 벽면 (4)
  5: wallpaper_plain
  6: wallpaper_pattern
  7: paint_wall
  8: tile_wall
  # 천장 (3)
  9: ceiling_flat
  10: ceiling_coffer
  11: indirect_lighting
  # 위생도기 (5)
  12: toilet
  13: vanity_cabinet
  14: wall_basin
  15: shower_partition
  16: bathtub
  # 주방 (5)
  17: kitchen_upper_cabinet
  18: kitchen_lower_cabinet
  19: kitchen_countertop
  20: range_hood
  21: kitchen_sink
  # 문/창호 (3)
  22: door_single
  23: door_sliding
  24: door_entrance
  # 기타 (5)
  25: baseboard
  26: recessed_light
  27: pendant_light
  28: built_in_closet
  29: shoe_cabinet
```

#### 학습 데이터 확보 파이프라인

```
[Step 1] Gemini Imagen 3 → 합성 인테리어 이미지 3,000장
         (스타일 x 방 타입 x 예산등급 조합)
              ↓
[Step 2] Gemini 2.5 Pro Vision → 자동 바운딩박스 라벨링
         "이 이미지에서 30개 클래스 객체를 YOLO 포맷으로 라벨링해줘"
              ↓
[Step 3] Roboflow → 수동 검수 (30%) + 데이터 증강
         회전/밝기/크롭/모자이크/색조 변환
              ↓
[Step 4] 오늘의집/집꾸미기 시공사례 5,000장 추가 크롤링
         → Step 2~3 반복
              ↓
[Step 5] 총 10,000~15,000장 학습 데이터셋
```

#### 학습 설정

```python
from ultralytics import YOLO

model = YOLO("yolo11x.pt")  # YOLOv11x pretrained

model.train(
    data="datasets/interior-materials/dataset.yaml",
    epochs=300,
    imgsz=1024,
    batch=16,           # A100 80GB 기준
    optimizer="AdamW",
    lr0=0.001,
    cos_lr=True,
    mosaic=1.0,
    mixup=0.15,
    augment=True,
    device=0,
    project="runs/interior-yolo",
    name="v11x-materials-v1",
)

# ONNX 내보내기
model.export(format="onnx", imgsz=1024, simplify=True)
```

---

### Stage 3: 이미지 임베딩 + 건자재 DB 매칭

#### 기술 스택

| 역할 | 선택 기술 | 선택 근거 | 내재화 계획 |
|------|----------|----------|------------|
| **이미지 임베딩** | **OpenAI CLIP API** (ViT-L/14, 768d) | 최고 정확도, 건축/인테리어 도메인 강점 | 1단계: API → 2단계: open_clip 자체 서버 |
| **벡터 DB** | Supabase pgvector | 이미 운영 중, SQL과 통합 | 유지 |
| **유사도 검색** | pgvector cosine similarity | Top-K 검색, 카테고리 필터 결합 | 유지 |
| **색상 분석** | OpenCV + KMeans | 이미지에서 dominant color 3개 추출 | 자체 운영 |
| **텍스처 분류** | **Google Cloud Vision API** | 텍스처/재질 라벨 (wood, marble, ceramic) | 1단계: API → 2단계: 자체 CNN |

#### 매칭 플로우

```
YOLO 감지: wood_floor_herringbone (bbox: [100,400,900,700])
    ↓
이미지 크롭 (바운딩박스 영역)
    ↓
┌─────────────────────────────────────────────┐
│ 병렬 분석                                    │
│                                              │
│ [A] OpenAI CLIP → 768d 임베딩               │
│ [B] OpenCV KMeans → dominant colors 3개      │
│ [C] Cloud Vision → texture label             │
└─────────────────────────────────────────────┘
    ↓
pgvector 유사도 검색 (카테고리 = FLOORING 필터)
    ↓
┌─────────────────────────────────────────────┐
│ 스코어 융합                                   │
│                                              │
│ final_score = 0.6 × CLIP유사도               │
│             + 0.25 × 색상유사도              │
│             + 0.15 × 텍스처일치              │
└─────────────────────────────────────────────┘
    ↓
Top-3 매칭 결과:
  1. LX하우시스 지아소리잠 헤링본 오크 ZSJ-2045 (score: 0.94)
  2. 동화자연마루 프리미엄 헤링본 내추럴 (score: 0.89)
  3. 한샘 오크 헤링본 HO-882 (score: 0.85)
    ↓
단가: 자재 85,000 + 시공 35,000 = 120,000원/m²
```

#### 내재화 로드맵

```
[1단계 - 빠른 개발] OpenAI CLIP API + Google Cloud Vision API
  비용: ~$50/월
  장점: 즉시 사용, 최고 정확도
  
[2단계 - 내재화] open_clip (ViT-L/14) 자체 서버
  비용: GPU 서버 $15/월 (Railway)
  장점: API 비용 0, 지연시간 감소, 커스텀 fine-tuning 가능
  시기: 매칭 정확도 검증 후 (Stage 4 이후)
  
[3단계 - 완전 내재화] 건자재 특화 임베딩 모델 fine-tuning
  방법: open_clip에 건자재 이미지 쌍(anchor-positive-negative) 학습
  장점: 건자재 도메인 특화, 일반 CLIP 대비 정확도 +10~15%
  시기: 건자재 DB 2,000개+ 확보 후
```

---

### Stage 4: 통합 파이프라인 + API

#### 기술 스택

| 역할 | 선택 기술 | 선택 근거 | 내재화 계획 |
|------|----------|----------|------------|
| **오케스트레이터** | Next.js API Route (TypeScript) | 기존 인프라 | 유지 |
| **Python 추론 서버** | **FastAPI + Uvicorn** | YOLO + CLIP + OpenCV 통합 | 자체 운영 (핵심) |
| **추론 호스팅** | **Modal.com** (서버리스 GPU) | 콜드스타트 최소, GPU 추론 $0.0016/초 | 1단계: Modal → 2단계: 자체 GPU |
| **결과 캐싱** | Supabase (분석 결과 저장) | 동일 이미지 재분석 방지 | 유지 |
| **비동기 큐** | Supabase Edge Functions + pg_cron | 대량 분석 시 비동기 처리 | 유지 |

#### 최종 파이프라인 API

```
POST /api/project/analyze-design-precise

Request:
{
  images: [
    { imageData: "base64...", roomType: "living", roomName: "거실", floorArea: 29.5 },
    { imageData: "base64...", roomType: "kitchen", roomName: "주방", floorArea: 8.2 },
    { imageData: "base64...", roomType: "bedroom", roomName: "안방", floorArea: 15.3 },
    { imageData: "base64...", roomType: "bathroom", roomName: "욕실", floorArea: 4.8 }
  ],
  budget: "standard",
  totalArea: 84.0
}

Response:
{
  rooms: [
    {
      roomType: "living",
      roomName: "거실",
      
      // Layer 1: Gemini 맥락 분석
      context: {
        overallStyle: "모던 내추럴",
        colorPalette: ["#8B6F47", "#F5F0E8", "#FFFFFF"],
        lightingType: "간접조명 + 매입등 혼합",
        estimatedGrade: "standard"
      },
      
      // Layer 2: YOLO 감지 결과
      detections: [
        {
          class: "wood_floor_herringbone",
          confidence: 0.94,
          bbox: [100, 400, 900, 700]
        },
        {
          class: "ceiling_coffer",
          confidence: 0.88,
          bbox: [50, 10, 950, 200]
        },
        ...
      ],
      
      // Layer 3: 건자재 DB 매칭
      matchedProducts: [
        {
          detectionClass: "wood_floor_herringbone",
          topMatches: [
            {
              productId: "uuid-1",
              brand: "LX하우시스",
              productName: "지아소리잠 헤링본 오크",
              modelNumber: "ZSJ-2045",
              similarity: 0.94,
              retailPrice: 85000,
              laborPrice: 35000,
              unit: "m²",
              thumbnailUrl: "https://..."
            },
            { ... }, // 2nd
            { ... }  // 3rd
          ],
          selectedIndex: 0  // 자동 선택 (최고 유사도)
        },
        ...
      ],
      
      // Layer 4: 최종 자재 목록 (기존 견적 엔진 호환)
      materials: [
        {
          categoryCode: "FLOORING",
          categoryName: "바닥재",
          materialName: "LX하우시스 지아소리잠 헤링본 오크",
          specification: "오크 원목 150x900mm 헤링본",
          unitPrice: 85000,
          laborPrice: 35000,
          unit: "m²",
          priceGrade: "standard",
          confidence: 0.94,
          productId: "uuid-1"
        },
        ...
      ]
    },
    ... // kitchen, bedroom, bathroom
  ],
  
  // 전체 견적 요약
  estimateSummary: {
    totalMaterialCost: 12500000,
    totalLaborCost: 8700000,
    overhead: 1272000,       // 6%
    profit: 1123500,         // 5%
    vat: 2359550,            // 10%
    grandTotal: 25955050,
    priceGrade: "standard",
    perPyeong: 1810000       // 평당 단가
  }
}
```

---

## 4. 전체 기술 스택 한눈에 보기

### 외부 API (유료)

| API | 용도 | 스테이지 | 예상 비용/월 | 내재화 시기 |
|-----|------|---------|-------------|------------|
| **Gemini 2.5 Pro** | Vision 맥락 분석 + 이미지 생성 + 자동 라벨링 | 전체 | $20~50 | 유지 (핵심 API) |
| **OpenAI CLIP API** | 이미지 임베딩 (768d 벡터) | Stage 3 | $20~30 | 6개월 후 open_clip 전환 |
| **Google Cloud Vision** | 텍스처/재질 분류 | Stage 3 | $10~20 | 6개월 후 자체 CNN 전환 |
| **Roboflow** | 라벨링 + 데이터셋 관리 | Stage 2 | $249 (Team) | 학습 완료 후 해지 |
| **Lambda Cloud A100** | YOLO 모델 학습 | Stage 2 | $50~100 (학습 기간) | 학습 완료 후 해지 |
| **Modal.com** | 서버리스 GPU 추론 | Stage 4 | $30~80 | 트래픽 증가 시 자체 GPU |

### 자체 운영 인프라

| 인프라 | 용도 | 비용/월 |
|--------|------|---------|
| **Supabase Pro** | DB + Auth + Storage + pgvector + Realtime | $25 |
| **Vercel Pro** | Next.js 배포 (300초 타임아웃) | $20 |
| **Python 추론 서버** (Railway/Render) | YOLO + CLIP 추론 API | $15~25 |
| **합계** | | **$60~70** |

### 핵심 라이브러리

| 라이브러리 | 버전 | 용도 | 환경 |
|-----------|------|------|------|
| `ultralytics` | 8.3+ | YOLOv11 학습/추론/ONNX 변환 | Python |
| `torch` | 2.x | PyTorch 백엔드 | Python |
| `open_clip_torch` | 2.x | CLIP 임베딩 (내재화 단계) | Python |
| `onnxruntime-web` | 1.x | 브라우저 YOLO 추론 | JS (클라이언트) |
| `onnxruntime` | 1.x | 서버 YOLO 추론 | Python |
| `fastapi` + `uvicorn` | 0.110+ | Python 추론 서버 | Python |
| `opencv-python` | 4.x | 이미지 전처리, 색상 분석 | Python |
| `sharp` | 0.33+ | Node.js 이미지 처리 | Node.js |
| `@google/genai` | latest | Gemini API 클라이언트 | Node.js |
| `playwright` | latest | 건자재 크롤링 | Node.js |

---

## 5. 내재화 로드맵

```
[현재] 외부 API 의존 (빠른 개발)
  │
  ├─ Gemini Vision → 유지 (대체 불필요)
  ├─ OpenAI CLIP API → open_clip 자체 서버로 전환
  ├─ Google Cloud Vision → 자체 텍스처 분류 CNN으로 전환
  ├─ Roboflow → 학습 완료 후 해지
  └─ Lambda Cloud → 학습 완료 후 해지
  
[6개월 후] 부분 내재화
  │
  ├─ YOLO 모델: 자체 보유 (핵심 IP)
  ├─ CLIP 임베딩: open_clip 자체 서버 ($15/월)
  ├─ 건자재 DB: 자체 구축 (핵심 데이터 자산)
  └─ Gemini Vision: 유지 (비용 대비 효율적)

[1년 후] 완전 내재화
  │
  ├─ 건자재 특화 임베딩 모델 (fine-tuned CLIP)
  ├─ 자체 GPU 서버 (NVIDIA T4, $200/월)
  ├─ 건자재 DB 5,000개+ (한국 시장 주요 제품 커버)
  └─ 월 운영비: $250~300 (API 의존도 최소)
```

---

## 6. 일정 계획

```
2026-04
├── W2 (04/10~04/13): Stage 0 - 기반 정리
│   ├── [완료] Gemini Vision 분석 API
│   ├── [완료] Vision → SelectedMaterial 변환기
│   ├── [완료] 디자인 페이지 UI 연동 (Mock 제거, API 필수)
│   ├── Supabase 복원 확인 + 동작 테스트
│   └── Vercel Pro 전환
│
├── W3 (04/14~04/20): Stage 1-A - 건자재 DB 설계 + 시드
│   ├── material_products + material_embeddings 테이블 생성
│   ├── 1순위 3개 카테고리 시드 (바닥재/타일/위생도기 각 30개)
│   ├── 제조사 카탈로그 PDF 파싱 스크립트
│   └── 관리자 건자재 관리 페이지
│
├── W4 (04/21~04/27): Stage 1-B - 건자재 크롤링 자동화
│   ├── Playwright 크롤러 (한샘/LX하우시스/동화자연마루/TOTO)
│   ├── 이미지 다운로드 + Supabase Storage 업로드
│   ├── Gemini Pro로 제품 스펙 구조화 추출
│   └── 목표: 500개 제품 확보
│
2026-05
├── W1 (04/28~05/04): Stage 2-A - YOLO 학습 데이터 준비
│   ├── Gemini Imagen 3으로 합성 인테리어 3,000장 생성
│   ├── Gemini 2.5 Pro Vision 자동 라벨링 (YOLO 포맷)
│   ├── Roboflow 수동 검수 (30%) + 데이터 증강
│   └── 오늘의집 시공사례 크롤링 5,000장 추가
│
├── W2 (05/05~05/11): Stage 2-B - YOLOv11x 학습
│   ├── Lambda Cloud A100에서 학습 (300 epochs, 1024px)
│   ├── 30클래스 감지 모델 학습 + 검증
│   ├── ONNX 변환 + 브라우저/서버 추론 테스트
│   └── 목표: mAP50 > 0.85
│
├── W3 (05/12~05/18): Stage 3 - 임베딩 매칭 엔진
│   ├── OpenAI CLIP API 연동 + 건자재 DB 전체 사전 임베딩
│   ├── pgvector 유사도 검색 + 색상/텍스처 융합 스코어
│   ├── FastAPI 추론 서버 구축 (YOLO + CLIP + OpenCV)
│   └── Top-3 매칭 정확도 검증 (목표: 80%+)
│
├── W4 (05/19~05/25): Stage 4 - 통합 + 프로덕션
│   ├── /api/project/analyze-design-precise 통합 API
│   ├── 디자인 페이지 "정밀 견적 분석" UI
│   ├── Modal.com 서버리스 GPU 배포
│   └── E2E 테스트 (다양한 스타일 × 예산 등급)
│
2026-06
├── W1~2: 정확도 개선 + 데이터 확장
│   ├── 오답 분석 → YOLO 추가 학습 (Active Learning)
│   ├── 건자재 DB 1,000개+ 확보
│   ├── 사용자 피드백 루프 구축
│   └── 내재화 1단계 시작 (open_clip 자체 서버)
```

---

## 7. 성공 지표 (KPI)

| 지표 | 현재 | Stage 2 | Stage 4 (최종) |
|------|------|---------|---------------|
| 자재 카테고리 인식률 | 70% | 90% | **95%+** |
| 실제 제품 매칭률 (Top-3) | 0% | - | **80%+** |
| 단가 오차율 | ±40% | ±25% | **±15% 이내** |
| 분석 소요 시간 | 5~10초 | 10~15초 | **15~25초** |
| 사용자 자재 수정률 | 100% | 50% | **20% 이하** |
| 건자재 DB 제품 수 | 0 | 500 | **1,000+** |

---

## 8. 월 예상 비용 요약

### 개발 기간 (4~5월)

| 항목 | 비용/월 |
|------|---------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Gemini API | $30~50 |
| OpenAI CLIP API | $20~30 |
| Google Cloud Vision | $10~20 |
| Roboflow Team | $249 |
| Lambda Cloud A100 (학습 시) | $50~100 |
| Modal.com (추론) | $30~50 |
| **합계** | **$434~544** |

### 운영 기간 (6월~, 학습/라벨링 도구 해지 후)

| 항목 | 비용/월 |
|------|---------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Gemini API | $30~50 |
| OpenAI CLIP API → open_clip | $0~30 |
| Modal.com (추론) | $30~80 |
| **합계** | **$105~205** |

### 완전 내재화 후 (1년 후)

| 항목 | 비용/월 |
|------|---------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Gemini API (Vision만) | $10~20 |
| 자체 GPU 서버 | $50~200 |
| **합계** | **$105~265** |

---

## 9. 건자재 크롤링 자동화 파이프라인 (Claude Agent + Playwright)

### 9-1. 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│  Claude Code Agent (오케스트레이터)                        │
│                                                           │
│  1. 크롤링 대상 사이트 분석 → 스크립트 자동 생성           │
│  2. Playwright 크롤링 실행 지시                            │
│  3. 수집된 원시 데이터 → Gemini Vision으로 구조화 파싱     │
│  4. 결과 검증 → Supabase DB INSERT                        │
│  5. 다음 사이트로 반복                                     │
└───────────────────┬──────────────────────────────────────┘
                    │
      ┌─────────────┼─────────────┐
      ↓             ↓             ↓
┌──────────┐ ┌──────────┐ ┌──────────────┐
│Playwright│ │Gemini    │ │Supabase      │
│크롤러    │ │Vision    │ │DB + Storage  │
│(데이터   │ │(구조화   │ │(저장)        │
│ 수집)    │ │ 파싱)    │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

### 9-2. 크롤링 대상별 전략

| 사이트 | 데이터 | 수집 방법 | 난이도 |
|--------|--------|----------|--------|
| **한샘몰** (hanssem.com) | 바닥재/주방/가구 + 가격 + 이미지 | Playwright SSR | 중 |
| **LX하우시스** (z-in.com) | 바닥재/벽지/창호 + 카탈로그 PDF | PDF 파싱 + 웹 | 중 |
| **동화자연마루** (dwflooring.co.kr) | 마루 전 제품 | 정적 크롤링 | 쉬움 |
| **TOTO** (kr.toto.com) | 위생도기 + 수전 | 정적 크롤링 | 쉬움 |
| **대림바스** (daelim-qualis.co.kr) | 위생도기/욕실 | 정적 크롤링 | 쉬움 |
| **이눅스 타일** (inuxtile.com) | 타일 전 제품 | Playwright | 중 |
| **네이버 쇼핑** | 가격 비교 + 리뷰 수 | 네이버 API | 쉬움 |
| **오늘의집** (ohou.se) | 시공사례 사진 (YOLO 학습용) | API + 크롤링 | 중 |

### 9-3. 실행 파이프라인 (1개 사이트당)

```
[Step 1] Claude Agent: 사이트 분석
  - 사이트 접속 → 제품 목록 페이지 URL 패턴 파악
  - 페이지네이션 방식 확인 (쿼리파람 / 무한스크롤 / 버튼)
  - 제품 상세 페이지 DOM 구조 파악 → CSS 셀렉터 추출

[Step 2] Claude Agent: Playwright 크롤링 스크립트 생성 + 실행
  scripts/crawlers/crawl-{brand}.ts

  실행 결과:
  raw-data/{brand}/
    ├── products.json        ← 제품 목록 (이름/URL/카테고리)
    ├── details/
    │   ├── product-001.json ← 제품 상세 (HTML 파싱)
    │   ├── product-002.json
    │   └── ...
    └── images/
        ├── product-001-thumb.jpg
        ├── product-001-texture.jpg
        └── ...

[Step 3] Gemini Vision: 구조화 파싱
  - 제품 이미지 → 색상/패턴/재질 자동 분류
  - 제품 스펙 텍스트 → 규격/단위/가격 구조화
  - 카탈로그 PDF 페이지 → 제품 정보 추출

  입력: raw-data/{brand}/details/product-001.json + images
  출력: {
    brand: "LX하우시스",
    productName: "지아소리잠 오크",
    modelNumber: "ZSJ-2045",
    specification: "1200x190x8mm",
    retailPrice: 65000,
    unit: "m²",
    categoryCode: "FLOORING",
    subCategory: "laminate",
    dominantColors: ["#8B6F47", "#A0845C"],
    patternType: "straight",
    surfaceFinish: "matte"
  }

[Step 4] Claude Agent: 검증 + DB 저장
  - 필수 필드 누락 검사 (브랜드/제품명/가격/이미지)
  - 중복 제품 검사 (model_number 기준)
  - Supabase material_products INSERT
  - 이미지 Supabase Storage 업로드
  - 결과 로그 출력
```

### 9-4. Claude Agent 자동화 스크립트 구조

```
scripts/
├── crawlers/
│   ├── crawl-config.ts          ← 사이트별 설정 (URL, 셀렉터, 페이지네이션)
│   ├── crawl-hanssem.ts         ← 한샘몰 크롤러
│   ├── crawl-lx-hausys.ts       ← LX하우시스 크롤러
│   ├── crawl-dongwha.ts         ← 동화자연마루 크롤러
│   ├── crawl-toto.ts            ← TOTO 크롤러
│   ├── crawl-ohouse.ts          ← 오늘의집 시공사례 (YOLO 학습용)
│   └── crawl-naver-shopping.ts  ← 네이버 쇼핑 가격 비교
│
├── parsers/
│   ├── parse-with-gemini.ts     ← Gemini Vision 구조화 파싱
│   ├── parse-catalog-pdf.ts     ← PDF 카탈로그 파싱
│   └── extract-colors.ts       ← 이미지 dominant color 추출
│
├── importers/
│   ├── import-to-supabase.ts    ← DB + Storage 저장
│   ├── generate-embeddings.ts   ← CLIP 임베딩 생성 + pgvector 저장
│   └── validate-products.ts     ← 데이터 품질 검증
│
└── run-full-pipeline.ts         ← 전체 파이프라인 실행
    (1회 실행으로 크롤링 → 파싱 → 검증 → 저장 → 임베딩)
```

### 9-5. 실행 방법 (Claude Code에서)

```bash
# 1. 전체 파이프라인 (특정 브랜드)
npx tsx scripts/crawlers/crawl-dongwha.ts
npx tsx scripts/parsers/parse-with-gemini.ts --source raw-data/dongwha
npx tsx scripts/importers/import-to-supabase.ts --source parsed-data/dongwha

# 2. 원커맨드 전체 실행
npx tsx scripts/run-full-pipeline.ts --brand dongwha

# 3. 전 브랜드 일괄
npx tsx scripts/run-full-pipeline.ts --all
```

### 9-6. 크롤링 주기

| 데이터 | 주기 | 이유 |
|--------|------|------|
| 신제품 추가 | 월 1회 | 제조사 신제품 출시 |
| 가격 업데이트 | 분기 1회 | 물가 변동 반영 |
| 시공사례 사진 | 주 1회 | YOLO 학습 데이터 지속 확보 |
| 단종 제품 제거 | 분기 1회 | DB 정합성 유지 |
