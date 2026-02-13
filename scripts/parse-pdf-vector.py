#!/usr/bin/env python3
"""
PyMuPDF PDF vector floor plan parser.
Extracts wall lines, dimension texts, and structural hints from PDF drawings.

Usage:
  python scripts/parse-pdf-vector.py <pdf_path> [--known-area 84] [--page 0] [--debug]

Output: JSON to stdout with floorPlan + vectorHints for hybrid Gemini integration.
"""

import sys
import os
import json
import math
import re
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from collections import Counter

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. pip install PyMuPDF"}), file=sys.stderr)
    sys.exit(1)

import numpy as np

MIN_WALL_LENGTH_PT = 15  # minimum line length in pt to consider as wall
MIN_LINE_LENGTH_PT = 3   # minimum line length to keep at all


# ============================================================
# Data structures
# ============================================================

@dataclass
class RawLine:
    x0: float; y0: float; x1: float; y1: float
    width: float
    color: tuple = (0, 0, 0)

@dataclass
class RawRect:
    x0: float; y0: float; x1: float; y1: float
    width: float
    fill: bool = False

@dataclass
class RawText:
    text: str; x: float; y: float; font_size: float; bbox: tuple = (0,0,0,0)

@dataclass
class ExtractResult:
    page_width: float; page_height: float
    lines: List[RawLine] = field(default_factory=list)
    rects: List[RawRect] = field(default_factory=list)
    texts: List[RawText] = field(default_factory=list)
    width_counts: dict = field(default_factory=dict)  # {width: line_count}


def line_length(l) -> float:
    return math.sqrt((l.x1 - l.x0)**2 + (l.y1 - l.y0)**2)

def is_horizontal(l, tol=3.0) -> bool:
    return abs(l.y1 - l.y0) < tol

def is_vertical(l, tol=3.0) -> bool:
    return abs(l.x1 - l.x0) < tol

def line_angle_deg(l) -> float:
    return math.degrees(math.atan2(l.y1 - l.y0, l.x1 - l.x0)) % 180


# ============================================================
# Stage 1: Extract vectors from PDF
# ============================================================

def extract_vectors(pdf_path: str, page_num: int = 0) -> ExtractResult:
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        page_num = 0
    page = doc[page_num]

    lines = []
    rects = []
    width_counts = {}

    for path in page.get_drawings():
        w = path.get("width")
        if w is None or w == 0:
            w = 0.5
        color = path.get("color") or (0, 0, 0)
        fill_color = path.get("fill")

        for item in path["items"]:
            kind = item[0]

            if kind == "l":
                p1, p2 = item[1], item[2]
                ln = RawLine(p1.x, p1.y, p2.x, p2.y, w, color or (0,0,0))
                length = line_length(ln)
                if length >= MIN_LINE_LENGTH_PT:
                    lines.append(ln)
                    wk = round(w, 3)
                    width_counts[wk] = width_counts.get(wk, 0) + 1

            elif kind == "re":  # rectangle
                r = item[1]  # fitz.Rect
                rects.append(RawRect(r.x0, r.y0, r.x1, r.y1, w, fill_color is not None))

            elif kind == "qu":  # quad (4-point)
                q = item[1]
                # Approximate quad as a rect
                xs = [q.ul.x, q.ur.x, q.lr.x, q.ll.x]
                ys = [q.ul.y, q.ur.y, q.lr.y, q.ll.y]
                rects.append(RawRect(min(xs), min(ys), max(xs), max(ys), w, fill_color is not None))

    # Extract text
    texts = []
    try:
        td = page.get_text("dict")
        for block in td.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if t:
                        bbox = span["bbox"]
                        texts.append(RawText(t, bbox[0], bbox[1], span.get("size", 10), tuple(bbox)))
    except Exception:
        pass

    pw, ph = page.rect.width, page.rect.height
    doc.close()

    return ExtractResult(pw, ph, lines, rects, texts, width_counts)


# ============================================================
# Stage 2: Classify lines
# ============================================================

CAT_EXTERIOR = "exterior_wall"
CAT_INTERIOR = "interior_wall"
CAT_DIMENSION = "dimension_line"
CAT_HATCH = "hatch"
CAT_FURNITURE = "furniture"
CAT_UNKNOWN = "unknown"

