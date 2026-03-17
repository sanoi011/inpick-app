"""services/pdf_parser/api_server.py — v4.7
FastAPI server for floorplan recognition.
"""
from __future__ import annotations
import io
import json
import logging
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np

# Ensure parent is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse

from config import CFG
from pipeline import run_pipeline

logger = logging.getLogger("pdf_parser.api")

app = FastAPI(
    title="INPICK Floorplan Parser",
    version="4.7.0",
    description="Floorplan recognition pipeline with Targeted Viewing + Scale Estimation v2"
)


def _convert_numpy(obj):
    """Recursively convert numpy types to native Python types."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: _convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_convert_numpy(v) for v in obj]
    return obj


@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.7.0", "config": {
        "seg_provider": CFG.seg_provider,
        "ocr_provider": CFG.ocr_provider,
        "targeted_viewing": CFG.targeted_viewing,
    }}


@app.post("/api/v1/recognize")
async def recognize(
    file: UploadFile = File(...),
    input_type: str = Form("drawing"),
    dpi: int = Form(300),
    known_area: Optional[float] = Form(None),
):
    """
    Main recognition endpoint.

    Accepts image file (PNG/JPG) and returns ParsedFloorPlan-compatible JSON.
    """
    t0 = time.time()

    try:
        contents = await file.read()

        # Decode image
        import cv2
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return JSONResponse({"error": "Cannot decode image"}, status_code=400)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Run pipeline
        result = run_pipeline(
            page_rgb=img_rgb,
            input_type=input_type,
            dpi=dpi,
            known_area_m2=known_area,
        )

        response = _convert_numpy({
            "success": result.success,
            "project": result.project_json,
            "scale": {
                "mm_per_px": result.scale.mm_per_px if result.scale else None,
                "method": result.scale.method if result.scale else "none",
                "status": result.scale.status if result.scale else "error",
            },
            "opening_subtypes": [
                {"id": s.opening_id, "base_type": s.base_type,
                 "subtype": s.subtype, "confidence": s.confidence}
                for s in result.opening_subtypes
            ],
            "timing": result.timing,
            "warnings": result.warnings,
            "processingTimeMs": (time.time() - t0) * 1000,
        })
        if result.error:
            response["error"] = result.error

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Recognition failed: {e}", exc_info=True)
        return JSONResponse(
            {"error": str(e), "processingTimeMs": (time.time() - t0) * 1000},
            status_code=500
        )
