# SAM 3.1 RunPod worker

이 워커는 SAM 3.1 Object Multiplex를 단일 프레임 세션으로 실행해 `바닥`, `벽`, `천장` 같은 의미와 사용자 클릭 위치를 함께 사용합니다. 결과가 없거나 워커가 실패하면 웹 API가 기존 SAM 2.1 클릭 분할로 자동 전환합니다.

## 배포

1. Meta `facebook/sam3.1` 체크포인트 접근 권한을 승인받습니다.
2. 컨테이너를 빌드해 레지스트리에 푸시합니다.
3. RunPod Serverless에서 최소 48GB VRAM GPU 엔드포인트를 만들고 아래 환경변수를 등록합니다.
4. Vercel에 `RUNPOD_API_KEY`와 `RUNPOD_SAM31_ENDPOINT_ID`를 등록합니다.
5. `RUNPOD_SAM_ENDPOINT_ID`는 SAM 2.1 경계 보정과 장애 폴백을 위해 유지합니다.

RunPod 환경변수:

```text
HF_TOKEN=hf_...
SAM_MODEL_VERSION=3.1
SAM31_USE_FA3=0
SAM31_USE_ROPE_REAL=0
SAM31_COMPILE=0
SAM31_MAX_OBJECTS=16
SAM31_MULTIPLEX_COUNT=16
```

먼저 호환성을 확인한 뒤 `SAM31_USE_FA3=1`, `SAM31_USE_ROPE_REAL=1`, `SAM31_COMPILE=1`을 순서대로 활성화합니다. GPU 드라이버나 Flash Attention 조합이 맞지 않을 때 세 옵션을 모두 `0`으로 되돌리면 기본 PyTorch 경로로 복구됩니다.

## 진단 작업

- `{"input":{"task":"health"}}`: 모델을 로딩하지 않고 CUDA·메모리·버전 확인
- `{"input":{"task":"warmup"}}`: 체크포인트까지 로딩하고 준비 상태 확인
- `concept_segment`: 실제 이미지 의미 분할

오류는 `MODEL_ACCESS_DENIED`, `CUDA_UNAVAILABLE`, `GPU_OUT_OF_MEMORY`, `MODEL_VERSION_MISMATCH`, `MODEL_TIMEOUT`, `EMPTY_MASK`로 구분됩니다. 웹 API는 재시도 가능한 장애를 짧게 재시도하고 이후 SAM 2.1로 전환합니다.

예시 요청:

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