@dataclass
class ClassifiedLine:
    line: RawLine
    category: str
    confidence: float


def compute_width_thresholds(width_counts: dict) -> dict:
    """Auto-threshold from width histogram using percentiles."""
    if not width_counts:
        return {"exterior": 0.35, "interior": 0.18}

    # Build sorted unique widths weighted by count
    entries = []
    for w, c in width_counts.items():
        entries.extend([float(w)] * c)
    arr = np.array(entries)

    unique_widths = sorted(set(float(w) for w in width_counts.keys()))

    if len(unique_widths) <= 2:
        # Few distinct widths: thickest = exterior, second = interior
        exterior_w = unique_widths[-1]
        interior_w = unique_widths[-2] if len(unique_widths) > 1 else exterior_w * 0.6
        return {"exterior": exterior_w - 0.001, "interior": interior_w - 0.001}

    p90 = float(np.percentile(arr, 90))
    p70 = float(np.percentile(arr, 70))
    return {
        "exterior": max(p90, 0.2),
        "interior": max(p70, 0.1),
    }


def classify_lines(extract: ExtractResult) -> List[ClassifiedLine]:
    thresholds = compute_width_thresholds(extract.width_counts)

    # Find drawing bounds from thick lines
    thick = [l for l in extract.lines if l.width >= thresholds["interior"] and line_length(l) >= MIN_WALL_LENGTH_PT]
    bounds = None
    if thick:
        xs = [l.x0 for l in thick] + [l.x1 for l in thick]
        ys = [l.y0 for l in thick] + [l.y1 for l in thick]
        bounds = {"xmin": min(xs)-20, "ymin": min(ys)-20, "xmax": max(xs)+20, "ymax": max(ys)+20}

    # Number text positions (dimension values like "2130", "3400")
    dim_positions = []
    for t in extract.texts:
        cleaned = t.text.replace(",", "").replace(" ", "").strip()
        if re.match(r'^\d{3,5}$', cleaned):
            dim_positions.append((t.x, t.y))

    classified = []
    for l in extract.lines:
        cat, conf = _classify_one(l, thresholds, bounds, dim_positions)
        classified.append(ClassifiedLine(l, cat, conf))

    # Detect hatch patterns (many parallel diagonal lines)
    _mark_hatch(classified)

    return classified


def _point_near_line(px, py, l, max_dist=15) -> bool:
    dx, dy = l.x1 - l.x0, l.y1 - l.y0
    len_sq = dx*dx + dy*dy
    if len_sq == 0:
        return math.hypot(px - l.x0, py - l.y0) < max_dist
    t = max(0, min(1, ((px-l.x0)*dx + (py-l.y0)*dy) / len_sq))
    proj_x, proj_y = l.x0 + t*dx, l.y0 + t*dy
    return math.hypot(px - proj_x, py - proj_y) < max_dist


def _classify_one(l, thresholds, bounds, dim_positions):
    length = line_length(l)

    # Very short lines = furniture/detail
    if length < MIN_WALL_LENGTH_PT:
        return CAT_FURNITURE, 0.5

    # Outside drawing bounds = dimension/annotation
    if bounds:
        inside = (bounds["xmin"] <= l.x0 <= bounds["xmax"] and bounds["ymin"] <= l.y0 <= bounds["ymax"]
                  and bounds["xmin"] <= l.x1 <= bounds["xmax"] and bounds["ymin"] <= l.y1 <= bounds["ymax"])
        if not inside:
            return CAT_DIMENSION, 0.7

    # Near dimension text = dimension line
    for dx, dy in dim_positions:
        if _point_near_line(dx, dy, l):
            return CAT_DIMENSION, 0.75

    # Width-based classification
    if l.width >= thresholds["exterior"]:
        if is_horizontal(l) or is_vertical(l):
            return CAT_EXTERIOR, 0.85
        return CAT_EXTERIOR, 0.6
    elif l.width >= thresholds["interior"]:
        if is_horizontal(l) or is_vertical(l):
            return CAT_INTERIOR, 0.75
        return CAT_UNKNOWN, 0.4
    else:
        return CAT_UNKNOWN, 0.3


