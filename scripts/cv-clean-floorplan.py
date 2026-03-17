"""
OpenCV + Inpainting 기반 도면 클리닝

Gemini가 제안한 방법론 기반:
1. 텍스트 감지: Connected Component 분석 (작은 고립 성분 = 텍스트)
2. 가구 감지: 컨투어 면적/밀도 + 밀폐 영역 위상 분석
3. 복원: cv2.inpaint (Telea 알고리즘) - 제거 영역을 주변 패턴으로 채움

사용법:
  python scripts/cv-clean-floorplan.py [input] [output]
"""

import os
import sys
import cv2
import numpy as np
from scipy import ndimage

# ─── 설정 ───
BRIGHTNESS_THRESHOLD = 145
SATURATION_THRESHOLD = 0.12
TEXT_MAX_SIZE = 200        # CC 분석 - 이 크기 이하 = 텍스트
FIXTURE_MIN_AREA = 100     # 컨투어 최소 면적
FIXTURE_MAX_AREA = 8000    # 컨투어 최대 면적
MIN_ROOM_SIZE = 5000       # 밀폐 흰색 >= 이 값 = 방
INPAINT_RADIUS = 5         # 인페인팅 반경


def get_structure_mask(img):
    """RGB 이미지에서 구조 마스크 추출"""
    arr = img.astype(np.float32)
    h, w, _ = arr.shape

    r, g, b = arr[:,:,2], arr[:,:,1], arr[:,:,0]  # OpenCV BGR
    brightness = 0.299 * r + 0.587 * g + 0.114 * b

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 0, (max_c - min_c) / max_c, 0)

    is_dark = brightness < BRIGHTNESS_THRESHOLD
    is_colored = saturation > SATURATION_THRESHOLD
    is_bright = brightness > 200
    is_floor = is_bright | (is_colored & (brightness > 90))
    is_structure = is_dark & ~is_floor

    return is_structure, brightness


def detect_text_mask(is_structure, h, w):
    """CC 분석으로 텍스트 마스크 생성"""
    labeled, n_labels = ndimage.label(is_structure)
    sizes = ndimage.sum(is_structure, labeled, range(1, n_labels + 1))

    text_mask = np.zeros((h, w), dtype=np.uint8)
    count = 0
    for i, size in enumerate(sizes):
        if size < TEXT_MAX_SIZE:
            text_mask[labeled == (i + 1)] = 255
            count += 1

    print(f"  Text components: {count}")
    return text_mask


