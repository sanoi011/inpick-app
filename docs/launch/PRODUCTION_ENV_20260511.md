# InPick 출시 v0 Production 환경변수

> 작성일: 2026-05-11
> 가이드: `c:\Users\user\Downloads\inpick-launch-critical-render-spec-dev-plan-20260511.md` §15
> 검증: `docs/launch/LAUNCH_ERROR_AUDIT_20260511.md`

---

## 0. 출시 정책 한 줄

**모델을 바꾸지 말고, 도면을 `RenderRoomSpec`으로 바꿔서 OpenAI에 구조를 강제한다.**
RunPod renderer, Vision Materials auto-confirm, base64 storage fallback은 production에서 함부로 켜지 않는다.

---

## 1. Vercel Environment Variables (Production)

```bash
# ─── AI Provider (REQUIRED) ───
AI_PROVIDER_POLICY=anthropic_openai_runpod_only
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...

# ─── 출시 v0 금지 (절대 켜지 마세요) ───
# INPICK_EVAL_REPORT_PASSED=          ← 미설정 또는 빈 값
# VISION_MATERIALS_EVAL_PASSED=       ← 미설정 또는 빈 값
# GOOGLE_GEMINI_API_KEY=              ← 반드시 제거 (정책 차단)
# BFL_COMMERCIAL_LICENSE_CONFIRMED=   ← 미설정

# ─── 이미지 생성 ───
IMAGE_GEN_BACKEND=openai
IMAGE_GEN_MODE=sync
INPICK_IMAGE_MODEL_ID=black-forest-labs/FLUX.2-klein-4b
OPENAI_IMAGE_FALLBACK_ENABLED=true

# ─── Launch-critical RenderRoomSpec (NEW 2026-05-11) ───
RENDER_ROOM_SPEC_ENABLED=true
RENDER_SPEC_STRICT_BALCONY=true
RENDER_QA_ENABLED=false                # 출시 후 v1에서 켜기
RENDER_QA_REGENERATE_ON_FAIL=false

# ─── Image Storage (strict — base64 production 차단) ───
IMAGE_STORAGE_PROVIDER=supabase
IMAGE_STORAGE_BUCKET=renders
IMAGE_STORAGE_STRICT=true              # production에서 storage 실패 시 502
IMAGE_PUBLIC_BASE_URL=                  # CDN override (옵션)

# ─── 문서 / 도면 Storage (NEW Track B에서 사용 예정) ───
DOCUMENT_STORAGE_STRICT=true
DRAWING_STORAGE_STRICT=true

# ─── Vision Materials (production 비활성) ───
RUNPOD_VISION_MATERIALS_ENDPOINT=
VISION_MATERIALS_LOAD_MODELS=false
INPICK_CONTENT_FILTER_ENABLED=false    # Phase 11+ NSFW/trademark

# ─── RunPod Image Generation (production 비활성) ───
RUNPOD_API_KEY=                         # 있어도 backend=openai 강제
RUNPOD_FLUX_ENDPOINT=
RUNPOD_SYNC_ENDPOINT=                   # SAM 2.1 (선택)
RUNPOD_ASYNC_ENDPOINT=
RENDERER_RUNTIME=poc

# ─── Supabase (REQUIRED) ───
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ─── 외부 API ───
JUSO_API_KEY=...                        # 행정안전부 주소 검색

# ─── 결제 (실키 또는 Mock) ───
TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=
TOSS_WEBHOOK_SECRET=

# ─── 관리자 ───
ADMIN_PASSWORD=...

# ─── Python 서비스 (production 미사용 — local dev only) ───
FLOORPLAN_AI_URL=                       # production 미설정
PDF_PARSER_V47_URL=
```

---

## 2. 새 환경변수 (Launch-critical)

| 변수 | 기본값 | 의미 |
|---|---|---|
| **`RENDER_ROOM_SPEC_ENABLED`** | `true` (Launch v0) | `/api/inpick/render-room`에서 RenderRoomSpec 생성 + prompt 강제. `false`이면 기존 wallLayout만 사용. |
| **`RENDER_SPEC_STRICT_BALCONY`** | `true` | 안방-안방발코니 hard constraint. opening classifier가 toRoom=발코니이면 balcony_sliding_door 강제. |
| **`RENDER_QA_ENABLED`** | `false` (출시 v0) | 렌더 후 Vision QA (Claude/OpenAI Vision으로 결과 이미지 검증). 비용 큼 — 출시 후 활성. |
| **`RENDER_QA_REGENERATE_ON_FAIL`** | `false` | QA 실패 시 1회 자동 재생성. |
| **`IMAGE_STORAGE_STRICT`** | `true` (production) | base64 fallback 차단. Storage 실패 시 502. |
| **`DOCUMENT_STORAGE_STRICT`** | `true` | 견적서 PDF base64 차단 (Track B). |
| **`DRAWING_STORAGE_STRICT`** | `true` | 도면 PDF base64 차단 (Track B). |
| **`VISION_MATERIALS_EVAL_PASSED`** | (빈 값) | eval 통과 시만 `true`. 빈 값이면 mock/confidence 결과를 confirmed로 표시 X. |

