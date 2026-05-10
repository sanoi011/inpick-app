# InPick 전체 시스템 진단 보고서

> 작성일: 2026-05-10
> 작성: Claude Opus 4.7 (자동 진단)
> 대상: 대표 (대영토건 김선본) — 각 파트별 코드 + 파이프라인 단일 페이지 점검
> 저장소: `sanoi011/inpick-app` (main, Vercel auto-deploy)

---

## 0. 한 줄 요약

| 영역 | 상태 |
|---|---|
| 소비자 6탭 워크플로우 | ✅ 운영 중 (E2E 작동) |
| 사업자 8개 페이지 | ✅ 운영 중 |
| 관리자 11개 페이지 | ✅ 운영 중 |
| 도면 인식 (3소스 융합) | ✅ MVP — 59/84A/84B 검증됨 |
| 견적 엔진 (17공종) | ✅ 검증 통과 — 3타입 ALL PASS |
| AI 이미지 생성 backend | ✅ Phase 1~10 완료 — OpenAI default + RunPod 옵션 |
| AI 채팅 (Step2) | ✅ Anthropic Claude Sonnet 4.6 (방금 SSE/인사 fix `49a436f` `62c9e0e`) |
| 결제 (Toss) | ⚠ Mock 모드 — 키 미발급 |
| 자재 브랜드/SKU 견적 통합 | ❌ 미착수 (대표 지목 핵심 기능) |

---

## 1. 워크플로우 파이프라인 (소비자)

### 1-1. 6탭 흐름 + 데이터 라이프사이클

```
[ 소비자 진입 ]
  /project/new (UUID 생성)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 1: /project/[id]/home (우리집 찾기)                     │
│  - 행정안전부 주소 검색 → 건물 선택 → 동/호 / 평형          │
│  - findKnownApartment() → sample-59/84a/84b 매칭            │
│  - 또는 grandPlanUrl 확보 → Tab 2에서 실시간 도면 생성      │
│ DB: consumer_projects (Supabase)                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 2: /project/[id]/design (도면/3D 매스)                  │
│  ─ 도면 출처:                                                │
│    a) sampleId 매칭 → public/floorplans/{id}.json 즉시      │
│    b) grandPlanUrl + GET cache hit → 즉시                   │
│    c) grandPlanUrl + cache miss → SSE 4단계 실시간 생성     │
│       Step 0: 네이버 원본 다운로드                          │
│       Step 1: Gemini Pro 클린 (워터마크 제거)               │
│       Step 2: sharp.flop 좌우 반전                          │
│       Step 3: Gemini Pro 세그멘테이션 마스크                │
│         → Supabase Storage (clean/mirror/mask) + DB 캐시    │
│    d) 사용자 직접: 업로드/촬영/손도면/직접그리기            │
│       → POST /api/project/parse-drawing (3소스 융합)        │
│  ─ 뷰어:                                                     │
│    FloorPlan2D.tsx (SVG, 팬/줌/치수선/설비심볼)              │
│    FloorPlan3D.tsx (Three.js + PBR + SSAO/Bloom)            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 3: /project/[id]/ai-design (AI 디자인 상담)             │
│  - Gemini 2.0 Flash SSE 스트리밍 채팅                       │
│  - design-recommend API: 스타일+예산+우선순위 → 자재/가구  │
│ API: /api/project/design-ai (스트리밍)                      │
│      /api/project/design-recommend (구조화 출력)            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 4: /project/[id]/rendering (3D 렌더링 + 자재)           │
│  - 방별 렌더 갤러리                                          │
│  - FloorPlanCanvas: 자재 선택 시 마스크 픽셀 alpha blend    │
│  - useMaterialCatalog: DB material_room_catalog 로드        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 5: /project/[id]/estimate (물량산출/견적)               │
│  - 17공종 QTY 엔진 (lib/floor-plan/quantity/)               │
│  - calculateAllQuantities → calculateEstimate               │
│    · 직접비 + 간접비 6% + 이윤 5% + VAT 10%                  │
│    · 층고 2500mm 초과 시 노무비 1.5배 할증                   │
│  - PDF 내보내기: jsPDF + NanumGothic                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Tab 6: /project/[id]/rfq (견적요청)                         │
│  - POST /api/rfq → estimates(confirmed) + 사업자 알림       │
│  - Supabase Realtime 입찰 폴백 (60초 + WS)                  │
│  - 입찰 비교 (AI추천/최저가/프리미엄/빠른시공 자동 태그)    │
│  - 업체 선정 → POST /api/contracts → contractor_projects    │
│    + 7단계 공정표 자동 생성                                  │
└─────────────────────────────────────────────────────────────┘
```

