"""tests/unit/test_identify_rois.py — v4.7 NEW
ROI identification tests using synthetic masks.
"""
import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from providers.base import SegResult
from core.targeted_viewing import identify_rois, ROI


class TestIdentifyRois:
    def _make_seg_with_mask(self, cls, mask):
        return SegResult(
            masks={cls: mask},
            boxes={},
            confidences={},
            meta={}
        )

    def test_single_component(self):
        """Single large component -> 1 ROI"""
        mask = np.zeros((1000, 1000), dtype=np.uint8)
        mask[200:400, 300:600] = 255  # 200x300 block

        seg = self._make_seg_with_mask("door", mask)
        rois = identify_rois(seg, (1000, 1000), padding_px=20, min_area_ratio=0.001)

        assert len(rois) == 1
        assert rois[0].reason == "door"
        # Check ROI contains the mask area with padding
        assert rois[0].x1 <= 300
        assert rois[0].y1 <= 200
        assert rois[0].x2 >= 600
        assert rois[0].y2 >= 400

    def test_two_components(self):
        """Two separate components -> 2 ROIs"""
        mask = np.zeros((1000, 1000), dtype=np.uint8)
        mask[100:200, 100:200] = 255  # component 1
        mask[700:800, 700:800] = 255  # component 2

        seg = self._make_seg_with_mask("window", mask)
        rois = identify_rois(seg, (1000, 1000), padding_px=10, min_area_ratio=0.001)

        assert len(rois) == 2

    def test_small_component_filtered(self):
        """Component smaller than min_area_ratio -> filtered out"""
        mask = np.zeros((1000, 1000), dtype=np.uint8)
        mask[500:505, 500:505] = 255  # 5x5 = 25px (0.0025% of 1M)

        seg = self._make_seg_with_mask("door", mask)
        rois = identify_rois(seg, (1000, 1000), padding_px=10, min_area_ratio=0.01)

        assert len(rois) == 0

    def test_padding_clipping(self):
        """ROIs near edge should be clipped to page bounds"""
        mask = np.zeros((500, 500), dtype=np.uint8)
        mask[0:50, 0:50] = 255  # top-left corner

        seg = self._make_seg_with_mask("door", mask)
        rois = identify_rois(seg, (500, 500), padding_px=100, min_area_ratio=0.001)

        assert len(rois) == 1
        assert rois[0].x1 >= 0  # clipped to 0
        assert rois[0].y1 >= 0  # clipped to 0

    def test_core_region_priority(self):
        """core_region should sort before other classes"""
        mask1 = np.zeros((1000, 1000), dtype=np.uint8)
        mask1[100:200, 100:200] = 255  # door

        mask2 = np.zeros((1000, 1000), dtype=np.uint8)
        mask2[500:700, 500:700] = 255  # core_region (larger)

        seg = SegResult(
            masks={"door": mask1, "core_region": mask2},
            boxes={}, confidences={}, meta={}
        )
        rois = identify_rois(seg, (1000, 1000), padding_px=10, min_area_ratio=0.001)

        assert len(rois) == 2
        assert rois[0].reason == "core_region"

    def test_empty_mask(self):
        """Empty mask -> no ROIs"""
        mask = np.zeros((1000, 1000), dtype=np.uint8)
        seg = self._make_seg_with_mask("door", mask)
        rois = identify_rois(seg, (1000, 1000))
        assert len(rois) == 0

    def test_no_target_class(self):
        """Mask for non-target class -> no ROIs"""
        mask = np.zeros((1000, 1000), dtype=np.uint8)
        mask[100:300, 100:300] = 255
        seg = self._make_seg_with_mask("wall", mask)  # wall is not in default target_classes
        rois = identify_rois(seg, (1000, 1000))
        assert len(rois) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
