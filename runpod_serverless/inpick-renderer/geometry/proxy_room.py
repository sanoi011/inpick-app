"""
2.5D room proxy generator — Phase 6.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md
       §7-2 (2.5D/3D proxy 최소 요구사항)
       Prompt 6 (Geometry proxy control image 구현)

전략:
- 평면도 폴리곤 (top-down 2D) → ceilingHeight로 extrude → 3D 룸 박스
- look-at 행렬 + pinhole 투영으로 perspective projection
- 출력 (≥1024x1024 권장):
  * perspective_canny: 검정 배경 + 흰선 (벽/바닥/천장 가장자리 + 문/창 사각형)
  * depth: 카메라 z 거리 기반 그레이스케일 (가까울수록 밝음)
  * segmentation: 클래스 컬러 (floor/ceiling/wall/door/window)
  * wall_mask, floor_mask: ControlNet용 흑백 마스크

좌표 정책:
- normalizeMode="ratio": polygon 좌표 0~1 → 월드 m 변환 (방 한 변 길이 = sqrt(area))
- normalizeMode="mm": 좌표 mm → m
- 카메라/타깃도 동일 변환 (높이 heightM은 이미 m 단위)

한계 (Phase 6 minimal):
- z-buffer 없음 (back-to-front 순서로 폴리곤 그림)
- 정확한 depth는 face별 평균 거리 (미세 grad 없음)
- 가구/조명 없음 (pure room box)
"""
from __future__ import annotations
import math
import sys
import os as _os
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw

# 부모 디렉토리 import (handler.py가 sys.path[0]에 추가하지만 안전하게)
_PARENT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)
from schemas import Opening, Point2D, RoomCamera, RoomGeometry, WallSegment


# ─── 컬러 (segmentation 클래스 색상) ───
SEG_COLORS = {
    "floor":    (80, 80, 80),
    "ceiling":  (120, 120, 120),
    "wall":     (200, 200, 200),
    "wall_int": (170, 170, 170),
    "wall_ext": (220, 220, 220),
    "door":     (255, 100, 100),
    "window":   (100, 180, 255),
    "opening":  (255, 200, 100),
}


# ─── 헬퍼 ───
def _world_size_m(geometry: RoomGeometry) -> float:
    """방의 월드 크기(=한 변 m). estimatedAreaM2 우선, 없으면 폴리곤 bbox."""
    if geometry.estimatedAreaM2 and geometry.estimatedAreaM2 > 0:
        return max(2.0, math.sqrt(geometry.estimatedAreaM2))
    if geometry.polygon:
        xs = [p.x for p in geometry.polygon]
        ys = [p.y for p in geometry.polygon]
        bx = max(xs) - min(xs)
        by = max(ys) - min(ys)
        bbox = max(bx, by) or 1.0
        # ratio normalize (0~1)면 4m 가정, mm면 mm→m
        if geometry.normalizeMode == "mm":
            return bbox / 1000.0
        return bbox * 4.0
    return 4.0


def _norm_to_world(p: Point2D, size_m: float, mode: str) -> Tuple[float, float]:
    """ratio (0~1) → m, 또는 mm → m."""
    if mode == "mm":
        return (p.x / 1000.0, p.y / 1000.0)
    return (p.x * size_m, p.y * size_m)


def _look_at_matrix(
    pos: np.ndarray, target: np.ndarray, up: Optional[np.ndarray] = None
) -> np.ndarray:
    """
    World→camera view matrix (4x4).
    OpenGL convention: 카메라는 -z 방향을 본다.
    """
    if up is None:
        up = np.array([0.0, 1.0, 0.0])
    forward = target - pos
    n = np.linalg.norm(forward)
    if n < 1e-6:
        forward = np.array([0.0, 0.0, -1.0])
    else:
        forward = forward / n
    right = np.cross(forward, up)
    n = np.linalg.norm(right)
    if n < 1e-6:
        right = np.array([1.0, 0.0, 0.0])
    else:
        right = right / n
    up_new = np.cross(right, forward)

    M = np.eye(4)
    M[0, :3] = right
    M[1, :3] = up_new
    M[2, :3] = -forward
    M[0, 3] = -np.dot(right, pos)
    M[1, 3] = -np.dot(up_new, pos)
    M[2, 3] = np.dot(forward, pos)
    return M


