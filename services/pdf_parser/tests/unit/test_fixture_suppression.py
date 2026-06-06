"""tests/unit/test_fixture_suppression.py — v4.7
Fixture suppression tests: verify fixtures are removed from ink mask.
"""
import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from providers.base import SegResult
from core.fixture_suppression import suppress_fixtures_from_ink


class TestFixtureSuppression:
    def _make_seg(self, fixture_masks):
        masks = {}
        for cls, mask in fixture_masks.items():
            masks[cls] = mask
        return SegResult(masks=masks, boxes={}, confidences={}, meta={})

    def test_removes_toilet_from_ink(self):
        """Toilet mask region should be zeroed in ink"""
        ink = np.ones((100, 100), dtype=np.uint8) * 255
        toilet_mask = np.zeros((100, 100), dtype=np.uint8)
        toilet_mask[40:60, 40:60] = 255  # 20x20 toilet region

        seg = self._make_seg({"toilet": toilet_mask})
        result = suppress_fixtures_from_ink(ink, seg, ["toilet"])

        # Fixture region should be zeroed (with 5x5 dilation)
        assert result[50, 50] == 0
        # Non-fixture region should be preserved
        assert result[0, 0] == 255

    def test_preserves_walls(self):
        """Wall regions should not be affected"""
        ink = np.ones((100, 100), dtype=np.uint8) * 255
        toilet_mask = np.zeros((100, 100), dtype=np.uint8)
        toilet_mask[80:100, 80:100] = 255

        seg = self._make_seg({"toilet": toilet_mask})
        result = suppress_fixtures_from_ink(ink, seg, ["toilet"])

        # Top-left corner (far from fixture) should be preserved
        assert result[10, 10] == 255

    def test_multiple_fixtures(self):
        """Multiple fixture classes should all be suppressed"""
        ink = np.ones((200, 200), dtype=np.uint8) * 255
        toilet_mask = np.zeros((200, 200), dtype=np.uint8)
        toilet_mask[20:40, 20:40] = 255
        sink_mask = np.zeros((200, 200), dtype=np.uint8)
        sink_mask[100:120, 100:120] = 255

        seg = self._make_seg({"toilet": toilet_mask, "sink": sink_mask})
        result = suppress_fixtures_from_ink(ink, seg, ["toilet", "sink"])

        assert result[30, 30] == 0
        assert result[110, 110] == 0
        assert result[0, 0] == 255

    def test_no_seg_result(self):
        """None seg_result should return ink unchanged"""
        ink = np.ones((100, 100), dtype=np.uint8) * 255
        result = suppress_fixtures_from_ink(ink, None, ["toilet"])
        np.testing.assert_array_equal(result, ink)

    def test_missing_fixture_class(self):
        """Missing fixture class in seg should be ignored"""
        ink = np.ones((100, 100), dtype=np.uint8) * 255
        seg = self._make_seg({})
        result = suppress_fixtures_from_ink(ink, seg, ["toilet", "sink"])
        np.testing.assert_array_equal(result, ink)

    def test_does_not_modify_original(self):
        """Original ink mask should not be modified"""
        ink = np.ones((100, 100), dtype=np.uint8) * 255
        original = ink.copy()
        toilet_mask = np.zeros((100, 100), dtype=np.uint8)
        toilet_mask[40:60, 40:60] = 255

        seg = self._make_seg({"toilet": toilet_mask})
        suppress_fixtures_from_ink(ink, seg, ["toilet"])

        np.testing.assert_array_equal(ink, original)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
