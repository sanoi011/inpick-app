"""
dimension_renderer.py - 클린 도면 위에 치수선을 코드로 오버레이

Gemini가 클리닝한 이미지(벽+문+창만 있는)에
벽-벽 거리 치수선과 숫자를 PIL로 그려넣는다.

1. 이미지 이진화 → 벽 위치 감지
2. 수평/수직 벽 세그먼트 추출
3. 공급면적 기반 스케일 계산
4. 방(닫힌 영역) 감지 → 각 방에 치수선 배치
5. PIL로 치수선 + 숫자 드로잉
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# ─── 설정 ───

WALL_THRESHOLD = 80       # 이 밝기 이하 = 벽 (0~255)
MIN_ROOM_AREA_PX = 2000   # 최소 방 크기 (픽셀²)
MIN_DIM_MM = 800           # 최소 치수 표시 (800mm 미만은 스킵)
ROUND_TO_MM = 50           # 50mm 단위 반올림
DIM_LINE_COLOR = (100, 100, 100)   # 치수선 색 (회색)
DIM_TEXT_COLOR = (40, 40, 40)      # 치수 숫자 색
DIM_LINE_WIDTH = 1
TICK_LENGTH = 6
TEXT_OFFSET = 4
MARGIN_PX = 12  # 벽에서 치수선까지 여백


def find_font(size: int):
    """사용 가능한 폰트 찾기"""
    font_candidates = [
        # 프로젝트 내 나눔고딕
        os.path.join(os.path.dirname(__file__), "..", "..", "public", "fonts", "NanumGothic-Regular.ttf"),
        # Windows 기본
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for fp in font_candidates:
        fp = os.path.normpath(fp)
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()


def binarize_walls(img_array: np.ndarray) -> np.ndarray:
    """이미지를 이진화하여 벽 마스크 생성 (벽=True)"""
    if len(img_array.shape) == 3:
        gray = np.mean(img_array[:, :, :3], axis=2)
    else:
        gray = img_array.astype(float)
    return gray < WALL_THRESHOLD


def find_rooms(wall_mask: np.ndarray) -> list[dict]:
    """
    벽 마스크에서 방(닫힌 흰색 영역)을 찾는다.
    4배 다운스케일 후 flood-fill로 성능 확보.
    """
    h, w = wall_mask.shape
    SCALE = 4  # 다운스케일 팩터

    # 다운스케일: SCALE x SCALE 블록 중 벽이 하나라도 있으면 벽
    sh, sw = h // SCALE, w // SCALE
    small = np.zeros((sh, sw), dtype=bool)
    for sy in range(sh):
        for sx in range(sw):
            block = wall_mask[sy*SCALE:(sy+1)*SCALE, sx*SCALE:(sx+1)*SCALE]
            small[sy, sx] = block.any()

    visited = np.zeros((sh, sw), dtype=bool)
    visited[small] = True

    rooms = []
    min_room_px = MIN_ROOM_AREA_PX // (SCALE * SCALE)

    for y in range(sh):
        for x in range(sw):
            if visited[y, x]:
                continue

            # BFS flood fill (다운스케일된 이미지)
            stack = [(x, y)]
            visited[y, x] = True
            count = 0
            min_x, max_x = x, x
            min_y, max_y = y, y

            while stack:
                cx, cy = stack.pop()
                count += 1
                if cx < min_x: min_x = cx
                if cx > max_x: max_x = cx
                if cy < min_y: min_y = cy
                if cy > max_y: max_y = cy

                for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < sw and 0 <= ny < sh and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((nx, ny))

            if count < min_room_px:
                continue

            # 이미지 경계에 닿으면 외부 배경
            if min_x <= 1 or min_y <= 1 or max_x >= sw - 2 or max_y >= sh - 2:
                continue

            # 원본 스케일로 복원
            real_bbox = (min_x * SCALE, min_y * SCALE, max_x * SCALE, max_y * SCALE)
            real_area = count * SCALE * SCALE

            rooms.append({
                "bbox": real_bbox,
                "area_px": real_area,
                "width_px": (max_x - min_x) * SCALE,
                "height_px": (max_y - min_y) * SCALE,
            })

    return rooms


def calculate_scale(rooms: list[dict], supply_area_m2: float) -> float:
    """
    감지된 방들의 총 픽셀 면적과 공급면적으로 스케일(mm/px) 계산.
    """
    total_px_area = sum(r["area_px"] for r in rooms)
    if total_px_area == 0:
        return 1.0

    supply_area_mm2 = supply_area_m2 * 1_000_000  # m² → mm²
    scale = math.sqrt(supply_area_mm2 / total_px_area)
    return scale


def round_dim(mm: float) -> int:
    """치수를 ROUND_TO_MM 단위로 반올림"""
    return round(mm / ROUND_TO_MM) * ROUND_TO_MM


def format_dim(mm: int) -> str:
    """치수를 콤마 구분 문자열로 포맷 (예: 3,600)"""
    return f"{mm:,}"


def draw_dimension_line(draw: ImageDraw.ImageDraw,
                        x1: int, y1: int, x2: int, y2: int,
                        dim_text: str, font, horizontal: bool):
    """치수선 + 틱마크 + 숫자를 그린다."""
    # 치수선
    draw.line([(x1, y1), (x2, y2)], fill=DIM_LINE_COLOR, width=DIM_LINE_WIDTH)

    if horizontal:
        # 양 끝 수직 틱마크
        draw.line([(x1, y1 - TICK_LENGTH), (x1, y1 + TICK_LENGTH)],
                  fill=DIM_LINE_COLOR, width=DIM_LINE_WIDTH)
        draw.line([(x2, y2 - TICK_LENGTH), (x2, y2 + TICK_LENGTH)],
                  fill=DIM_LINE_COLOR, width=DIM_LINE_WIDTH)

        # 숫자 (중앙 위)
        bbox = font.getbbox(dim_text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (x1 + x2) // 2 - tw // 2
        ty = y1 - th - TEXT_OFFSET

        # 배경 흰색 패딩
        draw.rectangle([tx - 2, ty - 1, tx + tw + 2, ty + th + 1], fill="white")
        draw.text((tx, ty), dim_text, fill=DIM_TEXT_COLOR, font=font)
    else:
        # 양 끝 수평 틱마크
        draw.line([(x1 - TICK_LENGTH, y1), (x1 + TICK_LENGTH, y1)],
                  fill=DIM_LINE_COLOR, width=DIM_LINE_WIDTH)
        draw.line([(x2 - TICK_LENGTH, y2), (x2 + TICK_LENGTH, y2)],
                  fill=DIM_LINE_COLOR, width=DIM_LINE_WIDTH)

        # 숫자 (중앙 왼쪽)
        bbox = font.getbbox(dim_text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = x1 - tw - TEXT_OFFSET
        ty = (y1 + y2) // 2 - th // 2

        # 배경 흰색 패딩
        draw.rectangle([tx - 2, ty - 1, tx + tw + 2, ty + th + 1], fill="white")
        draw.text((tx, ty), dim_text, fill=DIM_TEXT_COLOR, font=font)


def render_dimensions(clean_image_path: str, output_path: str,
                      supply_area_m2: float) -> bool:
    """
    클린 도면 이미지에 치수선을 오버레이하여 저장.

    Args:
        clean_image_path: Gemini가 클리닝한 이미지 경로
        output_path: 치수선이 추가된 최종 이미지 저장 경로
        supply_area_m2: 공급면적 (m²) - 스케일 계산용

    Returns:
        성공 여부
    """
    try:
        img = Image.open(clean_image_path).convert("RGB")
        img_array = np.array(img)

        # 1. 벽 감지
        wall_mask = binarize_walls(img_array)

        # 2. 방 감지
        rooms = find_rooms(wall_mask)
        if not rooms:
            # 방을 못 찾으면 클린 이미지 그대로 복사
            img.save(output_path)
            return True

        # 3. 스케일 계산
        scale = calculate_scale(rooms, supply_area_m2)

        # 4. 폰트 로드
        img_w = img.size[0]
        font_size = max(11, min(16, img_w // 80))
        font = find_font(font_size)

        # 5. 치수선 그리기
        draw = ImageDraw.Draw(img)

        for room in rooms:
            bx1, by1, bx2, by2 = room["bbox"]
            w_px = room["width_px"]
            h_px = room["height_px"]

            w_mm = round_dim(w_px * scale)
            h_mm = round_dim(h_px * scale)

            # 너무 작은 공간 스킵
            if w_mm < MIN_DIM_MM or h_mm < MIN_DIM_MM:
                continue

            # 가로 치수 (방 상단 내부)
            dim_y = by1 + MARGIN_PX
            draw_dimension_line(
                draw,
                bx1 + MARGIN_PX, dim_y, bx2 - MARGIN_PX, dim_y,
                format_dim(w_mm), font, horizontal=True
            )

            # 세로 치수 (방 좌측 내부)
            dim_x = bx1 + MARGIN_PX
            draw_dimension_line(
                draw,
                dim_x, by1 + MARGIN_PX, dim_x, by2 - MARGIN_PX,
                format_dim(h_mm), font, horizontal=False
            )

        # 6. 저장
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path, "PNG")
        return True

    except Exception as e:
        print(f"    [DIM ERROR] {e}")
        return False
