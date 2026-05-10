# InPick 이미지 생성 — Production 진입 체크리스트

> 가이드: `c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md` Prompt 10 + §13
> 작성일: 2026-05-10 · Phase 10

이 문서를 **모두 통과한 뒤에만** RunPod backend default를 production으로 활성화한다.

## 0. Backend default 변경 정책

```
production NODE_ENV + IMAGE_GEN_BACKEND=runpod (또는 auto) 동시 설정 시:
  → INPICK_EVAL_REPORT_PASSED=true 도 같이 설정해야 적용됨.
  → 미설정 시 select-backend.ts가 console.warn + force "openai".
```

가이드 §13 명시: **"evaluation report 없이는 backend default를 runpod로 바꾸지 않기"**.

## 1. Phase 별 완료 확인

| Phase | 대상 | 확인 |
|---|---|---|
| 1 | Backend adapter | ✅ commit `bf62735` |
| 2 | Async job + polling | ✅ commit `383530d` |
| 3 | Storage URL abstraction | ✅ commit `0580a46` |
| 4 | RoomGeometry/ControlPlan 타입 | ✅ commit `ae8d52d` |
| 5 | RunPod worker scaffold | ✅ commit `8a47e7f` |
| 6 | Geometry proxy 실제 PIL 구현 | ✅ commit `f5b4e9d` |
| 7 | Eval harness | ✅ commit `957de84` |
| 8 | LoRA 데이터 큐레이션 (스크립트) | ✅ commit `2b58eaf` |
| 9 | Step2 polling 통합 | ✅ commit `905ff08` |
| 10 | Production guardrail | ✅ (이 문서) |

## 2. 모델 정책 enforcement

- [ ] `src/lib/inpick/image-backends/model-policy.ts`에 사용 모델 등록 + 라이선스 명시
- [ ] FLUX.1-dev 사용 안 함 (또는 `BFL_COMMERCIAL_LICENSE_CONFIRMED=true` + 계약서 보유)
- [ ] RunPod worker `runpod_serverless/inpick-renderer/pipelines/model_registry.py` 동기화
- [ ] `RENDERER_RUNTIME=production` (RunPod 환경변수)
- [ ] 미등록 모델 호출 시 production에서 throw 확인

## 3. Storage / Output 정책

- [ ] `IMAGE_STORAGE_PROVIDER=supabase` (또는 R2/S3 추후)
- [ ] `IMAGE_STORAGE_BUCKET=renders` (Supabase 대시보드에서 bucket 생성 + public 권한 또는 RLS read-only)
- [ ] **base64 production 응답 금지 동작 확인** (storage 미설정 시 502 에러)
- [ ] `output.uploadUrl` + `publicUrl` 페어를 render-room API가 RunPod에 전달
- [ ] `pocAllowBase64` 와 `output.allowBase64Fallback` 둘 다 false 강제 (production)

## 4. Job / 상태 관리

- [ ] `image_generation_jobs` 테이블 마이그레이션 적용 완료
- [ ] async polling 정상 작동 (Phase 9 client + Phase 2 jobs route)
- [ ] job retention 정책 (30일 이상 된 completed/failed job 정리 — 별도 cleanup 작업)
- [ ] job timeout 설정 (default 5분 — 클라이언트 + 서버 양쪽)
- [ ] retry 정책: 사용자가 재시도 누르면 신규 jobId (멱등 X — 의도)

## 5. 비용 / 로깅

- [ ] generation 메타데이터 모두 기록:
  - [ ] cold start (boolean)
  - [ ] elapsed_ms
  - [ ] modelId / license
  - [ ] seed
  - [ ] control mode (geometry_proxy / floorplan_canny / openai_edit / prompt_only)
  - [ ] backend (openai / runpod)
  - [ ] cost_usd (estimate or actual)
  - [ ] delivery (uploaded / base64)
- [ ] **costUsd 고정값 X** — 가이드 §12 금지 ("0.02달러 고정 계산" 금지)

## 6. Content filter / review hook

- [ ] `src/lib/inpick/image-backends/content-filter.ts` placeholder 통합 위치 확인
- [ ] `INPICK_CONTENT_FILTER_ENABLED=true` 시 활성화 (Phase 11+에서 실제 분류기 통합)
- [ ] `content_review_queue` 테이블 placeholder (Phase 11+)

## 7. Data license ledger (LoRA)

- [ ] `data/inpick-style/license-ledger.jsonl` 사람 검증 100% 완료
  - 모든 entry의 `verification: "verified"` 또는 `"rejected"`
  - 0건 `pending` 상태로 LoRA 학습 진입 X
- [ ] `external` / `unknown` source는 `verification: "rejected"`만 가능
- [ ] `MANIFEST.jsonl` 에서 commercial+training 둘 다 true인 항목만 export 확인

