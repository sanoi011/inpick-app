# InPick 출시 직전 오류 감사 보고서

> 작성일: 2026-05-11
> 가이드: `c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md` §1, §4
> 정책: production에서 즉시 차단해야 할 항목 + 추가 작업 필요 항목 분리

---

## 1. Gemini 사용처 (production runtime 영향 평가)

### 1-1. `production route` (`src/app/api/`)

| 파일 | Gemini 호출 코드 | production 영향 | 조치 |
|---|---|---|---|
| `project/generate-floorplan/route.ts` | `new GoogleGenAI()` + `ai.models.generateContent` (line 2, 120) | ⚠ Gemini 활성 시만. 정책상 차단되면 raw URL fallback 작동 (3d1873e) | OK — 코드 자체는 잔존하지만 isGeminiConfigured() = false면 fallback path |
| `project/analyze-design-image/route.ts` | `client.models.generateContent` (line 170) | ⚠ 차단 시 503 명시적 | OK — strict block + 명확한 에러 |
| `project/analyze-photos/route.ts` | `client.models.generateContent` (line 240) | ⚠ 동일 | OK — isGeminiConfigured() 분기 |
| `project/estimate-materials/route.ts` | `client.models.generateContent` (line 208) | ⚠ 동일 + mock fallback 존재 | OK |
| `project/generate-elevation/route.ts` | `client.models.generateContent` (line 374) | ⚠ 동일 + mock fallback 존재 | OK |

**결론**: production은 안전 (`AI_PROVIDER_POLICY=anthropic_openai_runpod_only` → `gemini-client.ts`가 null 반환 → 모든 라우트 fallback path로 진입).

**잔존 코드는 deprecated이며 후속 작업에서 제거 예정** (출시 후).

### 1-2. 문서 (`docs/`)

| 위치 | Gemini 언급 | 조치 |
|---|---|---|
| `docs/ops/GEMINI_REMOVAL_AUDIT.md` | 정책 명시 + 진행 매트릭스 | ✅ 의도된 기록 |
| `docs/vision-materials/{METHOD_REFERENCES,EVALUATION_PROTOCOL}.md` | "Gemini 사용 금지" 명시 | ✅ 정책 가이드 |
| `docs/status/INPICK-PIPELINE-COMPLETE-20260511.md` | 정책 표 + deprecated 표시 | ✅ |
| `docs/status/INPICK-STATUS-DIAGNOSIS-20260510.md` | "GOOGLE_GEMINI_API_KEY  # 그 외 모든 AI 라우트 (Gemini 통일)" | ⚠ **2026-05-10 시점 정리** — 갱신됨 |
| `docs/2026-04-10_vision-estimate-roadmap.md` | `@google/genai` 의존성 명시 | ⚠ **roadmap 문서** — 정책 변경 전 작성. historical로 유지 |
| `docs/construction-drawings/04-GEMINI-AI.md` | generateContent 예시 | ⚠ **historical 작업 가이드** — 정책 변경 전 작성. 출시 후 archived 폴더로 이동 권장 |
| `docs/vision-roadmap/05-crawling-pipeline.md` | `@google/genai` import + `generateContent` 호출 | ⚠ **crawling roadmap** — Gemini 사용. 출시 후 별도 정책 결정 (data ingestion은 production traffic이 아님) |
| `docs/vision-roadmap/06-cost-infra.md` | `GOOGLE_GEMINI_API_KEY=AIza...` 키 노출 예시 | ⚠ **placeholder만** — 실제 키 아님 |

**조치**: 출시 직전 즉시 작업은 불필요. **출시 후** `docs/_archive/`로 historical 문서 이동.

### 1-3. Step1 도면 클린 파이프라인

`docs/status/INPICK-PIPELINE-COMPLETE-20260511.md` line 1에 다음 표현 존재:

> "③ Gemini 활성 시 → SSE 4단계 파이프라인 (Step 0~3: 다운로드 + Gemini 클린 + 미러 + 마스크)"

**현재 production 실제 흐름**:
- `isGeminiConfigured()` 정책 차단 → `generate-floorplan/route.ts:203~232` 의 raw URL fallback 진입
- 사용자에게 워터마크 포함 raw 네이버 도면이 그대로 전달됨

**조치**:
- 다음 status MD 갱신 시 "Gemini branch는 deprecated historical path" 명시
- 출시 v1에서 `gpt-image-2 EDITS API`로 마이그레이션 (별도 작업)

---

## 2. 이미지 생성 Backend / Eval 정책

### 2-1. `IMAGE_GEN_BACKEND` 사용처

