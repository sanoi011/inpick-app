"""
Detect 표면 — GroundingDINO (또는 YOLOv8 fallback).

Phase 3 (현재): placeholder. 실제 모델 import는 handler.py에서 try/except.

가이드:
- GroundingDINO: open-vocab, 자연어 prompt로 box 후보 탐지
- target prompts: "wood floor", "white wall", "bathroom tile",
  "countertop", "baseboard", "door", "window", "sink", "toilet", "cabinet"
"""
from __future__ import annotations
from typing import Any, Dict, List


def detect_surfaces(
    image_path: str,
    target_surface_types: List[str],
    room_type: str | None = None,
) -> List[Dict[str, Any]]:
    """
    표면 후보 box 반환.
    Phase 3 placeholder — 빈 배열.
    """
    _ = (image_path, target_surface_types, room_type)
    return []
