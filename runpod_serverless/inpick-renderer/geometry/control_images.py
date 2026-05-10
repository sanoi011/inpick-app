"""
Control image utilities — Phase 5 (canny baseline) + Phase 6 (proxy 통합).

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md §7-3 (fallback baseline)

현재 구현:
- flat_floorplan_canny: 평면도 이미지 → cv2.Canny (baseline)

Phase 6에서 추가:
- proxy_room.py와 통합 → perspective_canny, depth, segmentation
- 평가 모드: A (baseline) vs B (geometry proxy)
"""
from __future__ import annotations
import io
import base64
from typing import Optional, Dict
from PIL import Image


def load_image_from_b64_or_url(
    image_b64: Optional[str], image_url: Optional[str]
) -> Optional[Image.Image]:
    """base64 우선, 없으면 URL fetch (urllib)."""
    if image_b64:
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        try:
            data = base64.b64decode(image_b64)
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:
            print(f"[control-images] decode b64 fail: {e}")
            return None

    if image_url:
        try:
            import urllib.request

            with urllib.request.urlopen(image_url, timeout=20) as resp:
                data = resp.read()
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as e:
            print(f"[control-images] fetch url fail: {e}")
            return None

    return None


def flat_floorplan_canny(
    image: Image.Image, width: int = 1024, height: int = 1024
) -> Image.Image:
    """
    평면도 → Canny edge (flat baseline).

    가이드 §7-3: baseline으로만 사용. 구조 정확도 낮음.
    Phase 7 평가에서 geometry proxy(B)와 비교.
    """
    try:
        import numpy as np
        import cv2

        arr = np.array(image)
        if arr.ndim == 3 and arr.shape[-1] == 4:
            arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2RGB)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        out = Image.fromarray(edges_rgb)
        return out.resize((width, height), Image.LANCZOS)
    except ImportError:
        # Phase 5 — opencv 미설치 시 그레이 이미지로 폴백
        print("[control-images] opencv not installed — fallback to grayscale resize")
        gray = image.convert("L").resize((width, height), Image.LANCZOS)
        return gray.convert("RGB")


def build_control_images(
    *,
    floorplan_image: Optional[Image.Image],
    geometry,  # RoomGeometry | None
    camera,  # RoomCamera | None
    control_spec,  # ControlSpec
    width: int = 1024,
    height: int = 1024,
    save_debug: Optional[str] = None,
) -> Dict[str, Image.Image]:
    """
    ControlPlan에 따라 control image들을 생성.

    Phase 5 (현재):
    - useFloorplanCanny: flat_floorplan_canny 호출
    - 다른 키 (perspective_canny / depth / segmentation): proxy_room.build_proxy_images
      Phase 6에서 본격 구현 예정 — 현재는 빈 이미지.

    Phase 6:
    - geometry+camera로 perspective canny/depth/seg 생성
    """
    out: Dict[str, Image.Image] = {}

    if control_spec is None:
        return out

    # ─── flat baseline (Phase 5 활성) ───
    if control_spec.useFloorplanCanny and floorplan_image is not None:
        out["floorplan_canny"] = flat_floorplan_canny(
            floorplan_image, width=width, height=height
        )

    # ─── geometry proxy (Phase 6 활성) ───
    needs_proxy = (
        control_spec.usePerspectiveCanny
        or control_spec.useDepth
        or control_spec.useSegmentation
        or control_spec.useWallMask
        or control_spec.useFloorMask
    )
    if needs_proxy and geometry is not None:
        # 같은 패키지 모듈 — handler.py 기준 sys.path에 inpick-renderer 추가됨
        try:
            from geometry.proxy_room import build_proxy_images, estimate_default_camera  # type: ignore
        except ImportError:
            from .proxy_room import build_proxy_images, estimate_default_camera

        cam = camera or estimate_default_camera(geometry)
        proxies = build_proxy_images(geometry, camera=cam, width=width, height=height)

        if control_spec.usePerspectiveCanny:
            out["perspective_canny"] = proxies["perspective_canny"]
        if control_spec.useDepth:
            out["depth"] = proxies["depth"]
        if control_spec.useSegmentation:
            out["segmentation"] = proxies["segmentation"]
        if control_spec.useWallMask:
            out["wall_mask"] = proxies["wall_mask"]
        if control_spec.useFloorMask:
            out["floor_mask"] = proxies["floor_mask"]

    # ─── 디버그 저장 (옵션) ───
    if save_debug:
        import os

        os.makedirs(save_debug, exist_ok=True)
        for k, v in out.items():
            v.save(os.path.join(save_debug, f"{k}.png"))
        print(f"[control-images] debug saved to {save_debug}: {list(out.keys())}")

    return out
