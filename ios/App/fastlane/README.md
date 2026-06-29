# InPick iOS — Fastlane 자동 업로드

터미널에서 한 줄로 **빌드 → App Store Connect 업로드**까지 자동화합니다.

## 현재 상태 (2026-06-29)
설정 파일만 준비 완료. **실행은 Apple 유료 개발자 등록(다음 주) 후** 가능합니다.
> ⛔ 유료 등록 전엔 서명/업로드 불가 — 지금은 시뮬레이터 빌드까지만.

## 다음 주: 최초 1회 준비
1. **Fastlane 설치** (Homebrew 권장):
   ```bash
   brew install fastlane
   ```
   또는 Ruby Bundler: `cd ios/App && bundle install`
2. **App Store Connect API Key 발급**: App Store Connect → 사용자 및 액세스 → 통합 → 키 → `+`
   → 역할 App Manager → `.p8` 다운로드(1회만 가능) → `ios/App/fastlane/` 에 저장.
3. **환경변수 채우기**:
   ```bash
   cd ios/App
   cp fastlane/.env.example fastlane/.env   # ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILEPATH, DEVELOPER_TEAM_ID 입력
   ```
4. **App Store Connect 에 앱 생성**: 번들 ID `kr.inpick.app` 로 새 앱 등록(앱 이름 INPICK).
5. **Xcode 서명 1회 설정**: `open ios/App/App.xcworkspace` → App 타겟 → Signing & Capabilities
   → "Automatically manage signing" 체크 + 팀 선택 (이후 fastlane 의 `-allowProvisioningUpdates` 가 자동 처리).

## 실행
```bash
cd ios/App
bundle exec fastlane beta      # TestFlight 업로드 (내부 테스트)
bundle exec fastlane release   # App Store 심사용 업로드 (자동 제출 OFF)
```
(brew 로 설치했으면 `bundle exec` 없이 `fastlane beta`)

## 레인 설명
- **beta**: `cap sync` → 빌드번호 자동(+1) → 아카이브(app-store) → TestFlight 업로드.
- **release**: 위 + App Store Connect 업로드. 심사 자동제출은 OFF(`submit_for_review: false`) — 콘솔에서 확인 후 제출 권장.

## 보안
`fastlane/.env`, `*.p8` 는 **절대 git 커밋 금지** (`.gitignore` 처리됨). 키 유출 시 App Store Connect 에서 즉시 폐기.
