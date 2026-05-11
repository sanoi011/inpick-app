# InPick 전체 파이프라인 인계 보고서

> 작성일: 2026-05-11
> 작성: Claude Opus 4.7
> 대상: 대표 (대영토건 김선본)
> 범위: 2026-05-10 ~ 2026-05-11 세션에서 짠 모든 파이프라인, 모든 commit
> 저장소: `sanoi011/inpick-app` (main)

---

## 0. 작업 전체 commit 매트릭스 (최신 → 과거)

| Commit | 분류 | 내용 |
|---|---|---|
| `5108a0a` | fix | storage Bucket not found → base64 fallback graceful |
| `59e8b1a` | feat | Step2 캔버스 상단 Step1 선택 정보 행 |
| `c3a38bd` | style | Step2 ChatGPT 스타일 (좌측 베이지 + 메인 #F8F9F6 + 둥근 입력바) |
| `120e8e9` | fix | Step1 raw 도면 깜빡임 + Step2 채팅 스크롤 + extract 실패 |
| `884d600` | feat | Vision-Materials Phase 2/3-후속/6-후속/7 |
| `82464c5` | feat | Vision-Materials Phase 0~8 (mock 모드 전체) |
| `3d1873e` | chore | Gemini 제거 Phase C~H (Claude 교체 + 도면 fallback + env) |
| `611a9e9` | chore | Gemini 제거 Phase A+B (라우트 4개 삭제 + model-registry) |
| `9ce6827` | feat | 자재 brand/SKU 자동 매칭 — material_products 253K |
| `6c15888` | docs | 인픽 전체 시스템 진단 보고서 (2026-05-10) |
| `62c9e0e` | fix | AI 매 응답 인사 제거 + 정적 인사 1회 |
| `49a436f` | fix | SSE 파싱 버그 (답변 깨짐/잘림) |
| `1cb0165` | fix | chatMode default true (한 번 입력 = 즉시 생성 버그) |
| `286f4b5` | feat | Phase 10 — production guardrail |
| `905ff08` | feat | Phase 9 — Step2 polling 통합 |
| `2b58eaf` | feat | Phase 8 — Style LoRA data license ledger |
| `957de84` | feat | Phase 7 — image generation eval harness |
| `f5b4e9d` | feat | Phase 6 — Geometry proxy 실제 PIL 구현 |
| `8a47e7f` | feat | Phase 5 — RunPod worker scaffold |
| `ae8d52d` | feat | Phase 4 — RoomGeometry / ControlPlan 타입 |
| `0580a46` | feat | Phase 3 — Storage URL abstraction |
| `383530d` | feat | Phase 2 — async job + polling |
| `bf62735` | feat | Phase 1 — backend adapter + model policy guard |

총 **23개 commit**.

---

## 1. 전체 파이프라인 다이어그램 (생성)

```
┌──────────────────────────────────────────────────────────────────┐
│ Step1 — 우리집 찾기                                                │
│ /project/[id]/home + /workflow Step1                              │
│                                                                   │
│ 사용자 입력: 주소 (juso.go.kr)                                     │
│ → Building API (data.go.kr 건축물대장 + 네이버 cache)             │
│ → 동/호/평형 선택                                                  │
│ → 확장형/기본형 선택                                                │
│        ↓                                                          │
│ proceedWithBuilding(building, expanded):                          │
│   setFloorPlanImageUrl(null) ← 블라인드 (raw 깜빡임 차단)         │
│   ① manifest 캐시 확인 → 즉시 표시                                 │
│   ② DB 캐시 (generated_floorplans) → finalUrl 즉시                │
│   ③ Gemini 비활성 시 → 원본 grandPlanUrl (워터마크 포함, graceful)│
│   ③ Gemini 활성 시 → SSE 4단계 파이프라인                         │
│      Step 0: 네이버 원본 다운로드                                  │
│      Step 1: Gemini Pro 클린 (워터마크 제거)                       │
│      Step 2: sharp.flop 좌우 반전                                  │
│      Step 3: Gemini Pro 세그멘테이션 마스크 (방별 색상)             │
│      → Supabase Storage 업로드 + DB 캐시                          │
│        ↓                                                          │
│ ParsedFloorPlan + cleanedImageUrl + mask + roomColorMap           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ Step2 — AI 디자인 (Step2Designer.tsx)                             │
│ /workflow                                                         │
│                                                                   │
│ ChatGPT 스타일 레이아웃 (2026-05-11):                              │
│   ┌──────────┬───────────────────────────────────────┐            │
│   │ 베이지   │ #F8F9F6 메인 캔버스                    │            │
│   │ 사이드바 │ ┌─Step1 정보 행 (주소/단지/평형/예산)─┐│            │
│   │ - 전체   │ │AI 디자인 챗 헤더 + 토글            ││            │
│   │ - 방선택 │ │채팅 메시지 (스크롤만)              ││            │
│   │ - 토큰   │ │디자인 생성하기 버튼                ││            │
│   │ - 진행   │ │[ 둥근 입력바 ] [⊙ 전송]           ││            │
│   └──────────┴───────────────────────────────────────┘            │
│                                                                   │
│ 두 가지 모드 (chatMode default true):                              │
│  A) AI 상담 (chatMode=true):                                      │
│     - 정적 인사 1회 (페이지 진입 시)                                │
│     - 사용자 입력 → /api/inpick/design-chat/stream                │
│       · Anthropic Claude Sonnet 4.6 SSE                          │
│       · system: "인사말 금지" + 인테리어 전문가 프롬프트            │
│       · JSON-encoded SSE (텍스트 \n 안전)                         │
│     - 1턴 이상 대화 후 "이 컨셉으로 디자인 생성하기" 활성          │
│       · /api/inpick/design-chat/extract → 영문 prompt 추출         │
│       · Claude 실패 시 → buildFallbackPrompt (한국어 키워드 매핑)  │
│       · handleBulkGenerate(image_prompt) — 비어있는 방 일괄        │
│  B) 즉시 생성 (chatMode=false):                                   │
│     - 입력바 엔터 → handleGenerate / handleBulkGenerate           │
│                                                                   │
│ 이미지 생성 호출:                                                  │
│   renderRoomViaClient() — src/lib/inpick/render-room-client.ts    │
│   → POST /api/inpick/render-room                                  │
│                                                                   │
│ 자재 분석:                                                         │
│   "AI 자재 분석 (Top-3 후보)" 버튼 → VisionMaterialPicker 모달    │
│   → POST /api/inpick/vision-materials/analyze                     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ /api/inpick/render-room (POST)                                    │
│                                                                   │
│ 1. 토큰 차감 (enforceConsume)                                      │
│ 2. Rate limit (Vercel KV)                                         │
│ 3. floorplanImageUrl 확보 (propertyId → Storage)                  │
│ 4. ControlPlan 결정 (buildControlPlan):                            │
│    - IMAGE_GEN_BACKEND=openai (default) → openai_edit             │
│    - runpod + geometry → geometry_proxy                            │
│    - 평면도만 → floorplan_canny baseline                           │
│ 5. Backend dispatch (renderRoomViaBackend):                       │
│    - openai-backend → gpt-image-2 → gpt-image-1 fallback          │
│    - runpod-backend → inpick-renderer (Phase 5+)                  │
│ 6. Async mode (IMAGE_GEN_MODE=async): jobId 반환                  │
│    - GET /api/inpick/render-room/jobs/[jobId] polling             │
│ 7. base64 → ensureStorageUrl(image)                               │
│    - 성공: Supabase Storage public URL                            │
│    - 실패 (Bucket not found 등): base64 fallback (graceful)       │
│    - IMAGE_STORAGE_STRICT=true: 실패 시 502                       │
│ 8. 응답: { imageUrl, model, costUsd, jobId? }                     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ /workflow/estimate (견적 페이지)                                  │
│                                                                   │
│ rooms[] + renderImageUrl → POST /api/inpick/build-estimate        │
│                                                                   │
│ 우선순위 (build-estimate route.ts):                                │
│   1순위: visionAnalysisByRoom (vision-materials analyze 결과)     │
│         · confirmed/recommended → MaterialItem (brand+sku+spec)   │
│   2순위: extractMaterialsFromRender (legacy vision)               │
│   3순위: defaultSurfacesForRoom (KPA 표준 자재)                    │
│                                                                   │
│ enrichWithBrandSku(surfaces, roomName):                           │
│   각 surface에 lookupMaterialProduct() 호출                        │
│   → material_products 253K 매칭 → brand/sku/spec/카탈로그 단가     │
│                                                                   │
│ buildRoomEstimate(): 17공종 산출                                   │
│   - 직접비 + 간접비 6% + 이윤 5% + VAT 10%                         │
│   - 층고 2500mm 초과 → 노무비 1.5배 할증                            │
│                                                                   │
│ 응답: estimates + matchMetaByRoom (UI 배지용)                     │
│                                                                   │
│ 견적표 UI:                                                         │
│   ConsolidatedRow 자재명 셀:                                       │
│     [브랜드 뱃지] [SKU 뱃지] [확정 X% / 추천 X% / 기본] [방]      │
│   PDF 내보내기: jsPDF + NanumGothic                                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ /api/rfq → estimates(confirmed) + contractor_notifications        │
│ 사업자 입찰 (Realtime) → contracts → contractor_projects + 공정표 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 디렉토리 인벤토리 (신규/수정 파일)

### 2-1. AI 정책 (Gemini 제거)

```
src/lib/ai/
├── model-registry.ts          [신규 611a9e9] AI_PROVIDER_POLICY 정책 + assertAIProviderAllowed
└── anthropic-stream.ts        [신규 3d1873e] Claude SSE 공용 헬퍼 + Mock fallback

src/lib/gemini-client.ts       [수정 3d1873e] 정책 차단 통합 — 항상 null 반환

src/app/api/admin/normalize-floorplan/  [삭제 611a9e9]
src/app/api/project/generate-image/     [삭제 611a9e9]
src/app/api/project/design-recommend/   [삭제 611a9e9]
src/app/api/project/gemini-status/      [삭제 611a9e9]
```

### 2-2. Image Generation Backend (Phase 1~10)

```
src/lib/inpick/image-backends/
├── types.ts                   [신규 bf62735, 수정 ae8d52d] ImageGenerationBackend 인터페이스
├── select-backend.ts          [신규 bf62735, 수정 286f4b5] renderRoomViaBackend + production guardrail
├── openai-backend.ts          [신규 bf62735] OpenAI gpt-image-2 호출 래퍼
├── runpod-backend.ts          [신규 bf62735, 수정 0580a46] RunPod placeholder (Phase 5+)
├── model-policy.ts            [신규 bf62735] MODEL_POLICIES + assertModelAllowedForRuntime
└── content-filter.ts          [신규 286f4b5] NSFW/trademark hook placeholder

src/lib/inpick/floorplan/      [신규 ae8d52d]
├── geometry-types.ts          RoomGeometry / WallSegment / Opening / RoomCamera
├── parser.ts                  heuristic 사각형 룸 + DB lookup placeholder
└── control-plan.ts            ControlPlan + buildControlPlan + handler 직렬화

src/lib/inpick/storage/
└── image-storage.ts           [신규 0580a46, 수정 5108a0a] uploadRenderImage + ensureStorageUrl
                               + 버킷 자동 생성 + graceful base64 fallback

src/lib/inpick/generation-jobs/  [신규 383530d]
├── types.ts                   ImageGenerationJob + ImageGenerationJobRow
└── repository.ts              createJob / getJob / updateJob (image_generation_jobs)

src/lib/inpick/
├── render-room-client.ts      [신규 905ff08] sync/async 자동 polling 클라
└── material-product-lookup.ts [신규 9ce6827] material_products lookup (Surface→Category)

src/app/api/inpick/render-room/
├── route.ts                   [수정 bf62735, 0580a46, 383530d, 286f4b5]
└── jobs/[jobId]/route.ts      [신규 383530d] async polling endpoint
```

### 2-3. RunPod Workers

```
runpod_serverless/
├── handler.py                 (SAM 2.1 기존 — 변경 없음)
├── flux-controlnet/           (이전 superseded)
├── finetune/                  (SAM fine-tune)
├── inpick-renderer/           [신규 8a47e7f, 수정 f5b4e9d]
│   ├── handler.py             8단계 파이프라인 (Phase 5 placeholder)
│   ├── schemas.py             GenerateRequest / RoomGeometry / ControlSpec
│   ├── Dockerfile             CPU base
│   ├── requirements.txt
│   ├── README_DEPLOY.md
│   ├── pipelines/
│   │   ├── model_registry.py  license/runtime guard (FLUX.1-dev 차단)
│   │   └── generate.py        모델 캐시 + placeholder pipeline
│   ├── geometry/
│   │   ├── proxy_room.py      [Phase 6 f5b4e9d] PIL/numpy 실제 perspective 렌더
│   │   └── control_images.py  canny baseline + proxy 통합
│   └── storage/
│       └── upload.py          signed PUT + b64 fallback
└── vision-materials/          [신규 82464c5, 수정 884d600]
    ├── handler.py             GroundingDINO+SAM2+OpenCLIP+EasyOCR (Phase 후속)
    ├── schemas.py             WorkerRequest / WorkerResponse
    ├── Dockerfile             CPU base
    ├── Dockerfile.gpu         nvidia/cuda + open_clip + easyocr
    ├── requirements.txt
    ├── README_DEPLOY.md
    ├── pipelines/{detect,segment,embed,ocr,color_texture}.py
    └── storage/upload.py
```

### 2-4. Vision Material Matcher 트랙

```
src/lib/vision-materials/      [신규 82464c5]
├── types.ts                   SurfaceType / MaterialProductCandidate / EstimateLineMaterialMeta
├── category-map.ts            Surface→Category (욕실 floor → BATH_TILE 등)
├── confidence.ts              점수 가중합 + decideMaterialMatch
├── repository.ts              observations/candidates/decisions/links CRUD
├── product-retrieval.ts       Top-K vector similarity (또는 popularity fallback)
├── product-reranker.ts        색상/OCR 매칭 보강
├── price-resolver.ts          material_price_lookup → contractor_price → ...
├── worker-client.ts           RunPod hit (mock fallback)
└── estimate-bridge.ts         AnalyzedSurface → 견적 metadata + PDF label

src/app/api/inpick/vision-materials/
├── analyze/route.ts           POST 8단계 파이프라인
├── jobs/[jobId]/route.ts      GET polling
└── candidates/route.ts        GET 후보 + POST 사용자 선택

src/app/api/admin/vision-materials/
├── stats/route.ts             diagnostics
└── eval/route.ts              run_id별 metrics

src/hooks/useVisionMaterials.ts        [신규 884d600] analyze + selectCandidate 클라
src/components/workflow/VisionMaterialPicker.tsx  [신규 884d600] Top-3 모달

scripts/
├── build-material-product-image-index.ts  [신규 884d600] material_products → images 정규화
├── embed-material-product-images.ts       [신규 884d600] CLIP 512-dim embedding
└── eval-vision-materials.ts               [신규 82464c5] 평가 harness
```

### 2-5. 채팅 라우트 (Anthropic Claude)

```
src/app/api/inpick/design-chat/
├── stream/route.ts            [수정 49a436f, 62c9e0e] Claude SSE + 인사 금지
└── extract/route.ts           [수정 120e8e9] JSON 추출 + fallback prompt

src/app/api/project/
├── design-ai/route.ts         [재작성 3d1873e] Gemini → Claude
├── design-ai-image/route.ts   [재작성 3d1873e] 4컷 → deprecated graceful
└── contractor-ai/route.ts (실제: src/app/api/contractor-ai/route.ts)
                              [재작성 3d1873e] Gemini → Claude + RAG
```

### 2-6. 도면 처리 (Gemini fallback)

```
src/app/api/project/parse-drawing/route.ts        [수정 3d1873e] Python only fallback
src/app/api/project/generate-floorplan/route.ts   [수정 3d1873e] raw URL fallback
                                                  (Gemini 비활성 시 워터마크 포함 raw 제공)
src/app/api/project/{analyze-photos,analyze-design-image,generate-elevation}/route.ts
                                                  (기존 mock fallback 자동 활성)
```

### 2-7. 견적 통합 (자재 brand/SKU)

```
src/app/api/inpick/build-estimate/route.ts        [수정 9ce6827, 884d600]
                                                  visionAnalysisByRoom 지원 + matchMetaByRoom 응답
src/lib/inpick/estimate.ts                        [수정 9ce6827] priceSource="standard" 분기 추가
src/app/workflow/estimate/page.tsx                [수정 9ce6827, 884d600]
                                                  brand+SKU 뱃지 + 확정/추천/기본 배지
```

### 2-8. Step2 / 워크플로우 컴포넌트

```
src/components/workflow/
├── Step2Designer.tsx          [수정 1cb0165, 49a436f, 62c9e0e, 905ff08, 884d600,
                                       120e8e9, c3a38bd, 59e8b1a]
└── VisionMaterialPicker.tsx   [신규 884d600] Top-3 후보 모달

src/app/project/[id]/design/page.tsx   [수정 120e8e9] raw 깜빡임 차단
```

### 2-9. DB Migrations

```
supabase/migrations/
├── 20260510020000_image_generation_jobs.sql   [신규 383530d] async job 추적
└── 20260511000000_vision_materials.sql        [신규 82464c5] 6개 vision-materials 테이블
```

### 2-10. 문서

```
docs/
├── ops/
│   └── GEMINI_REMOVAL_AUDIT.md            [신규 611a9e9, 수정 82464c5]
├── inpick-image-generation/
│   ├── EVALUATION_PROTOCOL.md             [신규 957de84] Phase 7 평가 프로토콜
│   ├── MODEL_AND_DATA_POLICY.md           [신규 2b58eaf] Phase 8 모델+데이터 정책
│   ├── PRODUCTION_CHECKLIST.md            [신규 286f4b5] Phase 10 출시 체크리스트
│   └── sample-test-cases.json
├── vision-materials/
│   ├── METHOD_REFERENCES.md               [신규 82464c5] GroundingDINO+SAM2+CLIP+OCR
│   └── EVALUATION_PROTOCOL.md             [신규 82464c5] 출시 게이트 + 자동 metric
└── status/
    ├── INPICK-STATUS-DIAGNOSIS-20260510.md [신규 6c15888]
    └── INPICK-PIPELINE-COMPLETE-20260511.md (이 파일)
```

---

## 3. API 라우트 — Input/Output 상세

### 3-1. `POST /api/inpick/render-room`

**파일**: `src/app/api/inpick/render-room/route.ts`
**역할**: 이미지 생성 단일 진입 (Backend adapter)

**Input**:
```ts
{
  roomName: string;              // 필수 — "거실"
  widthMm: number;               // 필수
  depthMm: number;               // 필수
  heightMm?: number;             // 기본 2400
  style?: string;                // prompt
  expansion?: boolean;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "low" | "medium" | "high";  // low = 1차 무료, high = 2토큰
  windows?: number;
  doors?: number;
  isInteriorRoom?: boolean;
  windowWalls?: string[];        // ["south", "east"]
  doorWalls?: string[];
  adjacentRooms?: string[];
  wallLayout?: string;           // 자연어 도면 묘사
  furnishingOptions?: string[];
  aspectRatio?: number;
  isFromFloorplan?: boolean;
  propertyId?: string;           // Storage에서 normalized 도면 자동 로드
  floorplanImageUrl?: string;    // 직접 제공
  previousReference?: string;
  // Phase 4+ optional
  roomGeometry?: RoomGeometry;
  camera?: RoomCamera;
}
```

**Flow**:
1. `enforceConsume()` — 토큰 차감 (low=1, high=2)
2. `enforceRateLimit()` — Vercel KV (없으면 fail-open)
3. floorplanImageUrl 확보 — propertyId 있으면 Storage에서 normalized/original 조회
4. `IMAGE_GEN_MODE=async` + non-openai backend → `createJob()` → jobId 반환
5. `renderRoomViaBackend()` — env에 따라 openai / runpod / auto 분기
6. base64 응답이면 `ensureStorageUrl()` → public URL (또는 graceful base64)
7. 실패 시 `refundCredits()`

**Output (success)**:
```ts
{
  imageUrl: string;              // public URL 또는 data URL
  revisedPrompt?: string;
  model: string;                 // "gpt-image-2" / "flux-2-klein"
  backend: "openai" | "runpod";
  costUsd?: number;
  jobId?: string;
  credits_charged: number;
  credits_remaining?: number;
}
```

**Output (failure)**:
```ts
{
  error: string;
  hint?: string;
  model_status: "blocked" | "rate_limited" | "billing" | "auth" | "timeout";
  refunded: boolean;
}
```

---

### 3-2. `GET /api/inpick/render-room/jobs/[jobId]`

**파일**: `src/app/api/inpick/render-room/jobs/[jobId]/route.ts`
**역할**: async job polling

**Flow**:
1. `getJob(jobId)` — DB 조회
2. 활성 (queued/processing) + RunPod externalJobId 있으면 → backend.getJobStatus() 동기화
3. 완료/실패 시 updateJob

**Output**:
```ts
{
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl?: string;
  backend?: string;
  model?: string;
  costUsd?: number;
  elapsedMs?: number;
  error?: string;
  hint?: string;
  createdAt: string;
  completedAt?: string;
}
```

---

### 3-3. `POST /api/inpick/design-chat/stream`

**파일**: `src/app/api/inpick/design-chat/stream/route.ts`
**역할**: Step2 AI 디자인 채팅 (Anthropic Claude SSE)

**Input**: `{ messages: ChatMessage[] }` (user/assistant 교차)

**Flow**:
1. ANTHROPIC_API_KEY 검증
2. 시스템 프롬프트 + ephemeral cache + 인사 금지 규칙
3. Anthropic Messages API stream
4. text_delta → `data: ${JSON.stringify({text})}\n\n` SSE
5. message_stop → `data: [DONE]\n\n`

**Output**: SSE text/event-stream — `data: {"text":"..."}` … `data: [DONE]`

**핵심 fix들**:
- `49a436f`: 응답 깨짐 (텍스트 내 \n) 수정 — JSON encode
- `62c9e0e`: AI 매 응답 인사 제거 + 정적 인사 1회

---

### 3-4. `POST /api/inpick/design-chat/extract`

**파일**: `src/app/api/inpick/design-chat/extract/route.ts`
**역할**: 채팅 히스토리 → 이미지 prompt 추출

**Flow** (`120e8e9` fix 후):
1. messages 정규화:
   - assistant 시작 시 user 나올 때까지 slice (Anthropic 정책)
   - 연속 같은 role 합치기
   - 마지막에 "JSON만 출력하세요" 명령 추가
2. Claude (max_tokens=1200, temperature=0.3) 호출
3. ```json``` 마크다운 제거 + trailing comma 제거 후 JSON.parse
4. **실패 시 `buildFallbackPrompt()`** — 한국어 키워드 → 영문 prompt 자동 생성

**Output**:
```ts
{
  room_type: "living_room" | ...;
  area_sqm: number;
  style: "modern" | "minimal" | ...;
  tone: "warm wood" | "monotone" | ...;
  image_prompt: string;          // Photorealistic Korean apartment interior...
  notice?: string;               // fallback 사용 시
}
```

---

### 3-5. `POST /api/inpick/vision-materials/analyze`

**파일**: `src/app/api/inpick/vision-materials/analyze/route.ts`
**역할**: Vision Material Matcher 메인 진입

**Input**:
```ts
{
  projectId: string;
  roomId?: string;
  roomName?: string;
  roomType?: string;
  imageUrl: string;
  sourceImageKind: "user_photo" | "ai_render" | "floorplan" | "reference";
  clickedPoint?: { x: number; y: number };
  selectedBbox?: { x, y, width, height };
  budgetTier?: "low" | "mid" | "high" | "premium";
  styleTags?: string[];
  targetSurfaceTypes?: SurfaceType[];
  maxCandidates?: number;
}
```

**8단계 Flow**:
1. validate
2. `callVisionMaterialsWorker()` — RunPod 또는 mock
3. `insertObservations()` — material_vision_observations 저장
4. observation별 `retrieveProductCandidates()` — material_products Top-K
5. `rerankCandidates()` — 색상/OCR 보강
6. `insertCandidates()` — material_match_candidates 저장
7. `decideMaterialMatch()` — confidence gate (0.82 + margin 0.10 + DB SKU + price + compatible)
8. confirmed 시 `insertDecision()` (auto_high_confidence)

**Output**:
```ts
{
  status: "completed";
  observations: Array<{
    observation: SurfaceObservation;
    candidates: MaterialProductCandidate[];  // Top-5
    recommendation: {
      status: "confirmed" | "recommended" | "fallback";
      selectedMaterialProductId?: string;
      confidence: number;
      displayLabel: string;       // [확정] LX Z:IN / 지아자연애 / SKU
    };
  }>;
  summary: {
    observationCount;
    highConfidenceCount;
    recommendedCount;
    fallbackCount;
    modelVersions;
    elapsedMs;
  };
}
```

---

### 3-6. `POST /api/inpick/build-estimate`

**파일**: `src/app/api/inpick/build-estimate/route.ts`
**역할**: 17공종 견적 생성 + brand/SKU 통합

**Input**:
```ts
{
  rooms: Array<{
    roomName: string;
    dim: { name?, widthMm, depthMm, heightMm? };
    renderImageUrl?: string;
    surfaces?: MaterialItem[];
  }>;
  visionAnalysisByRoom?: Record<string, AnalyzedSurface[]>;  // Phase 6 후속
}
```

**Flow**:
1. 각 방마다 surfaces 결정 — 1순위 vision-materials → 2순위 legacy vision → 3순위 standard
2. `enrichWithBrandSku()` — material_products lookup → brand/sku/spec/카탈로그 단가
3. `buildRoomEstimate()` — 17공종 산출 (직접비 + 6% + 5% + VAT 10%)
4. `matchMetaByRoom` 추출 (UI 배지용)

**Output**:
```ts
{
  estimates: RoomEstimate[];
  grandTotal: { mainTotal, auxTotal, laborTotal, totalWon };
  fallbackRooms: Array<{ roomName, reason }>;
  errors: Array<{ roomName, error }>;
  matchMetaByRoom: Record<string, EstimateLineMaterialMeta[]>;
}
```

---

## 4. 핵심 lib 모듈 — Input/Output

### 4-1. `src/lib/inpick/image-backends/select-backend.ts`

```ts
renderRoomViaBackend(input: RenderRoomRequest): Promise<RenderRoomResult>
```

**Flow**:
1. `getPreferredBackend()` — env IMAGE_GEN_BACKEND 읽음
   - production + non-openai + `INPICK_EVAL_REPORT_PASSED!=true` → force "openai" (Phase 10 guardrail)
2. preferred = "openai" → `getOpenAIBackend().renderRoom()`
3. preferred = "runpod" → `getRunPodBackend().renderRoom()`
4. preferred = "auto" → runpod 시도 → 실패 시 OpenAI fallback (env로 토글)

---

### 4-2. `src/lib/inpick/image-backends/model-policy.ts`

```ts
assertModelAllowedForRuntime(modelId: string): void
```

**MODEL_POLICIES**:
| Model | License | Production |
|---|---|---|
| `black-forest-labs/FLUX.1-dev` | commercial-license-required | ❌ |
| `black-forest-labs/FLUX.2-klein-4b` | apache-2.0 | ✅ |
| `openai/gpt-image-2` | openai-tos | ✅ |

**Override**: `BFL_COMMERCIAL_LICENSE_CONFIRMED=true` 시 FLUX.1-dev production 허용 (계약 후만)

---

### 4-3. `src/lib/inpick/storage/image-storage.ts` (수정 `5108a0a`)

```ts
ensureStorageUrl(imageRef: string, options): Promise<string>
```

**Flow**:
1. data: URL 아니면 그대로 반환 (이미 URL)
2. `uploadRenderImage()`:
   - storage 미설정 → base64 fallback (warning)
   - `ensureBucketExists()` — 없으면 createBucket 시도
   - upload error → base64 fallback (warning)
   - `IMAGE_STORAGE_STRICT=true` + production → 실패 시 throw
3. 결과 url 반환 (production-storage URL 또는 data URL)

---

### 4-4. `src/lib/inpick/floorplan/control-plan.ts`

```ts
buildControlPlan(input: ControlPlanInput): ControlPlan
```

**우선순위**:
1. `forceBaseline=true` + 평면도 → `floorplan_canny` (Phase 7 평가 baseline)
2. `preferredBackend="openai"` → `openai_edit` (현재 production default)
3. geometry 있음 + RunPod → `geometry_proxy` (perspective_canny + depth + seg + masks)
4. 평면도만 → `floorplan_canny` baseline
5. 그 외 → `prompt_only`

---

### 4-5. `src/lib/inpick/material-product-lookup.ts`

```ts
lookupMaterialProduct({ surface, roomName, materialName, preferredGrade }): MaterialProductMatch | null
```

**Surface + Room → category_code 매핑**:
- 욕실 fixture → BATH_SET / TOILET / VANITY / SHOWER_BATH (자재명 keyword)
- 주방 fixture → KITCHEN_SINK / KITCHEN_CABINET
- 드레스룸 fixture → STORAGE
- 도어: 현관 → ENTRY_DOOR, 그 외 → DOOR_ROOM
- 바닥: 욕실 → BATH_TILE, 주방+타일 → KITCHEN_TILE, 그 외 → FLOORING
- 벽: 욕실 → BATH_TILE, 도장 → PAINT, 그 외 → WALLPAPER
- 천장 → CEILING / 창호 → WINDOW / 조명 → LIGHTING / 걸레받이 → BASEBOARD

**매칭 우선순위**:
1. `is_verified=true` + `price_grade='standard'` + `popularity_score DESC`
2. `price_grade='standard'` (verified 무관)
3. category만 일치

**Cache**: process 수명 in-memory (`matchCache: Map<string, MaterialProductMatch | null>`)

---

### 4-6. `src/lib/vision-materials/confidence.ts`

```ts
decideMaterialMatch(candidates, { categoryCompatible }): MatchRecommendation
```

**Gate**:
- **confirmed**: top1.confidence >= **0.82** AND (top1 - top2) >= **0.10** AND DB SKU 존재 AND price 존재 AND compatible
- **recommended**: top1.confidence >= **0.60** AND DB SKU 존재
- **fallback**: 그 외

**점수 가중합** (가이드 §8-4):
```
total = category*0.30 + visual*0.25 + texture*0.10 + color*0.10
      + ocr*0.10 + price*0.05 + roomRule*0.07 + budgetStyle*0.03
```

---

### 4-7. `src/lib/ai/model-registry.ts` (`611a9e9`)

```ts
assertAIProviderAllowed(provider: AIProvider): void
```

**AI_PROVIDER_POLICY**:
- `anthropic_openai_runpod_only` (default) — Gemini 차단
- `all_allowed` (dev 전용 — production에서 자동 강제 변경)
- `openai_only`
- `anthropic_only`

**Allowed providers**:
- `anthropic_openai_runpod_only`: anthropic, openai, runpod, local
- `all_allowed`: + gemini

---

### 4-8. `src/lib/ai/anthropic-stream.ts` (`3d1873e`)

```ts
streamAnthropicChat({ system, messages, mockFallback }): Promise<Response>
```

**Flow**:
1. `assertAIProviderAllowed("anthropic")` 정책 검증
2. ANTHROPIC_API_KEY 검증 — 없으면 mockFallback 또는 503
3. Claude Sonnet 4.6 stream API
4. text_delta → `data: ${JSON.stringify({text})}\n\n` SSE 변환
5. message_stop → `data: [DONE]\n\n`

**model**: `claude-sonnet-4-6` (default)
**caching**: ephemeral 5분 (system 프롬프트)

---

## 5. DB 스키마 (신규 테이블)

### 5-1. `image_generation_jobs` (`383530d`)

```sql
CREATE TABLE image_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  contractor_id UUID,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','completed','failed')),
  backend TEXT NOT NULL,         -- "openai" | "runpod"
  model TEXT,
  external_job_id TEXT,          -- RunPod job ID (async)
  request JSONB,
  result JSONB,
  result_url TEXT,
  cost_usd NUMERIC,
  elapsed_ms INT,
  error TEXT,
  hint TEXT,
  model_status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- trigger: completed/failed → completed_at 자동 set
```

### 5-2. `material_product_images` (`82464c5`)

```sql
CREATE TABLE material_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_product_id UUID NOT NULL REFERENCES material_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_kind TEXT NOT NULL DEFAULT 'reference'
    CHECK (image_kind IN ('reference','catalog','texture','package','user_confirmed')),
  viewpoint TEXT,
  source TEXT,
  source_license TEXT,
  width INT,
  height INT,
  perceptual_hash TEXT,
  clip_embedding vector(512),   -- CLIP/OpenCLIP ViT-B/32
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mpi_clip ON material_product_images
  USING ivfflat (clip_embedding vector_cosine_ops) WITH (lists = 100);
```

### 5-3. `material_vision_observations` (`82464c5`)

```sql
CREATE TABLE material_vision_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  room_id TEXT,
  source_image_url TEXT NOT NULL,
  source_image_kind TEXT NOT NULL,
  surface_type TEXT NOT NULL,    -- floor/wall/ceiling/tile/cabinet/...
  room_type TEXT,
  bbox JSONB,                    -- { x, y, width, height }
  mask_url TEXT,
  crop_url TEXT,
  area_ratio NUMERIC,
  dominant_colors JSONB,         -- [{ hex, ratio }]
  texture_features JSONB,
  ocr_text TEXT,
  coarse_labels JSONB,           -- [{ label, confidence }]
  clip_embedding vector(512),
  detector_model TEXT,
  segmenter_model TEXT,
  vision_model TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5-4. `material_match_candidates` (`82464c5`)

observation별 Top-K 제품 후보 + 점수 분해 (category/visual/texture/color/ocr/price/roomRule/budgetStyle/total/confidence) + reasons/warnings JSONB

### 5-5. `material_match_decisions` (`82464c5`)

```sql
CREATE TABLE material_match_decisions (
  id UUID PRIMARY KEY,
  observation_id UUID REFERENCES material_vision_observations,
  selected_material_product_id UUID REFERENCES material_products,
  decision_type TEXT CHECK (decision_type IN
    ('auto_high_confidence','user_selected','contractor_selected','fallback_generic','rejected')),
  confidence NUMERIC,
  fallback_reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  metadata JSONB                 -- active learning
);
```

### 5-6. `material_estimate_line_links` (`82464c5`)

견적 line item ↔ observation/material_product 연결 + match_status (confirmed/recommended/fallback)

### 5-7. `vision_eval_cases` / `vision_eval_results` (`82464c5`)

평가 harness 데이터셋 + 결과 (model_versions, metrics JSONB)

---

## 6. 환경변수 매트릭스

```bash
# ─── REQUIRED (production) ───
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY              # Step2 디자인 채팅 (Claude Sonnet 4.6)
OPENAI_API_KEY                 # 이미지 생성 default (gpt-image-2)
ADMIN_PASSWORD

# ─── AI Provider Policy ───
AI_PROVIDER_POLICY=anthropic_openai_runpod_only  # default — Gemini 차단

# ─── Image Generation ───
IMAGE_GEN_BACKEND=openai       # openai (default) | runpod | auto
IMAGE_GEN_MODE=sync            # sync (default) | async
INPICK_EVAL_REPORT_PASSED=     # production에서 backend!=openai로 변경 시 "true" 필수
INPICK_IMAGE_MODEL_ID=black-forest-labs/FLUX.2-klein-4b
OPENAI_IMAGE_FALLBACK_ENABLED=true
BFL_COMMERCIAL_LICENSE_CONFIRMED=  # FLUX.1-dev override (계약 후만)

# ─── Image Storage (Phase 3 + 5108a0a fix) ───
IMAGE_STORAGE_PROVIDER=supabase
IMAGE_STORAGE_BUCKET=renders
IMAGE_PUBLIC_BASE_URL=         # CDN override (옵션)
IMAGE_STORAGE_STRICT=          # "true" — production storage 실패 시 502 (이전 정책)
                               # 미설정 — base64 fallback graceful (현재 정책)

# ─── RunPod ───
RUNPOD_API_KEY=
RUNPOD_FLUX_ENDPOINT=
RUNPOD_SYNC_ENDPOINT=          # SAM 2.1
RUNPOD_ASYNC_ENDPOINT=
RUNPOD_VISION_MATERIALS_ENDPOINT=  # Vision Material Matcher worker
VISION_MATERIALS_LOAD_MODELS=true  # RunPod worker env (모델 실로드)

# ─── Vision Materials ───
VISION_MATERIALS_EVAL_PASSED=  # "true" — eval 통과 후 auto-confirm 활성

# ─── Worker (RunPod handler) ───
RENDERER_RUNTIME=production    # production | poc

# ─── Content filter ───
INPICK_CONTENT_FILTER_ENABLED=false  # Phase 11+ NSFW/trademark

# ─── 외부 ───
JUSO_API_KEY                   # 행정안전부 주소
TOSS_PAYMENTS_CLIENT_KEY=      # 미설정 시 Mock
TOSS_PAYMENTS_SECRET_KEY=
TOSS_WEBHOOK_SECRET=
FLOORPLAN_AI_URL=http://localhost:8100   # Python 도면 분석 (local dev)
PDF_PARSER_V47_URL=http://localhost:8101

# ─── DEPRECATED ───
# GOOGLE_GEMINI_API_KEY        # 정책상 차단 — 제거 권장
```

---

## 7. AI 라우팅 표 (최종)

| 라우트 | Provider | Model | 정책 |
|---|---|---|---|
| `/api/inpick/design-chat/stream` | Anthropic | `claude-sonnet-4-6` | 채팅 SSE |
| `/api/inpick/design-chat/extract` | Anthropic | `claude-sonnet-4-6` | prompt 추출 |
| `/api/project/design-ai` | Anthropic | `claude-sonnet-4-6` | 6탭 디자인 채팅 (3d1873e 교체) |
| `/api/project/design-ai-image` | — | — | deprecated (3d1873e graceful empty) |
| `/api/contractor-ai` | Anthropic | `claude-sonnet-4-6` | 사업자 AI (3d1873e 교체) |
| `/api/inpick/render-room` | OpenAI | `gpt-image-2` → `gpt-image-1` fallback | 이미지 default |
| `/api/inpick/render-room/jobs/[jobId]` | RunPod | (async polling) | jobId polling |
| `/api/inpick/sam/*` | RunPod | SAM 2.1 | 영역 분할 |
| `/api/inpick/vision-materials/analyze` | RunPod (mock) | GroundingDINO+SAM2+CLIP+EasyOCR | Vision Material |
| `/api/project/parse-drawing` | (Python only fallback) | floorplan-ai + PyMuPDF | 도면 (Gemini 차단) |
| `/api/project/generate-floorplan` | (raw URL fallback) | — | 워터마크 (Gemini 차단) |
| `/api/project/analyze-photos` | (mock fallback) | — | 사진 분석 |
| `/api/project/analyze-design-image` | (mock fallback) | — | 이미지 분석 |
| `/api/project/generate-elevation` | (mock fallback) | — | 입면도 |
| `/api/project/estimate-materials` | (mock fallback) | — | 자재 추천 |

---

## 8. 정책 강제

### 8-1. Gemini 무사용 (`611a9e9` `3d1873e`)

- ❌ `GOOGLE_GEMINI_API_KEY` (deprecated)
- ❌ `@google/genai` (gemini-client.ts가 정책 차단 시 null 반환)
- ❌ `gemini-*` 모델 호출
- ❌ `generateContent`
- ✅ `AI_PROVIDER_POLICY=anthropic_openai_runpod_only` enforce
- ✅ 미사용 라우트 4개 삭제

### 8-2. SKU Hallucination 금지 (`82464c5`)

- 견적서에 들어가는 SKU는 반드시 `material_products.id` 또는 `sku` (DB row 존재)
- `MaterialProductCandidate.materialProductId`는 항상 UUID
- AI/VLM이 임의 생성한 SKU 절대 금지
- 평가 metric: `no-hallucinated-SKU rate = 100%`

### 8-3. Production Guardrail (`286f4b5`)

```ts
// select-backend.ts getPreferredBackend()
if (NODE_ENV=production && IMAGE_GEN_BACKEND in [runpod, auto]) {
  if (INPICK_EVAL_REPORT_PASSED !== "true") {
    console.warn("forcing openai for safety");
    return "openai";  // 강제 fallback
  }
}
```

### 8-4. Storage Strict 모드 (`5108a0a`)

```ts
// image-storage.ts uploadRenderImage()
if (IMAGE_STORAGE_STRICT === "true" && isProductionMode()) {
  // 이전 Phase 3 정책 — storage 실패 시 502
  return { mode: "failed", error: ... };
}
// 기본 — base64 fallback graceful + console.warn
```

### 8-5. Vision Materials 출시 게이트 (`82464c5`)

```
VISION_MATERIALS_EVAL_PASSED=true
```

조건:
1. no-hallucinated-SKU rate = 100%
2. high-confidence auto precision >= 90%
3. estimate PDF smoke test pass
4. 59/84A/84B 17공종 견적 테스트 pass
5. GOOGLE_GEMINI_API_KEY 없이 build/runtime pass

---

## 9. Step2Designer.tsx 전체 hot path

**파일 위치**: `src/components/workflow/Step2Designer.tsx`

**핵심 state**:
```ts
chatMode (default true since 1cb0165)
chatMessages: ChatMessage[]
visionPickerOpen / visionPickerRequest
generating / chatStreaming / extractingPrompt
```

**주요 handler**:
- `handleChatSend()` — Anthropic SSE stream
  - JSON-encoded SSE 파싱 (`49a436f`)
- `handleChatToImage()` — extract API → handleBulkGenerate (118 fallback prompt 사용)
- `handleGenerate()` — 단일 방 (renderRoomViaClient — 905ff08 sync/async)
- `handleBulkGenerate(prompt)` — 일괄 (renderRoomViaClient)
- VisionMaterialPicker — `setVisionPickerRequest` → 모달 오픈

**레이아웃** (`c3a38bd`):
```
div.bg-[#EFE8DC] (베이지 컨테이너, min-h calc(100vh-180px))
├── aside (좌측 사이드바 4개 카드 bg-white/80)
└── section.bg-[#F8F9F6] (메인 흰색 캔버스, max-h calc(100vh-220px))
    ├── Step1 정보 행 (59e8b1a — 주소/단지/평형/예산)
    ├── 채팅 헤더 + 모드 토글
    ├── 채팅 본문 (overflow-y-auto)
    ├── 디자인 생성 액션 영역
    └── 하단 입력바 (rounded-full + mx-auto max-w-3xl)
```

---

## 10. 견적 페이지 hot path

**파일 위치**: `src/app/workflow/estimate/page.tsx`

**핵심 state**:
- `estimates: EstimateRoom[]`
- `matchMetaByRoom` — vision-materials 매칭 메타

**견적 생성 flow**:
1. `requestRooms` 구성 (basicInfo + Step2 결과)
2. POST `/api/inpick/build-estimate` → `{ estimates, matchMetaByRoom }`
3. `tradeGroups` 메모 — 자재명별 main/aux/labor 병합
4. ConsolidatedRow 생성 — `matchMetaByRoom[roomName]`에서 surface로 매칭 → `matchStatus + confidence`
5. UI:
   - 자재명 셀: [브랜드 뱃지] + [SKU 뱃지] + [확정 X% / 추천 X% / 기본]
   - 견적 합계 + 17공종 그룹
6. PDF 내보내기 (`generateEstimatePdf()`)

---

## 11. RunPod Workers 구조

### 11-1. `inpick-renderer/` (이미지 생성 — Phase 5/6)

**handler.py 8단계**:
1. input validation (schemas.parse_request)
2. model policy/runtime guard (assert_model_allowed)
3. floorplan image load (URL or base64)
4. control image build (`build_proxy_images` Phase 6 또는 flat canny)
5. fallback baseline 처리
6. image generation (Phase 5 placeholder 또는 실제 diffusers)
7. storage upload (signed PUT) 또는 base64 fallback
8. structured metadata 반환

**proxy_room.py (`f5b4e9d`)**:
- 평면도 폴리곤 → ceiling height extrude → 3D 룸 박스
- look-at view matrix (OpenGL convention)
- Sutherland-Hodgman near-plane clipping
- pinhole projection → 5개 control image:
  - perspective_canny
  - depth (face avg z → grayscale)
  - segmentation (클래스 컬러)
  - wall_mask / floor_mask

### 11-2. `vision-materials/` (자재 매칭 — Phase 3-후속)

**handler.py mode 분기**:
- `mode="embed_only"` — 이미지 → CLIP 512-dim (batch script용)
- `mode="full"` — 다운로드 → crop → embedding → OCR → 색상 → 응답

**모델 로드** (`VISION_MATERIALS_LOAD_MODELS=true`):
- OpenCLIP ViT-B/32 (laion2b_s34b_b79k)
- EasyOCR (ko + en, GPU 우선)
- GroundingDINO + SAM2 (Phase 후속 weight download)

---

## 12. Python Scripts 인벤토리

### 12-1. Vision Materials batch scripts (Phase 2)

```bash
# Step 1: material_products.thumbnail/installed_photos → material_product_images 정규화
npx tsx scripts/build-material-product-image-index.ts \
  [--batchSize 1000] [--limit 5000] [--dry true]

# Step 2: clip_embedding NULL인 row 페이징 → CLIP 512-dim 채움
npx tsx scripts/embed-material-product-images.ts \
  [--provider runpod] [--batchSize 20] [--limit 0]
# provider=runpod — RUNPOD_VISION_MATERIALS_ENDPOINT 사용
# provider=mock (default if no RunPod) — deterministic 512-dim (테스트만)
```

### 12-2. Eval scaffold

```bash
# Vision Materials eval (Phase 8 scaffold)
npx tsx scripts/eval-vision-materials.ts \
  --dataset gold-v1 \
  --runId vm-2026-05-11 \
  --out reports/vision-materials/run-2026-05-11.jsonl

# Image generation eval (Phase 7)
npx tsx scripts/eval-image-generation.ts \
  --cases docs/inpick-image-generation/sample-test-cases.json \
  --modes openai_edit,flat_canny,geometry_proxy \
  --out reports/eval-runs/run-2026-05-11.jsonl
```

### 12-3. LoRA data curation (Phase 8)

```bash
# 1. license ledger 생성
npx tsx scripts/create-data-license-ledger.ts \
  --scan data/inpick-style-raw \
  --out data/inpick-style/license-ledger.jsonl

# 2. 사람이 ledger 검증 후 train/validation export
npx tsx scripts/curate-inpick-style-dataset.ts \
  --ledger data/inpick-style/license-ledger.jsonl \
  --out data/inpick-style \
  --validationRatio 0.1
```

---

## 13. 위험 / 운영 액션 (대표)

### 13-1. ⚠ 즉시 점검 필요

| 항목 | 현재 상태 | 조치 |
|---|---|---|
| Supabase `renders` bucket | 자동 생성 시도 (`5108a0a`) | service_role 권한 충분하면 OK. 아니면 대시보드에서 직접 생성 |
| Toss Payments 키 | ⚠ Mock | 키 발급 + Vercel env |
| Kakao OAuth | ⚠ 비활성 | Supabase Provider 설정 |
| Vercel Hobby (10초 타임아웃) | ⚠ | Pro 권장 (parse-drawing 60초) |
| 커스텀 도메인 | ⚠ 미설정 | inpick.kr / inpick.co.kr 구매 |
| INPICK_EVAL_REPORT_PASSED | 🔵 미설정 | 정상 (eval 통과 전까지 OpenAI 강제) |
| VISION_MATERIALS_EVAL_PASSED | 🔵 미설정 | 정상 (Vision Materials는 mock) |
| GOOGLE_GEMINI_API_KEY | ⚠ deprecated | Vercel env에서 제거 권장 |

### 13-2. 다음 작업 우선순위

1. **Vision Materials production 활성** (대표 핵심 — "우리의 킥"):
   - Supabase migration 적용 (`20260511000000_vision_materials.sql`)
   - RunPod GPU endpoint 배포 (`Dockerfile.gpu`)
   - `RUNPOD_VISION_MATERIALS_ENDPOINT` + `VISION_MATERIALS_LOAD_MODELS=true`
   - `npx tsx scripts/build-material-product-image-index.ts`
   - `npx tsx scripts/embed-material-product-images.ts --provider runpod`
   - Gold dataset 30개 + eval 실행
   - `VISION_MATERIALS_EVAL_PASSED=true`
2. **Image generation eval** (Phase 7 — RunPod backend 활성 조건):
   - inpick-renderer Docker build + RunPod endpoint
   - eval-image-generation.ts 실행 + 사람 평가
   - 통과 시 `INPICK_EVAL_REPORT_PASSED=true`
   - `IMAGE_GEN_BACKEND=auto` 변경
3. **Toss + Kakao 외부 통합**
4. **커스텀 도메인**

---

## 14. 검증 상태

| 항목 | 상태 |
|---|---|
| `npx tsc --noEmit` | ✅ 모든 commit 후 통과 |
| 17공종 견적 엔진 ALL PASS (59/84A/84B) | ✅ 유지 (이전 검증) |
| Vision Materials mock 모드 동작 | ✅ |
| Anthropic Claude SSE 정상 | ✅ |
| OpenAI gpt-image-2 (default backend) 정상 | ✅ |
| Storage Bucket not found graceful fallback | ✅ `5108a0a` |
| Gemini 없이 빌드/실행 | ✅ |
| RunPod inpick-renderer 통합 | 🔵 Phase 5 placeholder (실제 모델 미배포) |
| RunPod vision-materials 통합 | 🔵 Phase 3-후속 GPU 미배포 |

---

## 15. 마무리

이번 세션 (2026-05-10 ~ 2026-05-11) 동안 InPick은 다음 트랙을 완성했습니다:

1. **이미지 생성 backend 추상화** (Phase 1~10) — OpenAI default + RunPod 옵션 + 정책 가드
2. **Gemini 완전 제거** — Anthropic Claude / OpenAI / RunPod / Supabase / Python만
3. **자재 brand/SKU 자동 매칭** — material_products 253K rows 통합
4. **Vision Material Matcher 전체 트랙** (Phase 0~9) — GroundingDINO + SAM2 + CLIP + EasyOCR scaffold + analyze API + retrieval + 견적 통합 + UX
5. **Step2Designer ChatGPT 스타일 UX** — 좌측 베이지 사이드바 + 메인 #F8F9F6 + 둥근 입력바
6. **Hot fixes** — 채팅 SSE 깨짐 / 인사 / extract / Step1 raw 깜빡임 / Storage Bucket not found

총 23 commits, 약 8,000+ 줄 추가/수정. 모든 TS 검증 통과.

**검토 후 단계별 fix 모드**로 이어집니다.

---

**작성**: Claude Opus 4.7
**저장 위치**: `docs/status/INPICK-PIPELINE-COMPLETE-20260511.md`