def _project(
    p3: np.ndarray,
    view: np.ndarray,
    fov_deg: float,
    width: int,
    height: int,
) -> Tuple[Optional[Tuple[int, int]], float]:
    """
    World 3D point → screen px (또는 카메라 뒤쪽이면 None).
    반환: ((px, py) or None, camera_z) — z는 정렬용 (- 방향이 앞).
    """
    p4 = np.array([p3[0], p3[1], p3[2], 1.0])
    pc = view @ p4
    z = pc[2]
    if z >= -0.01:  # 카메라 뒤
        return (None, z)
    f = 1.0 / math.tan(math.radians(fov_deg) / 2.0)
    aspect = width / height
    x_ndc = (f / aspect) * pc[0] / -z
    y_ndc = f * pc[1] / -z
    px = int(round((x_ndc + 1.0) * 0.5 * width))
    py = int(round((1.0 - (y_ndc + 1.0) * 0.5) * height))
    return ((px, py), z)


def _project_with_clamp(
    p3: np.ndarray, view: np.ndarray, fov_deg: float, width: int, height: int
) -> Tuple[Optional[Tuple[int, int]], float]:
    """카메라 뒤면 None. 카메라 앞이지만 화면 밖이면 좌표 clamp."""
    pt, z = _project(p3, view, fov_deg, width, height)
    if pt is None:
        return (None, z)
    px, py = pt
    # extreme out-of-screen 클램프 (아주 큰 값으로 발산 방지)
    px = max(-width * 5, min(width * 5, px))
    py = max(-height * 5, min(height * 5, py))
    return ((px, py), z)


# ─── Near-plane clipping (Sutherland–Hodgman) ───
NEAR_Z = -0.05  # 카메라 정면 5cm 이내는 자름 (camera space z<0이 앞)


def _to_cam_space(p3: np.ndarray, view: np.ndarray) -> np.ndarray:
    """world 3D → camera 3D (4x4 view 적용 후 xyz)."""
    p4 = np.array([p3[0], p3[1], p3[2], 1.0])
    return (view @ p4)[:3]


def _clip_face_to_near(
    cam_verts: List[np.ndarray], near_z: float = NEAR_Z
) -> List[np.ndarray]:
    """
    Camera-space 다각형을 z = near_z 평면으로 자름 (앞부분만 유지).
    카메라 앞: z <= near_z (NEAR_Z = -0.05). 뒤/앞 경계에서 선형 보간.
    """
    if not cam_verts:
        return []
    out: List[np.ndarray] = []
    n = len(cam_verts)
    for i in range(n):
        a = cam_verts[i]
        b = cam_verts[(i + 1) % n]
        a_inside = a[2] <= near_z
        b_inside = b[2] <= near_z
        if a_inside:
            out.append(a)
        if a_inside != b_inside:
            # 교점 보간
            t = (near_z - a[2]) / (b[2] - a[2]) if (b[2] - a[2]) != 0 else 0
            ix = a + t * (b - a)
            ix[2] = near_z  # 정확히 near_z로 고정
            out.append(ix)
    return out


def _project_cam_point(
    pc: np.ndarray, fov_deg: float, width: int, height: int
) -> Tuple[Optional[Tuple[int, int]], float]:
    """Camera-space 점을 screen px로. (z >= 0이면 None)"""
    z = pc[2]
    if z >= -0.01:
        return (None, z)
    f = 1.0 / math.tan(math.radians(fov_deg) / 2.0)
    aspect = width / height
    x_ndc = (f / aspect) * pc[0] / -z
    y_ndc = f * pc[1] / -z
    px = int(round((x_ndc + 1.0) * 0.5 * width))
    py = int(round((1.0 - (y_ndc + 1.0) * 0.5) * height))
    px = max(-width * 5, min(width * 5, px))
    py = max(-height * 5, min(height * 5, py))
    return ((px, py), z)


def _clip_and_project(
    world_verts: List[np.ndarray],
    view: np.ndarray,
    fov_deg: float,
    width: int,
    height: int,
) -> Tuple[List[Tuple[int, int]], float]:
    """
    World vertices → near-plane clipping → screen px list.
    avg_z (camera space) 함께 반환 (정렬용 — 0에 가까울수록 앞).
    """
    cam = [_to_cam_space(p, view) for p in world_verts]
    clipped = _clip_face_to_near(cam)
    if len(clipped) < 3:
        return ([], 0.0)
    pts: List[Tuple[int, int]] = []
    zs: List[float] = []
    for pc in clipped:
        ppx, z = _project_cam_point(pc, fov_deg, width, height)
        if ppx is not None:
            pts.append(ppx)
            zs.append(z)
    avg = sum(zs) / len(zs) if zs else 0.0
    return (pts, avg)


