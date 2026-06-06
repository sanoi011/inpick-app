"""providers/lidar/roomplan_converter.py — v4.7
Convert Apple RoomPlan JSON to internal format.
Thin wrapper - main conversion is in TS (src/lib/services/roomplan-converter.ts).
"""
from __future__ import annotations
from typing import Dict, Any, List
import json


def convert_roomplan_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert RoomPlan CapturedRoom JSON to a simplified internal format.
    For full ParsedFloorPlan conversion, use the TypeScript converter.
    """
    rooms = []
    walls = []
    doors = []
    windows = []

    # Extract floors as rooms
    for i, floor in enumerate(data.get("floors", [])):
        transform = floor.get("transform", [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        dims = floor.get("dimensions", [1, 1, 0.01])
        x = transform[12] if len(transform) > 12 else 0
        z = transform[14] if len(transform) > 14 else 0
        rooms.append({
            "id": f"room-{i}",
            "name": floor.get("identifier", f"Room {i}"),
            "x": x,
            "y": z,
            "width": dims[0] if len(dims) > 0 else 1,
            "height": dims[1] if len(dims) > 1 else 1,
            "area": dims[0] * dims[1] if len(dims) > 1 else 1,
        })

    # Extract walls
    for i, wall in enumerate(data.get("walls", [])):
        transform = wall.get("transform", [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        dims = wall.get("dimensions", [1, 2.4, 0.15])
        x = transform[12] if len(transform) > 12 else 0
        z = transform[14] if len(transform) > 14 else 0
        walls.append({
            "id": f"wall-{i}",
            "x": x,
            "y": z,
            "length": dims[0] if len(dims) > 0 else 1,
            "height": dims[1] if len(dims) > 1 else 2.4,
            "thickness": dims[2] if len(dims) > 2 else 0.15,
        })

    return {
        "rooms": rooms,
        "walls": walls,
        "doors": doors,
        "windows": windows,
        "source": "roomplan",
    }
