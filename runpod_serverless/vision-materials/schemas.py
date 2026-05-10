"""
Vision Materials worker — input/output schemas.

가이드: c:\\Users\\user\\Downloads\\inpick-vision-material-estimate-dev-plan-20260510.md §7-3
"""
from __future__ import annotations
import dataclasses
from typing import Any, Dict, List, Optional, Literal


SurfaceType = Literal[
    "floor","wall","ceiling","tile","cabinet","countertop",
    "baseboard","door","window","fixture","lighting","sanitary","unknown"
]


@dataclasses.dataclass
class WorkerRequest:
    image_url: str
    clicked_point: Optional[Dict[str, float]] = None  # {x, y}
    selected_bbox: Optional[Dict[str, float]] = None  # {x, y, width, height}
    target_surface_types: Optional[List[SurfaceType]] = None
    room_type: Optional[str] = None
    style_tags: Optional[List[str]] = None
    max_surfaces: int = 12


@dataclasses.dataclass
class DominantColor:
    hex: str
    ratio: float


@dataclasses.dataclass
class CoarseLabel:
    label: str
    confidence: float


@dataclasses.dataclass
class SurfaceObservation:
    surface_type: SurfaceType
    bbox: Dict[str, float]
    mask_url: Optional[str] = None
    crop_url: Optional[str] = None
    area_ratio: Optional[float] = None
    dominant_colors: List[Dict[str, Any]] = dataclasses.field(default_factory=list)
    texture_features: Optional[Dict[str, Any]] = None
    ocr_text: Optional[str] = None
    coarse_labels: List[Dict[str, Any]] = dataclasses.field(default_factory=list)
    clip_embedding: Optional[List[float]] = None
    confidence: float = 0.0


@dataclasses.dataclass
class WorkerResponse:
    surfaces: List[Dict[str, Any]]
    model_versions: Dict[str, str]
    elapsed_ms: int


def parse_request(data: Dict[str, Any]) -> WorkerRequest:
    if "image_url" not in data:
        raise ValueError("image_url required")
    return WorkerRequest(
        image_url=data["image_url"],
        clicked_point=data.get("clicked_point"),
        selected_bbox=data.get("selected_bbox"),
        target_surface_types=data.get("target_surface_types"),
        room_type=data.get("room_type"),
        style_tags=data.get("style_tags"),
        max_surfaces=int(data.get("max_surfaces", 12)),
    )
