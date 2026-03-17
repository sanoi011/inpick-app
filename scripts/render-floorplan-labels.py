"""
네이버 도면 → 벽선 + 도어 아크만 추출 (설비/텍스트 제거)

전략: Wall-Aware Enclosed Fixture Detection (v9)

Step 1: 흰색 영역 위상 분류
  - 이미지 가장자리 닿음 → 외부
  - 밀폐 흰색 >= 5000px → 방 (보존)
  - 밀폐 흰색 < 5000px → 설비 내부 (변기/욕조/싱크 내부 공간)

Step 2: 픽셀 레벨 벽/설비 분류
  - 각 dark 픽셀의 주변 흰색 영역 타입 검사 (reach=4px)
  - 방 또는 외부에 인접 → 벽 픽셀 → 보존 (10,351px 보호)
  - 설비 내부에만 인접 → 설비 외곽선 → 제거

Step 3: CC 분석 (갭 브리징)
  - 1px 팽창으로 끊어진 벽 재연결
  - 최대 컴포넌트 = 메인 벽 네트워크 (보존)
  - 벽 근처 중형 컴포넌트 = 도어 아크 (보존)
  - 나머지 = 텍스트/잔여 설비 (제거)
"""

import os
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


RULES = {
    "brightness_threshold": 145,
    "saturation_threshold": 0.12,
    "max_fixture_interior": 5000, # 이 크기 미만 밀폐 흰색 = 설비 내부 (방은 5000px 이상)
    "fixture_outline_reach": 4,   # 설비 내부에서 이만큼 팽창하여 외곽선 포착
    "min_room_size": 5000,        # 이 크기 이상 밀폐 흰색 = 방 (보존)
    "text_component_max": 200,    # CC 분석 - 이 크기 이하 고립 성분 = 텍스트
}


def get_structure_mask(img_path):
    img = Image.open(img_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape

    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    brightness = 0.299 * r + 0.587 * g + 0.114 * b

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 0, (max_c - min_c) / max_c, 0)

    is_dark = brightness < RULES["brightness_threshold"]
    is_colored = saturation > RULES["saturation_threshold"]
    is_bright = brightness > 200
    is_floor = is_bright | (is_colored & (brightness > 90))
    is_structure = is_dark & ~is_floor

    return is_structure, brightness, h, w


