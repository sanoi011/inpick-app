"""
메인 파이프라인 오케스트레이터
전체 인식 파이프라인을 단일 인터페이스로 실행
"""

import time
import yaml
import numpy as np
from pathlib import Path
from typing import Dict, Optional
from loguru import logger

from .preprocessor import FloorPlanPreprocessor
from .symbol_detector import SymbolDetector
from .text_recognizer import TextRecognizer
from .wall_extractor import WallExtractor
from .vectorizer import FloorPlanVectorizer


class FloorPlanPipeline:
    """InPick 평면도 인식 파이프라인"""

    def __init__(self, config_path: str = "configs/pipeline_config.yaml"):
        self.config = self._load_config(config_path)
        self._init_stages()
        logger.info("파이프라인 초기화 완료")

    def _load_config(self, path: str) -> dict:
        """설정 파일 로드"""
        config_file = Path(path)
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        logger.warning(f"설정 파일 없음: {path} → 기본값 사용")
        return self._default_config()

    def _default_config(self) -> dict:
        """기본 설정"""
        return {
            "preprocessor": {"target_size": 1280, "deskew": True, "enhance_contrast": True},
            "symbol_detector": {
                "pretrained": "yolov8n.pt", "confidence_threshold": 0.25,
                "iou_threshold": 0.45, "img_size": 1280, "device": "auto",
            },
            "text_recognizer": {
                "engine": "easyocr", "languages": ["ko", "en"],
                "confidence_threshold": 0.3,
            },
            "wall_extractor": {
                "method": "hybrid",
                "hough": {"threshold": 100, "min_line_length": 50, "max_line_gap": 10},
                "morphology": {"wall_thickness_min": 3, "wall_thickness_max": 20},
                "merge": {"angle_tolerance": 5, "distance_tolerance": 10, "min_wall_length": 30},
            },
            "vectorizer": {
                "auto_detect_scale": True, "scale_factor": 1.0,
                "output_format": "both",
            },
        }

    def _init_stages(self) -> None:
        """각 Stage 모듈 초기화"""
        self.preprocessor = FloorPlanPreprocessor(self.config.get("preprocessor", {}))
        self.symbol_detector = SymbolDetector(self.config.get("symbol_detector", {}))
        self.text_recognizer = TextRecognizer(self.config.get("text_recognizer", {}))
        self.wall_extractor = WallExtractor(self.config.get("wall_extractor", {}))
        self.vectorizer = FloorPlanVectorizer(self.config.get("vectorizer", {}))

    def run(
        self,
        image_path: Optional[str] = None,
        image: Optional[np.ndarray] = None,
        output_dir: str = "outputs",
    ) -> Dict:
        """
        전체 파이프라인 실행

        Args:
            image_path: 이미지 파일 경로 (PDF 포함)
            image: BGR numpy 이미지 (직접 전달 시)
            output_dir: 결과물 저장 디렉토리

        Returns:
            dict: {
                "vector_data": 벡터화된 구조 데이터,
                "svg_path": SVG 파일 경로,
                "json_path": JSON 파일 경로,
                "vis_path": 시각화 이미지 경로,
                "timing": 각 단계별 소요 시간,
            }
        """
        total_start = time.time()
        timings = {}

        # 출력 디렉토리 생성
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        # === 이미지 로드 ===
        if image is None:
            if image_path is None:
                raise ValueError("image_path 또는 image 중 하나를 제공해야 합니다")
            image = self.preprocessor.load_image(image_path)
        logger.info(f"입력 이미지: {image.shape[:2]}")

        # === Stage 1: 전처리 ===
        t = time.time()
        preprocessed = self.preprocessor.process(image)
        timings["preprocess"] = round(time.time() - t, 3)

        # === Stage 2: 심볼 감지 (YOLOv8) ===
        t = time.time()
        detections = self.symbol_detector.detect(
            preprocessed["original"],
            scale_info=preprocessed["scale_info"],
        )
        timings["symbol_detection"] = round(time.time() - t, 3)

        # === Stage 3: 텍스트 인식 (OCR) ===
        t = time.time()
        text_blocks = self.text_recognizer.recognize(preprocessed["for_ocr"])
        dimensions = self.text_recognizer.extract_dimensions(text_blocks)
        timings["text_recognition"] = round(time.time() - t, 3)

        # === Stage 4: 벽 추출 ===
        t = time.time()
        wall_data = self.wall_extractor.extract(preprocessed["for_wall"])
        walls = wall_data["walls"]
        rooms = wall_data["rooms"]
        timings["wall_extraction"] = round(time.time() - t, 3)

        # === Stage 5: 벡터화 ===
        t = time.time()
        original_size = preprocessed["scale_info"]["original_size"]
        vector_data = self.vectorizer.vectorize(
            walls=walls,
            rooms=rooms,
            symbols=detections,
            texts=text_blocks,
            dimensions=dimensions,
            image_size=original_size,
        )
        timings["vectorization"] = round(time.time() - t, 3)

        # === 출력 파일 생성 ===
        base_name = Path(image_path).stem if image_path else "floorplan"

        svg_path = str(out / f"{base_name}.svg")
        json_path = str(out / f"{base_name}.json")
        vis_path = str(out / f"{base_name}_detected.png")

        self.vectorizer.to_svg(vector_data, svg_path)
        self.vectorizer.to_json(vector_data, json_path)
        self.symbol_detector.export_results_image(
            preprocessed["original"], detections, vis_path
        )

        timings["total"] = round(time.time() - total_start, 3)

        # 결과 요약
        logger.info("=" * 50)
        logger.info("파이프라인 실행 완료")
        logger.info(f"  심볼 감지: {len(detections)}개")
        logger.info(f"  텍스트 블록: {len(text_blocks)}개")
        logger.info(f"  벽 선분: {len(walls)}개")
        logger.info(f"  방 영역: {len(rooms)}개")
        logger.info(f"  총 소요시간: {timings['total']}초")
        logger.info("=" * 50)

        return {
            "vector_data": vector_data,
            "svg_path": svg_path,
            "json_path": json_path,
            "vis_path": vis_path,
            "timing": timings,
            "summary": {
                "symbols": len(detections),
                "texts": len(text_blocks),
                "walls": len(walls),
                "rooms": len(rooms),
            },
        }

    def run_quick(self, image_path: str) -> Dict:
        """빠른 실행 (벽 추출 생략, 심볼+OCR만)"""
        image = self.preprocessor.load_image(image_path)
        preprocessed = self.preprocessor.process(image)

        detections = self.symbol_detector.detect(
            preprocessed["original"],
            preprocessed["scale_info"],
        )
        text_blocks = self.text_recognizer.recognize(preprocessed["for_ocr"])

        return {
            "symbols": [d.to_dict() for d in detections],
            "texts": [t.to_dict() for t in text_blocks],
            "rooms_from_text": self.text_recognizer.extract_rooms(text_blocks),
            "dimensions": self.text_recognizer.extract_dimensions(text_blocks),
        }
