# INPICK Apps in Toss API

운영 웹/API 코드를 변경하지 않기 위한 Apps in Toss 전용 서버다.

- 토스 mTLS 로그인 코드를 Supabase 세션으로 교환
- 앱인토스 IAP 주문 검증과 토큰/PDF 상품 지급·미결 주문 복구·환불 정합성 기록
- 패키지 앱의 Supabase Bearer 세션을 기존 웹앱이 읽는 세션 쿠키로 변환
- 기존 인픽 운영 AI·견적 API로 서버 간 중계
- 업체 입찰/RFQ API는 중계 단계에서 404 차단

이 프로젝트는 `apps-in-toss/inpick` 클라이언트와 함께 별도 Vercel 프로젝트로 배포한다.
운영 웹사이트 프로젝트의 코드나 환경변수는 변경하지 않는다.

- Vercel 프로젝트: `inpick-apps-in-toss-api`
- 운영 URL: `https://inpick-apps-in-toss-api.vercel.app`
- 검증: `npm run typecheck && npm test`

## 앱인토스 인앱결제(IAP)

- 상품 매핑: `GET /api/apps-in-toss/iap/catalog`
- 주문 검증·지급: `POST /api/apps-in-toss/iap/grant`
- 환불 정합성: `POST /api/apps-in-toss/iap/reconcile`
- 외부 상태 API: `https://apps-in-toss-api.toss.im`
- 필수 환경변수: `APPS_IN_TOSS_MTLS_CERT`, `APPS_IN_TOSS_MTLS_KEY`,
  `APPS_IN_TOSS_USER_HASH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`
- 선택 환경변수: 사설 CA가 별도로 필요한 경우 `APPS_IN_TOSS_MTLS_CA`

클라이언트의 `orderId`, SKU, 가격은 그대로 신뢰하지 않는다. 토스 로그인으로 얻은
userKey와 mTLS 주문 상태 API로 사용자·주문·SKU를 다시 검증하고,
`apps_in_toss_iap_orders`와 token ledger의 멱등 키로 중복 지급을 막는다. 실제 지급은
`provision_apps_in_toss_tokens_v1` 또는 `provision_apps_in_toss_pdf_v1` RPC 한
트랜잭션에서 처리하므로 부분 지급과 동시 충전 잔액 덮어쓰기도 차단한다.
콘솔 상품 등록 및 SKU 연결 절차는
`docs/mobile/APPS_IN_TOSS_IAP_RUNBOOK.md`를 따른다.

## 기존 앱인토스 페이(롤백 경로)

- 생성: `POST /api/apps-in-toss/payments/create`
- 승인: `POST /api/apps-in-toss/payments/execute`
- 외부 API: `https://pay-apps-in-toss-api.toss.im`
- 필수 환경변수: `APPS_IN_TOSS_MTLS_CERT`, `APPS_IN_TOSS_MTLS_KEY`,
  `APPS_IN_TOSS_USER_HASH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`
- 선택 환경변수: 사설 CA가 별도로 필요한 경우 `APPS_IN_TOSS_MTLS_CA`

클라이언트 금액은 신뢰하지 않고 `payment_products`의 활성 상품과 금액을 서버에서 다시
조회한다. 샌드박스는 결제 생성·인증까지만 기록하며 실제 승인이나 상품 지급은 하지 않는다.
라이브 결제 전에 앱인토스 콘솔에서 토스페이 이용 신청과 mTLS 키 등록이 완료되어야 한다.

토스 로그인을 실제로 사용하려면 앱인토스 콘솔에서 워크스페이스 소유자가
`토스 로그인` 약관에 동의하고 로그인 설정 검토를 요청해야 한다. 이 법적 동의는 코드나 배포 작업에서 대신 수행하지 않는다.
