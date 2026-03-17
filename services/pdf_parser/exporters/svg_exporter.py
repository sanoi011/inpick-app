"""exporters/svg_exporter.py — v4.7
Export pipeline result to SVG for visual debugging.
"""
from __future__ import annotations
from typing import Any, Dict, List


def export_to_svg(project: Dict[str, Any], width: int = 800, height: int = 600) -> str:
    """
    Generate SVG visualization of recognized floorplan.
    Used for debug artifact output.
    """
    mm_per_px = project.get("meta", {}).get("mm_per_px") or 5.0
    scale = 800 / max(project.get("meta", {}).get("page_size", [800, 600]))

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">',
        '<style>',
        '  .wall { stroke: #2D2D3D; stroke-width: 3; fill: none; }',
        '  .door { stroke: #E67E22; stroke-width: 2; fill: none; }',
        '  .window { stroke: #60A5FA; stroke-width: 2; fill: none; }',
        '  .room-label { font-family: sans-serif; font-size: 12px; fill: #333; text-anchor: middle; }',
        '</style>',
    ]

    # Walls
    for w in project.get("walls", []):
        x0 = w.get("x0_mm", 0) / mm_per_px * scale
        y0 = w.get("y0_mm", 0) / mm_per_px * scale
        x1 = w.get("x1_mm", 0) / mm_per_px * scale
        y1 = w.get("y1_mm", 0) / mm_per_px * scale
        lines.append(f'  <line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" class="wall"/>')

    # Openings
    for o in project.get("openings", []):
        cx = (o["x0"] + o["x1"]) / 2 * scale
        cy = (o["y0"] + o["y1"]) / 2 * scale
        r = 5
        cls = "door" if o["type"] == "door" else "window"
        lines.append(f'  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" class="{cls}"/>')

    # Room labels
    for room in project.get("rooms", []):
        if "center_px" in room:
            cx = room["center_px"][0] * scale
            cy = room["center_px"][1] * scale
            name = room.get("name", "")
            lines.append(f'  <text x="{cx:.1f}" y="{cy:.1f}" class="room-label">{name}</text>')

    lines.append('</svg>')
    return "\n".join(lines)
