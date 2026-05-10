"""
InPick Renderer — input/output schemas.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md
       §6-2 (RunPod handler 입력 예시), §6-3 (출력 예시)

dataclass 기반 가벼운 검증. pydantic 미사용 (cold start 절약).
"""
from __future__ import annotations
import dataclasses
from typing import Any, Dict, List, Optional, Literal


@dataclasses.dataclass
class Point2D:
    x: float
    y: float


@dataclasses.dataclass
class WallSegment:
    id: str
    from_: Point2D  # `from`은 Python 예약어 — JSON 변환 시 `from`으로 매핑
    to: Point2D
    kind: Literal["interior", "exterior"]
    thicknessMm: Optional[int] = None


@dataclasses.dataclass
class Opening:
    id: str
    type: Literal["door", "window", "opening"]
    wallId: str
    positionRatio: float
    widthRatio: Optional[float] = None
    sillHeightMm: Optional[int] = None
    heightMm: Optional[int] = None


@dataclasses.dataclass
class RoomGeometry:
    roomId: str
    roomName: str
    polygon: List[Point2D]
    walls: List[WallSegment]
    openings: List[Opening]
    estimatedAreaM2: Optional[float] = None
    normalizeMode: Literal["ratio", "mm"] = "ratio"
    ceilingHeightMm: Optional[int] = 2400
    source: Literal["manual", "heuristic", "model", "db"] = "heuristic"
    metadata: Optional[Dict[str, Any]] = None


@dataclasses.dataclass
class RoomCamera:
    position: Point2D
    target: Point2D
    fovDeg: float = 70.0
    heightM: Optional[float] = 1.45


@dataclasses.dataclass
class ControlSpec:
    """Phase 4 control plan 직렬화 결과 (controlPlanToHandlerControl 매핑)."""
    usePerspectiveCanny: bool = False
    useDepth: bool = False
    useSegmentation: bool = False
    useWallMask: bool = False
    useFloorMask: bool = False
    useFloorplanCanny: bool = False
    controlStrength: float = 0.65
    isBaseline: bool = False


@dataclasses.dataclass
class LoraSpec:
    name: str
    scale: float = 0.6


@dataclasses.dataclass
class OutputSpec:
    """업로드 정책. uploadUrl이 있으면 PUT, 없으면 base64 반환."""
    uploadUrl: Optional[str] = None
    publicUrl: Optional[str] = None
    bucket: Optional[str] = None
    key: Optional[str] = None
    allowBase64Fallback: bool = False  # production은 False


@dataclasses.dataclass
class GenerateRequest:
    jobId: str
    modelId: str
    prompt: str
    mode: Literal["room_render", "control_only", "preview"] = "room_render"
    negativePrompt: Optional[str] = None

    # 평면도
    floorplanImageUrl: Optional[str] = None
    floorplanImageB64: Optional[str] = None

    # geometry / camera (Phase 4)
    roomGeometry: Optional[RoomGeometry] = None
    camera: Optional[RoomCamera] = None
    control: Optional[ControlSpec] = None

    # 모델 옵션
    lora: Optional[LoraSpec] = None
    seed: Optional[int] = None
    steps: int = 24
    guidance: float = 3.5
    width: int = 1024
    height: int = 1024

    # 출력
    output: Optional[OutputSpec] = None

    # PoC vs production 구분 — Production은 False
    pocAllowBase64: bool = False


# ─── 파서 ───
def _to_point(d: Any) -> Point2D:
    return Point2D(x=float(d["x"]), y=float(d["y"]))


def _to_wall(d: Any) -> WallSegment:
    return WallSegment(
        id=d["id"],
        from_=_to_point(d.get("from") or d.get("from_") or {"x": 0, "y": 0}),
        to=_to_point(d["to"]),
        kind=d.get("kind", "interior"),
        thicknessMm=d.get("thicknessMm"),
    )


