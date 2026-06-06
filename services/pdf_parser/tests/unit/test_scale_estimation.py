"""tests/unit/test_scale_estimation.py — v4.7
Scale estimation tests: OCR scale, dim_match, door heuristic.
"""
import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from providers.base import OcrWord, SegResult
from core.scale_estimation import (
    estimate_mm_per_px, _try_ocr_scale, _try_dim_match, _try_door_heuristic,
    ScaleResult
)


class MockCfg:
    scale_ocr_roi = 0.20
    scale_min_mm_per_px = 0.2
    scale_max_mm_per_px = 10.0


def _make_word(text, cx, cy, w=50, h=20, conf=0.9):
    x0 = int(cx - w / 2)
    y0 = int(cy - h / 2)
    return OcrWord(text=text, conf=conf,
                   bbox_px=(x0, y0, x0 + w, y0 + h),
                   center_px=(float(cx), float(cy)))


class TestOcrScale:
    def test_scale_1_100_at_300dpi(self):
        """OCR '1:100' at 300dpi -> mm_per_px ~ 8.47"""
        words = [_make_word("SCALE 1:100", 900, 900)]
        cfg = MockCfg()
        r = _try_ocr_scale(words, 300, cfg, 1000, 1000)
        assert r is not None
        assert r.method == "ocr_scale"
        assert r.status == "ok"
        assert abs(r.mm_per_px - 8.467) < 0.1

    def test_scale_1_50_at_300dpi(self):
        words = [_make_word("S=1/50", 900, 900)]
        cfg = MockCfg()
        r = _try_ocr_scale(words, 300, cfg, 1000, 1000)
        assert r is not None
        assert abs(r.mm_per_px - 4.233) < 0.1

    def test_no_scale_found(self):
        words = [_make_word("hello world", 500, 500)]
        cfg = MockCfg()
        r = _try_ocr_scale(words, 300, cfg, 1000, 1000)
        assert r is None


class TestDimMatch:
    def test_two_candidates_median(self):
        """Two dimension lines with OCR numbers -> median mm_per_px"""
        cfg = MockCfg()
        seg = SegResult(
            masks={},
            boxes={"dimension_line": [(100, 100, 500, 110), (100, 200, 600, 210)]},
            confidences={"dimension_line": [0.9, 0.9]},
            meta={}
        )
        # 400px bbox -> "3000" mm text nearby -> 3000/400 = 7.5
        # 500px bbox -> "4000" mm text nearby -> 4000/500 = 8.0
        words = [
            _make_word("3000", 300, 100),
            _make_word("4000", 350, 200),
        ]
        r = _try_dim_match(words, seg, cfg)
        assert r is not None
        assert r.method == "dim_match"
        assert 7.0 <= r.mm_per_px <= 8.5

    def test_single_candidate_warning(self):
        cfg = MockCfg()
        seg = SegResult(
            masks={},
            boxes={"dimension_line": [(100, 100, 500, 110)]},
            confidences={"dimension_line": [0.9]},
            meta={}
        )
        words = [_make_word("3000", 300, 100)]
        r = _try_dim_match(words, seg, cfg)
        assert r is not None
        assert r.status == "warning"

    def test_no_dimension_lines(self):
        cfg = MockCfg()
        seg = SegResult(masks={}, boxes={}, confidences={}, meta={})
        r = _try_dim_match([], seg, cfg)
        assert r is None


class TestDoorHeuristic:
    def test_door_boxes_median(self):
        """Multiple door boxes -> median width -> 900mm assumed"""
        cfg = MockCfg()
        # Door boxes with ~100px short axis -> 900/100 = 9.0 mm/px
        seg = SegResult(
            masks={},
            boxes={"door": [
                (200, 100, 300, 200),  # 100x100 -> min=100
                (400, 100, 480, 220),  # 80x120 -> min=80
                (600, 100, 700, 210),  # 100x110 -> min=100
            ]},
            confidences={"door": [0.9, 0.8, 0.85]},
            meta={}
        )
        r = _try_door_heuristic(seg, cfg)
        assert r is not None
        assert r.method == "door_heuristic"
        assert 8.0 <= r.mm_per_px <= 12.0

    def test_too_few_doors(self):
        cfg = MockCfg()
        seg = SegResult(
            masks={},
            boxes={"door": [(200, 100, 300, 200)]},
            confidences={"door": [0.9]},
            meta={}
        )
        r = _try_door_heuristic(seg, cfg)
        assert r is None


class TestEstimateMmPerPx:
    def test_priority_chain(self):
        """OCR scale should be preferred over dim_match"""
        cfg = MockCfg()
        page = np.zeros((1000, 1000, 3), dtype=np.uint8)
        words = [_make_word("SCALE 1:100", 900, 900)]
        r = estimate_mm_per_px(page, words, 300, cfg)
        assert r.method == "ocr_scale"

    def test_all_fail_returns_error(self):
        cfg = MockCfg()
        page = np.zeros((1000, 1000, 3), dtype=np.uint8)
        r = estimate_mm_per_px(page, [], 300, cfg)
        assert r.status == "error"
        assert r.method == "none"
        assert r.mm_per_px is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
