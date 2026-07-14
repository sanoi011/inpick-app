"""RunPod Serverless worker for SAM 3.1 concept-guided surface selection.

SAM 3.1 is a multiplex video model. For InPick's still-image workflow we open a
single-frame session, apply a text prompt, then rank the returned masks with the
user's click. Set ``SAM_MODEL_VERSION=3`` only when operating the legacy SAM 3
image checkpoint.
"""

import base64
import io
import os
import tempfile
import threading
import time

import cv2
import numpy as np
import runpod
import torch
from PIL import Image

MODEL_VERSION = os.getenv("SAM_MODEL_VERSION", "3.1").strip()
_lock = threading.Lock()
_engine = None
_engine_name = None
_loaded_at = None


def get_engine():
    global _engine, _engine_name, _loaded_at
    if _engine is not None:
        return _engine, _engine_name
    with _lock:
        if _engine is not None:
            return _engine, _engine_name
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA_UNAVAILABLE: SAM requires a CUDA worker")

        if MODEL_VERSION.startswith("3.1"):
            from sam3.model_builder import build_sam3_multiplex_video_predictor

            _engine = build_sam3_multiplex_video_predictor(
                max_num_objects=int(os.getenv("SAM31_MAX_OBJECTS", "16")),
                multiplex_count=int(os.getenv("SAM31_MULTIPLEX_COUNT", "16")),
                use_fa3=os.getenv("SAM31_USE_FA3", "0") == "1",
                use_rope_real=os.getenv("SAM31_USE_ROPE_REAL", "0") == "1",
                compile=os.getenv("SAM31_COMPILE", "0") == "1",
                warm_up=False,
                async_loading_frames=False,
            )
            _engine_name = "sam3.1"
        else:
            from sam3.model_builder import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor

            model = build_sam3_image_model()
            model.eval()
            _engine = Sam3Processor(model)
            _engine_name = "sam3"

        _loaded_at = time.time()
        return _engine, _engine_name


def decode_image(value: str) -> Image.Image:
    payload = value.split(",", 1)[-1]
    try:
        decoded = base64.b64decode(payload, validate=True)
    except Exception as error:
        raise ValueError("INVALID_IMAGE: invalid base64 image") from error
    try:
        return Image.open(io.BytesIO(decoded)).convert("RGB")
    except Exception as error:
        raise ValueError("INVALID_IMAGE: unsupported image data") from error


def to_numpy(value) -> np.ndarray:
    if torch.is_tensor(value):
        value = value.detach().float().cpu().numpy()
    return np.asarray(value)


def first_output(outputs: dict, keys: tuple[str, ...], default=None):
    for key in keys:
        if key in outputs and outputs[key] is not None:
            return outputs[key]
    return default


def normalize_masks(value, width: int, height: int) -> np.ndarray:
    masks = to_numpy(value)
    while masks.ndim > 3 and masks.shape[1] == 1:
        masks = masks[:, 0]
    if masks.ndim == 2:
        masks = masks[None, ...]
    if masks.ndim != 3:
        return np.zeros((0, height, width), dtype=np.uint8)
    return masks


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


