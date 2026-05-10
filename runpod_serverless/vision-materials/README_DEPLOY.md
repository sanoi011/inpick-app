# Vision Materials Worker — RunPod Serverless 배포 가이드

> 가이드: `c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md` §7
> Phase 3 scaffold — Phase 후속에서 실제 모델 통합 예정

## 1. 디렉토리

```
runpod_serverless/vision-materials/
├── handler.py                    # 8단계 RunPod handler
├── schemas.py                    # WorkerRequest/Response
├── Dockerfile                    # CPU base (Phase 3 placeholder)
├── requirements.txt
├── README_DEPLOY.md              # 이 파일
├── pipelines/
│   ├── detect.py                 # GroundingDINO (Phase 후속)
│   ├── segment.py                # SAM2 (Phase 후속)
│   ├── embed.py                  # OpenCLIP (Phase 후속)
│   ├── ocr.py                    # EasyOCR (Phase 후속)
│   └── color_texture.py          # OpenCV
└── storage/
    └── upload.py                 # Supabase Storage
```

## 2. Phase 3 — 현재 상태

- 모든 pipelines/* 함수는 **placeholder** (실제 모델 미사용)
- handler.py는 **mock 응답** 반환 (input에 따라 1~3개 surface)
- Next.js `worker-client.ts`가 RUNPOD_VISION_MATERIALS_ENDPOINT 미설정 시 동일한 mock 응답 사용 → API 통합 테스트 가능

## 3. Phase 후속 — 실제 모델 통합

### 3-1. GPU base image

```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y python3.11 ...
```

### 3-2. 모델 의존성 (requirements.txt 활성화)

```
torch>=2.3.0
torchvision>=0.18.0
transformers>=4.44.0
open-clip-torch>=2.24.0
groundingdino-py>=0.4.0
segment-anything-2  # 별도 install (GitHub)
easyocr>=1.7.1
supabase>=2.3.0
```

### 3-3. 모델 로드 (handler.py cold start)

```python
import torch
from groundingdino.util.inference import Model as GdinoModel
from sam2.sam2_image_predictor import SAM2ImagePredictor
import open_clip
import easyocr

_gdino = GdinoModel(
    model_config_path="GroundingDINO_SwinT_OGC.cfg.py",
    model_checkpoint_path="groundingdino_swint_ogc.pth",
)
_sam2 = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-large")
_clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32", pretrained="laion2b_s34b_b79k"
)
_clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
_ocr = easyocr.Reader(["ko", "en"], gpu=True)
_HAS_MODELS = True
```

### 3-4. 파이프라인 통합

```python
from pipelines import detect, segment, embed, ocr, color_texture
from storage import upload

def run_pipeline(req):
    # 1. 이미지 다운로드
    img_path = download(req.image_url)
    # 2. 탐지
    boxes = detect.detect_surfaces(img_path, req.target_surface_types, req.room_type)
    # 3. 분할
    surfaces = []
    for box in boxes:
        mask = segment.segment_surface(img_path, bbox=box["bbox"])
        crop_path = make_crop(img_path, mask)
        # 4. embedding + OCR + 색상
        emb = embed.embed_image(crop_path)
        text = ocr.extract_text(crop_path)
        ct = color_texture.extract_color_texture(crop_path)
        # 5. Supabase Storage 업로드
        mask_url = upload.upload_image(mask["path"])
        crop_url = upload.upload_image(crop_path)
        surfaces.append({
            "surface_type": box["label"],
            "bbox": box["bbox"],
            "mask_url": mask_url,
            "crop_url": crop_url,
            "clip_embedding": emb,
            "ocr_text": text,
            **ct,
            "confidence": box["score"],
        })
    return {"surfaces": surfaces, ...}
```

## 4. 환경변수

```
RUNPOD_API_KEY=                           # RunPod 인증
RUNPOD_VISION_MATERIALS_ENDPOINT=         # Endpoint URL (Next.js worker-client.ts가 hit)
SUPABASE_URL=                             # mask/crop 업로드용
SUPABASE_SERVICE_ROLE_KEY=
```

## 5. RunPod endpoint 권장 설정

- **GPU**: A10G / RTX 4090 / A100 (SAM2 + GroundingDINO + CLIP 동시 로드)
- **Container Disk**: 30GB+ (모델 weights ~10GB + cache)
- **Active Workers**: 0 (cold start) 또는 1 (warm — UX 개선)
- **Max Workers**: 2~3 (소비자 동시 분석 대응)

## 6. 비용 추정

| 항목 | 비용 |
|---|---|
| Cold start | ~30초 (warm 0.05~0.1초) |
| Inference per request | ~3~8초 (GPU A10G) |
| GPU 시간당 | ~$0.50 (A10G) |
| 1만 요청/월 (10초 평균) | ~$14 |

## 7. 입출력 예시

### 입력

```json
{
  "input": {
    "image_url": "https://example.supabase.co/.../render.png",
    "clicked_point": { "x": 512, "y": 640 },
    "target_surface_types": ["floor", "wall", "tile", "cabinet"],
    "room_type": "living_room",
    "style_tags": ["warm_wood", "minimal", "korean_apartment"],
    "max_surfaces": 12
  }
}
```

### 출력

```json
{
  "surfaces": [
    {
      "surface_type": "floor",
      "bbox": { "x": 120, "y": 620, "width": 760, "height": 310 },
      "mask_url": "https://example.supabase.co/.../mask.png",
      "crop_url": "https://example.supabase.co/.../crop.png",
      "area_ratio": 0.28,
      "dominant_colors": [{ "hex": "#B98F67", "ratio": 0.52 }],
      "ocr_text": "",
      "coarse_labels": [
        { "label": "wood flooring", "confidence": 0.88 },
        { "label": "light oak", "confidence": 0.72 }
      ],
      "clip_embedding": [0.012, -0.034, ...],
      "confidence": 0.86
    }
  ],
  "model_versions": {
    "detector": "grounding-dino-tiny",
    "segmenter": "sam2-hiera-large",
    "embedding": "openclip-vit-b-32",
    "ocr": "easyocr-1.7.1"
  },
  "elapsed_ms": 4230
}
```

## 8. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-11 | Phase 3 scaffold (placeholder + mock 응답) |
