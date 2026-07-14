# SAM 3 RunPod worker

이 워커는 `바닥`, `벽`, `천장`처럼 사용자가 먼저 고른 의미와 클릭 위치를 함께 사용해 첫 마스크를 만듭니다. 이후 추가·제외점 보정은 기존 SAM 2.1 엔드포인트가 담당합니다.

1. Meta SAM 3 체크포인트 접근 권한을 받은 Hugging Face 토큰을 준비합니다.
2. 이 폴더의 이미지를 빌드해 컨테이너 레지스트리에 푸시합니다.
3. RunPod Serverless에서 24GB 이상 GPU 엔드포인트를 만들고 `HF_TOKEN`을 Secret으로 등록합니다.
4. 웹/Vercel에 `RUNPOD_SAM3_ENDPOINT_ID`를 등록합니다.
5. 기존 `RUNPOD_SAM_ENDPOINT_ID`는 SAM 2.1 경계 보정과 장애 폴백을 위해 유지합니다.

예시 요청:

```json
{
  "input": {
    "task": "concept_segment",
    "image_b64": "...",
    "concept": "visible floor finish surface only, excluding baseboards and walls",
    "click_point": [640, 720]
  }
}
```

SAM 3가 비활성화되거나 실패하면 웹 API가 기존 SAM 2.1 클릭 분할로 자동 전환합니다.
