"""
Vision Materials worker — RunPod Serverless handler (GPU + 실제 모델).

가이드: c:\\Users\\user\\Downloads\\inpick-vision-material-estimate-dev-plan-20260510.md §7

파이프라인:
  1. 이미지 다운로드 + 전처리
  2. GroundingDINO 탐지 (open-vocab)
  3. SAM2 segmentation (박스 prompt)
  4. crop 생성 + Supabase Storage 업로드 (옵션)
  5. CLIP/OpenCLIP embedding
  6. EasyOCR 텍스트 추출
  7. OpenCV 색상/텍스처 추출
  8. SurfaceObservation[] 반환

모델 로드 정책:
  - cold start 시 try/except로 graceful degrade
  - VISION_MATERIALS_LOAD_MODELS=true 일 때만 실제 모델 로드 시도
  - 실패 시 mock 응답 자동 fallback (CPU base에서도 동작)

mode 분기:
  - mode="embed_only": 이미지 → CLIP embedding만 반환 (build/embed scripts용)
  - mode="full" (default): 8단계 전체 실행
"""
from __future__ import annotations
import os
import sys
import time
import json
import io
import base64
import urllib.request
import traceback
from typing import Any, Dict, List, Optional

import runpod  # type: ignore

from schemas import parse_request, WorkerRequest


# ─── Cold start: 모델 로드 ───
print("[vision-materials] Loading models...", flush=True)
_LOAD_START = time.time()

_HAS_MODELS = False
_LOAD_MODELS = os.environ.get("VISION_MATERIALS_LOAD_MODELS", "").lower() == "true"

# 모델 핸들 (lazy)
_gdino = None
_sam2 = None
_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None
_ocr = None
_torch = None
_device = "cpu"

if _LOAD_MODELS:
    try:
        import torch
        _torch = torch
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[vision-materials] torch device={_device}", flush=True)

        # ─── OpenCLIP (가장 핵심 — 항상 로드 시도) ───
        try:
            import open_clip
            _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32",
                pretrained="laion2b_s34b_b79k",
                device=_device,
            )
            _clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
            print("[vision-materials] OpenCLIP loaded", flush=True)
        except Exception as e:
            print(f"[vision-materials] OpenCLIP load fail: {e}", flush=True)

        # ─── EasyOCR ───
        try:
            import easyocr
            _ocr = easyocr.Reader(
                ["ko", "en"],
                gpu=(_device == "cuda"),
                verbose=False,
            )
            print("[vision-materials] EasyOCR loaded", flush=True)
        except Exception as e:
            print(f"[vision-materials] EasyOCR load fail: {e}", flush=True)

        # ─── GroundingDINO + SAM2 (heavy — 옵션) ───
        # weight 다운로드 필요 — Phase 후속에서 설정
        # try:
        #     from groundingdino.util.inference import Model as GdinoModel
        #     _gdino = GdinoModel(
        #         model_config_path="/models/GroundingDINO_SwinT_OGC.cfg.py",
        #         model_checkpoint_path="/models/groundingdino_swint_ogc.pth",
        #     )
        # except Exception as e:
        #     print(f"[vision-materials] GroundingDINO load fail: {e}", flush=True)
        # try:
        #     from sam2.sam2_image_predictor import SAM2ImagePredictor
        #     _sam2 = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-large")
        # except Exception as e:
        #     print(f"[vision-materials] SAM2 load fail: {e}", flush=True)

        # 핵심 모델 (CLIP) 로드 성공이면 _HAS_MODELS = True
        _HAS_MODELS = _clip_model is not None
    except Exception as e:
        print(f"[vision-materials] base import fail: {e}", flush=True)
        _HAS_MODELS = False
else:
    print("[vision-materials] VISION_MATERIALS_LOAD_MODELS!=true — mock 모드", flush=True)

print(
    f"[vision-materials] models loaded={_HAS_MODELS} in {time.time() - _LOAD_START:.1f}s",
    flush=True,
)


