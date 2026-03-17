"""services/pdf_parser/pipeline.py — v4.7
Main floorplan recognition pipeline orchestrator.

Flow:
  a. PDF render -> image
  b. OCR (1x) -> words
  c. Scale estimation (v4.7: with seg_result)
  d. Seg (SegRouter: pass1 -> ROI -> pass2) [GPU sequential]
  e. Fixture suppression -> ink refinement
  f. Wall mask -> skeleton -> graph -> normalize [CPU parallel]
  g. Opening detection -> opening subtype (v4.7)
  h. Room labeling
  i. Build project JSON + debug artifacts

Input types: drawing | lidar_spatial | lidar_pc | cad
"""
from __future__ import annotations
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from config import CFG
from providers.base import OcrWord, SegResult
from core.scale_estimation import estimate_mm_per_px, ScaleResult
from core.fixture_suppression import suppress_fixtures_from_ink
from core.opening_subtype import classify_opening_subtype, OpeningSubtype
from core.targeted_viewing import run_targeted_viewing

logger = logging.getLogger("pdf_parser.pipeline")


@dataclass
class PipelineResult:
    """Pipeline output"""
    success: bool
    project_json: Dict[str, Any] = field(default_factory=dict)
    scale: Optional[ScaleResult] = None
    opening_subtypes: List[OpeningSubtype] = field(default_factory=list)
    debug_artifacts: Dict[str, Any] = field(default_factory=dict)
    timing: Dict[str, float] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None


def _build_compact_json(scale: ScaleResult,
                        walls: List[Dict],
                        rooms: List[Dict],
                        openings: List[Dict],
                        subtypes: List[OpeningSubtype]) -> Dict[str, Any]:
    """Build compact JSON for LLM validator (section 9 format)."""
    wall_thicknesses = {}
    for w in walls:
        t = str(w.get("thickness_mm", 0))
        wall_thicknesses[t] = wall_thicknesses.get(t, 0) + 1

    areas = [r.get("area_m2", 0) for r in rooms]
    subtype_counts = {}
    for s in subtypes:
        subtype_counts[s.subtype] = subtype_counts.get(s.subtype, 0) + 1

    return {
        "meta": {
            "type": "drawing",
            "mmPerPx": scale.mm_per_px,
            "scaleMethod": scale.method,
            "scaleStatus": scale.status,
        },
        "stats": {
            "walls": {"count": len(walls), "thicknessBuckets": wall_thicknesses},
            "rooms": {
                "count": len(rooms),
                "areaM2": {
                    "min": round(min(areas), 1) if areas else 0,
                    "median": round(float(np.median(areas)), 1) if areas else 0,
                    "max": round(max(areas), 1) if areas else 0,
                }
            },
            "openings": {
                "count": len(openings),
                "doors": sum(1 for o in openings if o.get("type") == "door"),
                "windows": sum(1 for o in openings if o.get("type") == "window"),
                "subtypes": subtype_counts,
            },
        },
        "samples": {
            "walls": walls[:5],
            "openings": openings[:5],
            "rooms": rooms[:5],
        },
    }


def _fetch_from_worker(pdf_bytes: bytes, page_num: int) -> Optional[bytes]:
    """Fetch preprocessed image from preprocess worker."""
    if not CFG.preprocess_worker_url:
        return None
    try:
        import requests
        resp = requests.post(
            f"{CFG.preprocess_worker_url}/render",
            files={"pdf": ("input.pdf", pdf_bytes)},
            data={"page": page_num, "dpi": CFG.preprocess_dpi},
            timeout=30
        )
        if resp.status_code == 200:
            return resp.content
    except Exception as e:
        logger.warning(f"Worker fetch failed: {e}")
    return None


