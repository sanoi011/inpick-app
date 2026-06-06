"""
인터랙티브 벽선 편집기 - 브러시로 설비 지우기

사용법:
  python scripts/interactive-wall-editor.py

조작:
  - 왼쪽 클릭 + 드래그: 빨간 브러시로 지울 영역 칠하기
  - 오른쪽 클릭 + 드래그: 실수로 칠한 부분 복구 (녹색)
  - 마우스 휠: 브러시 크기 조절
  - S 키: 저장 후 종료
  - Z 키: 전체 취소 (초기 상태로)
  - Q 키: 저장하지 않고 종료
"""

import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt


BRIGHTNESS_THRESHOLD = 145
SATURATION_THRESHOLD = 0.12


def get_structure_mask(img_path):
    img = Image.open(img_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape

    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    brightness = 0.299 * r + 0.587 * g + 0.114 * b

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 0, (max_c - min_c) / max_c, 0)

    is_dark = brightness < BRIGHTNESS_THRESHOLD
    is_colored = saturation > SATURATION_THRESHOLD
    is_bright = brightness > 200
    is_floor = is_bright | (is_colored & (brightness > 90))
    is_structure = is_dark & ~is_floor

    return is_structure, brightness, arr, h, w


class BrushEditor:
    def __init__(self, src_path, output_path):
        self.src_path = src_path
        self.output_path = output_path

        print("Loading image...")
        self.is_structure, self.brightness, self.arr, self.h, self.w = \
            get_structure_mask(src_path)

        struct_px = int(np.sum(self.is_structure))
        print(f"Image: {self.w}x{self.h}, Structure: {struct_px}px")

        # 제거 마스크 (True = 제거할 픽셀)
        self.remove_mask = np.zeros((self.h, self.w), dtype=bool)

        # 브러시 설정
        self.brush_radius = 12
        self.painting = False
        self.erasing = False  # 오른쪽 클릭 = 복구

        # 브러시 커서 위치
        self.cursor_x = 0
        self.cursor_y = 0

    def build_display(self):
        """현재 상태 디스플레이 이미지 생성"""
        # 밝은 배경 + 구조선
        display = np.full((self.h, self.w, 3), 0.95, dtype=np.float32)

        # 보존될 구조선 = 검정
        keep = self.is_structure & ~self.remove_mask
        display[keep] = [0.1, 0.1, 0.1]

        # 제거 표시 = 빨간색 반투명
        removed = self.is_structure & self.remove_mask
        display[removed] = [0.9, 0.2, 0.2]

        return display

    def paint_at(self, x, y, remove=True):
        """브러시 위치에 제거/복구 마스크 적용"""
        r = self.brush_radius
        y0 = max(0, y - r)
        y1 = min(self.h, y + r + 1)
        x0 = max(0, x - r)
        x1 = min(self.w, x + r + 1)

        # 원형 브러시
        yy, xx = np.ogrid[y0:y1, x0:x1]
        circle = ((yy - y)**2 + (xx - x)**2) <= r**2

        if remove:
            # 구조 픽셀만 제거 (빈 공간은 무시)
            self.remove_mask[y0:y1, x0:x1] |= (circle & self.is_structure[y0:y1, x0:x1])
        else:
            # 복구
            self.remove_mask[y0:y1, x0:x1] &= ~circle

    def on_press(self, event):
        if event.inaxes != self.ax:
            return
        if event.button == 1:  # 왼쪽 = 제거
            self.painting = True
            self.erasing = False
        elif event.button == 3:  # 오른쪽 = 복구
            self.painting = False
            self.erasing = True

        x, y = int(event.xdata), int(event.ydata)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.paint_at(x, y, remove=not self.erasing)
            self.refresh()

    def on_release(self, event):
        self.painting = False
        self.erasing = False

    def on_motion(self, event):
        if event.inaxes != self.ax:
            return
        if event.xdata is None or event.ydata is None:
            return

        x, y = int(event.xdata), int(event.ydata)
        self.cursor_x, self.cursor_y = x, y

        if self.painting or self.erasing:
            if 0 <= x < self.w and 0 <= y < self.h:
                self.paint_at(x, y, remove=not self.erasing)
                self.refresh()
        else:
            # 커서만 업데이트
            self.update_cursor()

    def on_scroll(self, event):
        """마우스 휠로 브러시 크기 조절"""
        if event.button == 'up':
            self.brush_radius = min(50, self.brush_radius + 2)
        elif event.button == 'down':
            self.brush_radius = max(3, self.brush_radius - 2)
        self.update_cursor()
        print(f"  Brush size: {self.brush_radius}px")

    def on_key(self, event):
        if event.key == 's':
            self.save_and_close()
        elif event.key == 'z':
            self.remove_mask[:] = False
            print("  [RESET] All removal cleared")
            self.refresh()
        elif event.key == 'q':
            print("\nQuit without saving.")
            plt.close(self.fig)

    def update_cursor(self):
        """브러시 커서 원 업데이트"""
        self.cursor_circle.center = (self.cursor_x, self.cursor_y)
        self.cursor_circle.radius = self.brush_radius
        self.fig.canvas.draw_idle()

    def refresh(self):
        """화면 갱신"""
        display = self.build_display()
        self.im.set_data(display)

        removed_px = int(np.sum(self.remove_mask))
        keep_px = int(np.sum(self.is_structure & ~self.remove_mask))
        self.ax.set_title(
            f"Keep: {keep_px}px (black)  |  Remove: {removed_px}px (red)  |  "
            f"Brush: {self.brush_radius}px\n"
            f"Left-drag=remove  Right-drag=restore  Wheel=size  S=save  Z=reset  Q=quit",
            fontsize=10
        )
        self.fig.canvas.draw_idle()

    def save_and_close(self):
        """결과 저장"""
        print("\nSaving...")
        keep_mask = self.is_structure & ~self.remove_mask

        result = np.full((self.h, self.w, 3), 255, dtype=np.uint8)
        fb = self.brightness[keep_mask]
        enhanced = np.clip(fb * 0.5, 0, 80).astype(np.uint8)
        result[keep_mask, 0] = enhanced
        result[keep_mask, 1] = enhanced
        result[keep_mask, 2] = enhanced

        output = Image.fromarray(result)
        output = output.filter(ImageFilter.SHARPEN)
        output.save(self.output_path, 'PNG')

        keep_px = int(np.sum(keep_mask))
        removed_px = int(np.sum(self.remove_mask))
        total = self.h * self.w
        print(f"  Saved: {self.output_path}")
        print(f"  Final: {keep_px}px ({keep_px/total*100:.1f}%)")
        print(f"  Removed: {removed_px}px")

        plt.close(self.fig)

    def run(self):
        self.fig, self.ax = plt.subplots(1, 1, figsize=(14, 10))
        self.fig.canvas.manager.set_window_title('INPICK Wall Editor - Brush Mode')

        display = self.build_display()
        self.im = self.ax.imshow(display, interpolation='nearest')
        self.ax.set_axis_off()

        # 브러시 커서 원
        self.cursor_circle = plt.Circle(
            (0, 0), self.brush_radius,
            fill=False, edgecolor='blue', linewidth=1.5, linestyle='--'
        )
        self.ax.add_patch(self.cursor_circle)

        self.refresh()

        self.fig.canvas.mpl_connect('button_press_event', self.on_press)
        self.fig.canvas.mpl_connect('button_release_event', self.on_release)
        self.fig.canvas.mpl_connect('motion_notify_event', self.on_motion)
        self.fig.canvas.mpl_connect('scroll_event', self.on_scroll)
        self.fig.canvas.mpl_connect('key_press_event', self.on_key)

        plt.tight_layout()
        plt.show()


if __name__ == '__main__':
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    naver_dir = os.path.join(base, 'drawings', 'naver')
    output_dir = os.path.join(base, 'public', 'floorplans', 'images')

    src = os.path.join(naver_dir, 'hoban-3bl-115a.jpg')
    dst = os.path.join(output_dir, 'hoban-3bl-115a.png')

    if not os.path.exists(src):
        print(f"Source not found: {src}")
        sys.exit(1)

    editor = BrushEditor(src, dst)
    editor.run()
