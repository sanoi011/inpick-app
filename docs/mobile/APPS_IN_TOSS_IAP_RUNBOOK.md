# InPick Apps in Toss 인앱결제 등록·출시 런북

기준일: 2026-07-23

대상 앱: `inpick`

상품 명세: `docs/mobile/APPS_IN_TOSS_IAP_PRODUCTS.json`

## 1. 이번 구현의 결제 경로

```text
앱인토스 콘솔 노출 상품
  → IAP.getProductItemList()
  → 사용자가 상품 선택
  → IAP.createOneTimePurchaseOrder()
  → orderId 발급 및 앱마켓 결제
  → InPick API /api/apps-in-toss/iap/grant
  → mTLS 주문 상태 API로 orderId + Toss userKey + SKU 검증
  → payment_intents / payments / apps_in_toss_iap_orders 기록
  → token_ledger 또는 user_entitlements에 멱등 지급
  → true 반환 후 Toss가 지급 완료 처리
```

앱 시작 시 `getPendingOrders()`를 호출해 결제 완료 후 지급이 실패한 주문을
재처리하고, 성공한 주문은 `completeProductGrant()`로 완료합니다. 환불 내역은
`getCompletedOrRefundedOrders()`로 확인한 뒤 서버에서 mTLS 재검증하여
`payment_reconciliation_jobs`에 회수 검토 작업을 만듭니다.

## 2. 콘솔 선행 조건

1. 워크스페이스 사업자 정보를 등록합니다.
2. 정산 정보를 입력하고 검토를 완료합니다.
3. 서버용 mTLS 인증서를 발급합니다.
4. Vercel `inpick-apps-in-toss-api`에 아래 환경 변수를 설정합니다.

```text
APPS_IN_TOSS_MTLS_CERT
APPS_IN_TOSS_MTLS_KEY
APPS_IN_TOSS_MTLS_CA
APPS_IN_TOSS_USER_HASH_SECRET
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## 3. 상품 등록

`APPS_IN_TOSS_IAP_PRODUCTS.json`의 5개 상품을 모두 `소모품`으로 등록합니다.
토큰은 사용하면 소진되고, 계약견적서도 특정 견적 1건에 쓰는 1회 이용권이므로
비소모품으로 등록하지 않습니다.

모든 상품에 아래 한 장을 공용으로 업로드합니다.

```text
apps-in-toss/inpick/inpick-source/public/iap/inpick-token-1024.png
PNG / 1024×1024 / RGB / SHA-256:
6e6584065eb4e8b9920672eeddeeadb64695d5b372f923dc0281e1a739477795
```

상품 생성 직후에는 노출을 `OFF`로 둡니다. 콘솔이 발급한 SKU와 자동 계산된
판매가를 복사한 다음에만 노출을 켭니다.

### 가격 주의

앱인토스 콘솔의 공급가는 VAT 별도이고 10원 단위입니다. 기존 InPick 판매가 중
5,000원, 15,000원, 50,000원, 150,000원은 이 조건으로 정확히 역산되지
않습니다. 명세에는 기존 가격과 오차가 가장 작은 공급가를 넣었습니다.

| 내부 상품 | 콘솔 공급가 | 예상 판매가 | 기존 판매가 |
|---|---:|---:|---:|
| `ai_credit_10` | 4,550원 | 5,005원 | 5,000원 |
| `ai_credit_30` | 13,640원 | 15,004원 | 15,000원 |
| `ai_credit_100` | 45,450원 | 49,995원 | 50,000원 |
| `ai_credit_300` | 136,360원 | 149,996원 | 150,000원 |
| `estimate_pdf_single` | 9,000원 | 9,900원 | 9,900원 |

콘솔이 실제로 표시한 판매가가 표와 다르면 콘솔 값을 정본으로 사용하고
`apps_in_toss_sale_amount_krw`도 같은 값으로 바꿉니다. 미니앱 UI는 하드코딩한
가격이 아니라 SDK의 `displayAmount`를 표시합니다.

## 4. 콘솔 SKU를 Supabase에 연결

먼저 마이그레이션을 적용합니다.

```text
supabase/migrations/20260723020000_apps_in_toss_iap.sql
```

그 다음 콘솔에서 발급된 SKU와 실제 판매가를 아래 템플릿에 넣어 실행합니다.
SKU를 모르는 상태에서 임의 문자열을 만들면 안 됩니다.

```sql
UPDATE payment_products
SET apps_in_toss_sku = '<ai_credit_10 콘솔 SKU>',
    apps_in_toss_sale_amount_krw = <콘솔 판매가>,
    apps_in_toss_enabled = TRUE
