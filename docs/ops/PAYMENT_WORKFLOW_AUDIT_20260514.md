# Payment / Token / Workflow Audit — 2026-05-14

> 가이드: `inpick-payment-saas-flow-uiux-improvement-plan-20260514.md` §1 P0 코드 감사
> 결제·토큰·이미지·견적·PDF 흐름의 분쟁 가능성 매핑

---

## 1. Render API 직접 호출 위치 (Step2 우회 경로)

### 1-1. `src/components/workflow/Step2Designer.tsx`
- **L753**: `fetch("/api/inpick/render-photo-style")` 직접 호출
- 응답 받으면 클라이언트 `onChange()`로 state 갱신
- `void saveDesignOutputAfterRender({...})` — fire-and-forget으로 design_outputs 저장
  - **문제**: 이 저장이 실패해도 워크플로는 계속 진행됨. 토큰 차감은 render API 내부에서 이미 일어남.
- **분쟁 시나리오**: 토큰 차감 성공 → image_url 받음 → DB 저장 실패 → 새로고침하면 이미지 사라짐 → 사용자는 "토큰을 썼는데 결과물이 없다"고 주장
- **해결**: P4 Generation Job Wrapper로 reserve → generate → persist → commit 구조로 묶어야 함

### 1-2. 다른 render 호출자
| 파일 | 용도 |
|---|---|
| `src/lib/inpick/render-room-client.ts` | render-room 클라이언트 (공통) |
| `src/app/inpick-design/page.tsx` | 데모 페이지 (사용자 워크플로 아님) |
| `src/app/admin/page.tsx` | 관리자 테스트 |

→ Step2Designer만 사용자 결제 경로. 다른 곳은 우회 검증 불필요.

---

## 2. 토큰 차감 위치 (`enforceConsume`)

### 2-1. `/api/inpick/render-room/route.ts:62`
```ts
let charge: Awaited<ReturnType<typeof enforceConsume>> | null = null;
// ...
charge = await enforceConsume("render-room", { ... });
// 외부 API 호출 (OpenAI/RunPod)
// 실패 시 refundCredits()
```
- **순서**: 인증 → enforceConsume(차감) → 이미지 생성 → 실패 시 refund
- **누락**: design_outputs 저장 실패는 호출자(Step2Designer)에서 처리. render API는 image URL만 반환하고 종료
- **결과**: render API 관점에서는 토큰 차감과 storage 업로드만 보장. DB 영속화는 보장 X

### 2-2. enforceConsume의 토큰 소스 (`src/lib/inpick/credit-policy.ts`)
- 우선순위 3-tier:
  1. RPC `deduct_tokens` (user_tokens) — **현재 운영 DB에 없음** (`20260426000000_token_system.sql` 미적용)
  2. `user_credits` 테이블 직접 차감 → 회원가입 +10 보너스가 여기 들어감
  3. `user_tokens` 테이블 직접 차감 — 없음
- **실 운영**: 2번 폴백 = `user_credits` 사용 중

### 2-3. 신규 `token_wallets / token_ledger` 시스템과 분리됨
- `token_wallets`는 결제 충전 경로(`creditTokensAfterPayment`)에서만 갱신
- `enforceConsume`은 `user_credits`만 차감 → 결제·소비가 별도 시스템
- **분쟁**: 사용자 보유 토큰 표시가 두 곳에서 다를 수 있음

---

## 3. successUrl 권한 지급 여부

### 3-1. `src/app/payments/success/page.tsx`
- 검증 결과: **권한 직접 지급 X**
- `useEffect`로 `/api/payments/confirm`만 호출 (paymentKey/orderId/amount를 클라이언트가 보냄)
- **잠재 위험**:
  - confirm 호출이 네트워크 실패 시 권한 미지급
  - **webhook로 보강 가능** (`/api/payments/webhook` 라우트 존재, DONE 이벤트 시 보정)
- **확인됨**: successUrl만으로 권한 지급하는 코드 없음 ✅

### 3-2. confirm 라우트 (`/api/payments/confirm/route.ts`)
- 서버에서 `payment_intents.amount_krw` 와 클라이언트 amount 비교
- 불일치 시 `payment_reconciliation_jobs` 생성 + 차단 ✅
- `pdf_estimate_single` 상품 분기 있음 (entitlement 발급) ✅

### 3-3. webhook 라우트 (`/api/payments/webhook/route.ts`)
- event_key UNIQUE로 중복 차단 ✅
- DONE 이벤트 시 `creditTokensAfterPayment` 호출
- **누락**: `product_type === "pdf_estimate_single"` 분기 없음 → PDF 결제가 webhook으로만 도착하면 entitlement 미발급
- **해결**: P3 `finalizePaymentProvisioning` 단일화로 confirm + webhook 양쪽이 같은 로직 호출하도록

---

## 4. 클라이언트 amount 위조 가능성

### 4-1. confirm 호출 (`/payments/success/page.tsx:36`)
```ts
body: JSON.stringify({
  paymentKey, orderId,
  amount: Number(amount),     // ← URL query
  credits: Number(creditAmount),   // ← URL query (서버에서 무시됨)
  userId: user.id,            // ← 서버에서 supabase.auth.getUser()로 대체
})
```
- **amount**: 서버에서 product.amount_krw와 비교, 불일치 시 차단 ✅
- **credits**: 서버에서 무시 (product에서 다시 조회) ✅
- **userId**: 서버에서 무시 (auth 토큰으로 대체) ✅

### 4-2. 평가
- 정상 동작 확인. 다만 amount 위조 차단은 confirm 라우트의 정합성에 전적으로 의존
- **권고**: P3에서 confirm + webhook 공통 finalizer에 amount mismatch 차단 강제