## 8. Evaluation harness (Phase 7) 통과

- [ ] 최소 N >= 10 cases 실행 완료
- [ ] 통과 기준 충족:
  - [ ] `geometry_proxy.geometry_score` 평균 >= `flat_canny.geometry_score` + 0.5
  - [ ] `geometry_proxy.openings_score` 평균 >= `flat_canny.openings_score` + 0.5
  - [ ] `geometry_proxy.usability_score` 평균 >= 3
- [ ] **결과 보고서**가 `reports/eval-runs/REPORT-{date}.md` 형태로 commit
- [ ] 보고서 작성자 + 검토자 명시
- [ ] **그 후에만** `INPICK_EVAL_REPORT_PASSED=true` Vercel/RunPod에 설정

## 9. Rate limit / Credit policy

- [ ] `enforceConsume` (credit-policy.ts) 정상 작동
- [ ] `enforceRateLimit` (rate-limit.ts) — Vercel KV 설정 또는 fail-open 명시
- [ ] 환불 정책: 외부 API 실패 시 자동 환불 작동 확인

## 10. Rollback 방법

문제 발생 시 즉시 RunPod 백엔드 비활성화:

1. **Vercel 환경변수에서 `IMAGE_GEN_BACKEND=openai` 강제 설정**
2. 또는 `INPICK_EVAL_REPORT_PASSED` 제거 → guardrail가 자동 force "openai"
3. 신규 redeploy 또는 Vercel "Redeploy" 버튼
4. 진행 중인 RunPod jobs는 그대로 완료 또는 timeout — 신규 job은 즉시 OpenAI로

**걸리는 시간**: 1~2분 (Vercel deployment).

## 11. Risk register (남은 위험)

| 위험 | 완화 방법 | 상태 |
|---|---|---|
| RunPod cold start 60~120초 → UX 저하 | active worker 1개 유지 또는 사용자에게 ETA 표시 | 미완 |
| OpenAI 결제 한도 초과 → 전체 불가 | 모니터링 + 한도 알람 + multi-key fallback | 부분 |
| FLUX.1-dev 우발적 사용 | model-policy 양쪽 enforce | ✅ |
| base64 production 누설 | storage upload 강제 | ✅ |
| LoRA 학습 데이터 정책 위반 | curate 스크립트 자격 4 조건 | ✅ |
| Content NSFW/trademark 누락 | Phase 11+에서 분류기 통합 필요 | ⚠ placeholder |
| 비용 폭주 (rate limit 우회) | rate-limit + credit policy | ✅ |

## 12. Env 설정 표 (production)

| 환경변수 | 값 | 비고 |
|---|---|---|
| `NODE_ENV` | `production` | Vercel 자동 |
| `IMAGE_GEN_BACKEND` | `openai` (default) → `auto` (Phase 7+ 통과 후) | |
| `IMAGE_GEN_MODE` | `sync` (default) → `async` (Phase 9 활성 시) | |
| `INPICK_EVAL_REPORT_PASSED` | `true` (eval 통과 후만) | guardrail 해제 |
| `INPICK_IMAGE_MODEL_ID` | `black-forest-labs/FLUX.2-klein-4b` | RunPod default |
| `OPENAI_IMAGE_FALLBACK_ENABLED` | `true` | auto 모드 시 RunPod 실패 → OpenAI |
| `BFL_COMMERCIAL_LICENSE_CONFIRMED` | `false` (default) → `true` (계약 후) | FLUX.1-dev override |
| `IMAGE_STORAGE_PROVIDER` | `supabase` | |
| `IMAGE_STORAGE_BUCKET` | `renders` | |
| `IMAGE_PUBLIC_BASE_URL` | (옵션 — CDN) | |
| `INPICK_CONTENT_FILTER_ENABLED` | `false` (Phase 10) → `true` (Phase 11+) | |
| `RENDERER_RUNTIME` (RunPod) | `production` | RunPod env |
| `OPENAI_API_KEY` | (현재 키) | InPick 전용 project |

## 13. 이상 변경 금지 (가이드 §12)

- ❌ FLUX.1-dev로 production 자체 호스팅
- ❌ 평면도 Canny만으로 구조 보존 가설
- ❌ LoRA로 도면→렌더 페어 학습
- ❌ Pinterest 등 외부 이미지 학습
- ❌ "이젠 OpenAI 코드 필요 없으니 지움"
- ❌ runsync로 production 일괄 처리
- ❌ base64 data URL을 그대로 프론트 반환
- ❌ 비용을 호출당 고정 $0.02로 계산

## 14. Sign-off

```
[ ] CTO/Tech Lead: __________ Date: ____________
[ ] Legal/Compliance: __________ Date: ____________
[ ] Product: __________ Date: ____________
```

## 15. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-10 | Phase 10 초기 — guardrail + checklist + content filter placeholder |
