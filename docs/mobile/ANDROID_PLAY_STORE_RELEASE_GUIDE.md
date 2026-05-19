# INPICK Android Google Play 출시 가이드

> 작성일: 2026-05-19
> 대상: 대표님 직접 작업용
> 전제: `INPICK_ANDROID_GOOGLE_PLAY_APP_DEV_PLAN_20260519.md`

## 1. 앱 식별 정보

```
Package Name: kr.inpick.app
App Name: INPICK
Category: Lifestyle (또는 Business)
Min Android SDK: 24 (Android 7.0)
Target SDK: 34 (Android 14)
Capacitor 패키징: ✓
```

## 2. 단계별 작업 (대표님)

### 2-1. Google Play Console 가입
1. https://play.google.com/console
2. 개인 또는 조직 선택 (조직 권장 — 1~2주 심사)
3. $25 일회성 결제

### 2-2. 앱 등록
1. Play Console → Create app
2. 패키지명: `kr.inpick.app`
3. 무료/한국어/앱 선택

### 2-3. Play App Signing
1. Play Console → Setup → App integrity → App signing
2. 'Use Play App Signing' 선택
3. Upload keystore 생성:
   ```bash
   keytool -genkey -v -keystore inpick-upload.keystore \
     -alias inpick-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
4. inpick-upload.keystore 백업 (분실 시 업데이트 불가)

### 2-4. Service Account 발급 (결제 검증 필수)
1. https://console.cloud.google.com (Play Console과 다른 사이트)
2. 프로젝트 생성 + `Google Play Android Developer API` Enable
3. IAM → Service Accounts → Create
4. Keys → Add → JSON 다운로드
5. Play Console로 돌아가서 Setup → API access → Service accounts에 SA 이메일 추가 (Manage orders + View financial data 권한)
6. 권한 전파 24시간 대기
7. PowerShell로 base64:
   ```powershell
   [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content service-account.json -Raw)))
   ```
8. Vercel 환경변수:
   - `GOOGLE_PLAY_PACKAGE_NAME=kr.inpick.app`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=base64`

### 2-5. Play Billing 상품 등록
Play Console → Monetize → Products → In-app products

| Product ID | 이름 | 가격 (₩) | 토큰 |
|---|---|---|---|
| kr.inpick.token.10 | AI 토큰 10개 | 5,000 | 10 |
| kr.inpick.token.33 | AI 토큰 33개 | 15,000 | 33 |
| kr.inpick.token.115 | AI 토큰 115개 | 50,000 | 115 |
| kr.inpick.token.360 | AI 토큰 360개 | 150,000 | 360 |
| kr.inpick.pdf.single | 견적서 PDF 발급권 | 9,900 | 1회권 |

각 상품 Activate.

## 3. 코드/서버 준비 상태 (Claude Code 완료)

- ✓ `capacitor.config.ts` (Package Name, allowMixedContent=false)
- ✓ `src/lib/inpick/payments/providers/google-play-provider.ts` — Service Account JWT + purchases.products.get + acknowledge
- ✓ `/api/mobile/payment-products?platform=android` — Play Billing 상품 + 정책 가드
- ✓ `/api/mobile/app-purchases/verify` — purchaseToken 검증 + acknowledge 자동 + finalize
- ✓ `/api/mobile/google-play/rtdn` — RTDN 수신
- ✓ `app_purchase_transactions` 테이블 (idempotency_key UNIQUE)

## 4. Android Studio 작업

```bash
# 1. Android 네이티브 프로젝트 추가
cd E:\InPick\inpick-app
npx cap add android
npx cap sync android

# 2. Android Studio 열기
npx cap open android

# 3. Android Studio에서:
#    - applicationId 확인 (kr.inpick.app)
#    - AndroidManifest.xml 권한 추가:
#      <uses-permission android:name="android.permission.CAMERA"/>
#      <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
#      <uses-permission android:name="android.permission.INTERNET"/>
#      <uses-permission android:name="com.android.vending.BILLING"/>
#    - App Links: intent-filter 추가
#      <intent-filter android:autoVerify="true">
#        <action android:name="android.intent.action.VIEW"/>
#        <category android:name="android.intent.category.DEFAULT"/>
#        <category android:name="android.intent.category.BROWSABLE"/>
#        <data android:scheme="https" android:host="inpick.kr"/>
#      </intent-filter>

# 4. Build → Generate Signed Bundle (AAB)
#    Keystore: inpick-upload.keystore 선택
#    Build variant: release
```

## 5. WebView OAuth 우회 (자동 적용됨)

Google은 embedded WebView에서 OAuth를 차단합니다. Claude Code가 `src/lib/mobile/platform.ts`에 다음 흐름 구현:
- 네이티브 앱 감지 → `@capacitor/browser` 사용 (Chrome Custom Tabs)
- 외부 Chrome 창에서 OAuth 완료 → 앱으로 callback

## 6. App Links 설정

도메인에 `assetlinks.json` 배치 (https://inpick.kr/.well-known/assetlinks.json):
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "kr.inpick.app",
    "sha256_cert_fingerprints": ["XX:XX:XX:..."]
  }
}]
```
SHA256은 Play Console → Setup → App signing에서 확인.

## 7. 앱 심사 리스크 체크

- ✓ Camera/Push/Native plugin 통합 → 단순 WebView 래퍼 아님
- ✓ 디지털 토큰/PDF는 Play Billing으로만 (Phase 2 활성화 전까지 앱 안 직접 구매 버튼 숨김)
- ✓ Data Safety 작성 (수집 데이터 종류 + 사용 목적 + 공유 여부)
- ✓ 콘텐츠 등급 설문 — 모두 'No' 선택 (인테리어 견적)
- ✓ Target Audience: 만 18세 이상 (사업자 계약 가능 연령)
- ✓ 광고: 없음
- ✓ 개인정보처리방침 URL 필수

## 8. 내부 테스트 + 프로덕션 출시

1. Internal Testing → AAB 업로드 → Testers (Google 그룹) 추가 → 본인 Android 폰에서 설치
2. Production → AAB → Submit → 심사 3~7일

## 9. 환불·취소 처리

- Google → 사용자 환불 → RTDN으로 `SUBSCRIPTION_REVOKED` 또는 `ONE_TIME_PRODUCT_CANCELED` 이벤트 수신
- `/api/mobile/google-play/rtdn` 가 자동으로 `payment_provider_events` 적재
- 관리자가 `/admin/payment-center` 에서 처리

## 10. 한국 대체결제 (Phase 3 — 별도)

Google Play는 한국에서 'User Choice Billing' 정책 제공:
- 사용자가 Play Billing vs 외부결제 선택 가능
- Toss/PortOne을 앱 안에서 사용 가능 (절차 복잡, 수수료 4% 절감)
- 신청: https://support.google.com/googleplay/android-developer/answer/11222040

1차 출시는 Play Billing 기본 권장. 외부결제는 Phase C로 분리.
