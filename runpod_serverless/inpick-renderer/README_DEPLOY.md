# InPick Renderer — RunPod Serverless 배포 가이드

> 가이드 본: `c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md` §6 (RunPod / GPU worker 설계)
> Phase 5 scaffold — Phase 6+에서 실제 모델 통합 예정

## 1. 디렉토리 구조

```
runpod_serverless/inpick-renderer/
  handler.py                 # 8단계 RunPod handler
  schemas.py                 # GenerateRequest / RoomGeometry / ControlSpec parser
  Dockerfile                 # CPU base (Phase 5 placeholder용)
  requirements.txt
  README_DEPLOY.md           # ← 이 파일
  pipelines/
    model_registry.py        # license/runtime guard
    generate.py              # 모델 로드 + 이미지 생성 (Phase 5: placeholder)
  geometry/
    proxy_room.py            # 2.5D proxy (Phase 6에서 본격 구현)
    control_images.py        # canny baseline + proxy 통합
  storage/
    upload.py                # signed PUT or b64 fallback
```

## 2. PoC vs Production 차이

| 항목 | PoC | Production |
|---|---|---|
| `RENDERER_RUNTIME` | `poc` (default) | `production` |
| `runsync` 호출 | 허용 | 비권장 |
| base64 응답 | 허용 (`pocAllowBase64=true`) | 차단 (uploadUrl 필수) |
| FLUX.1-dev | 허용 | 차단 (`BFL_COMMERCIAL_LICENSE_CONFIRMED=true`만 통과) |
| 미등록 모델 | 경고 후 통과 | 거부 |
| 로그 | print | structured JSON line |

## 3. Phase 5 빌드 / 로컬 실행

```bash
# 디렉토리 이동
cd runpod_serverless/inpick-renderer

# Docker 빌드 (CPU base, placeholder pipeline용)
docker build -t inpick-renderer:phase5 .

# 로컬 실행 (RunPod SDK가 stdin 폴링)
docker run --rm -it \
  -e RENDERER_RUNTIME=poc \
  -e INPICK_IMAGE_MODEL_ID=black-forest-labs/FLUX.2-klein-4b \
  inpick-renderer:phase5
```

## 4. RunPod endpoint 설정

1. RunPod 대시보드 → Serverless → New Endpoint
2. **Container Image**: `<your-registry>/inpick-renderer:phase5` (Docker Hub / GCR / ECR push 필요)
3. **GPU**: Phase 5는 CPU도 OK. Phase 6+ Flux는 H100 80GB 권장.
4. **Environment Variables**:
   - `RENDERER_RUNTIME=poc` (또는 `production`)
   - `INPICK_IMAGE_MODEL_ID=black-forest-labs/FLUX.2-klein-4b`
   - `BFL_COMMERCIAL_LICENSE_CONFIRMED=` (FLUX.1-dev 사용 시 + 라이선스 확보 시만 `true`)
   - `DEBUG_CONTROL_IMAGES_DIR=/tmp/inpick-debug` (옵션 — 디버그)
5. **Container Disk**: 10GB (Phase 5) → 50GB+ (Phase 6 Flux 모델 캐시)
6. **Active Workers**: 0 (cold start) 또는 1 (warm)

## 5. 입력 예시 (`/run` 또는 `/runsync`)

