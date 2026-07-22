# Inpick LiDAR Lab

인픽 프레임을 유지하면서 `RoomPlan` 공간 스캔→면적 계산→인테리어 요구 입력→참고 견적→`gpt-image-2` 이미지 생성을 끝까지 검증하는 독립 iOS 프로토타입입니다.

## 사용자 흐름

1. LiDAR가 탑재된 iPhone/iPad에서 방을 스캔합니다.
2. `CapturedRoom` JSON과 USDZ, AI 입력용 공간 참조 이미지를 로컬에 저장합니다.
3. 바닥 폴리곤으로 바닥 면적을, 벽에서 문·창·개구부를 뺀 순 벽면적을 계산합니다.
4. 공간 용도, 스타일, 마감 등급, 색상·소재와 추가 요구를 입력합니다.
5. 측정 면적과 시범 단가표로 공종별 참고 견적과 ±15% 범위를 즉시 표시합니다.
6. 앱은 LiDAR 참조 이미지, 측정치, 견적 범위, 디자인 요구를 로컬 중계 서버에 보냅니다.
7. 중계 서버가 OpenAI Image Edit API의 `gpt-image-2`로 공간 구조를 유지한 인테리어 이미지를 생성하고, 앱이 결과를 로컬에 저장·공유합니다.

## iOS 실행

1. `InpickLiDARLab.xcodeproj`를 Xcode로 엽니다.
2. Signing & Capabilities에서 Development Team을 선택합니다.
3. LiDAR가 탑재된 iPhone/iPad 실기기를 선택하고 실행합니다.
4. 앱 우측 상단의 서버 설정에 로컬 중계 서버 URL을 입력합니다.

시뮬레이터에서는 앱 셀과 LiDAR 미지원 UI만 확인할 수 있으며, 실제 공간 스캔은 실기기가 필요합니다.

## 로컬 `gpt-image-2` 서버

OpenAI API 키는 iOS 앱에 넣지 않고 로컬 서버의 환경 변수로만 관리합니다. Node.js 20 이상에서:

```bash
cd InpickLiDARLab/Server
cp .env.example .env
# .env의 OPENAI_API_KEY를 본인 키로 교체
set -a
source .env
set +a
npm start
```

- 시뮬레이터: 기본값 `http://127.0.0.1:8787`
- 실기기: Mac과 같은 Wi-Fi에 연결한 뒤 `http://<Mac의-로컬-IP>:8787`
- 연결 확인: 앱의 서버 설정에서 `연결 테스트`
- 서버 테스트: `npm test`

`.env`는 Git에서 제외됩니다. 이미지 생성은 OpenAI API 사용량과 비용이 발생할 수 있습니다.

## 저장 경로와 본 앱 통합 경계

- 스캔: Application Support의 `InpickLiDARLab/Scans`
- 생성 이미지: Application Support의 `InpickLiDARLab/Designs`
- 재사용 대상: `Features/RoomScan`, `Features/InteriorDesign`
- 인픽 본 앱에서 교체할 부분: `Design/InpickTheme.swift`, `AppRootView.swift`, 로컬 저장소
- 서비스 연결 지점: `RoomScannerView`의 완료 콜백→`DesignStudioView`→`POST /v1/designs/generate`

현재 견적은 기능 검증용 시범 단가표입니다. 운영 전에 인픽 파트너 단가, 세금, 철거·설비·폐기물 정책과 실측 확정 단계를 연결해야 합니다.

전체 모드의 프롬프트·API·분석·견적 연결과 운영 점검표는 [`INPICK_WORKFLOW_SIGNAL_AUDIT_2026-07-23.md`](../docs/status/INPICK_WORKFLOW_SIGNAL_AUDIT_2026-07-23.md)를 참고하세요.