def run_pipeline(
    page_rgb: np.ndarray,
    input_type: str = "drawing",
    dpi: int = 300,
    known_area_m2: Optional[float] = None,
    output_dir: Optional[Path] = None,
) -> PipelineResult:
    """
    Main pipeline entry point.

    Args:
        page_rgb: Input image as numpy array (H, W, 3)
        input_type: "drawing" | "lidar_spatial" | "lidar_pc" | "cad"
        dpi: Rendering DPI (for scale estimation)
        known_area_m2: Known total area for scale correction
        output_dir: Directory for debug artifacts
    """
    t0 = time.time()
    timing: Dict[str, float] = {}
    warnings: List[str] = []
    debug_artifacts: Dict[str, Any] = {}

    try:
        H, W = page_rgb.shape[:2]
        logger.info(f"Pipeline start: {W}x{H}, type={input_type}, dpi={dpi}")

        # ---- Step 1: OCR ----
        t1 = time.time()
        ocr_words: List[OcrWord] = []
        try:
            from providers.ocr.paddle_provider import PaddleOcrProvider
            ocr = PaddleOcrProvider(lang=CFG.ocr_lang)
            ocr_result = ocr.run_words(page_rgb)
            ocr_words = ocr_result.words
            logger.info(f"OCR: {len(ocr_words)} words")
        except Exception as e:
            logger.warning(f"OCR failed: {e}")
            warnings.append(f"OCR failed: {e}")
        timing["ocr_ms"] = (time.time() - t1) * 1000

        # ---- Step 2: Segmentation (Targeted Viewing) ----
        t2 = time.time()
        seg_result: Optional[SegResult] = None
        if CFG.seg_provider != "none":
            try:
                from providers import get_seg_router
                router = get_seg_router()
                if router and CFG.targeted_viewing:
                    tv_result = run_targeted_viewing(
                        page_rgb, router,
                        pass1_imgsz=CFG.pass1_imgsz,
                        pass2_imgsz=CFG.pass2_imgsz,
                        roi_padding_px=CFG.roi_padding_px,
                        roi_min_area_ratio=CFG.roi_min_area_ratio,
                    )
                    seg_result = tv_result.seg_result
                    debug_artifacts["targeted_viewing"] = {
                        "rois": len(tv_result.rois),
                        "pass2_details": tv_result.pass2_details,
                        "time_ms": tv_result.total_time_ms,
                    }
                elif router:
                    seg_result = router.pass2.predict(page_rgb, imgsz=CFG.pass2_imgsz)
            except Exception as e:
                logger.warning(f"Segmentation failed: {e}")
                warnings.append(f"Segmentation failed: {e}")
        timing["seg_ms"] = (time.time() - t2) * 1000

        # ---- Step 3: Scale Estimation ----
        t3 = time.time()
        scale = estimate_mm_per_px(page_rgb, ocr_words, dpi, CFG, seg_result)
        if scale.status == "error":
            warnings.append("Scale estimation failed - using default")
        timing["scale_ms"] = (time.time() - t3) * 1000
        debug_artifacts["scale"] = {
            "mm_per_px": scale.mm_per_px,
            "method": scale.method,
            "status": scale.status,
            "meta": scale.meta,
        }

        # ---- Step 4: Fixture Suppression ----
        # (Applied to ink mask after wall extraction, not directly to page_rgb)

        # ---- Step 5: Wall extraction ----
        t5 = time.time()
        walls: List[Dict] = []
        # Wall extraction uses the existing wall_extractor or wall_mask_engine
        # For now, extract from seg_result if available
        if seg_result and "wall" in seg_result.boxes:
            for i, box in enumerate(seg_result.boxes["wall"]):
                x0, y0, x1, y1 = box
                mm_per_px = scale.mm_per_px or 5.0
                walls.append({
                    "id": f"wall_{i}",
                    "x0_mm": x0 * mm_per_px,
                    "y0_mm": y0 * mm_per_px,
                    "x1_mm": x1 * mm_per_px,
                    "y1_mm": y1 * mm_per_px,
                    "thickness_mm": min(x1 - x0, y1 - y0) * mm_per_px,
                    "lenMm": max(x1 - x0, y1 - y0) * mm_per_px,
                })
        timing["wall_ms"] = (time.time() - t5) * 1000

        # ---- Step 6: Opening detection + subtype (v4.7) ----
        t6 = time.time()
        openings: List[Dict] = []
        opening_subtypes: List[OpeningSubtype] = []

        if seg_result:
            mm_per_px = scale.mm_per_px or 5.0
            for cls in ["door", "door_swing", "door_sliding", "window"]:
                for i, box in enumerate(seg_result.boxes.get(cls, [])):
                    x0, y0, x1, y1 = box
                    base_type = "window" if cls == "window" else "door"
                    width_px = min(x1 - x0, y1 - y0)
                    width_mm = width_px * mm_per_px
                    opening_id = f"op_{cls}_{i}"

                    openings.append({
                        "id": opening_id,
                        "type": base_type,
                        "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                        "widthMm": round(width_mm, 1),
                    })

                    # v4.7: subtype classification
                    subtype = classify_opening_subtype(
                        opening_id=opening_id,
                        base_type=base_type,
                        width_mm=width_mm,
                        adjacent_room_names=[],  # filled after room labeling
                    )
                    opening_subtypes.append(subtype)

        timing["opening_ms"] = (time.time() - t6) * 1000

        # ---- Step 7: Room labeling ----
        t7 = time.time()
        rooms: List[Dict] = []
        # Room labeling from OCR words
        for w in ocr_words:
            # Simple heuristic: Korean room names
            room_keywords = {
                "거실": "LIVING", "주방": "KITCHEN", "안방": "MASTER_BED",
                "침실": "BED", "욕실": "BATHROOM", "화장실": "BATHROOM",
                "현관": "ENTRANCE", "발코니": "BALCONY", "다용도": "UTILITY",
                "드레스": "DRESSROOM", "복도": "CORRIDOR",
            }
            for kw, rtype in room_keywords.items():
                if kw in w.text:
                    rooms.append({
                        "id": f"room_{len(rooms)}",
                        "name": w.text.strip(),
                        "type": rtype,
                        "center_px": w.center_px,
                        "area_m2": 0,  # to be computed from polygon
                    })
                    break
        timing["room_ms"] = (time.time() - t7) * 1000

        # ---- Step 8: Build project JSON ----
        project_json = {
            "meta": {
                "version": "4.7",
                "input_type": input_type,
                "dpi": dpi,
                "page_size": [W, H],
                "mm_per_px": scale.mm_per_px,
                "scale_method": scale.method,
                "scale_status": scale.status,
            },
            "walls": walls,
            "rooms": rooms,
            "openings": openings,
            "opening_subtypes": [
                {"id": s.opening_id, "base_type": s.base_type,
                 "subtype": s.subtype, "confidence": s.confidence,
                 "reasoning": s.reasoning}
                for s in opening_subtypes
            ],
            "ocr_words": [
                {"text": w.text, "conf": w.conf, "bbox": w.bbox_px}
                for w in ocr_words[:100]  # limit for JSON size
            ],
        }

        # ---- QC Gate ----
        if scale.status not in ("ok", "warning"):
            project_json["meta"]["degraded"] = True
            warnings.append("Scale estimation degraded")

        if not rooms:
            warnings.append("No rooms detected")

        timing["total_ms"] = (time.time() - t0) * 1000
        logger.info(f"Pipeline complete: {timing['total_ms']:.0f}ms, "
                     f"{len(walls)} walls, {len(rooms)} rooms, {len(openings)} openings")

        return PipelineResult(
            success=True,
            project_json=project_json,
            scale=scale,
            opening_subtypes=opening_subtypes,
            debug_artifacts=debug_artifacts,
            timing=timing,
            warnings=warnings,
        )

    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        return PipelineResult(
            success=False,
            error=str(e),
            timing={"total_ms": (time.time() - t0) * 1000},
            warnings=warnings,
        )