| 위치 | 내용 | 상태 |
|---|---|---|
| `src/lib/inpick/image-backends/select-backend.ts` | env → preferredBackend 결정 | ✅ |
| `select-backend.ts` getPreferredBackend() | production + non-openai + `INPICK_EVAL_REPORT_PASSED!=true` → force "openai" | ✅ guardrail 작동 |

**출시 v0 권장**: `IMAGE_GEN_BACKEND=openai` (또는 미설정 = default openai)

### 2-2. `INPICK_EVAL_REPORT_PASSED`

**출시 v0**: **미설정** (또는 빈 문자열). production에서 RunPod backend 자동 비활성.

### 2-3. `VISION_MATERIALS_EVAL_PASSED`

**출시 v0**: **미설정**.
- ⚠ **현재 코드에서 검증 부재**: `src/app/api/inpick/vision-materials/analyze/route.ts:182~191`이 confidence gate 통과 시 `auto_high_confidence` 결정을 무조건 저장
- **출시 전 fix 필요**: `VISION_MATERIALS_EVAL_PASSED=true`가 아니면 `auto_high_confidence` decision을 만들지 않도록 guard 추가

---

## 3. Storage / base64

### 3-1. `IMAGE_STORAGE_STRICT`

| 출시 정책 | 권장값 |
|---|---|
| 이미지 렌더 (`/api/inpick/render-room`) | `IMAGE_STORAGE_STRICT=true` (production) — base64 응답 production 차단 |
| 문서 PDF (estimate-documents) | 별도 `DOCUMENT_STORAGE_STRICT=true` (신규) |
| 도면 PDF (drawing-package) | 별도 `DRAWING_STORAGE_STRICT=true` (신규) |

### 3-2. `data:image/png;base64` 잔존 위치

| 파일 | 용도 | production 영향 |
|---|---|---|
| `src/lib/inpick/storage/image-storage.ts` | graceful base64 fallback (`5108a0a`) | ⚠ `IMAGE_STORAGE_STRICT=true` 설정 필요 |
| `src/app/api/inpick/normalize-floorplan/route.ts:377` | 내부 처리용 (cleanedImageUrl) | OK — Storage 이전 단계 |
| `src/app/api/inpick/refine-render/route.ts:333` | 응답 imageUrl | ⚠ Storage 마이그레이션 필요 (별도 작업) |
| `src/lib/inpick/openai-client.ts:312` | OpenAI 직접 호출 결과 | OK — ensureStorageUrl 통과 후 변환됨 |

---

## 4. Vision Materials mock 결과 → 확정 표시 위험

### 4-1. 현재 `analyze/route.ts` 동작

`src/app/api/inpick/vision-materials/analyze/route.ts:152~196`:

```ts
const recommendation = decideMaterialMatch(reranked, { categoryCompatible: compatible });

// auto_high_confidence면 decision 자동 저장
if (recommendation.status === "confirmed" && observationIds[i] && !observationIds[i].startsWith("mock-")) {
  await insertDecision({
    observationId: observationIds[i],
    selectedMaterialProductId: recommendation.selectedMaterialProductId,
    decisionType: "auto_high_confidence",
    confidence: recommendation.confidence,
  });
}
```

**문제**: `VISION_MATERIALS_EVAL_PASSED=true` 체크 없이 confidence gate만 통과하면 auto_high_confidence 저장.

**출시 v0 정책**:
- mock worker 사용 중 → confidence가 가짜
- eval gold dataset 미통과 → no-hallucinated-SKU rate 미검증

**조치 (Track A Phase 3 또는 별도 patch)**:
```ts
const evalPassed = process.env.VISION_MATERIALS_EVAL_PASSED === "true";
if (recommendation.status === "confirmed" && evalPassed && observationIds[i] && !observationIds[i].startsWith("mock-")) {
  // auto_high_confidence 저장 (only after eval pass)
}
```

또한 worker가 mock 모드(`source === "mock"`) 응답이면 어떤 confirmed도 auto 저장하지 않음.

### 4-2. 견적/PDF 표시 안전 정책

`docs/vision-materials/EVALUATION_PROTOCOL.md`에 이미 정의됨:
- ❌ VLM이 말한 SKU 그대로 PDF
- ❌ mock embedding 결과 확정 표시
- ❌ price 없는 상품 확정 견적 금액

**현재 코드 (build-estimate `9ce6827` + `884d600`)**:
- `enrichWithBrandSku` — material_products lookup (DB 검증 — SKU hallucination 0)
- `matchMetaByRoom` matchStatus = confirmed/recommended/fallback 분리됨 ✅

