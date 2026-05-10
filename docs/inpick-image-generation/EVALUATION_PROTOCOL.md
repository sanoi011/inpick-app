# InPick 이미지 생성 평가 프로토콜

> 가이드: `c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md` Prompt 7
> 작성일: 2026-05-10 · Phase 7

## 0. 목적

다음 모드를 같은 prompt + seed로 비교해서 **정말 가설이 맞는지** 검증한다.

| 모드 | 백엔드 | control |
|---|---|---|
| `openai_edit` | OpenAI | EDITS API mask = 평면도 |
| `flat_canny` | RunPod | `useFloorplanCanny` (baseline, 가이드 §7-3 A) |
| `geometry_proxy` | RunPod | `usePerspectiveCanny + useDepth + useSegmentation` (B) |
| `geometry_proxy_lora` | RunPod | 위 + InPick style LoRA (Phase 8 이후) |

**검증 가설**: B (geometry_proxy)가 A (flat_canny)보다 구조 정확도가 높을 것. 만약 "B가 A보다 더 낫지 않다"면, 모델이 아니라 **proxy 설계**부터 다시 본다 (가이드 §7-3).

## 1. 평가 항목 (1~5점, 5=좋음)

| 항목 | 의미 |
|---|---|
| **geometry_score** | 방 형태 (사각형/L자) 보존도 |
| **openings_score** | 문/창 위치 정확도 (입력 RoomGeometry에 명시한 것과 일치) |
| **perspective_score** | 시점/공간감 자연스러움 (top-down 평면도 안 보이는지) |
| **usability_score** | "이걸 사용자에게 보여줄 수 있는가" 종합 |
| **style_score** | 한국 아파트 인테리어 톤 (조명/마감/가구) |
| **editability_score** | 추후 Step3 자재 변경 시 잘 작동할지 |
| **notes** | 자유 메모 (특이사항, 결함) |

## 2. 데이터 포맷 (JSONL)

각 line = 1 generation result.

```jsonc
{
  "caseId": "eval_001_living_basic",
  "label": "거실 기본 (25m² 정사각형)",
  "mode": "geometry_proxy",
  "modelId": "black-forest-labs/FLUX.2-klein-4b",
  "seed": 12345,
  "prompt": "...",
  "status": "completed",
  "imageUrl": "https://.../eval_001_geometry_proxy.png",
  "backend": "runpod",
  "costUsd": 0.018,
  "elapsedMs": 12432,
  "controlMode": "geometry_proxy",
  "startedAt": "2026-05-10T13:20:01.000Z",
  "finishedAt": "2026-05-10T13:20:14.000Z",
  "wallMs": 13050,
  // 평가 (사람이 이미지 보고 채움)
  "geometry_score": 4,
  "openings_score": 3,
  "perspective_score": 5,
  "usability_score": 4,
  "style_score": 5,
  "editability_score": 4,
  "notes": "거실 형태 잘 잡힘. 창 위치 약간 틀어짐."
}
```

## 3. 실행

### 3-1. 샘플 test-cases 작성

```bash
npx tsx scripts/eval-image-generation.ts \
  --writeSample reports/eval-runs/test-cases.json
```

### 3-2. dry-run (설정 확인용)

```bash
npx tsx scripts/eval-image-generation.ts \
  --cases reports/eval-runs/test-cases.json \
  --modes openai_edit,flat_canny,geometry_proxy \
  --out reports/eval-runs/run-dry.jsonl \
  --dry true
```

### 3-3. 실제 실행 (서버가 떠 있어야 함)

```bash
# Next.js 개발서버 + RunPod inpick-renderer (포트별로 IMAGE_GEN_BACKEND 분기 필요)
npx tsx scripts/eval-image-generation.ts \
  --cases reports/eval-runs/test-cases.json \
  --modes openai_edit,flat_canny,geometry_proxy \
  --out reports/eval-runs/run-2026-05-10.jsonl \
  --url http://localhost:3000 \
  --timeout 300000
```

### 3-4. 평가 (사람)

`reports/eval-runs/run-XXX.jsonl` 열어서 각 row의 점수 필드를 채운다.

> **중요**: 이미지를 보지 않고 점수 매기지 말 것. URL을 모두 열어 시각 확인 필수.

### 3-5. 집계 (간단 summary)

```bash
# (별도 스크립트 — 추후 작성)
# 평균/표준편차/모드별 비교 차트
```

## 4. PoC 통과 기준 (가이드 §7-3 정신)

다음을 **모두 만족해야** Phase 8 (LoRA) 진입 가치 있음:

- [ ] **N ≥ 10 case** 실행 (충분한 표본)
- [ ] **`geometry_proxy.geometry_score` 평균 ≥ `flat_canny.geometry_score` + 0.5**
  - 즉 5점 만점에서 절반 등급 차이 이상
- [ ] **`geometry_proxy.openings_score` 평균 ≥ `flat_canny.openings_score` + 0.5**
- [ ] **`geometry_proxy.usability_score` 평균 ≥ 3** (사용자에게 보여줄 만한 수준)

만족 못하면 → proxy_room.py 개선 (depth quality, opening 표현, perspective 각도 등) 우선.

> 가이드 §7-3 인용: "B가 A보다 구조적으로 나아지지 않으면, 모델 문제가 아니라 proxy 설계 문제를 먼저 본다."

## 5. 비용 / 시간 추정

| 항목 | 값 |
|---|---|
| OpenAI gpt-image-2 1회 | ~$0.05 / 60초 |
| RunPod FLUX.2-klein-4b | ~$0.02 / 12~30초 (warm) |
| RunPod cold start | +60~120초 |
| 10 case × 3 mode | ~$2.10 / 30~60분 (warm) |

## 6. 변경 금지

- "95% 구조 보존" 같은 **수치 확정값**을 코드/문서에 넣지 마라 (가이드 §7-3 명시 금지).
- 평가 데이터에 사실값(score)을 generated하지 마라 — 사람만 채움.
- `mode` 필드는 enum (`openai_edit | flat_canny | geometry_proxy | geometry_proxy_lora`).

## 7. 다음 단계 (Phase 8)

- 평가 결과로 LoRA 학습 가치 판단
- `geometry_proxy.geometry_score` 만족하면 → LoRA로 `style_score` 끌어올리기
- 만족 못하면 → proxy_room.py 개선 + 재평가

## 8. 부록 — 모드별 호출 패턴 (개발자용)

현재 `/api/inpick/render-room` route는 `IMAGE_GEN_BACKEND` env로 분기. eval harness는 `_evalMode` body 필드로 hint를 보내지만, **실제 모드 강제는 env 분리 필요**.

옵션 A — 별도 endpoint 만들기:
```
/api/inpick/eval/render-room?backend=runpod&control=geometry_proxy
```

옵션 B — Vercel preview env별 별도 deploy:
- preview-openai → IMAGE_GEN_BACKEND=openai
- preview-runpod-baseline → IMAGE_GEN_BACKEND=runpod + control default=floorplan_canny
- preview-runpod-proxy → IMAGE_GEN_BACKEND=runpod + control default=geometry_proxy

옵션 C — 직접 RunPod /run 호출 (eval harness가 backend bypass):
- `runpod_serverless/inpick-renderer`로 직접 POST
- 모드별 ControlSpec 분리 가능

**Phase 7 minimal**: 옵션 C 권장. eval harness가 Next.js를 거치지 않고 RunPod handler를 직접 부른다.

## 9. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-10 | Phase 7 초기 — 4 mode 정의, JSONL 포맷, 통과 기준 |