```json
{
  "input": {
    "jobId": "gen_test_001",
    "modelId": "black-forest-labs/FLUX.2-klein-4b",
    "mode": "room_render",
    "prompt": "bright modern Korean apartment living room, white walls, warm oak floor, natural light",
    "negativePrompt": "top-down floorplan, blueprint lines, distorted walls",
    "floorplanImageUrl": "https://example.supabase.co/storage/v1/object/public/floorplans/abc/normalized.png",
    "roomGeometry": {
      "roomId": "p123-living",
      "roomName": "거실",
      "polygon": [
        {"x": 0, "y": 0},
        {"x": 1, "y": 0},
        {"x": 1, "y": 1},
        {"x": 0, "y": 1}
      ],
      "walls": [
        {"id": "wall-north", "from": {"x": 0, "y": 0}, "to": {"x": 1, "y": 0}, "kind": "exterior"},
        {"id": "wall-east",  "from": {"x": 1, "y": 0}, "to": {"x": 1, "y": 1}, "kind": "exterior"},
        {"id": "wall-south", "from": {"x": 1, "y": 1}, "to": {"x": 0, "y": 1}, "kind": "interior"},
        {"id": "wall-west",  "from": {"x": 0, "y": 1}, "to": {"x": 0, "y": 0}, "kind": "interior"}
      ],
      "openings": [
        {"id": "op-1", "type": "window", "wallId": "wall-south", "positionRatio": 0.5, "widthRatio": 0.4, "sillHeightMm": 900, "heightMm": 1200}
      ],
      "estimatedAreaM2": 24.5,
      "normalizeMode": "ratio",
      "ceilingHeightMm": 2400,
      "source": "heuristic"
    },
    "camera": {
      "position": {"x": 0.5, "y": 0.85},
      "target":   {"x": 0.5, "y": 0.5},
      "fovDeg": 70,
      "heightM": 1.45
    },
    "control": {
      "usePerspectiveCanny": true,
      "useDepth": true,
      "useSegmentation": true,
      "useWallMask": false,
      "useFloorMask": false,
      "useFloorplanCanny": false,
      "controlStrength": 0.65,
      "isBaseline": false
    },
    "seed": 12345,
    "steps": 24,
    "guidance": 3.5,
    "width": 1024,
    "height": 1024,
    "output": {
      "uploadUrl": "https://example.supabase.co/storage/v1/object/sign/renders/...",
      "publicUrl": "https://example.supabase.co/storage/v1/object/public/renders/abc.png",
      "allowBase64Fallback": false
    },
    "pocAllowBase64": false
  }
}
```

## 6. 응답 예시 (성공)

```json
{
  "status": "completed",
  "imageUrl": "https://example.supabase.co/storage/v1/object/public/renders/abc.png",
  "model": "black-forest-labs/FLUX.2-klein-4b",
  "elapsedMs": 12432,
  "seed": 12345,
  "metadata": {
    "coldStart": false,
    "controlMode": "geometry_proxy",
    "controlImages": ["perspective_canny", "depth", "segmentation"],
    "delivery": "uploaded",
    "lora": "inpick-style-v1",
    "loraScale": 0.6,
    "runtime": "production",
    "modelLicense": "apache-2.0",
    "uploadError": null,
    "phase": 5,
    "guidance": 3.5,
    "steps": 24,
    "controlStrength": 0.65
  }
}
```

## 7. PoC 실행 (base64 응답)

```json
{
  "input": {
    "jobId": "poc_001",
    "modelId": "black-forest-labs/FLUX.2-klein-4b",
    "prompt": "bright Korean apartment living room",
    "floorplanImageB64": "iVBORw0KG...",
    "control": { "useFloorplanCanny": true, "controlStrength": 0.5 },
    "pocAllowBase64": true
  }
}
```

## 8. Production 전 license checklist

가이드 §5 / §8-2 정책 — 다음을 모두 통과해야 production 활성화:

- [ ] `RENDERER_RUNTIME=production` 설정
- [ ] **모델 ID가 `apache-2.0` 또는 `openai-tos`** (FLUX.2-klein-4b / gpt-image-2 등)
  - FLUX.1-dev 사용 시: BFL과 상업 라이선스 계약 → `BFL_COMMERCIAL_LICENSE_CONFIRMED=true`
- [ ] InPick LoRA 학습 데이터가 license ledger 통과 (직접 촬영, 계약 자료, 명시적 학습 동의)
  - 금지: Pinterest, Instagram, 블로그 크롤링, 출처만 표기
- [ ] `output.uploadUrl` + `publicUrl` 페어 생성 로직 (Next.js render-room API 측에서 signed URL pre-issue)
- [ ] base64 응답 차단 검증 (`pocAllowBase64=false` + `output.allowBase64Fallback=false`)
- [ ] cost log: `costUsd` 추정값 계산 또는 실제 RunPod billing 기반
- [ ] cold start / elapsed_ms / seed / control_mode 모두 metrics에 기록
- [ ] cold start 시간 SLA (Phase 6 Flux 기준 60초 미만 권장)

## 9. 다음 Phase

| Phase | 작업 |
|---|---|
| 6 | `geometry/proxy_room.py` 실제 PIL/OpenCV 구현 (perspective canny/depth/seg) |
| 6 | `pipelines/generate.py` diffusers 통합 (FluxPipeline / FluxControlNetPipeline) |
| 7 | `scripts/eval-image-generation.ts` — flat baseline (A) vs geometry proxy (B) |
| 8 | InPick LoRA 학습 데이터 ledger + curate 스크립트 |
| 9 | Next.js render-room/jobs/[jobId] polling 통합 |
| 10 | production guardrail 활성화 (defaults 변경) |
