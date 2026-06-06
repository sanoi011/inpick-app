"""
네이버 부동산 도면 이미지 → INPICK 클린 도면 변환

1. 바닥 마감색(나무/베이지/파란색/타일) → 흰색
2. NAVER 워터마크 제거
3. 벽체/텍스트/설비/문 심볼 보존 (선명하게)
4. 깔끔한 흑백 건축도면 스타일로 출력
"""

import sys
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def clean_naver_floorplan(input_path, output_path, wall_threshold=145, saturation_threshold=0.12):
    """
    네이버 도면 이미지를 클린 흑백 도면으로 변환

    Args:
        input_path: 입력 JPG 경로
        output_path: 출력 PNG 경로
        wall_threshold: 밝기 임계값 (이하 = 벽/텍스트, 이상 = 바닥→흰색)
        saturation_threshold: 채도 임계값 (이상 = 색상 바닥→흰색)
    """
    img = Image.open(input_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape

    print(f"  Image size: {w}x{h}")

    # ─── Step 1: 밝기 + 채도 계산 ───
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

    # 인지 밝기 (perceived luminance)
    brightness = 0.299 * r + 0.587 * g + 0.114 * b

    # 채도 (HSV saturation)
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 0, (max_c - min_c) / max_c, 0)

    # ─── Step 2: 픽셀 분류 ───

    # 어두운 픽셀 = 벽체, 텍스트, 설비 외곽선, 문 아크
    is_dark = brightness < wall_threshold

    # 색상이 있는 픽셀 = 바닥 마감 (나무, 베이지, 파란색, 타일 패턴)
    is_colored = saturation > saturation_threshold

    # 밝은 픽셀 = 이미 밝은 배경
    is_bright = brightness > 200

    # 바닥으로 판정: 밝거나 OR 색상 있으면서 너무 어둡지 않은 것
    is_floor = is_bright | (is_colored & (brightness > 90))

    # 최종 마스크: 벽/구조물 = 어둡고 바닥이 아닌 것
    is_structure = is_dark & ~is_floor

    # 중간 밝기 구조물 (문 아크, 설비 외곽선 등)
    # 채도 낮고 밝기 중간 → 회색 구조물 요소
    is_gray_structure = (~is_colored) & (brightness >= wall_threshold) & (brightness < 180) & (saturation < 0.08)

    # ─── Step 3: NAVER 워터마크 제거 ───
    # 워터마크는 반투명 회색/파란 텍스트 → 색상 바닥 위에 있으므로
    # 바닥을 흰색으로 바꾸면 자동으로 제거됨
    # 추가: 워터마크가 중간 밝기+낮은 채도로 남을 수 있으므로
    # 이미지 중앙 영역에서 특별히 처리
    center_y1, center_y2 = int(h * 0.3), int(h * 0.7)
    center_x1, center_x2 = int(w * 0.25), int(w * 0.75)

    # 중앙 영역의 중간 밝기 픽셀 중 워터마크 후보
    watermark_candidate = np.zeros((h, w), dtype=bool)
    watermark_candidate[center_y1:center_y2, center_x1:center_x2] = True

    # 워터마크: 중앙 영역, 중간 밝기(140~200), 낮은 채도(<0.15)
    is_watermark = (
        watermark_candidate &
        (brightness >= 130) & (brightness < 210) &
        (saturation < 0.15) &
        ~is_dark
    )

    # ─── Step 4: 출력 이미지 생성 ───
    result = np.full((h, w, 3), 255, dtype=np.uint8)  # 기본 흰색

    # 벽체/텍스트: 진한 흑색으로
    # 밝기에 따라 약간의 그라데이션 유지 (선 두께감)
    dark_brightness = brightness[is_structure]
    # 벽체는 더 진하게 만들기
    enhanced = np.clip(dark_brightness * 0.6, 0, 100).astype(np.uint8)
    result[is_structure, 0] = enhanced
    result[is_structure, 1] = enhanced
    result[is_structure, 2] = enhanced

    # 회색 구조물 (설비, 문 힌지 등): 중간 회색
    gray_val = brightness[is_gray_structure]
    gray_enhanced = np.clip(gray_val * 0.7, 60, 180).astype(np.uint8)
    result[is_gray_structure, 0] = gray_enhanced
    result[is_gray_structure, 1] = gray_enhanced
    result[is_gray_structure, 2] = gray_enhanced

    # 워터마크 영역: 강제 흰색 (이미 기본값이지만 명시)
    result[is_watermark, :] = 255

    # ─── Step 5: 후처리 - 선명도 강화 ───
    output = Image.fromarray(result)

    # 약간의 선명화 (벽 선이 더 또렷하게)
    output = output.filter(ImageFilter.SHARPEN)

    # ─── Step 6: 방 라벨 보존 확인 ───
    # 텍스트는 is_structure에 포함되어 자동 보존됨

    output.save(output_path, 'PNG', quality=95)

    # 통계 출력
    total = h * w
    structure_pct = np.sum(is_structure) / total * 100
    floor_pct = np.sum(is_floor & ~is_structure) / total * 100
    watermark_pct = np.sum(is_watermark) / total * 100

    print(f"  Structure pixels: {structure_pct:.1f}%")
    print(f"  Floor → white: {floor_pct:.1f}%")
    print(f"  Watermark removed: {watermark_pct:.1f}%")
    print(f"  Output: {output_path}")


def add_inpick_badge(image_path, output_path=None):
    """INPICK 뱃지를 우하단에 추가"""
    if output_path is None:
        output_path = image_path

    img = Image.open(image_path).convert('RGB')
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # 우하단에 작은 뱃지
    badge_text = "INPICK"

    # 폰트 시도 (시스템 폰트 → 기본)
    font_size = max(14, int(min(w, h) * 0.022))
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

    # 텍스트 크기 측정
    bbox = draw.textbbox((0, 0), badge_text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    # 우하단 위치
    padding = 6
    margin = 12
    bx = w - tw - padding * 2 - margin
    by = h - th - padding * 2 - margin

    # 반투명 배경 효과 (흰색 배경 + 테두리)
    draw.rounded_rectangle(
        [bx - padding, by - padding, bx + tw + padding, by + th + padding],
        radius=4,
        fill=(255, 255, 255),
        outline=(180, 180, 180),
        width=1
    )

    # 텍스트
    draw.text((bx, by), badge_text, fill=(80, 80, 80), font=font)

    img.save(output_path, 'PNG', quality=95)
    print(f"  Badge added: {output_path}")


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    naver_dir = os.path.join(base, "drawings", "naver")
    output_dir = os.path.join(base, "public", "floorplans", "images")
    os.makedirs(output_dir, exist_ok=True)

    files = [
        ("hoban-3bl-115a.jpg", "hoban-3bl-115a.png"),
        ("hoban-3bl-116b.jpg", "hoban-3bl-116b.png"),
    ]

    for src, dst in files:
        src_path = os.path.join(naver_dir, src)
        dst_path = os.path.join(output_dir, dst)

        if not os.path.exists(src_path):
            print(f"[SKIP] {src} not found")
            continue

        print(f"\n[Processing] {src}")
        clean_naver_floorplan(src_path, dst_path)
        add_inpick_badge(dst_path)

    print("\nDone!")
