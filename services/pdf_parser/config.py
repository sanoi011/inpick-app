"""services/pdf_parser/config.py — v4.7 single source of truth for all config"""
from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


def _bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).lower() in ("true", "1", "yes")


def _int(key: str, default: int) -> int:
    return int(os.getenv(key, str(default)))


def _float(key: str, default: float) -> float:
    return float(os.getenv(key, str(default)))


ROOT = Path(__file__).resolve().parent  # services/pdf_parser/


@dataclass(frozen=True)
class InpickConfig:
    # -- Providers --
    pdf_render_provider: str = os.getenv("INPICK_PDF_RENDER_PROVIDER", "pdfium")
    seg_provider: str = os.getenv("INPICK_SEG_PROVIDER", "yolo")
    ocr_provider: str = os.getenv("INPICK_OCR_PROVIDER", "paddle")
    llm_validator: str = os.getenv("INPICK_LLM_VALIDATOR", "off")

    # -- Failover --
    seg_failover_to_rules: bool = _bool("INPICK_SEG_FAILOVER_TO_RULES", True)
    ocr_failover_to_tesseract: bool = _bool("INPICK_OCR_FAILOVER_TO_TESSERACT", True)

    # -- Seg runtime (pass1/pass2) --
    targeted_viewing: bool = _bool("INPICK_TARGETED_VIEWING", True)
    pass1_imgsz: int = _int("INPICK_PASS1_IMGSZ", 640)
    pass2_imgsz: int = _int("INPICK_PASS2_IMGSZ", 1280)
    pass1_model: str = os.getenv("INPICK_PASS1_MODEL", "models/yolo26n-seg-fp.pt")
    pass2_model: str = os.getenv("INPICK_PASS2_MODEL", "models/yolo26m-seg-fp.pt")
    yolo_conf: float = _float("INPICK_YOLO_CONF", 0.50)
    roi_padding_px: int = _int("INPICK_ROI_PADDING_PX", 50)
    roi_min_area_ratio: float = _float("INPICK_ROI_MIN_AREA_RATIO", 0.005)

    # -- Multi-Unit --
    multi_unit_detection: bool = _bool("INPICK_MULTI_UNIT_DETECTION", True)
    multi_unit_max_workers: int = _int("INPICK_MULTI_UNIT_MAX_WORKERS", 3)
    unit_overlap_px: int = _int("INPICK_UNIT_OVERLAP_PX", 30)

    # -- OCR runtime --
    ocr_lang: str = os.getenv("INPICK_OCR_LANG", "ko,en")
    tesseract_psm: int = _int("INPICK_TESSERACT_PSM", 11)
    tesseract_conf_min: int = _int("INPICK_TESSERACT_CONF_MIN", 30)

    # -- Scale Estimation --
    scale_estimation: bool = _bool("INPICK_SCALE_ESTIMATION", True)
    scale_ocr_roi: float = _float("INPICK_SCALE_OCR_ROI", 0.20)
    scale_min_mm_per_px: float = _float("INPICK_SCALE_MIN_MM_PER_PX", 0.2)
    scale_max_mm_per_px: float = _float("INPICK_SCALE_MAX_MM_PER_PX", 10.0)

    # -- Fixture Suppression --
    suppress_fixtures: bool = _bool("INPICK_SUPPRESS_FIXTURES", True)
    fixture_classes: str = os.getenv("INPICK_FIXTURE_CLASSES", "toilet,sink,bathtub")

    # -- LiDAR Providers --
    lidar_spatial_provider: str = os.getenv("INPICK_LIDAR_SPATIAL_PROVIDER", "none")
    lidar_pc_provider: str = os.getenv("INPICK_LIDAR_PC_PROVIDER", "none")
    lidar_cross_validation: str = os.getenv("INPICK_LIDAR_CROSS_VALIDATION", "off")

    # -- LiDAR PointCloud runtime (v4.7: v4.3 env) --
    pc_voxel_size_m: float = _float("INPICK_PC_VOXEL_SIZE_M", 0.02)
    pc_wall_slice_z_min_m: float = _float("INPICK_PC_WALL_SLICE_Z_MIN_M", 0.5)
    pc_wall_slice_z_max_m: float = _float("INPICK_PC_WALL_SLICE_Z_MAX_M", 2.0)
    pc_ransac_distance_m: float = _float("INPICK_PC_RANSAC_DISTANCE_M", 0.03)
    pc_grid_resolution_m: float = _float("INPICK_PC_GRID_RESOLUTION_M", 0.01)
    pc_sor_neighbors: int = _int("INPICK_PC_SOR_NEIGHBORS", 20)
    pc_sor_std_ratio: float = _float("INPICK_PC_SOR_STD_RATIO", 2.0)
    xval_threshold_mm: float = _float("INPICK_XVAL_THRESHOLD_MM", 50.0)

    # -- Preprocess Worker --
    preprocess_worker_url: str = os.getenv("INPICK_PREPROCESS_WORKER_URL", "")
    preprocess_dpi: int = _int("INPICK_PREPROCESS_DPI", 300)
    preprocess_max_dimension: int = _int("INPICK_PREPROCESS_MAX_DIMENSION", 8000)

    # -- Storage (v4.7: v4.6 fix #8) --
    storage_backend: str = os.getenv("INPICK_STORAGE_BACKEND", "local")

    # -- Skills --
    skills_max_load: int = _int("INPICK_SKILLS_MAX_LOAD", 5)

    # -- Debug --
    debug_artifacts: bool = _bool("INPICK_DEBUG_ARTIFACTS", True)
    export_recognition_svg: bool = _bool("INPICK_EXPORT_RECOGNITION_SVG", True)
    log_level: str = os.getenv("INPICK_LOG_LEVEL", "INFO")

    # -- Path helpers (CWD independent) --
    def abs_path(self, rel: str) -> str:
        p = Path(rel)
        if p.is_absolute():
            return str(p)
        return str((ROOT / rel).resolve())

    @property
    def pass1_model_abs(self) -> str:
        return self.abs_path(self.pass1_model)

    @property
    def pass2_model_abs(self) -> str:
        return self.abs_path(self.pass2_model)

    @property
    def fixture_classes_list(self) -> list:
        return [c.strip() for c in self.fixture_classes.split(",") if c.strip()]


CFG = InpickConfig()