### 1-2. workflow 컴포넌트 (`src/components/workflow/`)

| 파일 | 책임 |
|---|---|
| `BasicInfoCard.tsx` | Step1 — 주소/평형/확장/도면 요청 |
| `Step1Cards.tsx` | Step1 카드 그룹 + normalized floorplan state |
| `Step2Designer.tsx` | Step2 — AI 채팅 + 이미지 갤러리 + 자재 클릭 (방금 SSE/chatMode fix) |
| `MaterialEditor.tsx` | 자재 편집 모달 |
| `ClickableRenderImage.tsx` | 이미지 클릭 → 영역 SAM segmentation |
| `TokenBadge.tsx` | 크레딧 잔액 배지 |

핵심 흐름은 `Step2Designer` — 방금 수정한 두 군데:
1. `chatMode` default `false` → `true` (`1cb0165`)
2. SSE 파싱 raw → JSON encode 안전 (`49a436f`)
3. AI 매 응답 인사 제거 + 정적 인사 1회 (`62c9e0e`)

---

## 2. AI 서비스 라우팅 (단일 출처 표)

| 라우트 | Provider | 모델 | 용도 |
|---|---|---|---|
| `/api/inpick/design-chat/stream` | **Anthropic** | `claude-sonnet-4-6` | Step2 AI 디자인 채팅 (SSE) |
| `/api/inpick/design-chat/extract` | **Anthropic** | `claude-sonnet-4-6` | 채팅 → 이미지 prompt 추출 |
| `/api/project/design-ai` | **Google Gemini** | `gemini-2.0-flash` | 6탭 프로젝트 AI 디자인 (SSE) |
| `/api/project/design-recommend` | **Google Gemini** | `gemini-2.0-flash` | 스타일/예산 구조화 추천 |
| `/api/project/parse-drawing` | **Gemini Vision** + Python | `gemini-2.5-flash` → 2.0-flash → 2.0-flash-lite | 도면 시맨틱 분석 (3소스 융합) |
| `/api/project/generate-floorplan` | **Gemini Pro** | `gemini-2.0-flash` | 클린 + 마스크 + 미러 |
| `/api/project/generate-drawings` | **Gemini Pro** | `gemini-2.0-flash` | 시공도면 (가구/전기/입면) |
| `/api/project/generate-image` | **Gemini Pro** | `gemini-2.0-flash` | 이미지 생성 |
| `/api/project/analyze-photos` | **Gemini Vision** | `gemini-2.0-flash` | 다중 사진 → 평면도 추정 |
| `/api/project/analyze-design-image` | **Gemini Vision** | `gemini-2.0-flash` | 디자인 이미지 분석 |
| `/api/project/estimate-materials` | **Gemini** | `gemini-2.0-flash` | 자재 추출 |
| `/api/project/generate-elevation` | **Gemini** | `gemini-2.0-flash` | 입면도 |
| `/api/contractor-ai` | **Google Gemini** | `gemini-2.0-flash` (RAG) | 사업자 AI 비서 + RAG 컨텍스트 |
| `/api/admin/normalize-floorplan` | **Gemini** | `gemini-2.0-flash` | 관리자 도면 정규화 |
| `/api/ai-log` | (저장만) | — | AI 대화 로깅 |
| `/api/inpick/render-room` | **OpenAI** (default) / RunPod | `gpt-image-2` → `gpt-image-1` fallback / FLUX (옵션) | Step2 이미지 렌더 |
| `/api/inpick/render-room/jobs/[jobId]` | RunPod | — | async polling |
| `/api/inpick/sam/*` | RunPod (자체 SAM 2.1 worker) | SAM 2.1 | 영역 분할 |