# ─── 메인 ───
def build_proxy_images(
    geometry: RoomGeometry,
    camera: Optional[RoomCamera] = None,
    width: int = 1024,
    height: int = 1024,
) -> Dict[str, Image.Image]:
    """
    geometry → 5개 control image (PIL.Image RGB).
    """
    if not geometry.polygon or len(geometry.polygon) < 3:
        # 빈 폴리곤이면 빈 이미지 반환
        blank = Image.new("RGB", (width, height), (0, 0, 0))
        return {
            "perspective_canny": blank.copy(),
            "depth": blank.copy(),
            "segmentation": blank.copy(),
            "wall_mask": blank.copy(),
            "floor_mask": blank.copy(),
        }

    # 1. 월드 좌표 변환
    mode = geometry.normalizeMode or "ratio"
    size_m = _world_size_m(geometry)
    ceiling_m = (geometry.ceilingHeightMm or 2400) / 1000.0

    floor_2d = [_norm_to_world(p, size_m, mode) for p in geometry.polygon]
    floor_3d: List[np.ndarray] = [np.array([x, 0.0, z]) for (x, z) in floor_2d]
    ceiling_3d: List[np.ndarray] = [
        np.array([x, ceiling_m, z]) for (x, z) in floor_2d
    ]

    # 2. 카메라
    cam = camera or estimate_default_camera(geometry)
    cam_xy = _norm_to_world(cam.position, size_m, mode)
    tgt_xy = _norm_to_world(cam.target, size_m, mode)
    cam_h = cam.heightM if cam.heightM is not None else 1.45
    cam_pos = np.array([cam_xy[0], cam_h, cam_xy[1]])
    cam_target = np.array([tgt_xy[0], cam_h - 0.2, tgt_xy[1]])  # 약간 아래 응시
    view = _look_at_matrix(cam_pos, cam_target)
    fov = cam.fovDeg or 70.0

    n = len(floor_2d)
    walls_by_id = {w.id: w for w in geometry.walls}

    # 4. 면 정의 (world 3D verts) — wall + floor + ceiling
    raw_faces = []
    for i in range(n):
        j = (i + 1) % n
        raw_faces.append(
            {
                "type": "wall",
                "wall_index": i,
                "verts3d": [floor_3d[i], floor_3d[j], ceiling_3d[j], ceiling_3d[i]],
            }
        )
    raw_faces.append({"type": "floor", "verts3d": [p for p in floor_3d]})
    raw_faces.append(
        {"type": "ceiling", "verts3d": [p for p in reversed(ceiling_3d)]}
    )  # ceiling은 아래에서 보이도록 reverse

    # 4-1. Clip + project
    faces = []
    for rf in raw_faces:
        verts, avg_z = _clip_and_project(rf["verts3d"], view, fov, width, height)
        if len(verts) < 3:
            continue
        faces.append({**rf, "verts": verts, "avg_z": avg_z})

    # 5. 정렬 (뒤에서 앞으로 — z가 음수일수록 앞이므로, 0에 가까운 값부터 그림)
    faces.sort(key=lambda f: f["avg_z"])

    # 6. Canny (벽 가장자리 + 개구부 사각형)
    canny = Image.new("RGB", (width, height), (0, 0, 0))
    cd = ImageDraw.Draw(canny)
    # 6-1. 면 외곽선
    for face in faces:
        verts = face["verts"]
        for k in range(len(verts)):
            kn = (k + 1) % len(verts)
            cd.line([verts[k], verts[kn]], fill=(255, 255, 255), width=2)
    # 6-2. 개구부 사각형
    for op in geometry.openings:
        wall = walls_by_id.get(op.wallId)
        if not wall:
            continue
        rect_3d = _opening_rect_3d(wall, op, size_m, mode)
        rect_verts, _ = _clip_and_project(rect_3d, view, fov, width, height)
        for k in range(len(rect_verts)):
            kn = (k + 1) % len(rect_verts)
            cd.line(
                [rect_verts[k], rect_verts[kn]], fill=(255, 255, 255), width=3
            )

    # 7. Segmentation (back-to-front)
    seg = Image.new("RGB", (width, height), (0, 0, 0))
    sd = ImageDraw.Draw(seg)
    for face in faces:
        verts = face["verts"]
        if len(verts) < 3:
            continue
        if face["type"] == "wall":
            wi = face["wall_index"]
            wall = geometry.walls[wi] if wi < len(geometry.walls) else None
            color = (
                SEG_COLORS["wall_ext"]
                if wall and wall.kind == "exterior"
                else SEG_COLORS["wall_int"]
            )
        elif face["type"] == "floor":
            color = SEG_COLORS["floor"]
        else:
            color = SEG_COLORS["ceiling"]
        sd.polygon(verts, fill=color)
    # 개구부 — 클래스 색으로 덮어그림
    for op in geometry.openings:
        wall = walls_by_id.get(op.wallId)
        if not wall:
            continue
        rect_3d = _opening_rect_3d(wall, op, size_m, mode)
        rect_verts, _ = _clip_and_project(rect_3d, view, fov, width, height)
        if len(rect_verts) >= 3:
            color = SEG_COLORS.get(op.type, SEG_COLORS["opening"])
            sd.polygon(rect_verts, fill=color)

    # 8. Depth
    depth = Image.new("L", (width, height), 0)
    dd = ImageDraw.Draw(depth)
    all_z = [f["avg_z"] for f in faces]
    if all_z:
        z_min = min(all_z)  # 가장 음수 = 가장 가까움
        z_max = max(all_z)
        z_range = max(0.001, z_max - z_min)
    else:
        z_min, z_range = -1.0, 1.0
    for face in faces:
        verts = face["verts"]
        if len(verts) < 3:
            continue
        t = (face["avg_z"] - z_min) / z_range
        gray = int(255 * (1.0 - t))
        gray = max(0, min(255, gray))
        dd.polygon(verts, fill=gray)
    depth_rgb = depth.convert("RGB")

    # 9. Wall mask
    wall_mask = Image.new("L", (width, height), 0)
    wmd = ImageDraw.Draw(wall_mask)
    for face in faces:
        if face["type"] != "wall":
            continue
        verts = face["verts"]
        if len(verts) >= 3:
            wmd.polygon(verts, fill=255)

    # 10. Floor mask
    floor_mask = Image.new("L", (width, height), 0)
    fmd = ImageDraw.Draw(floor_mask)
    for face in faces:
        if face["type"] != "floor":
            continue
        verts = face["verts"]
        if len(verts) >= 3:
            fmd.polygon(verts, fill=255)

    return {
        "perspective_canny": canny,
        "depth": depth_rgb,
        "segmentation": seg,
        "wall_mask": wall_mask.convert("RGB"),
        "floor_mask": floor_mask.convert("RGB"),
    }


