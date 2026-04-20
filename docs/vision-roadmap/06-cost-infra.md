# 비용 + 인프라 + 내재화 계획

> 최종 수정: 2026-04-10

---

## 1. 전체 비용 요약

### 1-1. 개발 기간 (4~5월, 약 2개월)

| 항목 | 월 비용 | 용도 | 비고 |
|------|---------|------|------|
| **Supabase Pro** | $25 | DB, Auth, Storage, pgvector | 전환 완료 |
| **Vercel Pro** | $20 | 배포, 300초 타임아웃 | 전환 필요 |
| **Gemini API** | $30~50 | Vision 분석, 이미지 생성, 자동 라벨링, 데이터 파싱 | 사용량 기반 |
| **OpenAI API** | $20~30 | CLIP 임베딩 (768d) | 제품 임베딩 + 매칭 |
| **Google Cloud Vision** | $10~20 | 텍스처/재질 분류 | 1,000장당 $1.5 |
| **Roboflow Team** | $249 | YOLO 라벨링, 데이터 증강, 버전 관리 | 학습 완료 후 해지 |
| **Lambda Cloud A100** | $50~100 | YOLO 모델 학습 (GPU) | 학습 기간만 |
| **Modal.com** | $30~50 | 서버리스 GPU 추론 | A10G, 사용량 기반 |
| **도메인** | $3 (연) | inpick.kr | 1회성 |
| **합계** | **$437~547/월** | | |

### 1-2. 운영 안정화 (6월~, 학습 도구 해지 후)

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Supabase Pro | $25 | |
| Vercel Pro | $20 | |
| Gemini API | $20~40 | 사용자 분석 요청 기반 |
| OpenAI CLIP API | $10~20 | 매칭 요청 기반 |
| Modal.com 추론 | $30~80 | 트래픽 비례 |
| **합계** | **$105~185/월** | |

### 1-3. 내재화 완료 후 (1년 후)

| 항목 | 월 비용 | 비고 |
|------|---------|------|
| Supabase Pro | $25 | |
| Vercel Pro | $20 | |
| Gemini API | $10~20 | Vision만 유지 |
| 자체 GPU 서버 | $50~200 | YOLO + CLIP 자체 추론 |
| **합계** | **$105~265/월** | API 의존도 최소 |

---

## 2. 인프라 구성

### 2-1. 현재 운영 중

```
[프론트엔드 + API]
  Vercel (Hobby → Pro 전환 필요)
  └── Next.js 14, TypeScript
  └── API Routes (서버리스)
  └── 타임아웃: 10초 → 300초 (Pro)

[DB + Auth + Storage]
  Supabase Pro
  ├── PostgreSQL 15 (pgvector 포함)
  ├── Auth (Google OAuth)
  ├── Storage (도면/이미지)
  └── Realtime (채팅/알림)

[AI]
  Google Gemini API
  └── gemini-2.5-pro, gemini-3-pro-image-preview
  └── 도면 인식, AI 상담, 이미지 생성
```

### 2-2. 추가 필요

```
[Python 추론 서버] ← 신규
  Modal.com (서버리스 GPU)
  또는 Railway/Render ($15~25/월, CPU)
  ├── FastAPI + Uvicorn
  ├── YOLOv11x (ONNX, GPU 추론)
  ├── CLIP 임베딩 (open_clip, GPU)
  ├── OpenCV (색상 분석)
  └── 건자재 매칭 엔진

[GPU 학습 환경] ← 일시적 (학습 기간만)
  Lambda Cloud A100 80GB ($1.29/hr)
  또는 Google Colab Pro+ ($49.99/월)
  └── YOLO 학습 전용

[라벨링 도구] ← 일시적
  Roboflow Team ($249/월)
  └── 데이터셋 관리 + 라벨링 + 증강
```

### 2-3. 최종 아키텍처

```
[사용자 브라우저]
    │
    ↓ HTTPS
[Vercel Pro] ────── Next.js API Routes
    │                   │
    ├── Supabase ◄──────┤  DB 쿼리, Auth, Storage
    │                   │
    ├── Gemini API ◄────┤  Vision 맥락 분석
    │                   │
    └── Modal.com ◄─────┘  YOLO + CLIP + 매칭
        (GPU 추론)
            │
            └── Supabase pgvector ◄── 건자재 DB 유사도 검색
```

---

## 3. 내재화 로드맵

### 3-1. Phase 1: API 의존 (현재 ~ +3개월)

```
원칙: "돈 써서 빠르게 품질 달성"

[외부 API]
  ├── Gemini 2.5 Pro Vision → 맥락 분석
  ├── OpenAI CLIP API → 이미지 임베딩
  ├── Google Cloud Vision → 텍스처 분류
  └── Roboflow → 라벨링 도구

[자체 보유]
  ├── YOLOv11x 모델 (학습 완료, ONNX)
  ├── 건자재 DB (500~1,000개 제품)
  ├── 물량산출 엔진 (17개 공종)
  └── 단가 DB (60+ 항목)
```

### 3-2. Phase 2: 부분 내재화 (+3~6개월)