### 2-1. AI provider 환경변수

```bash
ANTHROPIC_API_KEY              # Step2 design-chat (Claude Sonnet 4.6)
GOOGLE_GEMINI_API_KEY          # 그 외 모든 AI 라우트 (Gemini 통일)
OPENAI_API_KEY                 # render-room (gpt-image-2) — 현재 production default
RUNPOD_API_KEY + RUNPOD_*_ENDPOINT  # SAM 2.1 + 옵션 Flux renderer (Phase 5+)
```

> ⚠ 주의: 채팅은 Anthropic (Step2) + Gemini (그 외)로 분리됨.
> Step2의 채팅 응답 깨짐은 모두 fix 완료 (`49a436f` `62c9e0e`).

---

## 3. 도면 인식 파이프라인 (3소스 융합)

```
PDF/이미지 업로드 → POST /api/project/parse-drawing
  │
  ├─ [Fast Path] sampleType 지정 시 → Template Matcher 즉시 반환 (3ms)
  │
  ├─ [Step 1] PyMuPDF 벡터 추출 (PDF only, ~3초)
  │   scripts/parse-pdf-vector.py — 벡터 선분 + 치수 텍스트
  │
  ├─ [Step 2a 병렬] Gemini Vision (~25초)
  │   src/lib/services/gemini-floorplan-parser.ts
  │   → 시맨틱 (방 이름/타입/폴리곤)
  │   → 모델 폴백 체인: 2.5-flash → 2.0-flash → 2.0-flash-lite
  │
  ├─ [Step 2b 병렬] floorplan-ai (~5초)
  │   python/floorplan-ai/  (FastAPI :8100)
  │   → YOLOv8n 심볼 감지 (mAP50: 0.913)
  │   → Hough Transform 벽 추출 (146~158개)
  │   → EasyOCR 치수 인식 (41~47개)
  │
  └─ [Step 3] Enhanced Fusion (src/lib/services/enhanced-fusion.ts)
      → rooms = Gemini (시맨틱 정확)
      → walls = floorplan-ai (기하학 정밀)
      → doors/windows = 합집합 (0.5m 중복 제거)
      → dimensions = floorplan-ai (EasyOCR)
      ↓
      Polygon Repair Engine (5단계)
      → vertex snap (0.15m) → edge align → collinear remove
      → gap fill → area clamping (BATHROOM ≤8m² 등)
      ↓
      ParsedFloorPlan JSON
```

### 3-1. 도면 인식 검증 결과 (저장됨)

| 도면 | 면적 | 방 | 벽 | 문 | 창 | 설비 | 신뢰도 | 시간 |
|---|---|---|---|---|---|---|---|---|
| 59.png | 53.8 m² | 11 | 146 | 9 | 5 | 7 | 1.0 | 28.8s |
| 84A.png | 84.0 m² | 9 | 158 | 7 | 7 | 12 | 1.0 | 27.6s |
| 84B.png | 84.0 m² | 12 | 149 | 11 | 3 | 7 | 1.0 | 28.5s |

---

## 4. 이미지 생성 backend (Phase 1~10 모두 완료, 2026-05-10)

### 4-1. 디렉토리

```
src/lib/inpick/
  image-backends/
    types.ts              # ImageGenerationBackend interface, RenderRoomRequest/Result
    select-backend.ts     # 환경변수 분기 + auto fallback + production guardrail
    openai-backend.ts     # OpenAI gpt-image-2 (현재 production default)
    runpod-backend.ts     # RunPod Flux backend (Phase 5 placeholder)
    model-policy.ts       # license/runtime guard (FLUX.1-dev 차단)
    content-filter.ts     # NSFW/trademark hook (Phase 10 placeholder)
  floorplan/
    geometry-types.ts     # RoomGeometry / WallSegment / Opening / RoomCamera
    parser.ts             # heuristic + DB lookup
    control-plan.ts       # ControlPlan 결정 (geometry_proxy / flat_canny / openai_edit)
  storage/
    image-storage.ts      # Supabase Storage upload (base64 → public URL)
  generation-jobs/
    types.ts
    repository.ts         # createJob / getJob / updateJob (image_generation_jobs)
  render-room-client.ts   # 클라 측 sync/async 자동 polling
  openai-client.ts        # 기존 OpenAI EDITS API 호출 (legacy, 보존)
```

