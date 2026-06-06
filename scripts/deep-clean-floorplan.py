"""
Deep Learning 기반 도면 클리닝 파이프라인 v2

전략: "인페인팅"이 아니라 "벽선만 추출해서 새로 그리기"
  - 바닥색/텍스트/설비를 "지우는" 게 아니라, 벽선만 "골라서 남기기"

3단계:
  Step 1. 구조 마스크 추출 (밝기/채도 기반 벽선 감지)
  Step 2. EasyOCR + YOLOv8로 텍스트/설비 영역의 벽 픽셀 제거
  Step 3. CC 분석으로 메인 벽 네트워크 + 도어 아크 보존, 나머지 제거

사용법:
  python scripts/deep-clean-floorplan.py [input] [output]
"""

import os
import sys
import cv2
import numpy as np
import torch
from PIL import Image, ImageFilter
from scipy import ndimage

# ─── 설정 ───
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YOLO_MODEL_PATH = os.path.join(BASE, 'runs', 'floorplan-yolo', 'weights', 'best.pt')
YOLO_MODEL_PATH2 = os.path.join(BASE, 'python', 'floorplan-ai', 'models', 'floorplan_yolov8n.pt')

BRIGHTNESS_THRESHOLD = 145
SATURATION_THRESHOLD = 0.12
MIN_ROOM_SIZE = 5000
FIXTURE_REACH = 4

# 설비 클래스 (제거 대상)
FIXTURE_CLASSES = {'toilet', 'sink', 'bathtub', 'kitchen_sink', 'stove'}
KEEP_CLASSES = {'door_swing', 'door_sliding', 'window'}


def get_structure_mask(img):
    """RGB 이미지에서 구조(벽선) 마스크 추출"""
    arr = img.astype(np.float32)
    h, w = arr.shape[:2]

    if len(arr.shape) == 3:
        b, g, r = arr[:,:,0], arr[:,:,1], arr[:,:,2]  # OpenCV BGR
    else:
        r = g = b = arr

    brightness = 0.299 * r + 0.587 * g + 0.114 * b

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    with np.errstate(divide='ignore', invalid='ignore'):
        saturation = np.where(max_c > 0, (max_c - min_c) / max_c, 0)

    is_dark = brightness < BRIGHTNESS_THRESHOLD
    is_colored = saturation > SATURATION_THRESHOLD
    is_bright = brightness > 200
    is_floor = is_bright | (is_colored & (brightness > 90))
    is_structure = is_dark & ~is_floor

    return is_structure, brightness


def detect_text_regions(img_path):
    """EasyOCR로 텍스트 바운딩 박스 감지"""
    import easyocr

    print("  Step 2a: EasyOCR text detection...")
    reader = easyocr.Reader(['ko', 'en'], gpu=torch.cuda.is_available())
    results = reader.readtext(img_path)

    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    text_mask = np.zeros((h, w), dtype=bool)

    texts = []
    for (bbox, text, confidence) in results:
        if confidence < 0.05:
            continue

        pts = np.array(bbox, dtype=np.int32)
        x1 = max(0, pts[:, 0].min() - 5)
        y1 = max(0, pts[:, 1].min() - 5)
        x2 = min(w, pts[:, 0].max() + 5)
        y2 = min(h, pts[:, 1].max() + 5)

        text_mask[y1:y2, x1:x2] = True
        texts.append(f"'{text}' ({confidence:.2f})")

    # 마스크 약간 확장
    if np.any(text_mask):
        text_mask = ndimage.binary_dilation(text_mask, iterations=3)

    print(f"    Detected {len(texts)} texts: {', '.join(texts[:15])}")
    return text_mask


def detect_fixture_regions(img_path):
    """YOLOv8로 설비 바운딩 박스 감지"""
    from ultralytics import YOLO

    print("  Step 2b: YOLOv8 fixture detection...")

    model_path = YOLO_MODEL_PATH if os.path.exists(YOLO_MODEL_PATH) else YOLO_MODEL_PATH2
    if not os.path.exists(model_path):
        print(f"    WARNING: YOLO model not found")
        img = cv2.imread(img_path)
        return np.zeros(img.shape[:2], dtype=bool)

    model = YOLO(model_path)
    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    fixture_mask = np.zeros((h, w), dtype=bool)

    results = model(img_path, conf=0.25, verbose=False)

    fixture_count = 0
    for r in results:
        for box in r.boxes:
            cls_name = model.names[int(box.cls[0])]
            conf = float(box.conf[0])

            if cls_name in FIXTURE_CLASSES:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1 = max(0, x1 - 3)
                y1 = max(0, y1 - 3)
                x2 = min(w, x2 + 3)
                y2 = min(h, y2 + 3)
                fixture_mask[y1:y2, x1:x2] = True
                fixture_count += 1
                print(f"    [REMOVE] {cls_name} ({conf:.2f}) at ({x1},{y1})-({x2},{y2})")
            elif cls_name in KEEP_CLASSES:
                print(f"    [KEEP]   {cls_name} ({conf:.2f})")

    if np.any(fixture_mask):
        fixture_mask = ndimage.binary_dilation(fixture_mask, iterations=3)

    print(f"    Fixtures to remove: {fixture_count}")
    return fixture_mask