---

## 5. payment_intents.metadata 위조 가능성

### 5-1. checkout 호출 시 body로 받음
```ts
// /api/payments/checkout/route.ts
metadata: {
  productCode: prod.code,
  returnPath: body.returnPath,
  estimateId: body.estimateId,           // ← 클라이언트 입력
  consumerProjectId: body.consumerProjectId, // ← 클라이언트 입력
}
```
- **문제**: 사용자가 다른 사용자의 estimateId/consumerProjectId를 보내면 그 견적에 대한 PDF entitlement가 발급됨
- **위험도**: 중간 — 결제 자체는 본인 결제이므로 본인 진영이지만, "타인의 견적 PDF를 자기 권한으로 받을 수 있는" 시나리오
- **해결**: P5에서 checkout 시 서버에서 estimateId/projectId 의 owner=user.id 검증 추가 필요

---

## 6. design_outputs / estimate_contexts 영속화

### 6-1. design_outputs
- Step2에서 fire-and-forget으로 저장
- 실패해도 사용자에게 알림 X
- 새로고침 시 클라이언트 state는 사라지지만 DB에 일부 저장돼 있을 수도 있음 — 일관성 X

### 6-2. estimate_contexts
- `/api/inpick/estimate-context/finalize` 존재 (Step1 + Step2 snapshot 저장)
- Step3 진입 시 contextId 기반으로 동작 ✅
- **확인 필요**: 현재 Step3에서 contextId 없이 진입 시 fallback 동작

### 6-3. workflow_state (consumer_projects.workflow_state JSONB)
- 3-way merge 시스템 존재 (`20260513030000`)
- Step2 mount 시 복원에 사용
- **확인 필요**: design_outputs와 workflow_state가 동기화되는지

---

## 7. PDF entitlement consume 흐름

### 7-1. 현재 흐름 (`/workflow/estimate/page.tsx`)
1. `check-access?consumerProjectId=` → granted/required 판단
2. granted면 즉시 `downloadEstimatePdf()` 실행 → PDF 발급 + 다운로드 + consume API 호출
3. **분쟁 포인트**: download 호출과 consume 호출 사이에 실패 시 사용자는 PDF 못 받음 + entitlement는 사용됨

### 7-2. MD §3-3 정책 변경 (PDF 1회 다운로드권 → 견적서 1건 발급권)
- 같은 estimateVersion은 재다운로드 무료
- PDF asset 생성 성공 후 consume
- **현재**: `consumeEntitlement(entitlementId)`는 클라이언트에서 다운로드 후 호출 — 서버에서 PDF 생성 후 consume이 더 안전

---

## 8. Legacy user_credits 의존성

### 8-1. 사용 위치
| 파일 | 용도 | 정리 우선순위 |
|---|---|---|
| `src/app/api/admin/credits/route.ts` | 관리자 크레딧 조회/부여 | 낮음 (관리자 UI만) |
| `src/app/api/admin/seed-test-accounts/route.ts` | 테스트 계정 시드 | 낮음 |
| `src/app/api/admin/stats/route.ts` | 대시보드 통계 | 낮음 |
| `src/hooks/useCredits.ts` | 클라이언트 잔액 조회 | **중간** (UI 표시) |
| `src/lib/inpick/credit-policy.ts` | enforceConsume 폴백 | **높음** (실제 차감) |

### 8-2. 권고
- 신규 코드는 `token_wallets` / `token_ledger`만 사용
- 레거시 `user_credits`는 관리자 통계 표시용으로만 유지 (점진적 마이그레이션)
- `enforceConsume`은 P2 token-transaction-service로 대체

---

## 9. 정리: 분쟁 가능 시나리오 매트릭스

| 시나리오 | 현재 상태 | 위험도 | 해결 Phase |
|---|---|---|---|
| 결제 성공 후 토큰 미지급 | webhook으로 보강 | 낮음 | P3 단일화로 더 강화 |
| 결제 성공 후 PDF entitlement 미발급 | webhook 분기 없음 | **높음** | P3 |
| 토큰 차감 후 design_outputs 미저장 | fire-and-forget | **높음** | P4 wrapper |
| Step2 새로고침 시 이미지 손실 | workflow_state 복구 시도 | 중간 | P4 (mount restore) |
| Step3 contextId 없이 진입 | fallback 존재 | 중간 | P4 finalize 강제 |
| PDF 다운로드 후 다시 다운로드 불가 | 단발권 모델 | **높음** | P5 발급권 모델로 |
| 클라이언트 amount 변조 | 차단됨 | 낮음 | — |
| 클라이언트 metadata 위조 | 검증 없음 | 중간 | P5 ownership 검증 |
| user_credits / token_wallets 잔액 불일치 | 두 시스템 공존 | 중간 | P2 점진적 통합 |

---

## 10. 다음 단계 (이 감사 기반)

P1 마이그레이션부터 진행. 새 테이블 4개:
1. `token_charge_intents` — reserve/commit 추적
2. `generation_jobs` — Step2 wrapper 본격 도입 (기존 `image_generation_jobs`와 별도 일반화 테이블)
3. `workflow_step_snapshots` — Step1/2/3 영속 복구
4. `reconciliation_cases` — 8개 case 타입 자동 감지

P2: token-transaction-service
P3: finalizePaymentProvisioning 단일화 (confirm + webhook 공통)
P4: Generation Job Wrapper API + Step2 mount restore
P5: PDF entitlement 발급권 모델로 변경
P6: /mypage/billing + /admin/reconciliation
P7: UX 컴포넌트 (TokenPurchaseDrawer, PaymentStatusStepper, GenerationJobProgressCard)

각 Phase 단계별로 코드 검토 후 적용.