**조치**: 코드 자체는 안전. eval 통과 전까지 confirmed → recommended로 강등하는 옵션 환경변수 추가 권장 (Track A Phase 3 부근에서 보강).

---

## 5. RunPod Renderer 상태

### 5-1. inpick-renderer

| 항목 | 상태 |
|---|---|
| handler.py | Phase 5 placeholder (회색 1024x1024 + 메타) |
| Dockerfile | CPU base만 |
| 실제 모델 (FLUX.2-klein-4b) 로드 | 미구현 |
| Production endpoint | 배포 안 됨 |

**출시 v0**: `RUNPOD_FLUX_ENDPOINT` 미설정. 사용 안 함.

### 5-2. vision-materials worker

| 항목 | 상태 |
|---|---|
| handler.py | Phase 3-후속 — OpenCLIP/EasyOCR `VISION_MATERIALS_LOAD_MODELS=true` 시 로드 |
| GroundingDINO + SAM2 | 주석 (Phase 후속에서 weight download 필요) |
| Dockerfile.gpu | 준비됨 (`884d600`) |
| Production endpoint | 배포 안 됨 |

**출시 v0**: `RUNPOD_VISION_MATERIALS_ENDPOINT` 미설정. mock 응답.

---

## 6. 출시 즉시 조치 항목 요약

| 우선 | 항목 | 위치 | 작업 |
|---|---|---|---|
| **P0** | RenderRoomSpec 7개 모듈 신규 | `src/lib/inpick/floorplan/` | Track A Phase 2 |
| **P0** | render-room route에 spec 강제 | `src/app/api/inpick/render-room/route.ts` | Track A Phase 3 |
| **P0** | `auto_high_confidence` 가드 | `analyze/route.ts` | Track A Phase 3 부근 보강 |
| **P0** | Step2 UI renderSpec warnings | `Step2Designer.tsx` | Track A Phase 4 |
| **P0** | 테스트 + Eval cases | `__tests__/` + `launch-critical-cases.json` | Track A Phase 5 |
| **P0** | Production ENV 문서 | `docs/launch/PRODUCTION_ENV_20260511.md` | Track A Phase 6 |
| **P1** | A4 가로 견적서 4페이지 | `src/lib/inpick/estimate-documents/` | Track B Phase 1~3 |
| **P1** | 입면전개도 deterministic 패키지 | `src/lib/inpick/drawings/` | Track B Phase 4 |

---

## 7. 출시 환경변수 권장값 (최종)

```bash
# ─── REQUIRED ───
AI_PROVIDER_POLICY=anthropic_openai_runpod_only
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# ─── 출시 v0 가드 — 다음을 절대 켜지 않음 ───
INPICK_EVAL_REPORT_PASSED=          # 빈 값
VISION_MATERIALS_EVAL_PASSED=       # 빈 값
RENDERER_RUNTIME=poc                # RunPod renderer 비활성

# ─── 이미지 생성 ───
IMAGE_GEN_BACKEND=openai
IMAGE_GEN_MODE=sync
RENDER_ROOM_SPEC_ENABLED=true        # NEW — Track A에서 활성
RENDER_SPEC_STRICT_BALCONY=true      # NEW — 안방발코니 hard constraint
RENDER_QA_ENABLED=false              # 출시 후 검토

# ─── Storage strict ───
IMAGE_STORAGE_PROVIDER=supabase
IMAGE_STORAGE_BUCKET=renders
IMAGE_STORAGE_STRICT=true            # production base64 차단
DOCUMENT_STORAGE_STRICT=true         # NEW — 문서 PDF
DRAWING_STORAGE_STRICT=true          # NEW — 도면 PDF

# ─── 제거 ───
# GOOGLE_GEMINI_API_KEY              ❌ Vercel env에서 제거
```

---

## 8. Sign-off (출시 전 게이트)

- [ ] Track A Phase 1~6 완료 (RenderRoomSpec + 테스트 통과)
- [ ] Track B Phase 1~4 완료 (견적서 + 입면전개도)
- [ ] `npx tsc --noEmit` 모든 commit 후 통과
- [ ] `npm test -- render-room-spec` 통과
- [ ] `IMAGE_STORAGE_STRICT=true` production 설정
- [ ] `GOOGLE_GEMINI_API_KEY` Vercel env 제거
- [ ] Supabase Storage `renders` / `estimate-documents` / `construction-drawings` 버킷 생성
- [ ] 안방발코니 fixture에서 `balcony_sliding_door` 분류 확인
- [ ] mock 결과 견적표에 [확정] 표시 안 됨 확인

---

**작성**: Claude Opus 4.7
**다음 단계**: Track A Phase 2 (RenderRoomSpec 7개 모듈 신규)
