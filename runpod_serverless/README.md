# InPick SAM 2.1 Serverless Worker

가이드: `InPick_RunPod_Serverless_Migration.md`

InPick의 영역 분할(SAM 2.1) GPU 작업을 RunPod Serverless에서 처리하는 worker.
Vercel(Next.js)에서 `/api/inpick/sam/*`이 이 worker를 HTTP로 호출.

## 빌드 + 배포 (사용자 행동)

### 1. Docker 이미지 빌드
```bash
cd runpod_serverless
docker build -t inpick-sam2-serverless:latest .
```

빌드 시간: 10~20분 (체크포인트 2.4GB 다운로드 포함, ~10GB 이미지)

### 2. 레지스트리 푸시
```bash
# Docker Hub
docker tag inpick-sam2-serverless:latest YOUR_USERNAME/inpick-sam2:latest
docker push YOUR_USERNAME/inpick-sam2:latest

# 또는 GitHub Container Registry
docker tag inpick-sam2-serverless:latest ghcr.io/YOUR_USERNAME/inpick-sam2:latest
docker push ghcr.io/YOUR_USERNAME/inpick-sam2:latest
```

### 3. RunPod Serverless Endpoint 생성
https://www.runpod.io/console/serverless 접속:

```
Endpoint Name: inpick-sam-segmentation
Container Image: YOUR_USERNAME/inpick-sam2:latest
GPU Type: L40S (가성비) 또는 H100 (속도 우선)

Worker Configuration:
  Active Workers: 0          (트래픽 없을 때 0원)
  Max Workers: 3
  Idle Timeout: 5 seconds
  Execution Timeout: 60 seconds

Container Disk: 25 GB
```

### 4. Endpoint 정보 확보
- **Endpoint ID** 복사 (예: `abc123xyz`)
- **API Key** 발급: https://www.runpod.io/console/user/settings

### 5. Vercel 환경변수 등록
InPick Vercel 프로젝트 Settings → Environment Variables:

```
RUNPOD_API_KEY=...
RUNPOD_SAM_ENDPOINT_ID=abc123xyz
```

저장 후 Redeploy.

## 검증

배포 후 Vercel에서 호출:
```
POST https://inpick-app.vercel.app/api/inpick/sam/warmup
```

응답: `{"warmed_up": true}` = 정상 활성화

## 비용

L40S 기준:
- auto_segment: ~6원/회
- click_segment: ~1.5원/회

월 1,000명 × 5회 사용 ≈ 1~2만원

## 동작 입력/출력

### auto_segment
입력:
```json
{ "input": { "task": "auto_segment", "image_b64": "..." } }
```

출력:
```json
{
  "regions": [
    { "id": "auto_001", "polygon": [[x,y],...], "bbox": [...], "area_pixels": 12345, "mask_b64": "..." }
  ],
  "image_size": [1024, 1024],
  "total_regions": 12
}
```

### click_segment
입력:
```json
{ "input": { "task": "click_segment", "image_b64": "...", "points": [[450, 600]], "labels": [1] } }
```

출력:
```json
{
  "polygon": [[x,y],...],
  "confidence": 0.95,
  "area_pixels": 8732,
  "mask_b64": "...",
  "image_size": [1024, 1024]
}
```

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| Cold start 60초+ | 첫 워커 GPU 메모리 모델 로드 | warmup endpoint 호출 또는 Active Workers 1로 |
| 응답 60초 timeout | runsync 한계 | Vercel 클라이언트가 자동 async fallback |
| 동시 요청 적체 | Max Workers 부족 | RunPod 콘솔에서 5~10으로 증가 |
