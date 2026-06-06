"""providers/seg/yolo_provider.py — v4.7
YOLOv8 segmentation provider for floorplan symbol detection.
"""
from __future__ import annotations
from typing import Dict, List, Tuple
import numpy as np

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from providers.base import SegmentationProvider, SegResult, ProviderMeta, ProviderError

# YOLO class mapping (13 classes from v4.6)
YOLO_CLASSES = [
    "wall", "door", "door_swing", "door_sliding", "window",
    "column", "toilet", "sink", "bathtub", "kitchen_sink",
    "stove", "stairs", "elevator", "dimension_line"
]


class YoloSegProvider(SegmentationProvider):
    meta = ProviderMeta(name="yolo-seg", version="1.0", runtime="local")

    def __init__(self, model_path: str, imgsz: int = 640, conf: float = 0.5):
        self._model_path = model_path
        self._imgsz = imgsz
        self._conf = conf
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from ultralytics import YOLO
            self._model = YOLO(self._model_path)
        except Exception as e:
            raise ProviderError(f"YOLO model load failed: {self._model_path}: {e}") from e

    def predict(self, page_rgb: np.ndarray, **kwargs) -> SegResult:
        self._load_model()
        imgsz = kwargs.get("imgsz", self._imgsz)
        conf = kwargs.get("conf", self._conf)

        results = self._model(page_rgb, imgsz=imgsz, conf=conf, verbose=False)

        masks: Dict[str, np.ndarray] = {}
        boxes: Dict[str, List[Tuple[int, int, int, int]]] = {}
        confidences: Dict[str, List[float]] = {}
        H, W = page_rgb.shape[:2]

        if results and len(results) > 0:
            result = results[0]
            if result.boxes is not None:
                for i, box in enumerate(result.boxes):
                    cls_id = int(box.cls[0])
                    if cls_id >= len(YOLO_CLASSES):
                        continue
                    cls_name = YOLO_CLASSES[cls_id]
                    conf_val = float(box.conf[0])

                    x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
                    if cls_name not in boxes:
                        boxes[cls_name] = []
                        confidences[cls_name] = []
                    boxes[cls_name].append((x0, y0, x1, y1))
                    confidences[cls_name].append(conf_val)

            # Extract masks if available
            if result.masks is not None:
                for i, mask in enumerate(result.masks.data):
                    cls_id = int(result.boxes[i].cls[0])
                    if cls_id >= len(YOLO_CLASSES):
                        continue
                    cls_name = YOLO_CLASSES[cls_id]
                    mask_np = mask.cpu().numpy()
                    if mask_np.shape[:2] != (H, W):
                        import cv2
                        mask_np = cv2.resize(mask_np, (W, H), interpolation=cv2.INTER_NEAREST)
                    mask_uint8 = (mask_np > 0.5).astype(np.uint8) * 255

                    if cls_name not in masks:
                        masks[cls_name] = np.zeros((H, W), dtype=np.uint8)
                    masks[cls_name] = np.maximum(masks[cls_name], mask_uint8)

        return SegResult(
            masks=masks,
            boxes=boxes,
            confidences=confidences,
            meta={"provider": "yolo", "imgsz": imgsz, "conf": conf,
                  "model": self._model_path}
        )
