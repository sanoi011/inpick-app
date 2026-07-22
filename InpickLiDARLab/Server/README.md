# Inpick Design Service

LiDAR 공간 기준 이미지와 면적 정보를 OpenAI `gpt-image-2` 이미지 편집 API에 전달하는 로컬 중계 서버입니다. OpenAI API 키가 iOS 앱 바이너리에 포함되지 않도록 분리합니다.

## 실행

Node.js 20 이상에서 실행합니다.

```bash
export OPENAI_API_KEY="..."
npm start
```

기본 주소는 `http://0.0.0.0:8787`입니다.

- Simulator: 앱 설정에 `http://127.0.0.1:8787`
- iPhone 실기기: 앱 설정에 `http://<Mac의-Bonjour-이름>.local:8787`

실기기와 Mac은 같은 Wi-Fi에 연결해야 합니다. 운영 환경에서는 이 서버를 인증·사용량 제한·HTTPS가 적용된 인픽 백엔드에 배포해야 합니다.

## 엔드포인트

- `GET /health`: 서버와 모델 설정 상태
- `POST /v1/designs/generate`: LiDAR 참조 이미지 기반 인테리어 이미지 생성

## 테스트

```bash
npm test
```
