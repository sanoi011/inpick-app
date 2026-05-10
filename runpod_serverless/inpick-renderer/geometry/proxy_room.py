"""
2.5D room proxy generator — Phase 5 placeholder, Phase 6에서 본격 구현.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md §7-2 (2.5D/3D proxy 최소 요구사항)

Phase 5 (현재): 인터페이스만 제공. 실제 렌더링은 Phase 6에서.
Phase 6: PIL/OpenCV 기반 단순 룸 박스 렌더링.
"""
from __future__ import annotations
from typing import Dict, Any, Optional
from PIL import Image

import sys
import os as _os

# handler.py가 작업 디렉토리 기준으로 sys.path 설정 — 부모 추가 후 절대 import
_PARENT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)
from schemas import RoomGeometry, RoomCamera, Point2D


def build_proxy_images(
    geometry: RoomGeometry,
    camera: Optional[RoomCamera] = None,
    width: int = 1024,
    height: int = 1024,
) -> Dict[str, Image.Image]:
    """
    Phase 6에서 구현될 함수 인터페이스.

    입력:
        geometry: RoomGeometry (방 폴리곤 + 벽 + 개구부)
        camera: RoomCamera (위치/타깃/fov/높이) — 없으면 기본값 추정
        width/height: 출력 해상도

    출력 (모두 PIL.Image):
        {
            "perspective_canny": ...,
            "depth": ...,
            "segmentation": ...,
            "wall_mask": ...,
            "floor_mask": ...,
        }
    """
    # Phase 5 — placeholder. 빈 이미지들 반환.
    blank = Image.new("RGB", (width, height), color=(0, 0, 0))
    return {
        "perspective_canny": blank.copy(),
        "depth": blank.copy(),
        "segmentation": blank.copy(),
        "wall_mask": blank.copy(),
        "floor_mask": blank.copy(),
    }


def estimate_default_camera(geometry: RoomGeometry) -> RoomCamera:
    """
    geometry에서 카메라가 없을 때 기본 카메라 추정.
    src/lib/inpick/floorplan/control-plan.ts의 defaultCameraForRoom과 유사 로직.
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