def _mark_hatch(classified):
    diags = [cl for cl in classified if cl.category in (CAT_UNKNOWN, CAT_FURNITURE)
             and 10 < line_angle_deg(cl.line) < 80]
    angle_groups = {}
    for cl in diags:
        a = round(line_angle_deg(cl.line) / 5) * 5
        angle_groups.setdefault(a, []).append(cl)
    for group in angle_groups.values():
        if len(group) >= 8:
            for cl in group:
                cl.category = CAT_HATCH
                cl.confidence = 0.85


# ============================================================
# Stage 3: Merge walls + build floor plan
# ============================================================

def _deduplicate_walls(walls, min_dist=0.05):
    """Remove near-duplicate walls (same position within tolerance)."""
    if len(walls) <= 1:
        return walls

    result = []
    used = set()
    for i, w in enumerate(walls):
        if i in used:
            continue
        merged = w.copy()
        for j in range(i+1, len(walls)):
            if j in used:
                continue
            w2 = walls[j]
            # Check if start/end are very close
            d_start = math.hypot(w["start"]["x"]-w2["start"]["x"], w["start"]["y"]-w2["start"]["y"])
            d_end = math.hypot(w["end"]["x"]-w2["end"]["x"], w["end"]["y"]-w2["end"]["y"])
            d_cross1 = math.hypot(w["start"]["x"]-w2["end"]["x"], w["start"]["y"]-w2["end"]["y"])
            d_cross2 = math.hypot(w["end"]["x"]-w2["start"]["x"], w["end"]["y"]-w2["start"]["y"])
            if (d_start < min_dist and d_end < min_dist) or (d_cross1 < min_dist and d_cross2 < min_dist):
                used.add(j)
                merged["thickness"] = max(merged["thickness"], w2["thickness"])
        result.append(merged)
        used.add(i)
    return result


