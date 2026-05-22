# Toss 심사 대기 — 결제창 미표시 원인 감사

> 작성: 2026-05-23 (파일명은 지시 기준 20260522 유지)
> 결론 요약: **결제창이 안 뜨는 것은 Toss 심사 문제가 아니다.** ① Toss 키가 어디에도 설정돼 있지 않고, ② 메인 결제 경로(TokenPurchaseDrawer)가 Toss SDK를 아예 호출하지 않는 미완성 stub이기 때문이다.

---

## 0. 결제 흐름 현황 (코드 기준)

```
[메인 경로] /mypage/billing → "토큰 충전" → TokenPurchaseDrawer
  → GET /api/billing/products (상품 + providerMode)
  → POST /api/payments/checkout (intent 생성 + clientKey 반환)
  → ❌ Toss SDK 미호출. clientKey 있으면 "다음 배포에서 활성화" 안내만 표시 (stub)

[레거시 경로] CreditChargeModal (project 워크플로우 내 토큰 부족 시)
  → POST /api/payments/checkout
  → loadTossSDK() (js.tosspayments.com/v1/payment) → window.TossPayments(data.clientKey).requestPayment()
  → successUrl: /payments/success?orderId=...

[복귀] /payments/success → POST /api/payments/confirm (paymentKey/orderId/amount)
  → Toss /v1/payments/confirm → payments insert → creditTokensAfterPayment / grant (인라인)
[webhook] POST /api/payments/webhook → finalizePaymentProvisioning()
```

---

## 1. 환경변수 점검 (체크리스트)

| 키 | 로컬 `.env.local` | Vercel(prod) | 비고 |
|----|------------------|--------------|------|
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | **빈 값(0자)** | **없음** | 브라우저 SDK 초기화에 필요. 없음 = 결제창 불가 |
| `TOSS_PAYMENTS_CLIENT_KEY` | **빈 값(0자)** | **없음** | checkout이 응답 `clientKey`로 사용하는 키 (서버 변수) |
| `TOSS_PAYMENTS_SECRET_KEY` | **빈 값(0자)** | **없음** | confirm 시 Toss 승인 호출 (Basic Auth) |
| `TOSS_WEBHOOK_SECRET` | **빈 값(0자)** | **없음** | webhook 서명 검증 |
| `NEXT_PUBLIC_SITE_URL` | `inpick-app.vercel.app` (설정됨) | 설정됨 | ⚠️ 실 운영도메인은 `interiorpick.co.kr` — 불일치 (successUrl 도메인 영향) |

> Vercel 환경변수 실측(2026-05-22)에 `TOSS_*` 키가 **하나도 없음** 확인. → **이것이 결제창 미표시의 1차 원인.**

### 키 이름 혼선 (체크리스트 §2 확인)
- 브라우저 SDK는 `NEXT_PUBLIC_` 접두 키만 직접 읽을 수 있음.
- 현재 코드는 checkout **응답 body의 `clientKey`**(서버 `TOSS_PAYMENTS_CLIENT_KEY`)를 SDK에 넘기는 방식 → `NEXT_PUBLIC_TOSS_CLIENT_KEY` 직접 참조는 `CreditChargeModal`의 안내 문구 분기에서만 사용.
- **권장 통일안**: SDK 클라이언트 키는 `NEXT_PUBLIC_TOSS_CLIENT_KEY` 하나로 통일하고, checkout 응답의 `clientKey`도 같은 값을 사용. (지금은 두 변수가 의미 혼재)

---

## 2. 결제창 미표시 — 근본 원인 (우선순위)

### 🔴 원인 1: Toss 키 전무 (1차 원인)
로컬·Vercel 모두 client key 없음 → SDK 초기화/`requestPayment` 불가. 메인/레거시 경로 둘 다 결제창을 열 수 없음.

### 🔴 원인 2: 메인 경로가 Toss SDK 미통합 (코드 미완성)
`TokenPurchaseDrawer.handlePurchase()` (`src/components/billing/TokenPurchaseDrawer.tsx:140-147`):
```ts
// Production: Toss Widget 호출 필요
if (result.clientKey && result.successUrl) {
  setErrorMsg("Toss SDK 통합은 다음 배포에서 활성화됩니다. 현재는 Mock 모드만 동작합니다.");
  return;
}
```
→ **키가 들어와도 메인 결제창은 안 뜬다.** 실제 SDK 호출 코드가 없는 stub. (레거시 `CreditChargeModal`만 SDK 호출 구현됨)

