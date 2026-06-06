"""providers/seg/noop_provider.py — v4.7
No-op segmentation provider for when seg is disabled.
"""
from __future__ import annotations
import numpy as np

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from providers.base import SegmentationProvider, SegResult, ProviderMeta


class NoopSegProvider(SegmentationProvider):
    meta = ProviderMeta(name="noop-seg", version="1.0", runtime="local")

    def predict(self, page_rgb: np.ndarray, **kwargs) -> SegResult:
        return SegResult(masks={}, boxes={}, confidences={}, meta={"provider": "noop"})