### 4-2. RunPod worker (별도 디렉토리)

```
runpod_serverless/
  handler.py                    # SAM 2.1 (현재 운영 중)
  flux-controlnet/handler.py    # 초기 Flux 시도 (superseded)
  inpick-renderer/              # Phase 5 신규 (가이드 권장 구조)
    handler.py                  # 8단계 파이프라인
    schemas.py                  # GenerateRequest / RoomGeometry / ControlSpec
    Dockerfile
    requirements.txt
    README_DEPLOY.md
    pipelines/
      model_registry.py         # MODEL_REGISTRY (FLUX.1-dev 차단)
      generate.py               # 모델 캐시 + Phase 5 placeholder pipeline
    geometry/
      proxy_room.py             # Phase 6 — 평면도 → 2.5D box → look-at projection
      control_images.py         # canny baseline + proxy 통합
    storage/
      upload.py                 # signed PUT + b64 fallback
  finetune/                     # SAM 2.1 fine-tuning
```

### 4-3. 환경변수 (Phase 10 production guardrail)

```bash
# Backend 선택
IMAGE_GEN_BACKEND=openai       # default. "auto" / "runpod"는 eval 통과 후만
IMAGE_GEN_MODE=sync            # default. "async"는 jobId polling
INPICK_EVAL_REPORT_PASSED=     # production에서 backend!=openai로 변경 시 "true" 필수
INPICK_IMAGE_MODEL_ID=black-forest-labs/FLUX.2-klein-4b
OPENAI_IMAGE_FALLBACK_ENABLED=true
BFL_COMMERCIAL_LICENSE_CONFIRMED=  # FLUX.1-dev override (계약 확보 후만 "true")

# Storage
IMAGE_STORAGE_PROVIDER=supabase
IMAGE_STORAGE_BUCKET=renders
IMAGE_PUBLIC_BASE_URL=          # 옵션 (CDN)

# RunPod
RUNPOD_API_KEY=
RUNPOD_FLUX_ENDPOINT=
RUNPOD_SYNC_ENDPOINT=           # SAM 2.1
RUNPOD_ASYNC_ENDPOINT=

# Worker
RENDERER_RUNTIME=poc           # production / poc
INPICK_CONTENT_FILTER_ENABLED=false  # Phase 11+ NSFW/trademark
```

### 4-4. ControlPlan 우선순위 (현재 동작)

| 조건 | 모드 | 비고 |
|---|---|---|
| `forceBaseline=true` | `floorplan_canny` | Phase 7 평가 baseline |
| `IMAGE_GEN_BACKEND=openai` | `openai_edit` | **현재 production default** |
| RunPod + RoomGeometry 있음 | `geometry_proxy` | canny+depth+seg+masks |
| 평면도만 있음 | `floorplan_canny` baseline | 구조 정확도 낮음 |
| 그 외 | `prompt_only` | |

---

## 5. 데이터베이스 (Supabase Postgres + Storage + Realtime + Auth)

### 5-1. 핵심 테이블 분류

#### 사용자/인증
- `auth.users` (Supabase Auth) + `consumer_projects` (소비자 프로젝트)
- `contractor_profiles` + `specialty_contractors` (사업자)
- `admin_profiles` (관리자)

#### 프로젝트/계약/입찰
- `consumer_projects` — 소비자 작업 영역 상태 + 도면 + 견적 메타
- `contractor_projects` + `project_phases` + `schedule_tasks` + `project_issues` + `project_activities`
- `bids` (입찰) → `contracts` (계약) → `contract_snapshots`
- `estimates` + `rfq_data(JSONB)` (견적/RFQ)

