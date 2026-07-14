# SAM 3.1 RunPod Serverless worker

이 워커는 SAM 3.1 Object Multiplex를 단일 프레임 세션으로 실행해 `바닥`, `벽`, `천장` 같은 의미와 사용자 클릭 위치를 함께 사용합니다. 결과가 없거나 워커가 실패하면 인픽 웹 API가 기존 SAM 2.1 클릭 분할로 자동 전환합니다.

## 실제 배포 권장 경로 — RunPod GitHub 연동

로컬 Mac에 Docker를 설치하지 않아도 RunPod가 이 저장소를 직접 빌드할 수 있습니다.

1. Hugging Face에서 `facebook/sam3.1` 체크포인트 접근을 승인받고 Read 권한 토큰을 만듭니다.
2. RunPod Console의 Settings → Connections에서 GitHub를 연결하고 `sanoi011/inpick-app` 저장소 접근을 허용합니다.
3. Serverless → New Endpoint → Import Git Repository에서 아래처럼 지정합니다.
   - Branch: `main`
   - Dockerfile Path: `runpod_serverless/sam3/Dockerfile`
   - Endpoint Type: `Queue`
   - Endpoint Name: `inpick-sam31`
4. GPU는 최소 48GB VRAM 등급인 L40/L40S, A40, RTX A6000 중 가용한 항목을 복수 선택합니다. 초기 검증은 Flex worker 0~1개, 실제 사용자 서비스는 cold start를 피하도록 Active worker 1개와 Max worker 2개를 권장합니다.
5. Endpoint의 Model 필드에 `facebook/sam3.1`을 넣어 RunPod 모델 캐시를 사용합니다.
6. 실행 제한 시간은 300초, Container Disk는 30GB 이상으로 설정합니다.
7. 아래 환경변수를 Endpoint Settings에 등록하고 배포합니다.

```text
HF_TOKEN=hf_...
SAM_MODEL_VERSION=3.1
SAM31_USE_FA3=0
SAM31_USE_ROPE_REAL=0
SAM31_COMPILE=0
SAM31_MAX_OBJECTS=16
SAM31_MULTIPLEX_COUNT=16
```

먼저 기본 PyTorch 경로로 호환성을 검증합니다. 그 뒤 `SAM31_USE_FA3=1`, `SAM31_USE_ROPE_REAL=1`, `SAM31_COMPILE=1`을 한 번에 하나씩 활성화합니다. GPU 드라이버나 Flash Attention 조합이 맞지 않을 때 세 옵션을 모두 `0`으로 되돌리면 복구됩니다.

## 인픽 백엔드 연결

RunPod에서 Endpoint ID를 확인하고 Vercel Production·Preview 환경에 다음 서버 전용 값을 등록한 뒤 재배포합니다. API Key에는 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.

```text
RUNPOD_API_KEY=...
RUNPOD_SAM31_ENDPOINT_ID=...
RUNPOD_SAM_ENDPOINT_ID=...  # 기존 SAM 2.1 장애 폴백 Endpoint
```

로컬에서는 같은 값을 `.env.local`에 등록합니다. 키를 코드나 Git에 커밋하지 않습니다.

## 배포 점검

모델을 로딩하지 않는 GPU 상태 점검:

```bash
npm run runpod:sam31:smoke
```

체크포인트까지 실제 로딩하는 warmup 점검:

```bash
npm run runpod:sam31:smoke -- --warmup
```

인픽 API 연결 확인:

```bash
curl -sS https://www.interiorpick.co.kr/api/inpick/sam/health
curl -sS -X POST https://www.interiorpick.co.kr/api/inpick/sam/warmup
```

정상일 때 `sam3_1_configured: true`, warmup 응답의 `engines.sam3_1: true`가 표시됩니다. RunPod 직접 health 출력의 `checkpoint_source`는 모델 캐시 사용 시 `runpod-model-cache`입니다.

## 워커 작업 규격

- `{"input":{"task":"health"}}`: 모델을 로딩하지 않고 CUDA·메모리·버전 확인
- `{"input":{"task":"warmup"}}`: 체크포인트까지 로딩하고 준비 상태 확인
- `concept_segment`: 이미지 의미 분할

예시:

```json
{
  "input": {
    "task": "concept_segment",
    "image_b64": "...",
    "concept": "visible floor finish surface only, excluding baseboards and walls",
    "click_point": [640, 720],
    "score_threshold": 0.35
  }
}
```

오류는 `MODEL_ACCESS_DENIED`, `CUDA_UNAVAILABLE`, `GPU_OUT_OF_MEMORY`, `MODEL_VERSION_MISMATCH`, `MODEL_TIMEOUT`, `EMPTY_MASK`로 구분됩니다. 인픽 API는 일시 장애를 짧게 재시도하고 이후 SAM 2.1로 전환합니다.

## 로컬 Docker 빌드 선택지

Docker를 설치한 환경에서는 저장소 루트에서 빌드합니다. Apple Silicon에서도 RunPod 호환을 위해 `linux/amd64`를 지정합니다.

```bash
docker build --platform linux/amd64 \
  -f runpod_serverless/sam3/Dockerfile \
  -t YOUR_DOCKER_ID/inpick-sam31:v1 .
```
