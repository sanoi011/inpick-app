"""core/fixture_suppression.py — v4.7 (same as v4.6)
Remove fixture symbols from ink mask to improve wall vectorization.
"""
from __future__ import annotations
from typing import Iterable
import numpy as np
import cv2


def suppress_fixtures_from_ink(ink_mask: np.ndarray, seg_result,
                               fixture_classes: Iterable[str]) -> np.ndarray:
    """Remove fixture symbol regions from ink mask (preserve wall/door/window)."""
    if seg_result is None:
        return ink_mask
    out = ink_mask.copy()
    for cls in fixture_classes:
        m = seg_result.masks.get(cls)
        if m is None or not np.any(m):
            continue
        k = np.ones((5, 5), np.uint8)
        m2 = cv2.dilate(m, k, iterations=1)
        out[m2 > 0] = 0
    return out
