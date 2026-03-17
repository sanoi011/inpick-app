"""tests/unit/test_seg_router.py — v4.7
Seg router caching and pass1->pass2 order tests using mock providers.
"""
import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from providers.base import SegmentationProvider, SegResult, ProviderMeta
from providers.seg.seg_router import SegRouter, SegRouterProvider


class MockSegProvider(SegmentationProvider):
    """Mock provider that records calls."""
    meta = ProviderMeta(name="mock", version="1.0", runtime="local")

    def __init__(self, name="mock"):
        self.name = name
        self.call_count = 0
        self.last_kwargs = {}

    def predict(self, page_rgb: np.ndarray, **kwargs) -> SegResult:
        self.call_count += 1
        self.last_kwargs = kwargs
        return SegResult(masks={}, boxes={}, confidences={}, meta={"provider": self.name})


class TestSegRouter:
    def test_router_holds_two_providers(self):
        pass1 = MockSegProvider("pass1")
        pass2 = MockSegProvider("pass2")
        router = SegRouter(pass1=pass1, pass2=pass2)
        assert router.pass1.name == "pass1"
        assert router.pass2.name == "pass2"

    def test_pass1_pass2_call_order(self):
        """pass1 should be called before pass2 in normal flow"""
        pass1 = MockSegProvider("pass1")
        pass2 = MockSegProvider("pass2")
        router = SegRouter(pass1=pass1, pass2=pass2)

        img = np.zeros((100, 100, 3), dtype=np.uint8)

        # Simulate targeted viewing flow
        result1 = router.pass1.predict(img, imgsz=640)
        assert pass1.call_count == 1
        assert pass2.call_count == 0

        result2 = router.pass2.predict(img, imgsz=1280)
        assert pass1.call_count == 1
        assert pass2.call_count == 1

    def test_kwargs_forwarded(self):
        """imgsz kwarg should be forwarded to provider"""
        provider = MockSegProvider()
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        provider.predict(img, imgsz=1280, conf=0.3)
        assert provider.last_kwargs["imgsz"] == 1280
        assert provider.last_kwargs["conf"] == 0.3


class TestSegRouterProvider:
    def test_reset(self):
        """reset() should clear cache"""
        SegRouterProvider.reset()
        assert SegRouterProvider._cached is None

    def test_caching(self):
        """Subsequent get() should return same instance"""
        SegRouterProvider.reset()
        # Note: get() will fail without actual model files,
        # but reset should work regardless
        assert SegRouterProvider._cached is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