def enclosed_fixture_detection(is_structure, h, w):
    """밀폐 영역 위상 분석으로 설비 내부 감지 (기존 v9 방식)"""
    print("  Step 2c: Enclosed fixture detection (topology)...")

    white = ~is_structure
    labeled_white, n_white = ndimage.label(white)
    white_sizes = ndimage.sum(white, labeled_white, range(1, n_white + 1))

    # 외부 영역
    edge_labels = set()
    edge_labels.update(labeled_white[0, :].tolist())
    edge_labels.update(labeled_white[-1, :].tolist())
    edge_labels.update(labeled_white[:, 0].tolist())
    edge_labels.update(labeled_white[:, -1].tolist())
    edge_labels.discard(0)

    # 흰색 영역 분류
    white_type = np.zeros((h, w), dtype=np.uint8)
    fixture_interior = np.zeros((h, w), dtype=bool)

    for i, size in enumerate(white_sizes):
        lbl = i + 1
        mask = labeled_white == lbl
        if lbl in edge_labels:
            white_type[mask] = 1  # 외부
        elif size >= MIN_ROOM_SIZE:
            white_type[mask] = 2  # 방
        else:
            white_type[mask] = 3  # 설비 내부
            fixture_interior[mask] = True

    # 벽/설비 분류
    room_or_exterior = (white_type == 1) | (white_type == 2)
    room_expanded = ndimage.binary_dilation(room_or_exterior, iterations=FIXTURE_REACH)
    fixture_expanded = ndimage.binary_dilation(fixture_interior, iterations=FIXTURE_REACH)

    # 설비 외곽선 = 설비 내부에만 인접한 dark 픽셀
    enclosed_fixture = is_structure & fixture_expanded & ~room_expanded

    fx_px = int(np.sum(enclosed_fixture))
    print(f"    Enclosed fixture outline pixels: {fx_px}")

    return enclosed_fixture


