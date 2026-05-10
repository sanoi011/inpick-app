# Gemini 사용처 감사 + 제거 계획

> 작성일: 2026-05-10
> 작성: Claude Opus 4.7
> 대상: 대표 (대영토건 김선본)
> 정책: **Gemini 제거**. AI Provider = `anthropic_openai_runpod_only`.

## 0. 정책 (대표 의도)

- ❌ Google Gemini 사용 중단
- ✅ Step2 디자인 채팅 → Anthropic Claude Sonnet 4.6
- ✅ 이미지 렌더 → OpenAI `gpt-image-2` (default) + RunPod Flux (옵션)
- ✅ 도면 처리 (워터마크/마스크 등) → OpenAI `gpt-image-2` 사용 (단일 통합)
- 🗑 미사용 / 구형 / 중복 라우트는 **삭제** (헷갈림/장애 원인 제거)

## 1. 사용처 감사 결과

### 1-1. 클라이언트 호출 매트릭스

`src/**/*.{ts,tsx}` 에서 fetch 한 라우트만 (production traffic).

| 라우트 | 호출자 | Gemini 의존 | 사용 중 | 분류 |
|---|---|---|---|---|
| `/api/project/parse-drawing` | `project/[id]/design/page.tsx` | ✅ Gemini Vision | ✅ | **유지 — Gemini-free fallback 필요** |
| `/api/project/generate-floorplan` | `design/page.tsx` + `FloorPlanGenerationProgress.tsx` | ✅ Gemini Pro (워터마크/마스크) | ✅ | **유지 — OpenAI `gpt-image-2`로 마이그레이션 필요** |
| `/api/project/design-ai` | `design/page.tsx:383` | ✅ Gemini SSE | ✅ | **교체 — Anthropic Claude** |
| `/api/project/design-ai-image` | `design/page.tsx:466` | ✅ Gemini | ✅ | **교체 — Claude 텍스트 + render-room 이미지** |
| `/api/project/analyze-design-image` | `design/page.tsx:543` + `vision-material-converter.ts` | ✅ Gemini Vision | ✅ | **교체 — OpenAI Vision** |
| `/api/project/analyze-photos` | `design/page.tsx:713` | ✅ Gemini Vision | ✅ | **교체 — OpenAI Vision** |
| `/api/contractor-ai` | `contractor/ai/page.tsx:124` | ✅ Gemini SSE | ✅ | **교체 — Anthropic Claude** |
| `/api/project/estimate-materials` | `estimate/page.tsx:244` | ✅ Gemini | ✅ | **교체 — Rule-based DB 매칭** |
| `/api/project/generate-elevation` | `admin/roadmap/page.tsx:442` (관리자 테스트만) | ✅ Gemini | ⚠ admin only | **유지 — Gemini-free fallback (deterministic)** |

### 1-2. 클라이언트 호출 없음 (삭제 후보)

| 라우트 | 비고 |
|---|---|
| `/api/project/generate-image` | 미사용 — `scripts/test-render-to-drawing.mjs`(dev 스크립트)만 호출. `render-room`이 대체. **삭제** |
| `/api/project/design-recommend` | 클라이언트 호출 없음. CLAUDE.md에서만 언급. **삭제** |
| `/api/project/gemini-status` | e2e 테스트(`api.spec.ts`)만 — 진단용. **삭제 또는 anthropic-status로 이름 변경** |
| `/api/admin/normalize-floorplan` | 클라이언트 호출 없음 (관리자 페이지에서 사용 안 됨). **삭제** |

### 1-3. lib 모듈 (재사용 코드)

| 파일 | 용도 | Gemini 의존 | 처리 |
|---|---|---|---|
| `src/lib/gemini-client.ts` | Gemini SDK 래퍼 | 핵심 | **삭제** (구 라우트 삭제 후) |
| `src/lib/embedding.ts` | `gemini text-embedding-004` | 임베딩 | **교체 또는 비활성** (현재 `embed-knowledge.ts` script만 사용 추정) |
| `src/lib/multi-modal-fusion.ts` | Gemini 멀티모달 융합 | ? | 호출 위치 확인 후 처리 |
| `src/lib/vision-embeddings.ts` | Gemini 이미지 임베딩 | ? | 동일 |
| `src/lib/services/gemini-floorplan-parser.ts` | parse-drawing 핵심 | ✅ | **OpenAI Vision으로 교체** |
| `src/lib/services/naver-floorplan-normalizer.ts` | generate-floorplan 핵심 (워터마크/마스크) | ✅ | **OpenAI `gpt-image-2`로 교체** |
| `src/lib/floor-plan/drawing/gemini-enhancer.ts` | 시공도면 enhancer | ✅ | **삭제 또는 Claude로 교체** |
| `src/lib/services/detection-fusion.ts` | YOLO+Gemini 융합 | ✅ | YOLO만 사용 (Gemini 부분 제거) |
| `src/lib/services/enhanced-fusion.ts` | parse-drawing 융합 | ✅ | OpenAI 결과로 교체 |

### 1-4. Scripts (개발 도구 — production 영향 X)

`scripts/` 의 `test-*.mjs`, `list-*.mjs`, `floorplan-pipeline/` 등은 **개발 도구**이므로 우선순위 낮음. production 라우트 정리 후 별도 처리.

## 2. 처리 계획 (단계별)

### Phase A: 미사용 라우트 즉시 삭제

```
src/app/api/project/generate-image/
src/app/api/project/design-recommend/
src/app/api/project/gemini-status/
src/app/api/admin/normalize-floorplan/
```

→ 4개 디렉토리 + 라우트 파일 삭제. 클라이언트 호출 없음 검증됨.

### Phase B: 중앙 model-registry + AI Provider Policy