---

## 3. Vercel 적용 순서

1. **Vercel 대시보드 → Project → Settings → Environment Variables**
2. **Production scope** 선택 (Preview/Development는 별도)
3. 위 1번 목록 그대로 입력
4. **`GOOGLE_GEMINI_API_KEY`** 항목 있으면 **Delete** (정책 차단됨)
5. **Save** → 다음 deployment부터 적용
6. (선택) **Redeploy** 강제 — 기존 deployment에 즉시 적용

---

## 4. Supabase 버킷 설정 (대시보드)

```sql
-- Supabase 대시보드 → Storage → New Bucket
-- 또는 SUPABASE_SERVICE_ROLE_KEY가 admin 권한이면 자동 생성됨 (5108a0a fix)
```

| Bucket | Public | 용도 |
|---|---|---|
| `renders` | ✅ public read | 이미지 렌더 결과 |
| `floorplans` | ✅ public read | 도면 normalized/clean/mask |
| `estimate-documents` (NEW) | ❌ signed URL only | 견적서 PDF (Track B) |
| `construction-drawings` (NEW) | ❌ signed URL only | 입면전개도 PDF (Track B) |

---

## 5. 출시 전 게이트 (검증)

### Gate A — RenderRoomSpec (Track A)

```bash
npx tsc --noEmit
# 테스트 (vitest 사용 시):
# npm test -- render-room-spec
```

**통과 조건**:
- 안방+안방발코니 비확장 → `balcony_sliding_door` 분류
- 안방 벽에 `exterior_window` 없음
- 컴파일된 prompt에 "NOT an exterior window" 포함
- validator errors 0건

### Gate B — Image Generation

```bash
npx tsx scripts/eval-image-generation.ts \
  --cases docs/inpick-image-generation/launch-critical-cases.json \
  --modes openai_edit \
  --out reports/eval-runs/launch-critical-20260511.jsonl
```

**통과 조건**:
- 안방발코니를 단순 창으로 만든 케이스 → 0건 또는 prompt 재생성으로 해결
- response imageUrl이 Supabase Storage URL (data URL X)
- 토큰 차감/환불 정상

### Gate C — 자재/SKU/견적

```bash
npx tsx scripts/eval-vision-materials.ts \
  --dataset gold-v1 \
  --runId vm-launch-20260511 \
  --out reports/vision-materials/launch-20260511.jsonl
```

**출시 기본 정책**:
- `VISION_MATERIALS_EVAL_PASSED!=true` → mock/confidence 결과 confirmed 표시 X (이미 코드에 enforce)
- 견적서에는 "추천 후보" 또는 "기본 기준"으로 표시

### Gate D — 운영

```text
[ ] Supabase renders bucket 존재 (또는 service_role 자동 생성)
[ ] IMAGE_STORAGE_STRICT=true
[ ] DOCUMENT_STORAGE_STRICT=true
[ ] DRAWING_STORAGE_STRICT=true
[ ] Toss live key 설정 또는 결제 mock UI 숨김
[ ] Kakao OAuth 미사용이면 로그인 진입 경로 정리
[ ] Vercel timeout 긴 route 확인 (parse-drawing 등 — Pro 권장)
[ ] GOOGLE_GEMINI_API_KEY 제거 확인
```

---

## 6. Rollback (긴급)

문제 발생 시 즉시 OpenAI 강제:

1. Vercel env 추가: `IMAGE_GEN_BACKEND=openai` (이미 default)
2. `RENDER_ROOM_SPEC_ENABLED=false` 설정 → 기존 path로 회귀
3. `IMAGE_STORAGE_STRICT=false` 설정 → base64 fallback 허용
4. Vercel **Redeploy** (1~2분)

---

## 7. 출시 후 v1 활성 조건

| 단계 | 조건 |
|---|---|
| **RENDER_QA_ENABLED=true** | render-qa.ts 모듈 작성 + Claude Vision 통합 |
| **VISION_MATERIALS_EVAL_PASSED=true** | gold dataset 30개 + no-hallucinated-SKU rate=100% + precision>=90% |
| **IMAGE_GEN_BACKEND=auto** | INPICK_EVAL_REPORT_PASSED=true (eval harness 통과) + RunPod inpick-renderer 실모델 배포 |
| **VISION_MATERIALS_LOAD_MODELS=true** | RunPod vision-materials Dockerfile.gpu 빌드 + endpoint 배포 |
| **BFL_COMMERCIAL_LICENSE_CONFIRMED=true** | BFL 상업 라이선스 계약 후만 |

---

## 8. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-11 | Launch-critical RenderRoomSpec — 출시 v0 환경변수 표준화 |

---

**작성**: Claude Opus 4.7
**관련 문서**: `docs/launch/LAUNCH_ERROR_AUDIT_20260511.md`
