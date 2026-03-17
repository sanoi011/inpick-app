"""services/pdf_parser/providers/base.py — v4.7
Provider base classes with ProviderError and **kwargs support.

v4.6 fixes:
  #4: SegmentationProvider.predict() now accepts **kwargs (for imgsz)
  #5: ProviderError added
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple
import numpy as np


class ProviderError(Exception):
    """Base exception for all provider errors"""
    pass


@dataclass(frozen=True)
class ProviderMeta:
    name: str
    version: str
    runtime: Literal["local", "docker", "cloud", "ios_device"]


# -- PDF Render --

class PdfRenderProvider:
    meta: ProviderMeta

    def render_page_rgb(self, pdf_bytes: bytes, page_num: int, dpi: int) -> np.ndarray:
        raise NotImplementedError

    def extract_text(self, pdf_bytes: bytes, page_num: int) -> Optional[str]:
        raise NotImplementedError


# -- Segmentation / Detection --

SegClass = Literal[
    "wall", "door", "window", "column", "core_region",
    "toilet", "sink", "bathtub", "stairs", "elevator",
    "dimension_line", "room_label",
    "door_swing", "door_sliding", "kitchen_sink", "stove"
]


@dataclass
class SegResult:
    masks: Dict[str, np.ndarray]                     # uint8 0/255
    boxes: Dict[str, List[Tuple[int, int, int, int]]]  # x0,y0,x1,y1
    confidences: Dict[str, List[float]]
    meta: Dict[str, Any]


class SegmentationProvider:
    meta: ProviderMeta

    def predict(self, page_rgb: np.ndarray, **kwargs) -> SegResult:
        """
        kwargs: implementation-specific options (e.g., imgsz, conf).
        YoloSegProvider accepts imgsz to control inference resolution.
        """
        raise NotImplementedError


# -- OCR --

@dataclass
class OcrWord:
    text: str
    conf: float
    bbox_px: Tuple[int, int, int, int]  # x0,y0,x1,y1
    center_px: Tuple[float, float]


@dataclass
class OcrResult:
    words: List[OcrWord]
    meta: Dict[str, Any]


class OcrProvider:
    meta: ProviderMeta

    def run_words(self, page_rgb: np.ndarray) -> OcrResult:
        raise NotImplementedError


# -- LLM Validator --

class LlmValidatorProvider:
    meta: ProviderMeta

    def validate(self, compact_json: Dict[str, Any]) -> Dict[str, Any]:
        """Input: compact JSON (see section 9). Do NOT send entire project.json."""
        raise NotImplementedError