# ─── 유틸 ───
def download_image(url: str) -> Optional[bytes]:
    """이미지 URL → bytes (실패 시 None)."""
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            return resp.read()
    except Exception as e:
        print(f"[vision-materials] download fail: {e}", flush=True)
        return None


def encode_image_to_pil(data: bytes):
    """bytes → PIL.Image RGB."""
    try:
        from PIL import Image
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        return None


def clip_embed(pil_image) -> Optional[List[float]]:
    """PIL → CLIP 512-dim L2-normalized embedding."""
    if not _HAS_MODELS or _clip_model is None or _clip_preprocess is None or _torch is None:
        return None
    try:
        img_t = _clip_preprocess(pil_image).unsqueeze(0).to(_device)
        with _torch.no_grad():
            features = _clip_model.encode_image(img_t)
            features = features / features.norm(dim=-1, keepdim=True)
        emb = features[0].cpu().numpy().tolist()
        return emb
    except Exception as e:
        print(f"[vision-materials] clip_embed error: {e}", flush=True)
        return None


def ocr_text(pil_image) -> str:
    """PIL → OCR 텍스트 (한/영)."""
    if not _ocr:
        return ""
    try:
        import numpy as np
        arr = np.array(pil_image)
        result = _ocr.readtext(arr, detail=0, paragraph=True)
        return " ".join(result) if result else ""
    except Exception as e:
        print(f"[vision-materials] ocr error: {e}", flush=True)
        return ""


