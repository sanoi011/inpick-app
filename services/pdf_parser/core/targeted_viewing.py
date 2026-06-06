"""core/targeted_viewing.py — v4.7
Targeted Viewing: Pass1 coarse → ROI identification → Pass2 detail.

v4.6 fix #9: identify_rois() implementation provided.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
import numpy as np
import cv2
import time

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from providers.base import SegResult


# -- Data classes --

@dataclass
class ROI:
    x1: int
    y1: int
    x2: int
    y2: int
    reason: str
    priority: int = 1


@dataclass
class TargetedViewingResult:
    seg_result: SegResult
    rois: List[ROI]
    pass1_meta: dict
    pass2_details: List[dict]
    total_time_ms: float


# -- ROI identification (v4.7: implementation provided) --

def identify_rois(seg_coarse: SegResult, page_shape: Tuple[int, int],
                  padding_px: int = 50, min_area_ratio: float = 0.005,
                  target_classes: Tuple[str, ...] = ("core_region", "door", "window", "stairs", "elevator")
                  ) -> List[ROI]:
    """
    Identify ROIs from Pass1 results that need detail analysis.

    Strategy:
    - Extract connected components from target_classes masks
    - Filter by minimum area (relative to page)
    - Apply padding + clip to page bounds

    Uses OpenCV connectedComponents (no SciPy dependency).
    """
    H, W = page_shape
    page_area = H * W
    rois: List[ROI] = []

    for cls in target_classes:
        mask = seg_coarse.masks.get(cls)
        if mask is None or not np.any(mask):
            continue

        # connected components
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            mask, connectivity=8
        )

        for i in range(1, num_labels):  # 0 = background
            area = stats[i, cv2.CC_STAT_AREA]
            if area < page_area * min_area_ratio:
                continue

            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]

            # padding + clipping
            x1 = max(0, x - padding_px)
            y1 = max(0, y - padding_px)
            x2 = min(W, x + w + padding_px)
            y2 = min(H, y + h + padding_px)

            rois.append(ROI(x1=x1, y1=y1, x2=x2, y2=y2, reason=cls, priority=1))

    # priority sort (core_region > others, then by area descending)
    rois.sort(key=lambda r: (0 if r.reason == "core_region" else 1, -(r.x2 - r.x1) * (r.y2 - r.y1)))
    return rois


# -- Merge --

def _offset_box(box: Tuple[int, int, int, int], dx: int, dy: int) -> Tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    return (x0 + dx, y0 + dy, x1 + dx, y1 + dy)


def merge_detail_into_coarse(coarse: SegResult, detail: SegResult,
                             roi: ROI, page_shape: Tuple[int, int]) -> SegResult:
    H, W = page_shape
    roi_h, roi_w = roi.y2 - roi.y1, roi.x2 - roi.x1

    # masks: overwrite ROI region with detail
    for cls, dmask in detail.masks.items():
        if cls not in coarse.masks:
            coarse.masks[cls] = np.zeros((H, W), dtype=np.uint8)
        if dmask.shape[:2] != (roi_h, roi_w):
            dmask = cv2.resize(dmask, (roi_w, roi_h), interpolation=cv2.INTER_NEAREST)
        coarse.masks[cls][roi.y1:roi.y2, roi.x1:roi.x2] = dmask

    # boxes/confidences: offset and append
    for cls, boxes in detail.boxes.items():
        if cls not in coarse.boxes:
            coarse.boxes[cls] = []
            coarse.confidences[cls] = []
        coarse.boxes[cls].extend([_offset_box(b, roi.x1, roi.y1) for b in boxes])
        coarse.confidences[cls].extend(detail.confidences.get(cls, [1.0] * len(boxes)))

    return coarse


# -- Main function --

def run_targeted_viewing(page_rgb: np.ndarray, seg_router,
                         pass1_imgsz: int = 640, pass2_imgsz: int = 1280,
                         roi_padding_px: int = 50, roi_min_area_ratio: float = 0.005,
                         max_rois: int = 8) -> TargetedViewingResult:
    t0 = time.time()
    H, W = page_rgb.shape[:2]

    # Pass1: coarse model (full image)
    seg_coarse = seg_router.pass1.predict(page_rgb, imgsz=pass1_imgsz)

    # ROI identification
    rois = identify_rois(seg_coarse, (H, W),
                         padding_px=roi_padding_px,
                         min_area_ratio=roi_min_area_ratio)[:max_rois]

    # Pass2: precise model (ROI crops only)
    pass2_details = []
    for i, roi in enumerate(rois):
        crop = page_rgb[roi.y1:roi.y2, roi.x1:roi.x2].copy()
        seg_detail = seg_router.pass2.predict(crop, imgsz=pass2_imgsz)
        seg_coarse = merge_detail_into_coarse(seg_coarse, seg_detail, roi, (H, W))
        pass2_details.append({
            "roi_index": i,
            "roi_reason": roi.reason,
            "roi_size": (roi.x2 - roi.x1, roi.y2 - roi.y1),
        })

    return TargetedViewingResult(
        seg_result=seg_coarse,
        rois=rois,
        pass1_meta={"coarse_imgsz": pass1_imgsz, "rois_found": len(rois)},
        pass2_details=pass2_details,
        total_time_ms=(time.time() - t0) * 1000
    )