def merge_and_build(extract: ExtractResult, classified: List[ClassifiedLine],
                    known_area: Optional[float] = None) -> dict:
    """Build ParsedFloorPlan from classified lines."""

    # --- Scale determination ---
    wall_cls = [cl for cl in classified if cl.category in (CAT_EXTERIOR, CAT_INTERIOR)
                and (is_horizontal(cl.line) or is_vertical(cl.line))
                and line_length(cl.line) >= MIN_WALL_LENGTH_PT]

    if not wall_cls:
        wall_cls = [cl for cl in classified if cl.category in (CAT_EXTERIOR, CAT_INTERIOR)]

    all_wall_lines = [cl.line for cl in wall_cls] if wall_cls else extract.lines[:100]

    if all_wall_lines:
        off_x = min(min(l.x0, l.x1) for l in all_wall_lines)
        off_y = min(min(l.y0, l.y1) for l in all_wall_lines)
        max_x = max(max(l.x0, l.x1) for l in all_wall_lines)
        max_y = max(max(l.y0, l.y1) for l in all_wall_lines)
    else:
        off_x, off_y, max_x, max_y = 0, 0, extract.page_width, extract.page_height

    bbox_w, bbox_h = max_x - off_x, max_y - off_y

    # Try dimension text scale first
    scale = None
    dim_texts = [(t.text, t.x, t.y, t.bbox) for t in extract.texts
                 if re.match(r'^\d{3,5}$', t.text.replace(",","").replace(" ","").strip())]

    if dim_texts and wall_cls:
        scale_samples = []
        for txt, tx, ty, tb in dim_texts:
            val_mm = int(txt.replace(",","").strip())
            if val_mm < 100:
                continue
            # Find nearest wall line
            for cl in wall_cls:
                l = cl.line
                if _point_near_line(tx, ty, l, max_dist=30):
                    pt_len = line_length(l)
                    if pt_len > 10:
                        m_per_pt = (val_mm / 1000.0) / pt_len
                        if 0.0005 < m_per_pt < 0.05:
                            scale_samples.append(m_per_pt)
        if scale_samples:
            scale = float(np.median(scale_samples))

    # Fallback: known area
    if scale is None and known_area and bbox_w > 0 and bbox_h > 0:
        scale = math.sqrt(known_area / (bbox_w * bbox_h))

    # Fallback: default 1:100 at ~72 DPI
    if scale is None:
        scale = 0.0035

    def to_m(val, offset):
        return round((val - offset) * scale, 4)

    # --- Merge parallel line pairs into walls ---
    h_walls = [cl for cl in wall_cls if is_horizontal(cl.line)]
    v_walls = [cl for cl in wall_cls if is_vertical(cl.line)]

    wall_data = []
    wid = 0
    paired = set()

    # Horizontal pairs
    h_walls.sort(key=lambda cl: cl.line.y0)
    for i, cl1 in enumerate(h_walls):
        if id(cl1) in paired:
            continue
        for j in range(i+1, len(h_walls)):
            cl2 = h_walls[j]
            if id(cl2) in paired:
                continue
            gap = abs(cl1.line.y0 - cl2.line.y0)
            if gap > 25:
                break
            if gap < 2:
                continue
            # Check x-overlap
            x1a, x1b = min(cl1.line.x0, cl1.line.x1), max(cl1.line.x0, cl1.line.x1)
            x2a, x2b = min(cl2.line.x0, cl2.line.x1), max(cl2.line.x0, cl2.line.x1)
            overlap = max(0, min(x1b, x2b) - max(x1a, x2a))
            span = max(x1b - x1a, x2b - x2a, 1)
            if overlap / span > 0.4:
                cy = (cl1.line.y0 + cl2.line.y0) / 2
                x_min = min(x1a, x2a)
                x_max = max(x1b, x2b)
                is_ext = cl1.category == CAT_EXTERIOR
                wall_data.append({
                    "id": f"wall-{wid}", "start": {"x": to_m(x_min, off_x), "y": to_m(cy, off_y)},
                    "end": {"x": to_m(x_max, off_x), "y": to_m(cy, off_y)},
                    "thickness": round(gap * scale, 4), "isExterior": is_ext,
                })
                wid += 1
                paired.add(id(cl1))
                paired.add(id(cl2))
                break

    # Vertical pairs
    v_walls.sort(key=lambda cl: cl.line.x0)
    for i, cl1 in enumerate(v_walls):
        if id(cl1) in paired:
            continue
        for j in range(i+1, len(v_walls)):
            cl2 = v_walls[j]
            if id(cl2) in paired:
                continue
            gap = abs(cl1.line.x0 - cl2.line.x0)
            if gap > 25:
                break
            if gap < 2:
                continue
            y1a, y1b = min(cl1.line.y0, cl1.line.y1), max(cl1.line.y0, cl1.line.y1)
            y2a, y2b = min(cl2.line.y0, cl2.line.y1), max(cl2.line.y0, cl2.line.y1)
            overlap = max(0, min(y1b, y2b) - max(y1a, y2a))
            span = max(y1b - y1a, y2b - y2a, 1)
            if overlap / span > 0.4:
                cx = (cl1.line.x0 + cl2.line.x0) / 2
                y_min = min(y1a, y2a)
                y_max = max(y1b, y2b)
                is_ext = cl1.category == CAT_EXTERIOR
                wall_data.append({
                    "id": f"wall-{wid}", "start": {"x": to_m(cx, off_x), "y": to_m(y_min, off_y)},
                    "end": {"x": to_m(cx, off_x), "y": to_m(y_max, off_y)},
                    "thickness": round(gap * scale, 4), "isExterior": is_ext,
                })
                wid += 1
                paired.add(id(cl1))
                paired.add(id(cl2))
                break

    # Unpaired long walls (single lines representing thin walls)
    for cl in wall_cls:
        if id(cl) not in paired and line_length(cl.line) >= MIN_WALL_LENGTH_PT * 2:
            l = cl.line
            wall_data.append({
                "id": f"wall-{wid}",
                "start": {"x": to_m(l.x0, off_x), "y": to_m(l.y0, off_y)},
                "end": {"x": to_m(l.x1, off_x), "y": to_m(l.y1, off_y)},
                "thickness": max(round(l.width * scale * 2, 4), 0.08),
                "isExterior": cl.category == CAT_EXTERIOR,
            })
            wid += 1

    # Deduplicate nearby walls
    wall_data = _deduplicate_walls(wall_data, min_dist=0.05)

    # Filter very short walls in meters
    wall_data = [w for w in wall_data if math.hypot(
        w["end"]["x"]-w["start"]["x"], w["end"]["y"]-w["start"]["y"]) >= 0.3]

    # Re-number wall IDs
    for i, w in enumerate(wall_data):
        w["id"] = f"wall-{i}"

    # --- Room detection from text ---
    ROOM_PATTERNS = {
        "LIVING": [r"거실", r"LV", r"Living", r"L\.?R"],
        "KITCHEN": [r"주방", r"Kitchen", r"KIT", r"식당"],
        "MASTER_BED": [r"안방", r"주침실", r"M\.?Bed"],
        "BED": [r"침실", r"Bed", r"B\.?R"],
        "BATHROOM": [r"욕실", r"화장실", r"UB", r"Bath"],
        "ENTRANCE": [r"현관", r"Entrance", r"ENT"],
        "BALCONY": [r"발코니", r"Balcony", r"BAL"],
        "UTILITY": [r"다용도", r"Utility", r"UTL"],
        "DRESSROOM": [r"드레스", r"D\.?R", r"W\.?I\.?C"],
    }
    AREA_DEFAULTS = {
        "LIVING": 20, "KITCHEN": 8, "MASTER_BED": 12, "BED": 9,
        "BATHROOM": 4, "ENTRANCE": 3, "BALCONY": 5, "UTILITY": 3, "DRESSROOM": 4,
    }

    room_data = []
    rid = 0
    for t in extract.texts:
        matched_type = None
        for rtype, pats in ROOM_PATTERNS.items():
            for pat in pats:
                if re.search(pat, t.text, re.IGNORECASE):
                    matched_type = rtype
                    break
            if matched_type:
                break
        if matched_type:
            x = to_m(t.x, off_x)
            y = to_m(t.y, off_y)
            area = AREA_DEFAULTS.get(matched_type, 5)
            dim = math.sqrt(area)
            room_data.append({
                "id": f"room-{rid}", "type": matched_type, "name": t.text.strip(),
                "area": round(area, 2),
                "position": {"x": round(x-dim/2, 3), "y": round(y-dim/2, 3),
                              "width": round(dim, 3), "height": round(dim, 3)},
            })
            rid += 1

    # Adjust areas if known_area provided
    total_area = sum(r["area"] for r in room_data) or 0
    if known_area and total_area > 0:
        ratio = known_area / total_area
        for r in room_data:
            r["area"] = round(r["area"] * ratio, 2)
        total_area = known_area
    elif known_area:
        total_area = known_area

    # --- Door detection from rects (filled narrow rects near wall gaps) ---
    # Also detect doors from wall gaps
    doors = []

    # --- Assemble vectorHints (key value for hybrid pipeline) ---
    # Only include significant wall lines (limit output size)
    sig_lines = [cl for cl in classified
                 if cl.category in (CAT_EXTERIOR, CAT_INTERIOR)
                 and line_length(cl.line) >= MIN_WALL_LENGTH_PT
                 and (is_horizontal(cl.line) or is_vertical(cl.line))]
    # Limit to top 200 longest
    sig_lines.sort(key=lambda cl: line_length(cl.line), reverse=True)
    sig_lines = sig_lines[:200]

    dimension_texts = []
    for t in extract.texts:
        cleaned = t.text.replace(",", "").replace(" ", "").strip()
        if re.match(r'^\d{3,5}$', cleaned):
            dimension_texts.append({
                "text": t.text.strip(), "value_mm": int(cleaned),
                "x": round(t.x, 1), "y": round(t.y, 1),
            })

    stats = Counter(cl.category for cl in classified)

    warnings = []
    if not room_data:
        warnings.append("Room names not detected from text (font encoding issue). Use Gemini Vision for room detection.")
    if not wall_data:
        warnings.append("No wall pairs found. Check PDF vector structure.")

    return {
        "floorPlan": {
            "totalArea": round(total_area, 2),
            "rooms": room_data,
            "walls": wall_data,
            "doors": doors,
            "windows": [],
            "fixtures": [],
        },
        "method": "pymupdf_vector",
        "confidence": 0.7 if room_data and wall_data else (0.5 if wall_data else 0.3),
        "warnings": warnings,
        "stats": {
            "total_lines": len(extract.lines),
            "total_rects": len(extract.rects),
            "total_texts": len(extract.texts),
            "classified": {k: v for k, v in stats.items()},
            "walls_merged": len(wall_data),
            "rooms_detected": len(room_data),
            "doors_detected": len(doors),
            "scale_m_per_pt": round(scale, 6),
            "bbox_pt": {"w": round(bbox_w, 1), "h": round(bbox_h, 1)},
            "width_distribution": {str(k): v for k, v in sorted(extract.width_counts.items())},
        },
        "vectorHints": {
            "wallLines": [
                {"start": [round(cl.line.x0,1), round(cl.line.y0,1)],
                 "end": [round(cl.line.x1,1), round(cl.line.y1,1)],
                 "width": cl.line.width,
                 "category": cl.category,
                 "lengthM": round(line_length(cl.line) * scale, 3)}
                for cl in sig_lines
            ],
            "dimensionTexts": dimension_texts,
            "allTexts": [
                {"text": t.text, "x": round(t.x,1), "y": round(t.y,1), "fontSize": round(t.font_size,1)}
                for t in extract.texts
            ],
            "pageSize": {"width": round(extract.page_width,1), "height": round(extract.page_height,1)},
            "scale": round(scale, 6),
            "offset": {"x": round(off_x,1), "y": round(off_y,1)},
        },
    }


