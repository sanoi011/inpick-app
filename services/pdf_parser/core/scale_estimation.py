"""core/scale_estimation.py — v4.7
Scale estimation with 3-method chain:
  1) OCR title block scale (1:100)
  2) Dimension line text-pixel matching (v4.7 NEW)
  3) Door width heuristic (seg boxes based, v4.7 fix)

v4.6 fixes:
  #2: Removed unused ROI crop logic
  #3: Door heuristic now uses seg door boxes median width
  #7: Corrected unit conversion comment
"""
from __future__ import annotations
import re
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from providers.base import OcrWord, SegResult


@dataclass
class ScaleResult:
    mm_per_px: Optional[float]
    status: str    # ok | warning | error
    method: str    # ocr_scale | dim_match | door_heuristic | none
    meta: dict


# -- Scale OCR patterns --
SCALE_RE = re.compile(
    r"(?:\ucd95\ucc99|SCALE|S)\s*[:=]?\s*1\s*[:/]\s*(\d{2,4})",
    re.IGNORECASE
)

# -- Dimension number pattern (v4.7 NEW) --
DIM_NUM_RE = re.compile(r"^(\d{3,5})$")  # 100~99999 range (mm notation)


def _filter_ocr_words_in_roi(words: List[OcrWord], roi_box: Tuple[int, int, int, int]) -> List[OcrWord]:
    """Filter OCR words within a specific region (x0,y0,x1,y1)"""
    x0, y0, x1, y1 = roi_box
    return [w for w in words if x0 <= w.center_px[0] <= x1 and y0 <= w.center_px[1] <= y1]


def _try_ocr_scale(words: List[OcrWord], dpi: int, cfg,
                   page_h: int, page_w: int) -> Optional[ScaleResult]:
    """Method 1: Title block OCR for scale notation (1:100 etc.)"""
    roi_ratio = cfg.scale_ocr_roi
    roi_box = (
        int(page_w * (1 - roi_ratio)), int(page_h * (1 - roi_ratio)),
        page_w, page_h
    )
    roi_words = _filter_ocr_words_in_roi(words, roi_box)
    text_blob = " ".join([w.text for w in roi_words])

    m = SCALE_RE.search(text_blob)
    if not m:
        # Try full page OCR
        text_blob_full = " ".join([w.text for w in words])
        m = SCALE_RE.search(text_blob_full)
    if not m:
        return None

    denom = int(m.group(1))
    # 1px = (25.4 / dpi) mm_on_paper x scale_denom
    # e.g. 300dpi, 1:100 -> 1px = 0.0847mm x 100 = 8.47mm
    mm_per_px = (25.4 / float(dpi)) * denom

    if cfg.scale_min_mm_per_px <= mm_per_px <= cfg.scale_max_mm_per_px:
        return ScaleResult(mm_per_px=mm_per_px, status="ok", method="ocr_scale",
                           meta={"scale": f"1:{denom}", "dpi": dpi})
    return ScaleResult(mm_per_px=None, status="warning", method="ocr_scale",
                       meta={"scale": f"1:{denom}", "dpi": dpi, "reason": "out_of_range"})


def _try_dim_match(words: List[OcrWord], seg_result: Optional[SegResult],
                   cfg) -> Optional[ScaleResult]:
    """
    Method 2 (v4.7 NEW): Dimension line text-pixel distance matching.

    Strategy:
    - Extract dimension_line masks/boxes from seg_result
    - Match nearby OCR numbers (DIM_NUM_RE) to dimension_line bbox
    - number(mm) / bbox long axis(px) = mm_per_px candidate
    - Use median of candidates as final value
    """
    if seg_result is None:
        return None

    dim_boxes = seg_result.boxes.get("dimension_line", [])
    if not dim_boxes:
        return None

    candidates = []
    for box in dim_boxes:
        bx0, by0, bx1, by1 = box
        length_px = max(bx1 - bx0, by1 - by0)
        if length_px < 20:
            continue

        # Search 30px expanded region around box for OCR numbers
        search_box = (bx0 - 30, by0 - 30, bx1 + 30, by1 + 30)
        nearby_words = _filter_ocr_words_in_roi(words, search_box)

        for w in nearby_words:
            dm = DIM_NUM_RE.match(w.text.strip())
            if dm:
                val_mm = int(dm.group(1))
                if 50 <= val_mm <= 50000:  # 50mm ~ 50m range
                    ratio = val_mm / float(length_px)
                    if cfg.scale_min_mm_per_px <= ratio <= cfg.scale_max_mm_per_px:
                        candidates.append(ratio)

    if len(candidates) >= 2:
        mm_per_px = float(np.median(candidates))
        return ScaleResult(mm_per_px=mm_per_px, status="ok", method="dim_match",
                           meta={"candidates": len(candidates), "median": mm_per_px})
    elif len(candidates) == 1:
        return ScaleResult(mm_per_px=candidates[0], status="warning", method="dim_match",
                           meta={"candidates": 1, "single_value": candidates[0]})
    return None


def _try_door_heuristic(seg_result: Optional[SegResult], cfg) -> Optional[ScaleResult]:
    """
    Method 3: Door seg boxes median width assumed as 900mm.

    v4.7 fix: Removed unused edge detection, uses seg_result door boxes directly.
    """
    if seg_result is None:
        return None

    door_boxes = seg_result.boxes.get("door", [])
    if len(door_boxes) < 2:
        return None

    # Extract short axis (opening width) of door bboxes
    widths_px = []
    for bx0, by0, bx1, by1 in door_boxes:
        w = bx1 - bx0
        h = by1 - by0
        widths_px.append(min(w, h))  # short axis = door width direction

    if not widths_px:
        return None

    median_px = float(np.median(widths_px))
    if median_px < 10:
        return None

    assumed_door_mm = 900.0  # Korean standard interior door 900mm
    mm_per_px = assumed_door_mm / median_px

    if cfg.scale_min_mm_per_px <= mm_per_px <= cfg.scale_max_mm_per_px:
        return ScaleResult(mm_per_px=mm_per_px, status="warning", method="door_heuristic",
                           meta={"assumed_door_mm": 900, "median_door_px": median_px,
                                 "door_count": len(door_boxes)})
    return None


def estimate_mm_per_px(page_rgb: np.ndarray, ocr_words: List[OcrWord],
                       dpi: int, cfg,
                       seg_result: Optional[SegResult] = None) -> ScaleResult:
    """
    Priority chain:
    1) Title block scale OCR: '1:100' -> mm_per_px
    2) Dimension line text-pixel matching (v4.7 actual implementation)
    3) Door width heuristic: seg door boxes median -> 900mm assumed
    """
    H, W = page_rgb.shape[:2]

    # 1) OCR scale
    r = _try_ocr_scale(ocr_words, dpi, cfg, H, W)
    if r and r.mm_per_px is not None:
        return r

    # 2) Dimension line matching (v4.7)
    r = _try_dim_match(ocr_words, seg_result, cfg)
    if r and r.mm_per_px is not None:
        return r

    # 3) Door heuristic
    r = _try_door_heuristic(seg_result, cfg)
    if r and r.mm_per_px is not None:
        return r

    return ScaleResult(mm_per_px=None, status="error", method="none", meta={})
