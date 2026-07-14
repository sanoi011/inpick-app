"""RunPod Serverless worker for SAM 3 open-vocabulary surface segmentation."""

import base64
import io
import os
import threading

import cv2
import numpy as np
import runpod
import torch
from PIL import Image

_lock = threading.Lock()
_processor = None


def get_processor():
    global _processor
    if _processor is not None:
        return _processor
    with _lock:
        if _processor is not None:
            return _processor
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor

        model = build_sam3_image_model()
        model.eval()
        _processor = Sam3Processor(model)
        return _processor


def decode_image(value: str) -> Image.Image:
    payload = value.split(",", 1)[-1]
    return Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGB")


def to_numpy(value) -> np.ndarray:
    if torch.is_tensor(value):
        value = value.detach().float().cpu().numpy()
    return np.asarray(value)


def polygon_for(mask: np.ndarray) -> list[list[int]]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    contour = max(contours, key=cv2.contourArea)
    epsilon = max(1.0, 0.0015 * cv2.arcLength(contour, True))
    approx = cv2.approxPolyDP(contour, epsilon, True)
    return [[int(point[0][0]), int(point[0][1])] for point in approx]


def encode_mask(mask: np.ndarray) -> str:
    image = Image.fromarray((mask > 0).astype(np.uint8) * 255, mode="L")
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


def concept_segment(payload: dict) -> dict:
    concept = str(payload.get("concept") or "").strip()
    if not concept:
        raise ValueError("concept is required")
    image = decode_image(payload["image_b64"])
    width, height = image.size
    processor = get_processor()

    state = processor.set_image(image)
    output = processor.set_text_prompt(state=state, prompt=concept)
    masks = to_numpy(output.get("masks", []))
    scores = to_numpy(output.get("scores", np.ones(len(masks)))).reshape(-1)
    if masks.ndim == 4:
        masks = masks[:, 0]
    if masks.ndim == 2:
        masks = masks[None, ...]
    if len(masks) == 0:
        raise ValueError("SAM 3 returned no concept masks")

    click = payload.get("click_point") or [width // 2, height // 2]
    click_x = max(0, min(width - 1, int(click[0])))
    click_y = max(0, min(height - 1, int(click[1])))
    candidates = []
    image_area = max(1, width * height)

    for index, raw_mask in enumerate(masks):
        mask = (raw_mask > 0.5).astype(np.uint8)
        if mask.shape != (height, width):
            mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        area = int(mask.sum())
        if area <= 0:
            continue
        contains_click = bool(mask[click_y, click_x])
        confidence = float(scores[index]) if index < len(scores) else 0.0
        ratio = area / image_area
        rank = (1 if contains_click else 0, 1 if 0.002 <= ratio <= 0.82 else 0, confidence)
        candidates.append(
            {
                "polygon": polygon_for(mask),
                "confidence": confidence,
                "area_pixels": area,
                "mask_b64": encode_mask(mask),
                "_rank": rank,
            }
        )

    if not candidates:
        raise ValueError("SAM 3 returned only empty masks")
    candidates.sort(key=lambda item: item["_rank"], reverse=True)
    for item in candidates:
        item.pop("_rank", None)
    best = candidates[0]
    return {
        "task": "click_segment",
        **best,
        "image_size": [width, height],
        "candidates": candidates[:6],
        "concept": concept,
    }


def handler(job):
    try:
        payload = job.get("input") or {}
        if payload.get("task") == "warmup":
            get_processor()
            return {"ok": True}
        if payload.get("task") != "concept_segment":
            return {"error": "unsupported task"}
        return concept_segment(payload)
    except Exception as error:
        return {"error": f"{type(error).__name__}: {error}"}


if __name__ == "__main__":
    if os.getenv("RUNPOD_DEBUG") == "1":
        get_processor()
    runpod.serverless.start({"handler": handler})
