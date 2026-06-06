"""core/opening_subtype.py — v4.7 NEW
Opening (door/window) subtype classification based on:
  - Room adjacency matching
  - Width range matching
  - Korean apartment standard dimensions

Subtypes:
  Doors: entrance, interior, bathroom, balcony_door, utility
  Windows: balcony_window, room_window, kitchen_window
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class OpeningSubtype:
    opening_id: str
    base_type: str                    # door | window
    subtype: str                      # entrance | interior | bathroom | balcony_door |
                                      # balcony_window | room_window | kitchen_window
    confidence: float
    reasoning: str


# Korean apartment standard dimensions (mm)
DOOR_SUBTYPES = {
    "entrance":       {"width_range": (900, 1100), "adj_rooms": ("복도", "현관", "거실")},
    "interior":       {"width_range": (800, 900),  "adj_rooms": None},
    "bathroom":       {"width_range": (600, 750),  "adj_rooms": ("욕실", "화장실", "파우더")},
    "balcony_door":   {"width_range": (700, 2400), "adj_rooms": ("발코니",)},
    "utility":        {"width_range": (600, 800),  "adj_rooms": ("다용도실", "보일러")},
}

WINDOW_SUBTYPES = {
    "balcony_window": {"width_range": (1800, 4000), "adj_rooms": ("발코니",)},
    "room_window":    {"width_range": (800, 1800),  "adj_rooms": None},
    "kitchen_window": {"width_range": (800, 1200),  "adj_rooms": ("주방", "부엌")},
}


def classify_opening_subtype(opening_id: str, base_type: str,
                             width_mm: Optional[float],
                             adjacent_room_names: List[str]) -> OpeningSubtype:
    """
    Classify opening detail type.

    Input:
    - base_type: "door" or "window" (from seg result)
    - width_mm: opening width in mm. None if unknown
    - adjacent_room_names: room names adjacent to this opening (from room_labeling)

    Strategy: room adjacency match -> width range match -> both match = high confidence
    """
    subtypes = DOOR_SUBTYPES if base_type == "door" else WINDOW_SUBTYPES
    adj_lower = [n.lower() for n in adjacent_room_names if n]

    best_subtype = "interior" if base_type == "door" else "room_window"
    best_conf = 0.3
    best_reason = "default"

    for stype, spec in subtypes.items():
        adj_match = False
        width_match = False

        # room adjacency check
        if spec["adj_rooms"]:
            for room_kw in spec["adj_rooms"]:
                if any(room_kw in adj for adj in adj_lower):
                    adj_match = True
                    break

        # width check
        if width_mm is not None:
            wmin, wmax = spec["width_range"]
            if wmin <= width_mm <= wmax:
                width_match = True

        # scoring
        if adj_match and width_match:
            conf = 0.9
            reason = f"room_adj({spec['adj_rooms']})+width({width_mm}mm)"
        elif adj_match:
            conf = 0.7
            reason = f"room_adj({spec['adj_rooms']})"
        elif width_match and spec["adj_rooms"] is None:
            conf = 0.5
            reason = f"width({width_mm}mm)"
        else:
            continue

        if conf > best_conf:
            best_conf = conf
            best_subtype = stype
            best_reason = reason

    return OpeningSubtype(
        opening_id=opening_id,
        base_type=base_type,
        subtype=best_subtype,
        confidence=best_conf,
        reasoning=best_reason
    )