`src/lib/ai/model-registry.ts` 생성:
- `AI_PROVIDER_POLICY` 환경변수 (default: `anthropic_openai_runpod_only`)
- `assertAIProviderAllowed("gemini")` → 정책 위반 시 throw
- `getActiveAIProvider()` → 현재 정책 정보

API 라우트 진입 시 `assertAIProviderAllowed`로 차단.

### Phase C: 채팅 라우트 Claude로 교체 (3개)

- `/api/project/design-ai` — Gemini SSE → Anthropic Claude Sonnet 4.6 SSE (응답 shape 동일)
- `/api/project/design-ai-image` — Claude 텍스트 응답 + 이미지는 `render-room` 위임
- `/api/contractor-ai` — Gemini SSE → Anthropic Claude SSE (RAG 컨텍스트 유지)

### Phase D: Vision 라우트 OpenAI로 교체

- `/api/project/analyze-design-image` — Gemini Vision → OpenAI gpt-image-2 (Vision 분석)
- `/api/project/analyze-photos` — Gemini Vision → OpenAI Vision

### Phase E: 도면 처리 통합 (가장 중요 — 대표 지목)

> "도면 워터마크 처리부터 이미지2 모델을 사용해야 하는데 이게 처리 부분이 겹쳤던거같아"

- `/api/project/generate-floorplan` (네이버 원본 → 클린 → 미러 → 마스크):
  - 현재: Gemini Pro 4단계
  - 목표: OpenAI `gpt-image-2` EDITS API 사용 (`render-room` 인프라와 통합)
  - **임시**: Gemini 호출이 실패하면 raw 이미지 그대로 통과 (graceful fallback)
- `/api/project/parse-drawing` (도면 시맨틱):
  - 현재: Gemini Vision + floorplan-ai + PyMuPDF (3소스 융합)
  - 목표: floorplan-ai (Python) + PyMuPDF + OpenAI Vision fallback
  - **임시**: Gemini 부분 제거하고 Python 결과만 반환 (정확도 일부 저하 — 후속 OpenAI 통합 예정)

### Phase F: estimate-materials Rule-based 전환

- `/api/project/estimate-materials` → `material_products` + `category_taxonomy` + `category_aliases` + `material_price_lookup` DB 매칭
- 이미 `/api/inpick/build-estimate` (방금 brand/SKU 통합 완료 — `9ce6827`)와 통합 가능 — 같은 lookup 헬퍼 사용

### Phase G: generate-elevation 보존

- `/api/project/generate-elevation` — 관리자 roadmap 페이지에서 호출 (실 사용 빈도 낮음)
- Gemini 호출 부분만 mock/deterministic로 교체 (입면도 generator는 svg-generators.ts에 이미 있음)

### Phase H: 환경변수 + 진단 정리

- `.env.example`: `GOOGLE_GEMINI_API_KEY` deprecated 표시
- `/api/inpick/health`: gemini check 제거, `ANTHROPIC_API_KEY` required로 표기
- `/admin/env-check`: 동일

### Phase I: 문서 갱신

- `CLAUDE.md` AI 모델 표 업데이트
- `docs/status/INPICK-STATUS-DIAGNOSIS-20260510.md` 갱신
- 이 audit MD에 완료 commit hash 기록

## 3. 완료 조건

- [ ] `npx tsc --noEmit` 통과
- [ ] `GOOGLE_GEMINI_API_KEY` 없이 `npm run build` 통과
- [ ] `/api/inpick/design-chat/stream` 정상 (Anthropic Claude — 이미 사용 중)
- [ ] `/api/inpick/render-room` 정상
- [ ] `/api/project/design-ai` 정상 (Claude로 교체 후)
- [ ] `/api/contractor-ai` 정상 (Claude로 교체 후)
- [ ] 클라이언트 호출하는 모든 라우트가 Gemini 없이 동작 (graceful fallback 포함)
- [ ] 미사용 4개 라우트 삭제됨
- [ ] 이 MD에 처리 commit hash 모두 기록됨

## 4. 진행 상황 (commit 단위)

| Phase | Commit | 내용 |
|---|---|---|
| A — 라우트 삭제 | (예정) | 4개 미사용 라우트 삭제 |
| B — model-registry | (예정) | AI Provider Policy enforcement |
| C — 채팅 Claude | (예정) | 3개 라우트 교체 |
| D — Vision OpenAI | (예정) | 2개 라우트 교체 |
| E — 도면 통합 | (예정) | parse-drawing + generate-floorplan |
| F — estimate Rule | (예정) | DB 매칭 |
| G — elevation | (예정) | deterministic |
| H — env + health | (예정) | 환경변수 정리 |
| I — 문서 | (예정) | CLAUDE.md / status MD |

## 5. 위험 / 주의사항

- **`/api/project/generate-floorplan`은 운영 핵심**: 사용자가 아파트 검색 → 이게 작동해야 도면이 나옴. Gemini 갑자기 끊으면 도면 생성 불가. 이 라우트는 OpenAI 마이그레이션이 가장 신중해야 함. **임시**: Gemini 호출이 실패하면 raw 네이버 이미지 그대로 캐시 + 경고 로그 (사용자 도면이 워터마크 제거 안 된 상태로 보임 — 1~2일 임시 허용 후 OpenAI 마이그레이션 완료).
- **`gemini-floorplan-parser.ts` 의존성**: parse-drawing이 이걸 부름. 삭제 시 import 에러. 우선 parse-drawing route에서 gemini 호출만 try/catch로 무력화 → 나중에 lib 파일 삭제.
- **`embedding.ts` (Gemini)**: knowledge embedding은 dev 도구 (`scripts/embed-knowledge.ts`)에서만 사용 추정 — production 영향 없음. 보존.

## 6. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-10 | 초기 audit + 처리 계획 |
