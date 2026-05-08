"""
RunPod Serverless Worker for SAM 2.1
가이드(InPick_RunPod_Serverless_Migration.md §1)의 handler.py 그대로.

요청 입력:
{
  "input": {
    "task": "auto_segment" | "click_segment",
    "image_b64": "...",
    "points": [[x, y], ...],     # click_segment 시 필수
    "labels": [1, 0, ...]        # click_segment 시 필수
  }
}
"""

import runpod
import torch
import numpy as np
from PIL import Image
import base64
import io
import cv2
import traceback

from sam2.build_sam import build_sam2
from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
from sam2.sam2_image_predictor import SAM2ImagePredictor


# ===============================================
# 모델 로드 (워커 시작 시 1회)
# ===============================================
print("[InPick SAM Worker] Loading SAM 2.1 model...")

SAM2_CHECKPOINT = "/app/checkpoints/sam2.1_hiera_large.pt"
MODEL_CONFIG = "configs/sam2.1/sam2.1_hiera_l.yaml"

device = "cuda" if torch.cuda.is_available() else "cpu"
sam2_model = build_sam2(MODEL_CONFIG, SAM2_CHECKPOINT, device=device)

auto_generator = SAM2AutomaticMaskGenerator(
    model=sam2_model,
    points_per_side=24,
    pred_iou_thresh=0.88,
    stability_score_thresh=0.92,
    min_mask_region_area=2000,
)

predictor = SAM2ImagePredictor(sam2_model)
print(f"[InPick SAM Worker] Model loaded on {device}")


# ===============================================
# 유틸
# ===============================================

def decode_image_b64(image_b64: str) -> np.ndarray:
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(image)


def encode_mask_b64(mask: np.ndarray) -> str:
    mask_uint8 = (mask * 255).astype(np.uint8)
    pil_mask = Image.fromarray(mask_uint8, mode="L")
    buffer = io.BytesIO()
    pil_mask.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


def mask_to_polygon(mask: np.ndarray) -> list:
    contours, _ = cv2.findContours(
        mask.astype(np.uint8),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    if not contours:
        return []
    largest = max(contours, key=cv2.contourArea)
    epsilon = 0.005 * cv2.arcLength(largest, True)
    simplified = cv2.approxPolyDP(largest, epsilon, True)
    return simplified.reshape(-1, 2).tolist()


# ===============================================
# 작업
# ===============================================

def task_auto_segment(image: np.ndarray) -> dict:
    H, W = image.shape[:2]
    masks = auto_generator.generate(image)

    regions = []
    for idx, m in enumerate(masks):
        if m["area"] < W * H * 0.005:
            continue
        polygon = mask_to_polygon(m["segmentation"])
        regions.append({
            "id": f"auto_{idx:03d}",
            "polygon": polygon,
            "bbox": list(map(int, m["bbox"])),
            "area_pixels": int(m["area"]),
            "predicted_iou": float(m["predicted_iou"]),
            "stability_score": float(m["stability_score"]),
            "mask_b64": encode_mask_b64(m["segmentation"]),
        })

    return {
        "task": "auto_segment",
        "regions": regions,
        "image_size": [W, H],
        "total_regions": len(regions),
    }


def task_click_segment(image: np.ndarray, points: list, labels: list) -> dict:
    H, W = image.shape[:2]
    predictor.set_image(image)

    point_coords = np.array(points)
    point_labels = np.array(labels)

    masks, scores, _ = predictor.predict(
        point_coords=point_coords,
        point_labels=point_labels,
        multimask_output=True,
    )

    best_idx = int(np.argmax(scores))
    best_mask = masks[best_idx]
    polygon = mask_to_polygon(best_mask)

    return {
        "task": "click_segment",
        "polygon": polygon,
        "confidence": float(scores[best_idx]),
        "area_pixels": int(best_mask.sum()),
        "mask_b64": encode_mask_b64(best_mask),
        "image_size": [W, H],
    }


# ===============================================
# RunPod 핸들러
# ===============================================

def handler(job):
    try:
        job_input = job.get("input", {})
        task_name = job_input.get("task")
        if not task_name:
            return {"error": "task field is required"}

        image_b64 = job_input.get("image_b64")
        if not image_b64:
            return {"error": "image_b64 field is required"}

        image = decode_image_b64(image_b64)

        if task_name == "auto_segment":
            return task_auto_segment(image)

        elif task_name == "click_segment":
            points = job_input.get("points")
            if not points:
                return {"error": "points field is required for click_segment"}
            labels = job_input.get("labels", [1] * len(points))
            return task_click_segment(image, points, labels)

        else:
            return {"error": f"Unknown task: {task_name}"}

    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


print("[InPick SAM Worker] Starting Serverless handler...")
runpod.serverless.start({"handler": handler})