def candidates_from_output(
    masks_value,
    scores_value,
    width: int,
    height: int,
    click_point,
) -> list[dict]:
    masks = normalize_masks(masks_value, width, height)
    scores = to_numpy(scores_value).reshape(-1) if scores_value is not None else np.ones(len(masks))
    click = click_point or [width // 2, height // 2]
    click_x = max(0, min(width - 1, int(click[0])))
    click_y = max(0, min(height - 1, int(click[1])))
    image_area = max(1, width * height)
    candidates = []

    for index, raw_mask in enumerate(masks):
        mask = (raw_mask > 0.5).astype(np.uint8)
        if mask.shape != (height, width):
            mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        area = int(mask.sum())
        if area <= 0:
            continue
        contains_click = bool(mask[click_y, click_x])
        confidence = float(scores[index]) if index < len(scores) else 0.5
        if not np.isfinite(confidence):
            confidence = 0.5
        ratio = area / image_area
        rank = (1 if contains_click else 0, 1 if 0.002 <= ratio <= 0.82 else 0, confidence)
        candidates.append(
            {
                "polygon": polygon_for(mask),
                "confidence": max(0.0, min(1.0, confidence)),
                "area_pixels": area,
                "mask_b64": encode_mask(mask),
                "_rank": rank,
            }
        )

    candidates.sort(key=lambda item: item["_rank"], reverse=True)
    for item in candidates:
        item.pop("_rank", None)
    return candidates


def concept_segment_sam3(payload: dict, processor) -> dict:
    image = decode_image(payload["image_b64"])
    width, height = image.size
    state = processor.set_image(image)
    output = processor.set_text_prompt(state=state, prompt=payload["concept"])
    candidates = candidates_from_output(
        output.get("masks", []),
        output.get("scores"),
        width,
        height,
        payload.get("click_point"),
    )
    return result_from_candidates(candidates, width, height, payload["concept"], "sam3")


def concept_segment_sam31(payload: dict, predictor) -> dict:
    image = decode_image(payload["image_b64"])
    width, height = image.size
    session_id = None
    with tempfile.TemporaryDirectory(prefix="inpick-sam31-") as frame_dir:
        image.save(os.path.join(frame_dir, "00000.jpg"), format="JPEG", quality=95)
        try:
            started = predictor.handle_request(
                {
                    "type": "start_session",
                    "resource_path": frame_dir,
                    "offload_video_to_cpu": False,
                    "offload_state_to_cpu": False,
                }
            )
            session_id = started["session_id"]
            response = predictor.handle_request(
                {
                    "type": "add_prompt",
                    "session_id": session_id,
                    "frame_index": 0,
                    "text": payload["concept"],
                    "output_prob_thresh": float(payload.get("score_threshold", 0.35)),
                }
            )
            outputs = response.get("outputs") or {}
            masks = first_output(
                outputs,
                ("out_binary_masks", "binary_masks", "masks", "pred_masks"),
                [],
            )
            scores = first_output(
                outputs,
                ("out_probs", "scores", "object_scores", "pred_scores"),
                None,
            )
            candidates = candidates_from_output(
                masks,
                scores,
                width,
                height,
                payload.get("click_point"),
            )
            return result_from_candidates(
                candidates,
                width,
                height,
                payload["concept"],
                "sam3.1",
            )
        finally:
            if session_id:
                try:
                    predictor.handle_request(
                        {
                            "type": "close_session",
                            "session_id": session_id,
                            "run_gc_collect": True,
                        }
                    )
                except Exception:
                    # 정상 추론 결과를 세션 정리 오류로 덮지 않는다. 다음 요청의
                    # 메모리 검사는 health/warmup 및 OOM 분류 경로에서 처리한다.
                    pass


def result_from_candidates(
    candidates: list[dict],
    width: int,
    height: int,
    concept: str,
    engine: str,
) -> dict:
    if not candidates:
        raise ValueError("EMPTY_MASK: model returned no usable concept mask")
    best = candidates[0]
    return {
        "task": "click_segment",
        **best,
        "image_size": [width, height],
        "candidates": candidates[:6],
        "concept": concept,
        "engine": engine,
        "model_version": MODEL_VERSION,
    }


def classify_error(error: Exception) -> dict:
    raw = str(error)
    lower = raw.lower()
    if "out of memory" in lower or "cuda oom" in lower:
        code, retryable = "GPU_OUT_OF_MEMORY", True
    elif "gated" in lower or "401" in lower or "403" in lower or "access" in lower and "hugging" in lower:
        code, retryable = "MODEL_ACCESS_DENIED", False
    elif "cuda_unavailable" in lower or "cuda" in lower and "not available" in lower:
        code, retryable = "CUDA_UNAVAILABLE", False
    elif "empty_mask" in lower or "no usable" in lower:
        code, retryable = "EMPTY_MASK", False
    elif "invalid_image" in lower:
        code, retryable = "INVALID_IMAGE", False
    elif "timeout" in lower:
        code, retryable = "MODEL_TIMEOUT", True
    elif "missing key" in lower or "unexpected key" in lower or "size mismatch" in lower:
        code, retryable = "MODEL_VERSION_MISMATCH", False
    else:
        code, retryable = "WORKER_ERROR", True

    token = os.getenv("HF_TOKEN")
    safe_message = raw.replace(token, "[redacted]")[:800] if token else raw[:800]
    return {
        "error": {
            "code": code,
            "message": safe_message,
            "retryable": retryable,
            "engine": _engine_name or f"sam{MODEL_VERSION}",
        }
    }


def health_payload(loaded: bool) -> dict:
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    free_bytes = total_bytes = 0
    if torch.cuda.is_available():
        free_bytes, total_bytes = torch.cuda.mem_get_info()
    return {
        "ok": True,
        "engine": _engine_name or f"sam{MODEL_VERSION}",
        "model_version": MODEL_VERSION,
        "loaded": loaded,
        "loaded_at": _loaded_at,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": device_name,
        "gpu_free_bytes": free_bytes,
        "gpu_total_bytes": total_bytes,
    }


def handler(job):
    try:
        payload = job.get("input") or {}
        task = payload.get("task")
        if task == "health":
            return health_payload(_engine is not None)
        if task == "warmup":
            get_engine()
            return health_payload(True)
        if task != "concept_segment":
            return {"error": {"code": "UNSUPPORTED_TASK", "message": "unsupported task", "retryable": False}}

        concept = str(payload.get("concept") or "").strip()
        if not concept:
            raise ValueError("concept is required")
        if not payload.get("image_b64"):
            raise ValueError("image_b64 is required")

        engine, engine_name = get_engine()
        if engine_name == "sam3.1":
            return concept_segment_sam31({**payload, "concept": concept}, engine)
        return concept_segment_sam3({**payload, "concept": concept}, engine)
    except Exception as error:
        if torch.cuda.is_available() and (
            "out of memory" in str(error).lower() or "cuda oom" in str(error).lower()
        ):
            torch.cuda.empty_cache()
        return classify_error(error)


if __name__ == "__main__":
    if os.getenv("RUNPOD_DEBUG") == "1":
        get_engine()
    runpod.serverless.start({"handler": handler})