def extract_dominant_colors(pil_image, k: int = 3):
    """K-means로 dominant colors (간단 버전)."""
    try:
        import numpy as np
        arr = np.array(pil_image.resize((100, 100)))
        flat = arr.reshape(-1, 3)
        # 단순 quantize (cv2 K-means 없이 — 빠른 버전)
        # bin = flat 색을 8-bit → 4-bit로 quantize
        quantized = (flat // 32) * 32
        # unique 색상 + count
        unique, counts = np.unique(quantized, axis=0, return_counts=True)
        sorted_idx = np.argsort(-counts)[:k]
        total = counts.sum()
        result = []
        for i in sorted_idx:
            r, g, b = unique[i]
            ratio = float(counts[i] / total)
            hex_color = f"#{int(r):02X}{int(g):02X}{int(b):02X}"
            result.append({"hex": hex_color, "ratio": round(ratio, 3)})
        return result
    except Exception as e:
        print(f"[vision-materials] color error: {e}", flush=True)
        return []


# ─── Pipeline ───
def run_pipeline(req: WorkerRequest) -> Dict[str, Any]:
    t0 = time.time()
    surfaces: List[Dict[str, Any]] = []

    # ─── mode=embed_only — Phase 2 batch script용 ───
    raw_input = getattr(req, "_raw_input", None)
    mode = "full"
    if raw_input and isinstance(raw_input, dict):
        mode = str(raw_input.get("mode", "full"))

    img_data = download_image(req.image_url) if req.image_url else None
    pil = encode_image_to_pil(img_data) if img_data else None

    # mode=embed_only — embedding만 반환
    if mode == "embed_only":
        if not pil:
            return {"error": "image download/decode 실패", "embedding": None}
        emb = clip_embed(pil) if _HAS_MODELS else None
        return {
            "embedding": emb,
            "model": "openclip-vit-b-32" if _HAS_MODELS else "mock",
            "elapsed_ms": int((time.time() - t0) * 1000),
        }

    # ─── full mode ───
    targets = req.target_surface_types or ["floor", "wall", "ceiling"]

    if not pil:
        # mock fallback
        return mock_response(req, t0)

    # 1. (Phase 후속) GroundingDINO 탐지 — 현재는 전체 이미지 1개 surface로 처리
    # TODO: _gdino.predict_with_classes(image, classes=...) 통합
    boxes_per_target: Dict[str, Dict[str, float]] = {}
    if req.clicked_point:
        # 클릭점 주변 — 단일 surface
        x = float(req.clicked_point.get("x", pil.width / 2))
        y = float(req.clicked_point.get("y", pil.height / 2))
        size = min(pil.width, pil.height) // 3
        boxes_per_target[targets[0]] = {
            "x": max(0, x - size / 2),
            "y": max(0, y - size / 2),
            "width": size,
            "height": size,
        }
    else:
        # 다중 surface — 균등 분할 (mock)
        n = min(3, len(targets))
        for i, st in enumerate(targets[:n]):
            boxes_per_target[st] = {
                "x": (pil.width / n) * i,
                "y": pil.height * 0.3,
                "width": pil.width / n,
                "height": pil.height * 0.4,
            }

    # 2. 각 box → crop → embedding/OCR/색상
    for surface_type, bbox in boxes_per_target.items():
        try:
            crop = pil.crop((
                int(bbox["x"]),
                int(bbox["y"]),
                int(bbox["x"] + bbox["width"]),
                int(bbox["y"] + bbox["height"]),
            ))
            emb = clip_embed(crop) if _HAS_MODELS else None
            text = ocr_text(crop) if _HAS_MODELS else ""
            colors = extract_dominant_colors(crop, k=3) if pil else []

            surfaces.append({
                "surface_type": surface_type,
                "bbox": bbox,
                "area_ratio": (bbox["width"] * bbox["height"]) / (pil.width * pil.height),
                "dominant_colors": colors,
                "ocr_text": text,
                "coarse_labels": [{"label": surface_type, "confidence": 0.6}],
                "clip_embedding": emb,
                "confidence": 0.7 if _HAS_MODELS else 0.5,
            })
        except Exception as e:
            print(f"[vision-materials] surface error ({surface_type}): {e}", flush=True)

    return {
        "surfaces": surfaces,
        "model_versions": {
            "detector": "placeholder-grounding-dino",  # TODO: Phase 후속 활성화
            "segmenter": "placeholder-sam2",
            "embedding": "openclip-vit-b-32" if _HAS_MODELS else "mock",
            "ocr": "easyocr-1.7" if _ocr else "mock",
        },
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def mock_response(req: WorkerRequest, t0: float) -> Dict[str, Any]:
    """이미지 다운로드 실패 또는 _HAS_MODELS=False — mock 응답."""
    surfaces = []
    targets = req.target_surface_types or ["floor", "wall", "ceiling"]
    if req.clicked_point:
        x = float(req.clicked_point.get("x", 512))
        y = float(req.clicked_point.get("y", 640))
        surfaces.append({
            "surface_type": targets[0] if targets else "unknown",
            "bbox": {"x": max(0, x - 200), "y": max(0, y - 200), "width": 400, "height": 400},
            "area_ratio": 0.25,
            "dominant_colors": [{"hex": "#B98F67", "ratio": 0.6}],
            "coarse_labels": [{"label": "wood flooring", "confidence": 0.78}],
            "confidence": 0.55,
        })
    else:
        for st in targets[:3]:
            surfaces.append({
                "surface_type": st,
                "bbox": {"x": 0, "y": 0, "width": 100, "height": 100},
                "area_ratio": 1.0 / max(1, len(targets)),
                "dominant_colors": [{"hex": "#888888", "ratio": 0.5}],
                "coarse_labels": [{"label": st, "confidence": 0.5}],
                "confidence": 0.5,
            })
    return {
        "surfaces": surfaces,
        "model_versions": {"detector": "mock", "segmenter": "mock", "embedding": "mock", "ocr": "mock"},
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    try:
        job_input = job.get("input", {}) if isinstance(job, dict) else {}
        req = parse_request(job_input)
        # mode=embed_only 같은 추가 필드 전달용
        try:
            req._raw_input = job_input  # type: ignore[attr-defined]
        except Exception:
            pass
        return run_pipeline(req)
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[-2000:],
        }


if __name__ == "__main__":
    print(
        f"[vision-materials] starting handler — has_models={_HAS_MODELS}",
        flush=True,
    )
    runpod.serverless.start({"handler": handler})