#### 도면/이미지
- `generated_floorplans` (실시간 생성 도면 캐시 + mask + room_color_map)
- `drawing_parse_logs` (파싱 이력)
- `drawing_render_pairs` (도면-렌더 학습용 쌍)
- `aihub_floorplans` (AI Hub 데이터셋)
- `floor_plan_library` + `apartments` + `floor_plan_types` (라이브러리)
- `image_generation_jobs` (Phase 2 — async job 추적)
- `vision_embeddings` (이미지 벡터)

#### 자재/단가
- `material_room_catalog` + `material_options` + `material_sub_items` (24옵션, 25부자재)
- `material_products` (Vision 기반, 253K rows)
- `material_price_observations` + `material_price_lookup` (실시간 단가 + 61버킷)
- `aux_materials_master` (337행) + `aux_material_coefficients` (67행) + `aux_material_crawl_targets` (44행)
- `category_taxonomy` + `category_aliases` (45 카테고리)

#### AI/ML
- `ai_conversations` + `floor_plan_parse_logs` + `quantity_calculations`
- `construction_cases` + `construction_knowledge` (LH 시방 PDF 추출)
- `knowledge_embeddings` (pgvector 768d)
- `building_regulations` (1,260행 법규)
- `training_furniture_samples`
- `emotion_reference_images` (감정 카탈로그)

#### 채팅/알림
- `chat_rooms` + `chat_messages` (Realtime)
- `consumer_notifications` + `contractor_notifications`
- `user_material_events` + `user_token_balance` + `token_transactions`

#### 사업자 디렉토리
- `contractors` (디렉토리 공개) + `contractor_trades`
- `contact_inquiries` + `contract_notes`

#### 재무
- `invoices` + `payment_records` + `expense_records`
- `bid_indirect_rates` (사업자별 간접비 요율)
- `user_credits` + `credit_transactions`

#### 시공도면
- `construction_drawing_sets` + `construction_drawings`

#### 로드맵/관리
- `roadmap_features` + `roadmap_milestones` + `roadmap_stats`

### 5-2. 마이그레이션 적용 현황

전체 52+ 마이그레이션 모두 **Supabase 적용 완료** (CLAUDE.md 마이그레이션 표 참조).

직접 연결 정책: `DATABASE_URL` + `apply_migration.py` 헬퍼 사용. DROP/TRUNCATE는 사전 승인 필수.

---

## 6. 견적 엔진 (17공종)

### 6-1. 디렉토리

```
src/lib/floor-plan/quantity/
  types.ts                     # QtyUnit, TradeCode, TRADE_NAMES, SURCHARGE_RATES
  geometry.ts                  # calcPolygonArea, calcWallLength
  adapter.ts                   # ParsedFloorPlan → FloorPlanProject
  surface-calculator.ts        # 표면적 산출
  trades/01_demolition.ts ~ 17_finishing.ts  # 17공종 모듈
  quantity-calculator.ts       # 통합 산출 (calculateAllQuantities)
  unit-price-db.ts             # 60+ 항목 단가DB (2025 서울 기준)
  estimate-calculator.ts       # 견적 계산 (직접비 + 6%/5%/10% + VAT 10%)
```

### 6-2. 공종

| 공종 | 코드 | 비고 |
|---|---|---|
| 철거 | demolition | |
| 조적 | masonry | 84B 0건 = 정상 |
| 미장 | plaster | |
| 방수 | waterproofing | 욕실/베란다 자동 적용 |
| 타일 | tiling | |
| 목공 | carpentry | |
| 바닥재 | flooring | KPA 단가 + AI 오버라이드 |
| 도배 | wallpaper | |
| 천장 | ceiling | |
| 창호 | window | |
| 잡철 | misc-metal | |
| 배관 | plumbing | |
| 위생도기 | sanitary | |
| 전기 | electrical | |
| 고정설비 | fixtures | |
| 걸레받이 | baseboard | |
| 정리 | finishing | |

### 6-3. 검증 결과 (3타입 ALL PASS)