# ============================================================
# Debug visualizer (inline, simple)
# ============================================================

def create_debug_image(pdf_path: str, classified: List[ClassifiedLine],
                       output_path: str, page_num: int = 0):
    """Render PDF page with classified lines overlaid in color."""
    from PIL import Image, ImageDraw

    doc = fitz.open(pdf_path)
    page = doc[page_num]
    # Render PDF page as image
    mat = fitz.Matrix(2, 2)  # 2x zoom
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    draw = ImageDraw.Draw(img, "RGBA")

    COLORS = {
        CAT_EXTERIOR: (255, 0, 0, 180),      # red
        CAT_INTERIOR: (0, 0, 255, 150),       # blue
        CAT_DIMENSION: (128, 128, 128, 100),  # gray
        CAT_HATCH: (0, 200, 0, 80),           # green
        CAT_FURNITURE: (200, 200, 0, 60),     # yellow
        CAT_UNKNOWN: (0, 0, 0, 30),           # faint black
    }

    zoom = 2
    for cl in classified:
        l = cl.line
        color = COLORS.get(cl.category, (0, 0, 0, 30))
        w = max(int(l.width * zoom), 1)
        if cl.category in (CAT_EXTERIOR, CAT_INTERIOR):
            w = max(w, 2)
        draw.line([(l.x0*zoom, l.y0*zoom), (l.x1*zoom, l.y1*zoom)], fill=color, width=w)

    img.save(output_path)
    doc.close()
    return output_path


