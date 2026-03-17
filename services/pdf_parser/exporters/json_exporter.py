"""exporters/json_exporter.py — v4.7
Export pipeline result to ParsedFloorPlan-compatible JSON.
"""
from __future__ import annotations
import json
from typing import Any, Dict, Optional
import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        elif isinstance(obj, (np.floating,)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def export_to_json(project: Dict[str, Any], output_path: Optional[str] = None) -> str:
    """
    Export project JSON to file or string.

    Args:
        project: Pipeline output project_json
        output_path: If provided, write to file

    Returns:
        JSON string
    """
    json_str = json.dumps(project, ensure_ascii=False, indent=2, cls=NumpyEncoder)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_str)

    return json_str


def to_parsed_floorplan(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert pipeline project_json to ParsedFloorPlan format
    compatible with TypeScript types/floorplan.ts.
    """
    mm_per_px = project.get("meta", {}).get("mm_per_px") or 5.0
    m_per_px = mm_per_px / 1000.0

    rooms = []
    for r in project.get("rooms", []):
        rooms.append({
            "id": r["id"],
            "type": r.get("type", "UTILITY"),
            "name": r.get("name", ""),
            "area": r.get("area_m2", 0),
            "position": {
                "x": r.get("center_px", (0, 0))[0] * m_per_px,
                "y": r.get("center_px", (0, 0))[1] * m_per_px,
                "width": 3.0,  # placeholder
                "height": 3.0,
            }
        })

    walls = []
    for w in project.get("walls", []):
        walls.append({
            "id": w["id"],
            "start": {"x": w["x0_mm"] / 1000, "y": w["y0_mm"] / 1000},
            "end": {"x": w["x1_mm"] / 1000, "y": w["y1_mm"] / 1000},
            "thickness": w.get("thickness_mm", 150) / 1000,
        })

    doors = []
    windows = []
    for o in project.get("openings", []):
        if o["type"] == "door":
            doors.append({
                "id": o["id"],
                "position": {"x": (o["x0"] + o["x1"]) / 2 * m_per_px,
                              "y": (o["y0"] + o["y1"]) / 2 * m_per_px},
                "width": o.get("widthMm", 900) / 1000,
                "type": "swing",
            })
        else:
            windows.append({
                "id": o["id"],
                "position": {"x": (o["x0"] + o["x1"]) / 2 * m_per_px,
                              "y": (o["y0"] + o["y1"]) / 2 * m_per_px},
                "width": o.get("widthMm", 1200) / 1000,
                "height": 1.2,
            })

    total_area = sum(r.get("area", 0) for r in rooms)

    return {
        "totalArea": total_area,
        "rooms": rooms,
        "walls": walls,
        "doors": doors,
        "windows": windows,
    }
