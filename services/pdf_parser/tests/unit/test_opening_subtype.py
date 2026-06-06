"""tests/unit/test_opening_subtype.py — v4.7 NEW
Opening subtype classification tests.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from core.opening_subtype import classify_opening_subtype


class TestDoorSubtype:
    def test_bathroom_door(self):
        """Bathroom adjacent + 700mm -> bathroom (conf >= 0.9)"""
        r = classify_opening_subtype("d1", "door", 700, ["욕실"])
        assert r.subtype == "bathroom"
        assert r.confidence >= 0.9

    def test_entrance_door(self):
        """Entrance adjacent + 1000mm -> entrance (conf >= 0.9)"""
        r = classify_opening_subtype("d2", "door", 1000, ["현관"])
        assert r.subtype == "entrance"
        assert r.confidence >= 0.9

    def test_entrance_living_adjacent(self):
        """Living room adjacent + 1000mm -> entrance"""
        r = classify_opening_subtype("d3", "door", 1000, ["거실"])
        assert r.subtype == "entrance"
        assert r.confidence >= 0.7

    def test_interior_door_default(self):
        """No room match, 850mm -> interior (default)"""
        r = classify_opening_subtype("d4", "door", 850, ["침실1"])
        assert r.subtype == "interior"
        # width matches interior range, adj_rooms is None -> conf 0.5
        assert r.confidence >= 0.3

    def test_balcony_door(self):
        """Balcony adjacent + 1800mm -> balcony_door"""
        r = classify_opening_subtype("d5", "door", 1800, ["발코니"])
        assert r.subtype == "balcony_door"
        assert r.confidence >= 0.9

    def test_utility_door(self):
        """Utility room adjacent + 700mm -> utility"""
        r = classify_opening_subtype("d6", "door", 700, ["다용도실"])
        assert r.subtype == "utility"
        assert r.confidence >= 0.9

    def test_no_width_adj_only(self):
        """No width info, only adjacency -> conf 0.7"""
        r = classify_opening_subtype("d7", "door", None, ["욕실"])
        assert r.subtype == "bathroom"
        assert r.confidence >= 0.7


class TestWindowSubtype:
    def test_balcony_window(self):
        """Balcony adjacent + 2400mm -> balcony_window (conf >= 0.7)"""
        r = classify_opening_subtype("w1", "window", 2400, ["발코니"])
        assert r.subtype == "balcony_window"
        assert r.confidence >= 0.7

    def test_room_window_default(self):
        """No specific room + 1200mm -> room_window"""
        r = classify_opening_subtype("w2", "window", 1200, ["침실"])
        assert r.subtype == "room_window"
        # adj_rooms is None for room_window, width matches -> conf 0.5
        assert r.confidence >= 0.3

    def test_kitchen_window(self):
        """Kitchen adjacent + 1000mm -> kitchen_window"""
        r = classify_opening_subtype("w3", "window", 1000, ["주방"])
        assert r.subtype == "kitchen_window"
        assert r.confidence >= 0.9

    def test_large_balcony_window(self):
        """Balcony + 3500mm -> balcony_window"""
        r = classify_opening_subtype("w4", "window", 3500, ["발코니"])
        assert r.subtype == "balcony_window"
        assert r.confidence >= 0.9


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