def extract_walls_and_doors(src_path, output_path):
    print(f"  Loading: {src_path}")
    is_structure, brightness, h, w = get_structure_mask(src_path)
    total = h * w
    struct_px = int(np.sum(is_structure))
    print(f"  Image: {w}x{h}, Structure: {struct_px} px ({struct_px/total*100:.1f}%)")

    # ─── Step 1: 흰색 영역 분류 ───
    white = ~is_structure
    labeled_white, n_white = ndimage.label(white)
    white_sizes = ndimage.sum(white, labeled_white, range(1, n_white + 1))

    # 외부 = 가장자리 닿는 영역
    edge_labels = set()
    edge_labels.update(labeled_white[0, :].tolist())
    edge_labels.update(labeled_white[-1, :].tolist())
    edge_labels.update(labeled_white[:, 0].tolist())
    edge_labels.update(labeled_white[:, -1].tolist())
    edge_labels.discard(0)

    # 분류: 외부 / 방(큰 내부) / 설비 내부(작은 밀폐)
    fixture_interior = np.zeros((h, w), dtype=bool)
    fixture_interior_count = 0
    fixture_interior_sizes = []
    room_count = 0

    for i, size in enumerate(white_sizes):
        lbl = i + 1
        if lbl in edge_labels:
            continue  # 외부
        if size >= RULES["min_room_size"]:
            room_count += 1
            continue  # 방
        if size < RULES["max_fixture_interior"]:
            fixture_interior[labeled_white == lbl] = True
            fixture_interior_count += 1
            fixture_interior_sizes.append(int(size))

    # 진단: 모든 내부 영역 크기 히스토그램
    all_interior = []
    room_sizes = []
    for i, size in enumerate(white_sizes):
        lbl = i + 1
        if lbl in edge_labels:
            continue
        all_interior.append(int(size))
        if size >= RULES["min_room_size"]:
            room_sizes.append(int(size))

    all_interior.sort(reverse=True)
    room_sizes.sort(reverse=True)

    print(f"  White regions: {n_white} total")
    print(f"  Exterior: {len(edge_labels)}")
    print(f"  All interior sizes (top 30): {all_interior[:30]}")
    print(f"  Rooms (>= {RULES['min_room_size']}px): {room_count} → {room_sizes[:15]}")
    print(f"  Fixture interiors (< {RULES['max_fixture_interior']}px): {fixture_interior_count}")
    if fixture_interior_sizes:
        fixture_interior_sizes.sort(reverse=True)
        print(f"  Top fixture interior sizes: {fixture_interior_sizes[:15]}")

    # ─── Step 2: 픽셀 레벨 분류 (설비 외곽선 vs 벽) ───
    # 각 dark 픽셀이 어떤 흰색 영역에 인접하는지로 분류
    # 벽 = 방(큰 흰색) 또는 외부에 인접하는 dark 픽셀
    # 설비 외곽선 = 설비 내부(작은 흰색)에만 인접하는 dark 픽셀

    # 흰색 영역 타입 맵: 0=구조, 1=외부, 2=방, 3=설비내부
    white_type = np.zeros((h, w), dtype=np.uint8)  # 0 = structure/uncategorized
    for i, size in enumerate(white_sizes):
        lbl = i + 1
        mask = labeled_white == lbl
        if lbl in edge_labels:
            white_type[mask] = 1  # 외부
        elif size >= RULES["min_room_size"]:
            white_type[mask] = 2  # 방
        else:
            white_type[mask] = 3  # 설비 내부

    # 각 dark 픽셀 주변 탐색 (reach 범위 내에 방/외부가 있는지)
    reach = RULES["fixture_outline_reach"]
    # 방+외부 영역 팽창
    room_or_exterior = (white_type == 1) | (white_type == 2)
    room_expanded = ndimage.binary_dilation(room_or_exterior, iterations=reach)

    # 설비 내부 팽창
    fixture_expanded = ndimage.binary_dilation(fixture_interior, iterations=reach)

    # 설비 외곽선 = dark 픽셀 중에서:
    #   - 설비 내부 근처 (fixture_expanded)
    #   - 방/외부 근처가 아닌 것 (NOT room_expanded)
    fixture_outline = is_structure & fixture_expanded & ~room_expanded
    fixture_px = int(np.sum(fixture_outline))

    # 추가: 설비 내부에만 인접하지만 방에도 인접한 "경계" 픽셀 수
    boundary_px = int(np.sum(is_structure & fixture_expanded & room_expanded))
    print(f"  Fixture outline pixels: {fixture_px} (protected boundary: {boundary_px})")

    # ─── Step 3: 설비 제거 ───
    clean_structure = is_structure & ~fixture_outline

    # ─── Step 4: CC 분석 (갭 브리징) - 텍스트/잔여물 제거 ───
    bridged = ndimage.binary_dilation(clean_structure, iterations=1)
    labeled_bridged, _ = ndimage.label(bridged)
    labeled_clean = labeled_bridged * clean_structure

    unique_labels = np.unique(labeled_clean[labeled_clean > 0])
    sizes_map = {}
    for lbl in unique_labels:
        sizes_map[lbl] = int(np.sum(labeled_clean == lbl))

    if sizes_map:
        wall_label = max(sizes_map, key=sizes_map.get)
        wall_size = sizes_map[wall_label]
    else:
        wall_label = 0
        wall_size = 0

    wall_network = labeled_clean == wall_label
    print(f"  Wall network (bridged): {wall_size}px ({len(sizes_map)} components)")

    wall_dilated = ndimage.binary_dilation(wall_network, iterations=5)

    text_mask = np.zeros((h, w), dtype=bool)
    door_arc_mask = np.zeros((h, w), dtype=bool)
    text_count = 0
    door_count = 0

    for lbl, size in sizes_map.items():
        if lbl == wall_label:
            continue
        component = labeled_clean == lbl
        near_wall = np.any(component & wall_dilated)

        if size < RULES["text_component_max"] or not near_wall:
            text_mask[component] = True
            text_count += 1
        else:
            door_arc_mask[component] = True
            door_count += 1

    final_mask = wall_network | door_arc_mask
    text_px = int(np.sum(text_mask))
    door_px = int(np.sum(door_arc_mask))
    print(f"  Door arcs preserved: {door_count} ({door_px}px)")
    print(f"  Removed (text+fixture remnants): {text_count} ({text_px}px)")

    # ─── Step 5: 출력 ───
    result = np.full((h, w, 3), 255, dtype=np.uint8)
    fb = brightness[final_mask]
    enhanced = np.clip(fb * 0.5, 0, 80).astype(np.uint8)
    result[final_mask, 0] = enhanced
    result[final_mask, 1] = enhanced
    result[final_mask, 2] = enhanced

    output = Image.fromarray(result)
    output = output.filter(ImageFilter.SHARPEN)
    output.save(output_path, 'PNG')

    final_px = int(np.sum(final_mask))
    print(f"\n  === Summary ===")
    print(f"  Original: {struct_px} px")
    print(f"  Fixtures removed: {fixture_px} px ({fixture_px/struct_px*100:.1f}%)")
    print(f"  Text removed: {text_px} px (x{text_count})")
    print(f"  Final: {final_px} px ({final_px/total*100:.1f}%)")
    print(f"  Output: {output_path} ({os.path.getsize(output_path)//1024}KB)")

    return {
        "fixture_interior_count": fixture_interior_count,
        "fixture_interior_sizes": fixture_interior_sizes[:20],
        "fixture_px": fixture_px,
        "text_count": text_count,
        "text_px": text_px,
        "room_count": room_count,
    }


if __name__ == '__main__':
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    naver_dir = os.path.join(base, 'drawings', 'naver')
    output_dir = os.path.join(base, 'public', 'floorplans', 'images')

    files = [('hoban-3bl-115a.jpg', 'hoban-3bl-115a.png')]

    for src, dst in files:
        src_path = os.path.join(naver_dir, src)
        dst_path = os.path.join(output_dir, dst)
        if not os.path.exists(src_path):
            print(f"[SKIP] {src}")
            continue
        print(f"\n[Processing] {src}")
        stats = extract_walls_and_doors(src_path, dst_path)

    learn_path = os.path.join(base, 'scripts', 'floorplan-extraction-rules.json')
    with open(learn_path, 'w', encoding='utf-8') as f:
        json.dump({"rules": RULES, "stats": stats}, f, indent=2, ensure_ascii=False, default=str)
    print(f"\nRules: {learn_path}")
    print("Done!")