WHERE code = 'ai_credit_10';

UPDATE payment_products
SET apps_in_toss_sku = '<ai_credit_30 콘솔 SKU>',
    apps_in_toss_sale_amount_krw = <콘솔 판매가>,
    apps_in_toss_enabled = TRUE
WHERE code = 'ai_credit_30';

UPDATE payment_products
SET apps_in_toss_sku = '<ai_credit_100 콘솔 SKU>',
    apps_in_toss_sale_amount_krw = <콘솔 판매가>,
    apps_in_toss_enabled = TRUE
WHERE code = 'ai_credit_100';

UPDATE payment_products
SET apps_in_toss_sku = '<ai_credit_300 콘솔 SKU>',
    apps_in_toss_sale_amount_krw = <콘솔 판매가>,
    apps_in_toss_enabled = TRUE
WHERE code = 'ai_credit_300';

UPDATE payment_products
SET apps_in_toss_sku = '<estimate_pdf_single 콘솔 SKU>',
    apps_in_toss_sale_amount_krw = <콘솔 판매가>,
    apps_in_toss_enabled = TRUE
WHERE code = 'estimate_pdf_single';
```

등록이 끝나기 전에는 `apps_in_toss_enabled=FALSE`이므로, 잘못된 상품이나 가격이
사용자에게 노출되지 않습니다.

## 5. 배포 순서

1. Supabase 마이그레이션을 적용합니다.
2. 앱인토스 API를 배포합니다.
3. 콘솔 상품 5개를 생성하고 SKU를 Supabase에 연결합니다.
4. 샌드박스에서만 상품 노출을 켭니다.
5. 미니앱을 새 빌드로 업로드합니다.
6. 아래 필수 테스트를 모두 통과한 후 라이브 노출을 켭니다.

## 6. 필수 테스트

### 성공

- 콘솔의 노출 `ON` 상품 5개가 앱에 표시되는지
- 상품명, 이미지, `displayAmount`가 콘솔과 같은지
- 토큰 상품 결제 후 정확한 유료/보너스 토큰이 한 번만 지급되는지
- 계약견적서 결제 후 현재 견적의 PDF 권한이 생기는지

### 결제 성공 + 지급 실패

- 테스트 서버가 `/iap/grant`에서 실패하도록 한 번 유도
- 사용자에게 지급 지연 안내가 보이는지
- 앱 재실행 시 `getPendingOrders()`로 자동 복구되는지
- 복구 후 `completeProductGrant()`가 호출되고 잔액이 갱신되는지

### 오류와 중복

- 사용자 취소 시 오류 경고를 띄우지 않는지
- 네트워크 오류 시 재실행 복구 안내가 보이는지
- 동일 `orderId`를 반복 호출해도 토큰/권한이 한 번만 지급되는지
- 다른 Toss userKey의 주문을 지급할 수 없는지
- 환불 주문이 `refunded`로 기록되고 회수 검토 작업이 생성되는지

## 7. 콘솔 자동화 제약

앱인토스 공식 Console MCP는 현재 Claude 연결을 우선 지원합니다. Codex에 해당
MCP가 연결되지 않은 환경에서는 콘솔의 로그인 상태와 워크스페이스를 대신
조작할 수 없습니다. 이 경우 이 JSON 명세와 공용 이미지를 이용해 콘솔에서
등록한 뒤, 발급 SKU 5개만 위 SQL에 반영하면 코드 변경 없이 연결됩니다.

공식 문서:

- https://developers-apps-in-toss.toss.im/iap/intro.html
- https://developers-apps-in-toss.toss.im/iap/develop.html
- https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html
- https://developers-apps-in-toss.toss.im/prepare/console-mcp.html