# ─── 개구부 사각형 (벽 위에 위치) ───
def _opening_rect_3d(
    wall: WallSegment, op: Opening, size_m: float, mode: str
) -> List[np.ndarray]:
    """
    Opening (positionRatio + widthRatio) → 벽 위 사각형 4꼭짓점 3D.
    꼭짓점 순서: 좌하 → 우하 → 우상 → 좌상.
    """
    wf = _norm_to_world(wall.from_, size_m, mode)
    wt = _norm_to_world(wall.to, size_m, mode)
    pos = op.positionRatio
    w = op.widthRatio if op.widthRatio is not None else (
        0.15 if op.type == "door" else 0.25
    )
    t1 = max(0.0, pos - w / 2.0)
    t2 = min(1.0, pos + w / 2.0)
    sill = (op.sillHeightMm or (0 if op.type == "door" else 900)) / 1000.0
    height_m = (op.heightMm or (2100 if op.type == "door" else 1200)) / 1000.0
    top = sill + height_m
    x1 = wf[0] + t1 * (wt[0] - wf[0])
    z1 = wf[1] + t1 * (wt[1] - wf[1])
    x2 = wf[0] + t2 * (wt[0] - wf[0])
    z2 = wf[1] + t2 * (wt[1] - wf[1])
    return [
        np.array([x1, sill, z1]),
        np.array([x2, sill, z2]),
        np.array([x2, top, z2]),
        np.array([x1, top, z1]),
    ]


# ─── 기본 카메라 (Phase 5에서 가져옴) ───
def estimate_default_camera(geometry: RoomGeometry) -> RoomCamera:
    """
    카메라 미지정 시 — 방 중심에서 한 모서리 쪽으로 후퇴한 시점.
    src/lib/inpick/floorplan/control-plan.ts의 defaultCameraForRoom과 동일 로직.
    """
    if not geometry.polygon:
        return RoomCamera(
            position=Point2D(x=0.5, y=0.9),
            target=Point2D(x=0.5, y=0.5),
            fovDeg=70.0,
            heightM=1.45,
        )
    sx = sum(p.x for p in geometry.polygon) / len(geometry.polygon)
    sy = sum(p.y for p in geometry.polygon) / len(geometry.polygon)
    return RoomCamera(
        position=Point2D(x=sx, y=min(sy + 0.4, 0.95)),
        target=Point2D(x=sx, y=sy),
        fovDeg=70.0,
        heightM=1.45,
    )