### 🟡 원인 3: mock 차단 후 503 (의도된 안전 상태)
직전 커밋(`88070c1`)으로 mock 자동지급을 막아, 프로덕션에서 키 없으면 checkout이 `503 no_active_payment_provider` 반환. → 무료지급은 막혔으나, 사용자에겐 "결제 안 됨"으로 보임. **이 상태를 §심사대기 UI로 명확히 표시 필요(지시 Part 2).**

### 🟡 원인 4 후보 (해당 없음 / 확인 결과)
- **인증 실패(requireConsumerUser)**: checkout은 `supabase.auth.getUser()` 사용. 로그인 정상이면 통과. 단 **consumer_profiles row 없으면 403 `profile_required`** → orphan 회원은 결제 차단됨. (앞선 Auth 정밀화로 orphan self-heal 추가됨 → 위험 완화)
- **active 상품 없음**: `payment_products` seed에 `ai_credit_10/30/100` 활성 존재(마이그 적용 가정). `/api/billing/products`/`/api/payments/products` 정상 응답 예상.
- **checkout 응답 필드**: orderId/amount/orderName/customerKey/successUrl/failUrl/clientKey 포함(키 있을 때). 구조 정상.
- **server component에서 SDK 호출**: 아님. 두 결제 컴포넌트 모두 `"use client"`.

---

## 3. confirm / webhook 정합성 점검 (절대원칙 §6, §7)

| 항목 | 현황 | 평가 |
|------|------|------|
| 단일 finalizer | `finalizePaymentProvisioning()` 존재, **webhook은 호출, confirm은 인라인 로직 사용** | ⚠️ 불일치 — confirm도 finalizer 호출로 통일 권장 |
| 중복 지급 방지 | intent.status='paid' idempotent + `payments.payment_key` UNIQUE + ledger idempotency | ✅ 다중 가드 존재 |
| amount 위조 차단 | confirm에서 서버 amount 대조 + `recordAmountMismatch` + Toss 응답 totalAmount 재검증 | ✅ |
| successUrl 단독 지급 방지 | confirm이 Toss 승인 API를 직접 호출 → successUrl 도착만으론 미지급 | ✅ |
| success 페이지 필드 | success 페이지가 `data.credits`/`data.newBalance` 참조하나 confirm은 `creditsAdded`/`balanceAfter` 반환 | 🟡 표시값 0으로 보이는 경미 버그 |

---

## 4. 즉시 조치 / 권장 순서

1. **(대표) Vercel에 Toss 테스트 키 등록** — `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...`, `TOSS_PAYMENTS_SECRET_KEY=test_sk_...`, (선택)`TOSS_WEBHOOK_SECRET`. `NEXT_PUBLIC_SITE_URL`을 운영도메인(`https://interiorpick.co.kr`)으로 정정.
2. **(코드) TokenPurchaseDrawer에 실제 Toss SDK 호출 구현** — stub 제거, `requestPayment` 연결.
3. **(코드) 심사 대기 UI** — 일반 사용자에겐 결제 버튼 숨김/disabled + "심사 중" 표시, 테스터/관리자만 테스트 결제 허용 (Part 2).
4. **(코드) confirm을 finalizePaymentProvisioning로 통일** (Part 원칙 §6) + success 페이지 응답 필드 정합.
5. **(코드) 관리자 수동 지급 정리** — token_ledger/user_entitlements/audit (Part 3).
6. **(코드) /admin/settings·payment-center에 Toss 키 prefix(test/live)·secret 존재여부·결제모드 표시** (Part 4).
7. **(대표) Toss live 심사 통과 후** live 키 교체 → 코드 변경 없이 전환.

---

## 5. 결론
- 결제창 미표시 = **키 부재(1차) + 메인 경로 SDK 미통합(2차)**. 결제사 교체 불필요.
- 인프라(상품/intent/payments/finalizer/ledger/entitlement/대사)는 이미 구비됨. **테스트 키 등록 + SDK 호출 연결 + 심사대기 UI**만 채우면 테스트 결제 플로우 완성 가능.