# ============================================================
# Main
# ============================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(description="PyMuPDF PDF Vector Floor Plan Parser")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--known-area", type=float, default=None, help="Known area in m2")
    parser.add_argument("--page", type=int, default=0, help="PDF page number (0-indexed)")
    parser.add_argument("--debug", action="store_true", help="Save debug overlay image")
    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(json.dumps({"error": f"File not found: {args.pdf_path}"}))
        sys.exit(1)

    # Stage 1: Extract
    extract = extract_vectors(args.pdf_path, args.page)
    sys.stderr.write(f"[pymupdf] Extracted: {len(extract.lines)} lines, "
                     f"{len(extract.rects)} rects, {len(extract.texts)} texts\n")

    # Stage 2: Classify
    classified = classify_lines(extract)
    stats = Counter(cl.category for cl in classified)
    sys.stderr.write(f"[pymupdf] Classified: {dict(stats)}\n")

    # Stage 3: Merge + build
    result = merge_and_build(extract, classified, args.known_area)
    sys.stderr.write(f"[pymupdf] Result: {result['stats']['walls_merged']} walls, "
                     f"{result['stats']['rooms_detected']} rooms\n")

    # Debug image
    if args.debug:
        try:
            debug_path = args.pdf_path.rsplit(".", 1)[0] + "_debug.png"
            create_debug_image(args.pdf_path, classified, debug_path, args.page)
            sys.stderr.write(f"[pymupdf] Debug image saved: {debug_path}\n")
        except Exception as e:
            sys.stderr.write(f"[pymupdf] Debug image failed: {e}\n")

    # JSON output to stdout
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
