"""
벡터화 & SVG 변환 모듈
추출된 벽, 심볼, 텍스트 데이터를 SVG/JSON 구조화 데이터로 변환
InPick의 2D 에디터에서 편집 가능한 포맷으로 출력
"""

import json
import math
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from loguru import logger
import numpy as np


class _NumpyEncoder(json.JSONEncoder):
    """numpy 타입을 JSON 직렬화 가능하게 변환"""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


class FloorPlanVectorizer:
    """평면도 벡터화 + SVG/JSON 출력"""

    def __init__(self, config: dict):
        self.auto_detect_scale = config.get("auto_detect_scale", True)
        self.scale_factor = config.get("scale_factor", 1.0)  # px → mm
        self.svg_stroke_width = config.get("svg_stroke_width", 2)
        self.svg_wall_color = config.get("svg_wall_color", "#333333")
        self.svg_door_color = config.get("svg_door_color", "#0066CC")
        self.svg_window_color = config.get("svg_window_color", "#00AA00")
        self.output_format = config.get("output_format", "both")
        self.precision = config.get("coordinate_precision", 1)

    def vectorize(
        self,
        walls: list,
        rooms: list,
        symbols: list,
        texts: list,
        dimensions: list,
        image_size: Tuple[int, int],
    ) -> Dict:
        """
        모든 인식 결과를 통합 벡터 데이터로 변환

        Returns:
            dict: InPick 호환 구조화 데이터
        """
        logger.info("벡터화 시작")

        # 축척 자동 감지 (치수선 기반)
        if self.auto_detect_scale and dimensions:
            self.scale_factor = self._detect_scale(dimensions, walls)
            logger.info(f"축척 자동 감지: 1px = {self.scale_factor:.3f}mm")

        # 좌표 변환 (px → mm)
        result = {
            "version": "1.0",
            "unit": "mm",
            "scale_factor": round(self.scale_factor, 4),
            "canvas": {
                "width": round(image_size[0] * self.scale_factor, self.precision),
                "height": round(image_size[1] * self.scale_factor, self.precision),
            },
            "walls": self._vectorize_walls(walls),
            "rooms": self._vectorize_rooms(rooms, texts),
            "symbols": self._vectorize_symbols(symbols),
            "texts": [t.to_dict() for t in texts] if texts else [],
        }

        logger.info(
            f"벡터화 완료 - 벽: {len(result['walls'])}, "
            f"방: {len(result['rooms'])}, 심볼: {len(result['symbols'])}"
        )
        return result

    def _vectorize_walls(self, walls: list) -> List[Dict]:
        """벽 선분을 mm 좌표로 변환"""
        sf = self.scale_factor
        vectorized = []
        for w in walls:
            vectorized.append({
                "type": "wall",
                "start": {
                    "x": round(w.start[0] * sf, self.precision),
                    "y": round(w.start[1] * sf, self.precision),
                },
                "end": {
                    "x": round(w.end[0] * sf, self.precision),
                    "y": round(w.end[1] * sf, self.precision),
                },
                "thickness": round(w.thickness * sf, self.precision),
                "orientation": w.orientation,
                "length_mm": round(w.length * sf, self.precision),
            })
        return vectorized

    def _vectorize_rooms(self, rooms: list, texts: list) -> List[Dict]:
        """방 폴리곤을 mm 좌표로 변환 + 텍스트 매칭"""
        sf = self.scale_factor

        # 방 이름 텍스트 위치 매핑
        room_names = {}
        if texts:
            for t in texts:
                if t.category == "room_name":
                    cx = (t.bbox[0] + t.bbox[2]) / 2
                    cy = (t.bbox[1] + t.bbox[3]) / 2
                    room_names[(cx, cy)] = t.text

        vectorized = []
        for room in rooms:
            # 가장 가까운 방 이름 매칭
            matched_name = self._match_room_name(room, room_names)

            pts = room.contour.reshape(-1, 2).tolist()
            vectorized.append({
                "type": "room",
                "name": matched_name,
                "vertices": [
                    {"x": round(p[0] * sf, self.precision),
                     "y": round(p[1] * sf, self.precision)}
                    for p in pts
                ],
                "center": {
                    "x": round(room.center[0] * sf, self.precision),
                    "y": round(room.center[1] * sf, self.precision),
                },
                "area_mm2": round(room.area * sf * sf, 0),
                "area_m2": round(room.area * sf * sf / 1_000_000, 2),
            })
        return vectorized

    def _vectorize_symbols(self, symbols: list) -> List[Dict]:
        """심볼을 mm 좌표로 변환"""
        sf = self.scale_factor
        vectorized = []
        for s in symbols:
            vectorized.append({
                "type": s.class_name,
                "type_ko": s.class_name_ko,
                "confidence": round(s.confidence, 4),
                "bbox": {
                    "x1": round(s.bbox[0] * sf, self.precision),
                    "y1": round(s.bbox[1] * sf, self.precision),
                    "x2": round(s.bbox[2] * sf, self.precision),
                    "y2": round(s.bbox[3] * sf, self.precision),
                },
                "center": {
                    "x": round(s.center[0] * sf, self.precision),
                    "y": round(s.center[1] * sf, self.precision),
                },
            })
        return vectorized

    def _match_room_name(self, room, room_names: dict) -> Optional[str]:
        """방 폴리곤에 가장 가까운 텍스트 매칭"""
        if not room_names:
            return None

        best_name = None
        best_dist = float('inf')
        rx, ry = room.center

        for (tx, ty), name in room_names.items():
            dist = math.sqrt((rx - tx) ** 2 + (ry - ty) ** 2)
            # 텍스트가 방 바운딩렉트 안에 있는지 체크
            x, y, w, h = room.bounding_rect
            if x <= tx <= x + w and y <= ty <= y + h:
                if dist < best_dist:
                    best_dist = dist
                    best_name = name

        return best_name

    def _detect_scale(self, dimensions: list, walls: list) -> float:
        """치수선 정보로 축척 자동 감지"""
        if not dimensions or not walls:
            logger.warning("치수선/벽 데이터 부족 → 기본 축척 사용")
            return self.scale_factor

        # 치수선의 mm 값과 가장 가까운 벽 길이(px)를 매칭
        for dim in dimensions:
            mm_value = dim["value_mm"]
            dim_cx = (dim["bbox"][0] + dim["bbox"][2]) / 2
            dim_cy = (dim["bbox"][1] + dim["bbox"][3]) / 2

            best_wall = None
            best_dist = float('inf')
            for w in walls:
                wcx = (w.start[0] + w.end[0]) / 2
                wcy = (w.start[1] + w.end[1]) / 2
                dist = math.sqrt((dim_cx - wcx)**2 + (dim_cy - wcy)**2)
                if dist < best_dist:
                    best_dist = dist
                    best_wall = w

            if best_wall and best_wall.length > 0:
                scale = mm_value / best_wall.length
                if 0.1 < scale < 50:  # 합리적 범위
                    return scale

        return self.scale_factor

    def to_svg(self, data: Dict, output_path: str) -> str:
        """벡터 데이터를 SVG 파일로 출력"""
        width = data["canvas"]["width"]
        height = data["canvas"]["height"]

        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}">\n',
            f'  <style>\n',
            f'    .wall {{ stroke: {self.svg_wall_color}; stroke-width: {self.svg_stroke_width}; fill: none; }}\n',
            f'    .room {{ fill: #f0f0f0; fill-opacity: 0.3; stroke: #999; stroke-width: 0.5; }}\n',
            f'    .door {{ stroke: {self.svg_door_color}; stroke-width: 1.5; fill: none; }}\n',
            f'    .window {{ stroke: {self.svg_window_color}; stroke-width: 2; fill: none; }}\n',
            f'    .label {{ font-family: "Noto Sans KR", sans-serif; font-size: 12px; fill: #333; text-anchor: middle; }}\n',
            f'  </style>\n\n',
        ]

        # 방 폴리곤
        svg_parts.append('  <g id="rooms">\n')
        for room in data.get("rooms", []):
            pts = " ".join(f'{v["x"]},{v["y"]}' for v in room["vertices"])
            svg_parts.append(f'    <polygon class="room" points="{pts}" />\n')
            if room.get("name"):
                cx, cy = room["center"]["x"], room["center"]["y"]
                svg_parts.append(
                    f'    <text class="label" x="{cx}" y="{cy}">{room["name"]}</text>\n'
                )
        svg_parts.append('  </g>\n\n')

        # 벽 선분
        svg_parts.append('  <g id="walls">\n')
        for wall in data.get("walls", []):
            svg_parts.append(
                f'    <line class="wall" '
                f'x1="{wall["start"]["x"]}" y1="{wall["start"]["y"]}" '
                f'x2="{wall["end"]["x"]}" y2="{wall["end"]["y"]}" />\n'
            )
        svg_parts.append('  </g>\n\n')

        # 심볼
        svg_parts.append('  <g id="symbols">\n')
        for sym in data.get("symbols", []):
            b = sym["bbox"]
            cls = sym["type"]
            if "door" in cls:
                css_class = "door"
            elif cls == "window":
                css_class = "window"
            else:
                css_class = "wall"
            svg_parts.append(
                f'    <rect class="{css_class}" '
                f'x="{b["x1"]}" y="{b["y1"]}" '
                f'width="{b["x2"] - b["x1"]}" height="{b["y2"] - b["y1"]}" '
                f'data-type="{cls}" data-type-ko="{sym["type_ko"]}" />\n'
            )
        svg_parts.append('  </g>\n\n')

        svg_parts.append('</svg>')

        svg_content = "".join(svg_parts)
        Path(output_path).write_text(svg_content, encoding="utf-8")
        logger.info(f"SVG 저장: {output_path}")
        return svg_content

    def to_json(self, data: Dict, output_path: str) -> str:
        """벡터 데이터를 JSON 파일로 출력"""
        json_str = json.dumps(data, ensure_ascii=False, indent=2, cls=_NumpyEncoder)
        Path(output_path).write_text(json_str, encoding="utf-8")
        logger.info(f"JSON 저장: {output_path}")
        return json_str