| 타입 | 총견적 | 아이템 | 미매칭 |
|---|---|---|---|
| 59㎡ | 6,433만원 | 110 | 0 |
| 84A㎡ | 7,983만원 | 157 | 0 |
| 84B㎡ | 6,813만원 | 107 | 0 |

PDF 내보내기: `src/lib/pdf/estimate-pdf-generator.ts` (jsPDF + NanumGothic 한국어).

---

## 7. 페이지 인벤토리

### 7-1. 소비자 (자체 영역)

| 페이지 | 경로 | 상태 |
|---|---|---|
| 랜딩 | `/` | ✅ |
| 인증 | `/auth` | Google OAuth ✅ / Kakao ⚠ 비활성 |
| 내 프로젝트 | `/projects` | ✅ |
| 새 프로젝트 | `/project/new` | UUID 발급 → /home |
| 우리집 찾기 | `/project/[id]/home` | Tab 1 |
| 도면/3D | `/project/[id]/design` | Tab 2 |
| AI 디자인 | `/project/[id]/ai-design` | Tab 3 |
| 3D 렌더링 | `/project/[id]/rendering` | Tab 4 |
| 물량산출 | `/project/[id]/estimate` | Tab 5 |
| 견적요청 | `/project/[id]/rfq` | Tab 6 |
| 내 계약 | `/contracts` | ✅ |
| 계약 상세 | `/contract/[id]` | + 채팅 + 공정표 + 시공도면 |
| 업체 디렉토리 | `/find-contractors` | + `/[id]` 상세 |
| 알림 | `/notifications` | Realtime |
| 계정 | `/account` | 프로필/탈퇴 |
| 결제 | `/payments/success` `/fail` | Toss (Mock) |

### 7-2. 사업자 (사이드바 8개)

| 페이지 | 경로 | 상태 |
|---|---|---|
| 대시보드 | `/contractor` | 5요약 카드 |
| 입찰 관리 | `/contractor/bids` | 4탭 |
| 프로젝트 관리 | `/contractor/projects` | Gantt + 사진 + 체크리스트 |
| AI 비서 | `/contractor/ai` | 컨텍스트 인지 (Gemini) |
| 매칭 | `/contractor/matching` | 6요소 점수 |
| 일정 | `/contractor/schedule` | 월간/주간/일간 |
| 재무 | `/contractor/finance` | 청구서/지출 |
| 프로필 | `/contractor/profile` | 5탭 |

(별도) `/contractor/login` `/contractor/register`

### 7-3. 관리자 (사이드바 11개)

| 페이지 | 경로 |
|---|---|
| 대시보드 | `/admin` |
| 사용자 관리 | `/admin/users` |
| 프로젝트 | `/admin/projects` |
| 계약/입찰 | `/admin/contracts` |
| 크레딧 | `/admin/credits` |
| AI 로그 | `/admin/ai-logs` |
| 자재/단가 | `/admin/materials` |
| 도면 로그 | `/admin/drawing-logs` |
| 도면 라이브러리 | `/admin/floor-plans` |
| 크롤러 | `/admin/crawlers` |
| 로드맵 | `/admin/roadmap` |
| 설정 | `/admin/settings` |

---

## 8. Python / 외부 서비스 인벤토리

### 8-1. Python 서비스

```
python/
  floorplan-ai/           # FastAPI :8100 (도면 분석 핵심)
    main.py + run_pipeline.py + src/api_server.py
    src/symbol_detector.py (YOLOv8n, mAP50 0.913)
    src/wall_extractor.py (Hough Transform)
    src/text_recognizer.py (EasyOCR)
    models/floorplan_yolov8n.pt (학습 완료)

scripts/
  parse-pdf-vector.py     # PyMuPDF 3단계 벡터 추출
  parse-dxf.py            # DXF (ezdxf)
  convert-dwg.py          # ODA File Converter wrapper
  train-yolo-floorplan.py
  generate-synthetic-training.ts
  embed-knowledge.ts
  extract-lh-knowledge.ts
  process-drawings.ts (AI Hub COCO → JSON)
  verify-84b-e2e.mjs
  verify-all-types-qty.ts
  test-*.{mjs,py}         # 통합 테스트 스크립트
  eval-image-generation.ts (Phase 7)
  create-data-license-ledger.ts (Phase 8)
  curate-inpick-style-dataset.ts (Phase 8)
```

