"""Test dimension renderer"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os
import math

clean_path = 'saved_plans/대전유성구/샘물타운/76_60m2/clean.png'
final_path = 'saved_plans/대전유성구/샘물타운/76_60m2/final.png'

print('1. Load image', flush=True)
img = Image.open(clean_path).convert('RGB')
arr = np.array(img)
print(f'   Size: {img.size}', flush=True)

print('2. Binarize', flush=True)
gray = np.mean(arr[:, :, :3], axis=2)
wall_mask = gray < 80
print(f'   Wall pixels: {wall_mask.sum()}', flush=True)

print('3. Find rooms (4x downscale)', flush=True)
h, w = wall_mask.shape
SCALE = 4
sh, sw = h // SCALE, w // SCALE

# Downscale with numpy (no loop)
small = wall_mask[:sh*SCALE, :sw*SCALE].reshape(sh, SCALE, sw, SCALE).any(axis=(1, 3))

visited = np.zeros((sh, sw), dtype=bool)
visited[small] = True
rooms = []
min_room_px = 2000 // (SCALE * SCALE)

for y in range(sh):
    for x in range(sw):
        if visited[y, x]:
            continue
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
        if min_x <= 1 or min_y <= 1 or max_x >= sw - 2 or max_y >= sh - 2:
            continue
        rooms.append({
            'bbox': (min_x * SCALE, min_y * SCALE, max_x * SCALE, max_y * SCALE),
            'area_px': count * SCALE * SCALE,
            'width_px': (max_x - min_x) * SCALE,
            'height_px': (max_y - min_y) * SCALE,
        })

print(f'   Found {len(rooms)} rooms', flush=True)
for i, r in enumerate(rooms):
    print(f'   Room {i}: bbox={r["bbox"]}, area={r["area_px"]}, w={r["width_px"]}, h={r["height_px"]}', flush=True)

print('4. Scale', flush=True)
supply_area_m2 = 78.0
total_px = sum(r['area_px'] for r in rooms)
supply_mm2 = supply_area_m2 * 1_000_000
scale = math.sqrt(supply_mm2 / total_px) if total_px > 0 else 1.0
print(f'   scale = {scale:.4f} mm/px', flush=True)

print('5. Font (default)', flush=True)
font = ImageFont.load_default()
print(f'   Font loaded', flush=True)

print('6. Draw dimensions', flush=True)
draw = ImageDraw.Draw(img)
MARGIN = 12
TICK = 6
for i, room in enumerate(rooms):
    bx1, by1, bx2, by2 = room['bbox']
    w_mm = round(room['width_px'] * scale / 50) * 50
    h_mm = round(room['height_px'] * scale / 50) * 50
    print(f'   Room {i}: {w_mm} x {h_mm} mm', flush=True)

    if w_mm < 800 or h_mm < 800:
        print('   Skipped (too small)', flush=True)
        continue

    w_text = f'{w_mm:,}'
    h_text = f'{h_mm:,}'

    # Horizontal dim line (top of room)
    y_line = by1 + MARGIN
    x_start = bx1 + MARGIN
    x_end = bx2 - MARGIN
    draw.line([(x_start, y_line), (x_end, y_line)], fill=(100, 100, 100), width=1)
    draw.line([(x_start, y_line - TICK), (x_start, y_line + TICK)], fill=(100, 100, 100), width=1)
    draw.line([(x_end, y_line - TICK), (x_end, y_line + TICK)], fill=(100, 100, 100), width=1)
    bb = font.getbbox(w_text)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = (x_start + x_end) // 2 - tw // 2
    ty = y_line - th - 4
    draw.rectangle([tx - 2, ty - 1, tx + tw + 2, ty + th + 1], fill='white')
    draw.text((tx, ty), w_text, fill=(40, 40, 40), font=font)
    print(f'   H-dim done: {w_text}', flush=True)

    # Vertical dim line (left of room)
    x_line = bx1 + MARGIN
    y_start = by1 + MARGIN
    y_end = by2 - MARGIN
    draw.line([(x_line, y_start), (x_line, y_end)], fill=(100, 100, 100), width=1)
    draw.line([(x_line - TICK, y_start), (x_line + TICK, y_start)], fill=(100, 100, 100), width=1)
    draw.line([(x_line - TICK, y_end), (x_line + TICK, y_end)], fill=(100, 100, 100), width=1)
    bb = font.getbbox(h_text)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = x_line - tw - 4
    ty = (y_start + y_end) // 2 - th // 2
    draw.rectangle([tx - 2, ty - 1, tx + tw + 2, ty + th + 1], fill='white')
    draw.text((tx, ty), h_text, fill=(40, 40, 40), font=font)
    print(f'   V-dim done: {h_text}', flush=True)

print('7. Save', flush=True)
os.makedirs(os.path.dirname(final_path), exist_ok=True)
img.save(final_path, 'PNG')
print(f'   Size: {os.path.getsize(final_path)} bytes', flush=True)
print('SUCCESS!', flush=True)