def clean_floor_plan(input_path, output_path):
    """메인 파이프라인"""
    print(f"\n{'='*60}")
    print(f"Deep Clean Floor Plan v2")
    print(f"{'='*60}")

    img = cv2.imread(input_path)
    if img is None:
        print(f"ERROR: Cannot load {input_path}")
        return
    h, w = img.shape[:2]
    print(f"  Image: {w}x{h}")

    # ─── Step 1: 구조 마스크 추출 ───
    print("  Step 1: Structure mask extraction...")
    is_structure, brightness = get_structure_mask(img)
    struct_px = int(np.sum(is_structure))
    print(f"    Structure: {struct_px}px ({struct_px/(h*w)*100:.1f}%)")

    # ─── Step 2: 제거 영역 감지 (3가지 방법 합치기) ───
    # 2a: EasyOCR 텍스트 영역
    text_mask = detect_text_regions(input_path)

    # 2b: YOLO 설비 영역
    yolo_fixture_mask = detect_fixture_regions(input_path)

    # 2c: 밀폐 영역 위상 분석 (벽으로 둘러싸인 작은 공간 = 설비)
    enclosed_fixture = enclosed_fixture_detection(is_structure, h, w)

    # ─── Step 3: 제거 마스크 합치기 ───
    print("  Step 3: Combining removal masks...")

    # 제거할 구조 픽셀 = (텍스트 영역 내 구조) + (YOLO 설비 영역 내 구조) + (밀폐 설비 외곽선)
    remove_mask = np.zeros((h, w), dtype=bool)

    # 텍스트 영역 내의 구조 픽셀 제거
    text_struct = is_structure & text_mask
    remove_mask |= text_struct
    print(f"    Text structure pixels: {int(np.sum(text_struct))}")

    # YOLO 설비 영역 내의 구조 픽셀 제거
    yolo_struct = is_structure & yolo_fixture_mask
    remove_mask |= yolo_struct
    print(f"    YOLO fixture structure pixels: {int(np.sum(yolo_struct))}")

    # 밀폐 영역 설비 외곽선 제거
    remove_mask |= enclosed_fixture
    print(f"    Enclosed fixture pixels: {int(np.sum(enclosed_fixture))}")

    total_remove = int(np.sum(remove_mask))
    print(f"    Total removal: {total_remove}px ({total_remove/struct_px*100:.1f}% of structure)")

    # ─── Step 4: CC 분석 - 메인 벽 네트워크 + 도어 아크 보존 ───
    print("  Step 4: CC analysis (wall network + door arcs)...")

    clean_structure = is_structure & ~remove_mask

    # 갭 브리징 (1px 팽창으로 끊어진 벽 재연결)
    bridged = ndimage.binary_dilation(clean_structure, iterations=1)
    labeled_bridged, _ = ndimage.label(bridged)
    labeled_clean = labeled_bridged * clean_structure

    unique_labels = np.unique(labeled_clean[labeled_clean > 0])
    sizes_map = {}
    for lbl in unique_labels:
        sizes_map[lbl] = int(np.sum(labeled_clean == lbl))

    if not sizes_map:
        print("    ERROR: No structure remaining!")
        return

    # 메인 벽 네트워크 = 가장 큰 컴포넌트
    wall_label = max(sizes_map, key=sizes_map.get)
    wall_size = sizes_map[wall_label]
    wall_network = labeled_clean == wall_label
    print(f"    Wall network: {wall_size}px ({len(sizes_map)} components)")

    # 도어 아크 보존: 벽 근처의 중형 컴포넌트
    wall_dilated = ndimage.binary_dilation(wall_network, iterations=5)

    final_mask = wall_network.copy()
    door_count = 0
    text_removed = 0

    for lbl, size in sizes_map.items():
        if lbl == wall_label:
            continue
        component = labeled_clean == lbl
        near_wall = np.any(component & wall_dilated)

        if near_wall and size >= 200:  # 벽 근처 중형 = 도어 아크
            final_mask |= component
            door_count += 1
        else:
            text_removed += 1

    door_px = int(np.sum(final_mask)) - wall_size
    print(f"    Door arcs preserved: {door_count} ({door_px}px)")
    print(f"    Small fragments removed: {text_removed}")

    # ─── Step 5: 렌더링 ───
    print("  Step 5: Rendering...")

    result = np.full((h, w, 3), 255, dtype=np.uint8)

    # 벽선 렌더링 (원본 밝기 기반 선명도)
    fb = brightness[final_mask]
    enhanced = np.clip(fb * 0.5, 0, 80).astype(np.uint8)
    result[final_mask, 0] = enhanced
    result[final_mask, 1] = enhanced
    result[final_mask, 2] = enhanced

    # PIL로 변환 + 선명화
    output = Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))
    output = output.filter(ImageFilter.SHARPEN)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    output.save(output_path, 'PNG')

    final_px = int(np.sum(final_mask))
    file_kb = os.path.getsize(output_path) // 1024
    print(f"\n  {'='*40}")
    print(f"  Original structure: {struct_px}px")
    print(f"  Removed: {struct_px - final_px}px ({(struct_px-final_px)/struct_px*100:.1f}%)")
    print(f"  Final: {final_px}px ({final_px/(h*w)*100:.1f}%)")
    print(f"  Output: {output_path} ({file_kb}KB)")


if __name__ == '__main__':
    args = sys.argv[1:]

    if len(args) >= 2:
        input_path = os.path.join(BASE, args[0]) if not os.path.isabs(args[0]) else args[0]
        output_path = os.path.join(BASE, args[1]) if not os.path.isabs(args[1]) else args[1]
    else:
        input_path = os.path.join(BASE, 'drawings', 'naver', 'hoban-3bl-115a.jpg')
        output_path = os.path.join(BASE, 'public', 'floorplans', 'images', 'hoban-3bl-115a-deep.png')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    clean_floor_plan(input_path, output_path)

    # 116B도 처리
    input_116 = os.path.join(BASE, 'drawings', 'naver', 'hoban-3bl-116b.jpg')
    output_116 = os.path.join(BASE, 'public', 'floorplans', 'images', 'hoban-3bl-116b-deep.png')
    if os.path.exists(input_116):
        clean_floor_plan(input_116, output_116)

    print("\nAll done!")