def detect_fixture_mask(is_structure, h, w):
    """밀폐 영역 위상 분석 + 컨투어 기반 가구 마스크 생성"""

    # ─── Method 1: 밀폐 흰색 영역 기반 (Enclosed Fixture Detection) ───
    white = ~is_structure
    labeled_white, n_white = ndimage.label(white)
    white_sizes = ndimage.sum(white, labeled_white, range(1, n_white + 1))

    # 외부 영역 식별
    edge_labels = set()
    edge_labels.update(labeled_white[0, :].tolist())
    edge_labels.update(labeled_white[-1, :].tolist())
    edge_labels.update(labeled_white[:, 0].tolist())
    edge_labels.update(labeled_white[:, -1].tolist())
    edge_labels.discard(0)

    # 흰색 영역 타입 맵
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

    # 벽 인지 분류: 설비 내부에만 인접한 dark 픽셀 = 설비 외곽선
    reach = 4
    room_or_exterior = (white_type == 1) | (white_type == 2)
    room_expanded = ndimage.binary_dilation(room_or_exterior, iterations=reach)
    fixture_expanded = ndimage.binary_dilation(fixture_interior, iterations=reach)

    enclosed_fixture_mask = is_structure & fixture_expanded & ~room_expanded

    # ─── Method 2: 컨투어 기반 가구 감지 ───
    structure_uint8 = (is_structure.astype(np.uint8)) * 255
    contours, _ = cv2.findContours(structure_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    contour_fixture_mask = np.zeros((h, w), dtype=np.uint8)
    contour_count = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if FIXTURE_MIN_AREA < area < FIXTURE_MAX_AREA:
            # 형태 분석: 벽(직선)은 fill ratio가 매우 낮고, 가구는 높음
            x, y, bw, bh = cv2.boundingRect(cnt)
            bbox_area = bw * bh
            if bbox_area == 0:
                continue
            fill_ratio = area / bbox_area

            # 벽은 보통 얇고 길다 (fill ratio < 0.15, aspect ratio > 5)
            aspect = max(bw, bh) / max(min(bw, bh), 1)

            # 가구 판별: fill ratio 높거나 aspect ratio 낮은 것
            if fill_ratio > 0.2 and aspect < 5:
                cv2.drawContours(contour_fixture_mask, [cnt], -1, 255, -1)
                contour_count += 1

    # 두 방법 합치기
    combined = np.zeros((h, w), dtype=np.uint8)
    combined[enclosed_fixture_mask] = 255
    combined = cv2.bitwise_or(combined, contour_fixture_mask)

    enclosed_px = int(np.sum(enclosed_fixture_mask))
    contour_px = int(np.sum(contour_fixture_mask > 0))
    print(f"  Enclosed fixture pixels: {enclosed_px}")
    print(f"  Contour fixture pixels: {contour_px}")
    print(f"  Contour fixtures: {contour_count}")

    return combined


def clean_floor_plan(input_path, output_path):
    """메인 파이프라인"""
    print(f"\n[Processing] {os.path.basename(input_path)}")

    # 1. 이미지 로드
    img = cv2.imread(input_path)
    if img is None:
        print(f"  ERROR: Cannot load {input_path}")
        return
    h, w = img.shape[:2]
    print(f"  Image: {w}x{h}")

    # 2. 구조 마스크 추출
    print("  Step 1: Structure extraction...")
    is_structure, brightness = get_structure_mask(img)
    struct_px = int(np.sum(is_structure))
    print(f"  Structure: {struct_px}px ({struct_px/(h*w)*100:.1f}%)")

    # 3. 텍스트 마스크
    print("  Step 2: Text detection (CC analysis)...")
    text_mask = detect_text_mask(is_structure, h, w)

    # 4. 가구 마스크
    print("  Step 3: Fixture detection (contour + topology)...")
    fixture_mask = detect_fixture_mask(is_structure, h, w)

    # 5. 최종 제거 마스크 = 텍스트 + 가구
    remove_mask = cv2.bitwise_or(text_mask, fixture_mask)

    # 마스크 약간 확장 (경계 정리)
    kernel = np.ones((3, 3), np.uint8)
    remove_mask = cv2.dilate(remove_mask, kernel, iterations=2)

    remove_px = int(np.sum(remove_mask > 0))
    print(f"  Total removal mask: {remove_px}px")

    # 6. 바닥색 → 흰색 변환 (인페인팅 전 배경 정리)
    print("  Step 4: Floor color → white...")
    clean_bg = img.copy()
    # 바닥(비구조, 비제거) 영역을 흰색으로
    floor = ~is_structure & (remove_mask == 0)
    clean_bg[floor] = [255, 255, 255]

    # 7. Inpainting (Telea 알고리즘)
    print("  Step 5: Inpainting (Telea)...")
    result = cv2.inpaint(clean_bg, remove_mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)

    # 8. 후처리: 벽선 선명화 + 배경 순백 정리
    print("  Step 6: Post-processing...")
    # 결과에서 구조 재추출하여 깔끔한 흑백 도면 생성
    result_gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)

    # 인페인팅된 영역은 대부분 흰색/밝은 회색이 됨
    # 원본 벽선 중 제거되지 않은 것만 보존
    keep_structure = is_structure & (remove_mask == 0)

    # 최종 출력: 깨끗한 흰색 배경 + 보존된 벽선
    final = np.full((h, w, 3), 255, dtype=np.uint8)
    bri = brightness[keep_structure]
    enhanced = np.clip(bri * 0.5, 0, 80).astype(np.uint8)
    final[keep_structure, 0] = enhanced
    final[keep_structure, 1] = enhanced
    final[keep_structure, 2] = enhanced

    # 저장
    cv2.imwrite(output_path, final)
    keep_px = int(np.sum(keep_structure))
    file_kb = os.path.getsize(output_path) // 1024
    print(f"\n  === Summary ===")
    print(f"  Original structure: {struct_px}px")
    print(f"  Removed: {remove_px}px ({remove_px/struct_px*100:.1f}%)")
    print(f"  Final: {keep_px}px ({keep_px/(h*w)*100:.1f}%)")
    print(f"  Output: {output_path} ({file_kb}KB)")


if __name__ == '__main__':
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    args = sys.argv[1:]
    if len(args) >= 2:
        input_path = os.path.join(base, args[0])
        output_path = os.path.join(base, args[1])
    else:
        # 기본: 115A 처리
        input_path = os.path.join(base, 'drawings', 'naver', 'hoban-3bl-115a.jpg')
        output_path = os.path.join(base, 'public', 'floorplans', 'images', 'hoban-3bl-115a.png')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)

    clean_floor_plan(input_path, output_path)

    # 116B도 처리
    input_116 = os.path.join(base, 'drawings', 'naver', 'hoban-3bl-116b.jpg')
    output_116 = os.path.join(base, 'public', 'floorplans', 'images', 'hoban-3bl-116b.png')
    if os.path.exists(input_116):
        clean_floor_plan(input_116, output_116)

    print("\nDone!")