```
전환 대상:
  OpenAI CLIP API → open_clip (ViT-L/14) 자체 서버
  Google Cloud Vision → 자체 텍스처 분류 CNN (EfficientNet-B0)
  Roboflow → 해지 (학습 완료)
  Lambda Cloud → 해지 (학습 완료)

비용 절감:
  OpenAI CLIP: $20/월 → $0 (자체 서버에 통합)
  Cloud Vision: $15/월 → $0 (자체 CNN)
  Roboflow: $249/월 → $0 (해지)
  Lambda: $75/월 → $0 (해지)
  절감 합계: ~$360/월

신규 비용:
  GPU 서버 (Railway T4): $15~25/월
  → 순절감: $335~345/월
```

### 3-3. Phase 3: 완전 내재화 (+6~12개월)

```
전환 대상:
  Modal.com → 자체 GPU 서버 (NVIDIA T4/A10, $100~200/월)
  open_clip → 건자재 특화 fine-tuned CLIP

추가 개발:
  ├── 건자재 특화 임베딩 모델 fine-tuning
  │   학습 데이터: 건자재 DB 이미지 쌍 (같은 제품 텍스처 ↔ 시공사진)
  │   방법: Contrastive Learning (InfoNCE loss)
  │   예상 개선: Top-3 정확도 +10~15%
  │
  ├── 단가 자동 업데이트 파이프라인
  │   네이버 쇼핑 API + 제조사 크롤링 → 분기 자동 갱신
  │
  └── 건자재 DB 확장 (2,000~5,000개)
      한국 시장 주요 제품 대부분 커버

최종 월 운영비:
  Supabase Pro: $25
  Vercel Pro: $20
  Gemini API (Vision): $10~20
  자체 GPU: $100~200
  합계: $155~265/월
```

---

## 4. 환경 변수 관리

### 4-1. 현재 (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # 서버 전용

# Google Gemini
GOOGLE_GEMINI_API_KEY=AIza...

# 기존 키들
JUSO_API_KEY=...
ADMIN_PASSWORD=...
CONTRACTOR_JWT_SECRET=...
```

### 4-2. Stage 1~4 추가 필요

```env
# OpenAI (CLIP 임베딩)
OPENAI_API_KEY=sk-...

# Google Cloud Vision
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Python 추론 서버
VISION_INFERENCE_URL=http://localhost:8200
# 프로덕션: VISION_INFERENCE_URL=https://inpick--vision-analyze.modal.run

# Roboflow (학습 기간만)
ROBOFLOW_API_KEY=...

# Modal.com
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...
```

### 4-3. Vercel 환경 변수 등록

```
Vercel Dashboard → Settings → Environment Variables

필수 추가:
  OPENAI_API_KEY
  VISION_INFERENCE_URL
  SUPABASE_SERVICE_ROLE_KEY
```

---

## 5. 핵심 자산 (IP)

### 5-1. 자체 보유 핵심 자산

| 자산 | 가치 | 경쟁 진입장벽 |
|------|------|-------------|
| **YOLOv11x 인테리어 자재 모델** | 30클래스 감지, 자체 학습 데이터 | 높음 (학습 데이터 10,000장+) |
| **건자재 DB** | 1,000개+ 제품, 이미지+스펙+단가 | 중간 (크롤링 가능하나 정제 비용 큼) |
| **물량산출 엔진** | 17개 공종, 60+ 단가 항목 | 중간 (전문 지식 필요) |
| **3-Layer 융합 알고리즘** | Gemini+YOLO+CLIP 교차 검증 | 높음 (노하우) |
| **건자재 특화 CLIP** (향후) | 일반 CLIP 대비 +15% 정확도 | 매우 높음 (데이터+학습 비용) |

### 5-2. 외부 의존 (대체 가능)

| 서비스 | 대체 옵션 | 전환 난이도 |
|--------|----------|------------|
| Gemini Vision | GPT-4o, Claude Vision | 쉬움 (API 교체) |
| OpenAI CLIP | open_clip (오픈소스) | 쉬움 |
| Cloud Vision | 자체 CNN, Hugging Face 모델 | 중간 |
| Modal.com | Railway, Render, 자체 서버 | 쉬움 |
| Supabase | 자체 PostgreSQL + Minio | 어려움 (마이그레이션) |

---

## 6. 스케일링 고려사항

### 6-1. 사용자 수 기준 인프라

| 월간 분석 횟수 | 인프라 | 예상 비용/월 |
|--------------|--------|-------------|
| 0~500건 | Modal.com 서버리스 | $30~50 |
| 500~2,000건 | Modal.com + 캐싱 강화 | $80~150 |
| 2,000~10,000건 | 자체 GPU 서버 (T4) | $150~300 |
| 10,000건+ | 자체 GPU 클러스터 (A10G ×2) | $400~800 |

### 6-2. 캐싱 전략

```
1. 동일 이미지 캐시: 이미지 해시 → 분석 결과 저장 (30일 TTL)
2. 유사 이미지 캐시: CLIP 임베딩 유사도 > 0.95 → 기존 결과 재활용
3. 제품 매칭 캐시: 임베딩 → Top-3 결과 캐시 (7일 TTL)
```