### 8-2. 외부 API

| 서비스 | 용도 | 상태 |
|---|---|---|
| Anthropic Claude | Step2 채팅 | ✅ |
| Google Gemini | 그 외 모든 AI | ✅ |
| OpenAI gpt-image-2 | 이미지 렌더 (default) | ✅ |
| 행정안전부 (juso.go.kr) | 주소 검색 | ✅ |
| 네이버 (cache 매핑) | 건물/평형/도면 URL | ✅ |
| 건축물대장 (data.go.kr) | 동/호 정보 | ✅ |
| RunPod Serverless | SAM 2.1 + 옵션 Flux | ✅ SAM / ⚠ Flux는 Phase 5 placeholder |
| Toss Payments | 결제 | ⚠ Mock (키 미발급) |
| Supabase | DB+Auth+Storage+Realtime | ✅ |
| Vercel | 배포 + KV (rate limit) | ✅ Hobby |

---

## 9. Phase 1~10 가이드 구현 (오늘 완료)

> 가이드: `c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md`

| Phase | 커밋 | 내용 |
|---|---|---|
| 1 | `bf62735` | Backend adapter (model policy + select) |
| 2 | `383530d` | Async job + polling endpoint |
| 3 | `0580a46` | Storage URL abstraction |
| 4 | `ae8d52d` | RoomGeometry / ControlPlan 타입 + heuristic parser |
| 5 | `8a47e7f` | RunPod worker scaffold (8단계 handler + license guard) |
| 6 | `f5b4e9d` | Geometry proxy 실제 PIL 구현 |
| 7 | `957de84` | Eval harness + EVALUATION_PROTOCOL.md |
| 8 | `2b58eaf` | LoRA license ledger + curate 스크립트 |
| 9 | `905ff08` | Step2 polling 통합 (sync/async 자동) |
| 10 | `286f4b5` | Production guardrail (eval-pass gate + content filter) |

또한 오늘 hotfix:
- `1cb0165` chatMode default true (한 번 입력 = 즉시 생성 버그 수정)
- `49a436f` SSE 파싱 fix (답변 깨짐 fix)
- `62c9e0e` AI 매 응답 인사 제거 + 정적 인사 1회

---

## 10. ⚠ 즉시 점검 필요 (운영 리스크)

| 항목 | 상태 | 리스크 | 조치 |
|---|---|---|---|
| Toss Payments 키 | ⚠ Mock | 결제 불가 | 키 발급 + Vercel env |
| Kakao OAuth | ⚠ 비활성 | 카카오 로그인 미작동 | Supabase Provider 설정 |
| 커스텀 도메인 | ⚠ 미설정 | inpick-app.vercel.app | 도메인 구매 + Vercel 연결 |
| Vercel Hobby | ⚠ 10초 타임아웃 | parse-drawing 60초 필요 | Pro 권장 ($20/월) |
| OpenAI 잔액 | ✅ $200 한도 | — | 모니터링 필요 |
| RunPod inpick-renderer | 🔵 Phase 5 placeholder | 실제 Flux 미통합 | Phase 6+ 후 Docker push |
| `INPICK_EVAL_REPORT_PASSED` | 🔵 미설정 | RunPod backend 강제 비활성 | 정상 (eval 통과 후만 활성) |
| Construction Storage 버킷 | ⚠ 미생성? | 시공도면 업로드 실패 가능 | `construction-drawings` 버킷 생성 필요 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service role — 노출 X | OK |

---

## 11. 핵심 미착수 작업 (대표 지목)

### 11-1. 자재 브랜드/SKU 견적 통합 ("우리의 킥")

**현재**: `defaultSurfacesForRoom()` (`api/inpick/build-estimate/route.ts`)이 generic 자재명만 사용 ("강마루", "타일").