def _to_opening(d: Any) -> Opening:
    return Opening(
        id=d["id"],
        type=d["type"],
        wallId=d["wallId"],
        positionRatio=float(d.get("positionRatio", 0.5)),
        widthRatio=d.get("widthRatio"),
        sillHeightMm=d.get("sillHeightMm"),
        heightMm=d.get("heightMm"),
    )


def _to_room_geometry(d: Any) -> RoomGeometry:
    return RoomGeometry(
        roomId=d["roomId"],
        roomName=d["roomName"],
        polygon=[_to_point(p) for p in d.get("polygon", [])],
        walls=[_to_wall(w) for w in d.get("walls", [])],
        openings=[_to_opening(o) for o in d.get("openings", [])],
        estimatedAreaM2=d.get("estimatedAreaM2"),
        normalizeMode=d.get("normalizeMode", "ratio"),
        ceilingHeightMm=d.get("ceilingHeightMm", 2400),
        source=d.get("source", "heuristic"),
        metadata=d.get("metadata"),
    )


def _to_camera(d: Any) -> RoomCamera:
    return RoomCamera(
        position=_to_point(d["position"]),
        target=_to_point(d["target"]),
        fovDeg=float(d.get("fovDeg", 70.0)),
        heightM=d.get("heightM", 1.45),
    )


def _to_control(d: Any) -> ControlSpec:
    return ControlSpec(
        usePerspectiveCanny=bool(d.get("usePerspectiveCanny", False)),
        useDepth=bool(d.get("useDepth", False)),
        useSegmentation=bool(d.get("useSegmentation", False)),
        useWallMask=bool(d.get("useWallMask", False)),
        useFloorMask=bool(d.get("useFloorMask", False)),
        useFloorplanCanny=bool(d.get("useFloorplanCanny", False)),
        controlStrength=float(d.get("controlStrength", 0.65)),
        isBaseline=bool(d.get("isBaseline", False)),
    )


def parse_request(data: Dict[str, Any]) -> GenerateRequest:
    """
    RunPod input → GenerateRequest. 누락 필드는 적절한 기본값.

    필수: jobId, modelId, prompt
    floorplan(URL or B64) 둘 중 하나 권장 (mode=room_render이면 필수)
    """
    if "jobId" not in data:
        raise ValueError("jobId required")
    if "modelId" not in data:
        raise ValueError("modelId required")
    if "prompt" not in data:
        raise ValueError("prompt required")

    geo = data.get("roomGeometry")
    cam = data.get("camera")
    ctrl = data.get("control")
    lora = data.get("lora")
    output = data.get("output")

    return GenerateRequest(
        jobId=str(data["jobId"]),
        modelId=str(data["modelId"]),
        prompt=str(data["prompt"]),
        mode=data.get("mode", "room_render"),
        negativePrompt=data.get("negativePrompt"),
        floorplanImageUrl=data.get("floorplanImageUrl"),
        floorplanImageB64=data.get("floorplanImageB64"),
        roomGeometry=_to_room_geometry(geo) if geo else None,
        camera=_to_camera(cam) if cam else None,
        control=_to_control(ctrl) if ctrl else None,
        lora=LoraSpec(name=lora["name"], scale=float(lora.get("scale", 0.6))) if lora else None,
        seed=data.get("seed"),
        steps=int(data.get("steps", 24)),
        guidance=float(data.get("guidance", 3.5)),
        width=int(data.get("width", 1024)),
        height=int(data.get("height", 1024)),
        output=OutputSpec(
            uploadUrl=output.get("uploadUrl") if output else None,
            publicUrl=output.get("publicUrl") if output else None,
            bucket=output.get("bucket") if output else None,
            key=output.get("key") if output else None,
            allowBase64Fallback=bool(output.get("allowBase64Fallback", False)) if output else False,
        ) if output else None,
        pocAllowBase64=bool(data.get("pocAllowBase64", False)),
    )
