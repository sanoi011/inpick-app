# InPick 모바일 앱 (iOS + Android) 빌드 + 배포 가이드

> 베이스: Capacitor 7 + Next.js (Vercel 배포 사이트 그대로 사용)
> 전략: Native shell + WebView가 `https://inpick-app.vercel.app` 로드 + Camera/Push 등 Capacitor plugin

---

## 0. 사전 준비 (사용자 행동, 한 번만)

### 0-1. 개발자 계정 가입
| 플랫폼 | URL | 비용 |
|---|---|---|
| **Apple Developer Program** | https://developer.apple.com/programs/ | $99 / 년 |
| **Google Play Console** | https://play.google.com/console | $25 1회 |

### 0-2. 빌드 환경
| 플랫폼 | 필요 환경 |
|---|---|
| **iOS** | macOS + Xcode 15+ (App Store Connect 업로드도 macOS 전용) |
| **Android** | Windows / macOS / Linux + Android Studio Hedgehog+ |

> **macOS 없이 iOS 빌드** 옵션:
> - **Codemagic** (https://codemagic.io) — 월 500분 무료
> - **Bitrise** — 월 100분 무료
> - 또는 Apple Developer 계정으로 Xcode Cloud (월 $14.99)

### 0-3. npm 의존성 설치 (1회)
```bash
cd E:\InPick\inpick-app
npm install
```
새로 추가된 Capacitor 패키지가 자동 설치됩니다 (`@capacitor/core`, `cli`, `ios`, `android`, plugin들).

---

## 1. Native 프로젝트 초기화 (한 번만)

### 1-1. iOS (macOS 필요)
```bash
npm run mobile:add:ios
```
→ `ios/` 디렉토리 생성. Xcode 프로젝트 자동 셋업.

### 1-2. Android (Windows/macOS/Linux)
```bash
npm run mobile:add:android
```
→ `android/` 디렉토리 생성. Android Studio 프로젝트 자동 셋업.

> 두 디렉토리는 `.gitignore`에 등록되어 있어 git에 안 들어갑니다.
> 각 개발자 PC에서 한 번씩 init 필요.

---

## 2. 앱 아이콘 + 스플래시 자동 생성

루트의 `resources/icon.svg`, `resources/icon-foreground.svg`, `resources/icon-background.svg`, `resources/splash.svg` 가 source.

### 자동 생성 도구 — `@capacitor/assets`
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#FFFFFF" --iconBackgroundColorDark "#1A1A1A" --splashBackgroundColor "#F73B20" --splashBackgroundColorDark "#F73B20"
```
→ iOS/Android 모든 사이즈 자동 생성:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/*` (29~1024px 30+ 사이즈)
- `android/app/src/main/res/mipmap-*/` (mdpi~xxxhdpi 5단계)
- adaptive icon (foreground + background)
- splash screen (모든 디바이스 크기)

---

## 3. 동기화

코드/설정 변경 후 native 프로젝트로 반영:
```bash
npm run mobile:sync
```
이 명령은:
- `capacitor.config.ts` 변경사항 반영
- 새 plugin 자동 등록
- Vercel URL 등 server 설정 갱신

---

## 4. 빌드 + 실행

### 4-1. iOS (macOS 전용)
```bash
npm run mobile:open:ios
```
→ Xcode 자동 열림. 상단의 디바이스 선택 → ▶ Run.

배포 빌드:
- Xcode → Product → Archive
- Distribute App → App Store Connect

### 4-2. Android
```bash
npm run mobile:open:android
```
→ Android Studio 자동 열림. ▶ Run.

배포 빌드 (AAB — Play Store 필수 형식):
- Build → Generate Signed Bundle / APK
- Android App Bundle 선택
- Keystore 생성 (한 번만, 분실 시 앱 업데이트 불가능 — 백업 필수)
- 결과: `android/app/release/app-release.aab`

---

## 5. App Store 등록 (iOS)

### 5-1. App Store Connect 앱 생성
https://appstoreconnect.apple.com → My Apps → +
- **Bundle ID**: `kr.inpick.app`
- **앱 이름**: InPick
- **카테고리**: Productivity / Lifestyle
- **연령 등급**: 4+

### 5-2. 메타데이터
| 필드 | 값 |
|---|---|
| **앱 이름** | InPick |
| **부제** | AI 인테리어 견적 플랫폼 |
| **키워드** | 인테리어,견적,AI,설계,리모델링,홈인테리어 |
| **카테고리 (1차)** | Lifestyle (또는 Productivity) |
| **개인정보 처리방침 URL** | https://inpick-app.vercel.app/privacy |
| **지원 URL** | https://inpick-app.vercel.app/mypage/support |

### 5-3. 스크린샷
- 6.7" iPhone (1290×2796) — 필수
- 6.5" iPhone (1284×2778) — 필수
- 5.5" iPhone (1242×2208) — 필수 (legacy)
- iPad Pro 12.9" (2048×2732) — iPad 지원 시
> Capacitor에서 시뮬레이터 실행 후 ⌘+S로 스크린샷 캡처 가능

### 5-4. 심사 제출
- TestFlight 내부 테스터 (즉시) → 외부 테스터 (24시간 심사)
- App Store 심사 (1~3일)

### 5-5. Apple 4.2.0 회피 — 단순 wrapper 거부 위험
**해결책 (이미 적용)**:
- ✅ 카메라 plugin (`@capacitor/camera`) — LIDAR 통합 시 사용
- ✅ 푸시 알림 (`@capacitor/push-notifications`) — 견적 알림
- ✅ 공유 (`@capacitor/share`) — 견적서 공유

심사 메모 작성 시 **"Native LIDAR scan, push notifications, in-app camera capture features"** 명시.

---

## 6. Google Play 등록 (Android)

### 6-1. Play Console 앱 생성
https://play.google.com/console → 앱 만들기
- **Package name**: `kr.inpick.app`
- **앱 이름**: InPick
- **무료/유료**: 무료
- **카테고리**: 라이프스타일

### 6-2. 메타데이터
| 필드 | 값 |
|---|---|
| **간단 설명** (80자) | AI가 만드는 인테리어 디자인 + 정확한 견적 한 번에 |
| **자세한 설명** (4000자) | 사용자 도면 → AI 디자인 생성 → 자재 영역 클릭만으로 자재 교체 → 면적 × 단가 정확한 견적 → 사업자 매칭. (자세한 본문은 별도 작성) |
| **개인정보 처리방침 URL** | https://inpick-app.vercel.app/privacy |
| **콘텐츠 등급** | 모든 사용자 |

### 6-3. 자산
- 앱 아이콘 512×512 PNG (자동 생성됨)
- 그래픽 이미지 1024×500 PNG (별도 디자인 필요)
- 스마트폰 스크린샷 최소 2개 (1080×1920 권장)

### 6-4. 출시 단계
1. **내부 테스트** (즉시 사용 가능, 100명 한도)
2. **비공개 테스트** (Closed beta, 이메일 리스트)
3. **공개 테스트** (Open beta)
4. **프로덕션** (스토어 정식 등록)

심사 1~3일.

---

## 7. 업데이트 워크플로

### 웹 변경만 (대부분 케이스)
**앱 재빌드 불필요** — Capacitor server.url이 Vercel을 가리키므로, Vercel에 push만 하면 모바일 앱도 즉시 새 버전.

### Native 코드 변경 (plugin 추가, 권한 변경, 빌드 설정)
```bash
npm run mobile:sync
npm run mobile:open:ios     # 또는 :android
# Xcode/Android Studio에서 새 빌드 → 스토어 업로드
# 버전 번호 올리기 (Info.plist 또는 build.gradle)
```

---

## 8. 비용 요약

| 항목 | 비용 | 빈도 |
|---|---|---|
| Apple Developer Program | $99 | 매년 |
| Google Play Console | $25 | 1회 |
| Codemagic (선택, macOS 없을 때) | 무료 / 월 $79+ | 월 |
| 도메인/Vercel/RunPod (별건) | 별건 | — |

**최소 비용**: 첫 해 약 $124 + 부가세.

---

## 9. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| Xcode 빌드 실패 "No team found" | Apple Developer 계정 미연동 | Xcode → Signing & Capabilities → Team 선택 |
| Android Gradle 동기화 실패 | JDK 버전 미스매치 | JDK 17+ 설치, Android Studio Settings → Build Tools → Gradle → Gradle JDK |
| iOS Camera 안 됨 | Info.plist에 `NSCameraUsageDescription` 누락 | Xcode → Info.plist → "Privacy - Camera Usage Description" 추가 |
| App Store 4.2.0 거부 | 단순 wrapper로 인식 | Camera/Push native 기능 사용 화면 + 심사 메모에 명시 |
| Vercel 사이트가 앱에서 안 열림 | `cleartext: true` 또는 SSL 인증서 | https 강제 + Apple ATS 정책 확인 |

---

## 10. 다음 단계 (권장)

1. **In-app purchase** (선택) — 토큰 충전을 Apple/Google 결제로 처리 (Apple은 디지털 콘텐츠는 IAP 강제)
2. **Deep linking** — `inpick://project/123` 같은 URL 스키마 지원
3. **ARKit/ARCore plugin** — 진짜 LIDAR 스캔을 앱 내에서 (현재는 외부 앱 → 파일 업로드)
4. **푸시 알림 백엔드** — Vercel + Firebase Cloud Messaging