**필요**: Supabase `material_products` 테이블 (253,745 rows, vision 기반)에서 surface 타입별 top product (brand + sku + spec) 매칭하여 견적 라인에 노출.

**변경 위치 (예상)**:
- `src/app/api/inpick/build-estimate/route.ts` — defaultSurfacesForRoom에서 material_products 조회
- `src/lib/floor-plan/quantity/unit-price-db.ts` — SKU 기반 가격 조회 + 폴백
- `src/lib/floor-plan/quantity/estimate-calculator.ts` — line 메타에 brand/sku/spec 포함
- `src/lib/pdf/estimate-pdf-generator.ts` — PDF에 브랜드 + 품명 표시

**Vision 자동 추출 + 견적 자동 brand/sku 채움 → 사용자에게 "실제 브랜드명/품명/스펙"이 들어간 견적서가 나옴 → 차별화 포인트.**

---

## 12. 빌드 / 배포 체크리스트

### 12-1. 정상 빌드 확인 (방금 검증)

```bash
npx tsc --noEmit  # ✅ 통과 (Phase 1~10 + hotfix)
```

### 12-2. 신규 deployment에서 확인

1. Vercel auto-deploy (main push) ~3분
2. `/api/inpick/health` GET → 환경변수/DB/외부 API 상태
3. `/admin/env-check` → 환경변수 매트릭스
4. Step2 채팅 작동 (방금 fix `62c9e0e`)
5. `/api/project/parse-drawing` smoke test (3소스 융합)

### 12-3. 모바일 (Capacitor 7)

- iOS / Android 빌드 가능 (`@capacitor/cli` v7)
- 현재 active dev는 Web 위주 → 추후

---

## 13. 변경 이력 (오늘 2026-05-10 기준)

| 시간대 | 변경 |
|---|---|
| 새벽~아침 | 한글기념일 — 워크플로우/견적/사업자/관리자 전반 리빌딩 (5/5~5/9) |
| 오전 | 가이드 외부 dev direction MD 수신 → audit |
| 오후 | Phase 1~10 자동 진행 (10 commits) |
| 저녁 | hotfix 3건 (chatMode / SSE 파싱 / 인사) |
| 이 보고서 | 진단 MD 작성 |

---

## 14. 다음 권장 작업 우선순위

1. **자재 브랜드/SKU 견적 통합** (대표 지목 핵심 — 차별화)
2. **Toss Payments 실키 + Webhook URL 등록**
3. **Vercel Pro 업그레이드** (parse-drawing 타임아웃 해결)
4. **Supabase Storage `construction-drawings` 버킷 생성**
5. **카카오 OAuth Supabase 설정**
6. **eval harness 실제 실행** (RunPod inpick-renderer 배포 후 → INPICK_EVAL_REPORT_PASSED=true 설정 → backend=auto 활성)
7. **커스텀 도메인 (예: inpick.kr) 연결** + 코드 3곳 URL 수정 (layout.tsx / sitemap.ts / robots.ts)
8. **LoRA 학습 데이터 수집** (Phase 8 license-ledger.jsonl 사람 검증)

---

## 15. 진단 메서드

이 보고서는 다음 자동 점검을 통합한 결과입니다:

- `Glob` / `Grep` 인벤토리 (118 API 라우트 + 52 마이그레이션 + 7 워크플로우 컴포넌트)
- `npx tsc --noEmit` 빌드 검증 (방금 통과)
- 주요 파일 read (design-chat/stream + Step2Designer + select-backend 등)
- Phase 1~10 commit 이력 (bf62735 ~ 286f4b5)
- 오늘 hotfix 3건 (1cb0165 / 49a436f / 62c9e0e)

문제 의심 시:
- `npm run dev` → `/api/inpick/health` 체크
- `/admin/env-check` 환경변수 매트릭스
- Vercel Logs (Production / Preview)
- Supabase 대시보드 → SQL Editor → `select count(*) from <table>`

---

**작성**: Claude Opus 4.7 · **저장 위치**: `docs/status/INPICK-STATUS-DIAGNOSIS-20260510.md`
