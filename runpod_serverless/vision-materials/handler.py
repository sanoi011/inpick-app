"""
Vision Materials worker — RunPod Serverless handler.

가이드: c:\\Users\\user\\Downloads\\inpick-vision-material-estimate-dev-plan-20260510.md §7

파이프라인:
  1. 이미지 다운로드 + 전처리
  2. GroundingDINO 탐지 (open-vocab)
  3. SAM2 segmentation (박스/포인트 prompt)
  4. crop 생성 + Supabase Storage 업로드
  5. CLIP/OpenCLIP embedding
  6. EasyOCR 텍스트 추출
  7. 색상/텍스처 추출 (OpenCV)
  8. SurfaceObservation[] 반환

Phase 3 (현재): scaffold — 모델 import는 try/except로 graceful degrade.
                실제 모델 미설치/로드 실패 시 mock 응답 반환.

Phase 후속: production GPU 빌드 + 모델 로드 검증
"""
from __future__ import annotations
import os
import sys
import time
import json
import traceback
from typing import Any, Dict, List

import runpod  # type: ignore

from schemas import parse_request, WorkerRequest


# ─── Cold start: 모델 로드 (placeholder) ───
print("[vision-materials] Loading models...", flush=True)
_LOAD_START = time.time()

_HAS_MODELS = False
try:
    # 실제 모델 import (Phase 3 후반에 활성화)
    # import torch
    # from groundingdino.util.inference import Model as GdinoModel
    # from segment_anything_2 import SAM2ImagePredictor
    # import open_clip
    # import easyocr
    # _gdino = GdinoModel(...)
    # _sam2 = SAM2ImagePredictor(...)
    # _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
    # _ocr = easyocr.Reader(["ko", "en"], gpu=True)
    # _HAS_MODELS = True
    pass
except Exception as e:
    print(f"[vision-materials] model load failed: {e}", flush=True)
    _HAS_MODELS = False

print(
    f"[vision-materials] models loaded={_HAS_MODELS} in {time.time() - _LOAD_START:.1f}s",
    flush=True,
)


def run_pipeline(req: WorkerRequest) -> Dict[str, Any]:
    """
    Phase 3 placeholder — mock 응답.
    실제 구현은 pipelines/{detect,segment,embed,ocr,color_texture}.py 통합 후.
    """
    t0 = time.time()
    surfaces: List[Dict[str, Any]] = []

    # 클릭점 있으면 단일, 없으면 다중 (mock)
    targets = req.target_surface_types or ["floor", "wall", "ceiling"]
    if req.clicked_point:
        x = float(req.clicked_point.get("x", 0))
        y = float(req.clicked_point.get("y", 0))
        surfaces.append({
            "surface_type": targets[0] if targets else "unknown",
            "bbox": {"x": max(0, x - 200), "y": max(0, y - 200), "width": 400, "height": 400},
            "area_ratio": 0.25,
            "dominant_colors": [{"hex": "#B98F67", "ratio": 0.6}],
            "coarse_labels": [
                {"label": "wood flooring", "confidence": 0.78},
                {"label": "light oak", "confidence": 0.62},
            ],
            "confidence": 0.65,
        })
    else:
        for i, st in enumerate(targets[:3]):
            surfaces.append({
                "surface_type": st,
                "bbox": {"x": 0, "y": 0, "width": 100, "height": 100},
                "area_ratio": 1.0 / max(1, len(targets)),
                "dominant_colors": [{"hex": "#888888", "ratio": 0.5}],
                "coarse_labels": [{"label": st, "confidence": 0.5}],
                "confidence": 0.55,
            })

    return {
        "surfaces": surfaces,
        "model_versions": {
            "detector": "placeholder-grounding-dino" if _HAS_MODELS else "mock",
            "segmenter": "placeholder-sam2" if _HAS_MODELS else "mock",
            "embedding": "placeholder-openclip-vit-b-32" if _HAS_MODELS else "mock",
            "ocr": "placeholder-easyocr" if _HAS_MODELS else "mock",
        },
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    try:
        job_input = job.get("input", {}) if isinstance(job, dict) else {}
        req = parse_request(job_input)
        return run_pipeline(req)
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc()[-2000:],
        }


if __name__ == "__main__":
    print(f"[vision-materials] runtime={'with-models' if _HAS_MODELS else 'mock'}", flush=True)
    runpod.serverless.start({"handler": handler})
