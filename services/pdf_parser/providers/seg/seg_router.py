"""providers/seg/seg_router.py — v4.7
2-model router for Targeted Viewing: Pass1 (nano) + Pass2 (medium).
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import threading

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from config import CFG
from providers.base import SegmentationProvider, ProviderMeta, ProviderError
from providers.seg.yolo_provider import YoloSegProvider


@dataclass
class SegRouter:
    """Targeted Viewing: pass1 (coarse) + pass2 (detail)"""
    pass1: SegmentationProvider  # lightweight (nano)
    pass2: SegmentationProvider  # precise (medium)


class SegRouterProvider:
    """Factory: created once, cached for reuse."""
    meta = ProviderMeta(name="seg-router", version="1.0", runtime="local")
    _lock = threading.Lock()
    _cached: Optional[SegRouter] = None

    @classmethod
    def get(cls) -> SegRouter:
        with cls._lock:
            if cls._cached is not None:
                return cls._cached
            try:
                pass1 = YoloSegProvider(
                    model_path=CFG.pass1_model_abs,
                    imgsz=CFG.pass1_imgsz,
                    conf=CFG.yolo_conf
                )
                pass2 = YoloSegProvider(
                    model_path=CFG.pass2_model_abs,
                    imgsz=CFG.pass2_imgsz,
                    conf=CFG.yolo_conf
                )
            except Exception as e:
                raise ProviderError(f"SegRouter model load failed: {e}") from e
            cls._cached = SegRouter(pass1=pass1, pass2=pass2)
            return cls._cached

    @classmethod
    def reset(cls):
        """Test utility: reset cache"""
        with cls._lock:
            cls._cached = None
