"""
SAM2 segmentation — box/point prompt → mask.

Phase 3 (현재): placeholder.
가이드: clicked_point 있으면 클릭점 포함 mask 우선.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional


def segment_surface(
    image_path: str,
    bbox: Dict[str, float] | None = None,
    points: Optional[List[List[float]]] = None,
) -> Dict[str, Any]:
    """
    SAM2 mask 생성.
    Phase 3 placeholder — 빈 dict.
    """
    _ = (image_path, bbox, points)
    return {"mask": None, "score": 0.0}
