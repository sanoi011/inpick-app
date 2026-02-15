"""
Stage 2: 평면도 텍스트 인식 (OCR)
방 이름, 면적, 치수 텍스트를 인식하고 구조화된 데이터로 반환
"""

import cv2
import numpy as np
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from loguru import logger


@dataclass
class TextBlock:
    """인식된 텍스트 블록"""
    text: str
    confidence: float
    bbox: tuple  # (x1, y1, x2, y2)
    category: str  # room_name, area, dimension, label, unknown

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 4),
            "bbox": {"x1": self.bbox[0], "y1": self.bbox[1],
                     "x2": self.bbox[2], "y2": self.bbox[3]},
            "category": self.category,
        }


class TextRecognizer:
    """평면도 전용 OCR 인식기"""

    # 한국 아파트 방 이름 패턴
    ROOM_NAMES = {
        "안방", "거실", "주방", "욕실", "화장실", "발코니", "베란다",
        "다용도실", "현관", "드레스룸", "팬트리", "방", "침실", "서재",
        "복도", "세탁실", "창고", "알파룸", "가족실", "식당", "다이닝",
        "MBR", "LDK", "BR", "LR", "KIT", "BATH", "BAL", "ENT",
    }

    # 면적 패턴 (3.3㎡, 10.5평, 12.3m² 등)
    AREA_PATTERN = re.compile(
        r'(\d+\.?\d*)\s*(㎡|m²|m2|평|PY|py)', re.IGNORECASE
    )

    # 치수 패턴 (3,600 / 2400 / 1.2m 등)
    DIMENSION_PATTERN = re.compile(
        r'(\d{1,2}[,.]?\d{3}|\d{3,5})\s*(mm)?', re.IGNORECASE
    )

    def __init__(self, config: dict):
        self.engine = config.get("engine", "easyocr")
        self.languages = config.get("languages", ["ko", "en"])
        self.conf_threshold = config.get("confidence_threshold", 0.3)
        self.custom_room_names = set(config.get("room_names", []))
        self.all_room_names = self.ROOM_NAMES | self.custom_room_names
        self.reader = None

    def _init_engine(self) -> None:
        """OCR 엔진 초기화 (lazy loading)"""
        if self.reader is not None:
            return

        if self.engine == "easyocr":
            try:
                import easyocr
                self.reader = easyocr.Reader(
                    self.languages,
                    gpu=self._check_gpu(),
                    verbose=False,
                )
                logger.info(f"EasyOCR 초기화 완료 - 언어: {self.languages}")
            except ImportError:
                logger.error("easyocr 미설치: pip install easyocr")
                raise
        else:
            logger.info("Tesseract OCR 모드 (pytesseract 필요)")

    def _check_gpu(self) -> bool:
        """GPU 사용 가능 여부"""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False

    def recognize(self, image: np.ndarray) -> List[TextBlock]:
        """
        평면도 이미지에서 텍스트 인식

        Args:
            image: 그레이스케일 또는 BGR 이미지

        Returns:
            List[TextBlock]: 인식된 텍스트 블록 리스트
        """
        self._init_engine()
        logger.info("텍스트 인식 시작")

        if self.engine == "easyocr":
            raw_results = self._recognize_easyocr(image)
        else:
            raw_results = self._recognize_tesseract(image)

        # 필터링 및 카테고리 분류
        text_blocks = []
        for bbox, text, conf in raw_results:
            if conf < self.conf_threshold:
                continue
            if not text.strip():
                continue

            category = self._classify_text(text.strip())
            block = TextBlock(
                text=text.strip(),
                confidence=conf,
                bbox=bbox,
                category=category,
            )
            text_blocks.append(block)

        logger.info(f"텍스트 인식 완료 - {len(text_blocks)}개 블록")
        self._log_summary(text_blocks)
        return text_blocks

    def _recognize_easyocr(self, image: np.ndarray) -> List[tuple]:
        """EasyOCR 엔진으로 인식"""
        results = self.reader.readtext(image)
        parsed = []
        for (pts, text, conf) in results:
            # EasyOCR bbox: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]] → (x1,y1,x2,y2)
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            bbox = (min(xs), min(ys), max(xs), max(ys))
            parsed.append((bbox, text, conf))
        return parsed

    def _recognize_tesseract(self, image: np.ndarray) -> List[tuple]:
        """Tesseract 엔진으로 인식"""
        try:
            import pytesseract
        except ImportError:
            logger.error("pytesseract 미설치: pip install pytesseract")
            raise

        data = pytesseract.image_to_data(
            image, lang="kor+eng", output_type=pytesseract.Output.DICT
        )
        parsed = []
        for i in range(len(data["text"])):
            text = data["text"][i]
            conf = float(data["conf"][i]) / 100.0
            if conf < 0:
                continue
            x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
            bbox = (x, y, x + w, y + h)
            parsed.append((bbox, text, conf))
        return parsed

    def _classify_text(self, text: str) -> str:
        """텍스트 카테고리 분류"""
        # 1. 방 이름 체크
        for room_name in self.all_room_names:
            if room_name in text:
                return "room_name"

        # 2. 면적 체크
        if self.AREA_PATTERN.search(text):
            return "area"

        # 3. 치수 체크
        if self.DIMENSION_PATTERN.search(text):
            return "dimension"

        # 4. 숫자만 있으면 치수일 가능성
        cleaned = text.replace(",", "").replace(".", "").strip()
        if cleaned.isdigit() and len(cleaned) >= 3:
            return "dimension"

        return "unknown"

    def extract_dimensions(self, text_blocks: List[TextBlock]) -> List[Dict]:
        """치수 블록에서 mm 값 추출"""
        dimensions = []
        for block in text_blocks:
            if block.category != "dimension":
                continue
            match = self.DIMENSION_PATTERN.search(block.text)
            if match:
                value_str = match.group(1).replace(",", "")
                try:
                    value_mm = int(value_str)
                    dimensions.append({
                        "value_mm": value_mm,
                        "text": block.text,
                        "bbox": block.bbox,
                    })
                except ValueError:
                    pass
        return dimensions

    def extract_rooms(self, text_blocks: List[TextBlock]) -> List[Dict]:
        """방 이름 블록 추출 + 중심 좌표"""
        rooms = []
        for block in text_blocks:
            if block.category != "room_name":
                continue
            cx = (block.bbox[0] + block.bbox[2]) / 2
            cy = (block.bbox[1] + block.bbox[3]) / 2
            rooms.append({
                "name": block.text,
                "center": (cx, cy),
                "bbox": block.bbox,
                "confidence": block.confidence,
            })
        return rooms

    def _log_summary(self, blocks: List[TextBlock]) -> None:
        """인식 결과 요약"""
        from collections import Counter
        cats = Counter(b.category for b in blocks)
        for cat, count in cats.most_common():
            logger.debug(f"  [{cat}]: {count}개")
