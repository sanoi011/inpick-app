# INPICK iOS App Store 출시 가이드

> 작성일: 2026-05-19
> 대상: 대표님 직접 작업용
> 전제: `INPICK_IOS_APP_STORE_APP_DEV_PLAN_20260519.md`

## 1. 앱 식별 정보

```
Bundle ID: kr.inpick.app
App Name: INPICK (한국어), INPICK (영어)
Primary Category: Lifestyle (또는 Business)
Min iOS Version: 14.0
Capacitor 패키징: ✓ (capacitor.config.ts 작성 완료)
```

## 2. 단계별 작업 (대표님)

### 2-1. Apple Developer Program 가입
1. https://developer.apple.com/programs/enroll
2. 법인(대영토건) 권장 — D-U-N-S Number 신청 (무료, 5~10일)
3. $99/년 결제

### 2-2. Bundle ID 등록
1. https://developer.apple.com/account/resources/identifiers
2. App IDs → + → Explicit → `kr.inpick.app`
3. Capabilities: Sign In with Apple, In-App Purchase, Push Notifications, Universal Links

### 2-3. App Store Connect 앱 생성
1. https://appstoreconnect.apple.com → My Apps → +
2. Bundle ID: kr.inpick.app 선택
3. SKU: inpick-ios-001

### 2-4. App Store Server API Key 발급 (결제 검증 필수)
1. https://appstoreconnect.apple.com/access/api
2. Generate API Key — App Manager 권한
3. .p8 파일 다운로드 + Key ID/Issuer ID 메모
4. PowerShell로 base64 인코딩:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('AuthKey_XXXX.p8'))
   ```
5. Vercel 환경변수:
   - `APP_STORE_BUNDLE_ID=kr.inpick.app`
   - `APP_STORE_KEY_ID=10자리`
   - `APP_STORE_ISSUER_ID=UUID`
   - `APP_STORE_PRIVATE_KEY=base64`
   - `APP_STORE_ENV=sandbox` (테스트) / `production` (출시 후)

### 2-5. IAP 상품 등록
| Product ID | Type | Tier (₩) | 지급 토큰 |
|---|---|---|---|
| kr.inpick.token.10 | Consumable | 5,000 | 10 |
| kr.inpick.token.33 | Consumable | 15,000 | 33 |
| kr.inpick.token.115 | Consumable | 50,000 | 115 |
| kr.inpick.token.360 | Consumable | 150,000 | 360 |
| kr.inpick.pdf.single | Non-Consumable | 9,900 | 1회권 |

각 상품 한국어/영어 표시명·설명 작성. 심사 1~2일.

## 3. 코드/서버 준비 상태 (Claude Code 완료)

- ✓ `capacitor.config.ts` (Bundle ID, 외부 도메인 로딩)
- ✓ `src/lib/inpick/payments/providers/app-store-provider.ts` — App Store Server API JWT + transaction 검증
- ✓ `/api/mobile/payment-products?platform=ios` — IAP 상품 목록 + 정책 가드
- ✓ `/api/mobile/app-purchases/verify` — transaction 검증 + finalize
- ✓ `/api/mobile/app-store/notifications` — ASN V2 수신
- ✓ `app_purchase_transactions` 테이블 (idempotency_key UNIQUE)

## 4. Xcode 작업 (대표님 또는 외주)

```bash
# 1. iOS 네이티브 프로젝트 추가
cd E:\InPick\inpick-app
npx cap add ios
npx cap sync ios

# 2. Xcode 열기
npx cap open ios

# 3. Xcode에서:
#    - Bundle ID 확인 (kr.inpick.app)
#    - Signing & Capabilities → Team 선택
#    - Info.plist에 권한 문구 추가:
#      NSCameraUsageDescription = "도면 촬영을 위해 카메라 접근 권한이 필요합니다"
#      NSPhotoLibraryUsageDescription = "도면 업로드를 위해 사진 접근 권한이 필요합니다"
#      NSLocationWhenInUseUsageDescription = "주소 자동 입력을 위해 위치 정보가 필요합니다"
#    - Capabilities 추가: In-App Purchase, Push Notifications, Sign In with Apple
#    - Universal Links: Associated Domains에 applinks:inpick.kr 추가

# 4. Archive → Upload to App Store Connect
```

## 5. WebView OAuth 우회 (자동 적용됨)

iOS WebView 안에서 Google OAuth는 차단됩니다. Claude Code가 `src/lib/mobile/platform.ts`에 다음 흐름을 구현:
- 네이티브 앱 감지 → `@capacitor/browser` 사용 (SFSafariViewController)
- 외부 Safari 창에서 OAuth 완료 → 앱으로 callback

## 6. Universal Links 설정

도메인에 `apple-app-site-association` 파일 배치 (https://inpick.kr/.well-known/apple-app-site-association):
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.kr.inpick.app",
      "paths": ["/auth/callback", "/payments/success", "/payments/fail", "*"]
    }]
  }
}
```

## 7. 앱 심사 리스크 체크

- ✓ Camera/Push/Sign In with Apple 등 native 기능 통합 → 단순 WebView 래퍼 아님
- ✓ 디지털 토큰/PDF는 StoreKit IAP로만 (Phase 2 활성화 전까지 앱 안 직접 구매 버튼 숨김)
- ✓ 개인정보처리방침 URL 필수
- ✓ 심사용 데모 계정 제공 (App Review Information)
- ✓ 연령 등급 4+ (인테리어 견적, 폭력/성적 콘텐츠 없음)

## 8. TestFlight 베타 배포 흐름

1. Xcode → Archive → Distribute App → App Store Connect
2. App Store Connect → TestFlight → Internal Testing 그룹 생성
3. 본인 Apple ID 추가 → 즉시 테스트 가능
4. 외부 테스터 그룹은 별도 Apple 심사 (24시간)

## 9. 환불·취소 처리

- Apple → 사용자 환불 요청 → ASN으로 `REFUND` 이벤트 수신
- `/api/mobile/app-store/notifications` 가 자동으로 `payment_provider_events` 적재
- 관리자가 `/admin/payment-center` 에서 처리:
  - 미사용 토큰 자동 회수
  - 사용한 토큰은 reconciliation case 생성 → 수동 검토

## 10. 출시 후 모니터링

- App Store Connect → Sales and Trends — 일/주/월 매출
- Vercel logs — `/api/mobile/app-purchases/verify` 호출 빈도
- /admin/payment-center → App Purchases 탭 — 검증 성공률 / 환불률
