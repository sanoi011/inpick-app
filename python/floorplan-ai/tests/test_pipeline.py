"""
파이프라인 테스트

실행: pytest tests/ -v
"""

import sys
import numpy as np
import pytest
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


class TestPreprocessor:
    """전처리 모듈 테스트"""

    def test_process_basic(self):
        from src.preprocessor import FloorPlanPreprocessor
        config = {"target_size": 640, "deskew": False}
        pp = FloorPlanPreprocessor(config)

        # 더미 이미지 (흰 배경에 검은 선)
        img = np.ones((800, 600, 3), dtype=np.uint8) * 255
        img[100:105, 50:550] = 0  # 수평선
        img[50:400, 200:205] = 0  # 수직선

        result = pp.process(img)

        assert "original" in result
        assert "binary" in result
        assert "for_yolo" in result
        assert "scale_info" in result
        assert result["for_yolo"].shape[0] == 640
        assert result["for_yolo"].shape[1] == 640

    def test_scale_info(self):
        from src.preprocessor import FloorPlanPreprocessor
        pp = FloorPlanPreprocessor({"target_size": 1280})
        img = np.ones((1000, 800, 3), dtype=np.uint8) * 255
        result = pp.process(img)

        info = result["scale_info"]
        assert info["original_size"] == (800, 1000)
        assert info["scale_factor"] == 1280 / 1000


class TestSymbolDetector:
    """심볼 감지 모듈 테스트"""

    def test_detection_dataclass(self):
        from src.symbol_detector import Detection
        det = Detection(
            class_id=1, class_name="door_swing",
            class_name_ko="여닫이문", confidence=0.95,
            bbox=(100, 200, 150, 250),
        )
        assert det.center == (125.0, 225.0)
        assert det.area == 2500.0

        d = det.to_dict()
        assert d["class_name"] == "door_swing"
        assert d["confidence"] == 0.95

    def test_class_names(self):
        from src.symbol_detector import CLASS_NAMES_KO, CLASS_NAMES_EN
        assert len(CLASS_NAMES_KO) == 13
        assert len(CLASS_NAMES_EN) == 13
        assert CLASS_NAMES_KO[0] == "벽"
        assert CLASS_NAMES_EN[4] == "window"


class TestTextRecognizer:
    """텍스트 인식 모듈 테스트"""

    def test_classify_room_name(self):
        from src.text_recognizer import TextRecognizer
        tr = TextRecognizer({"engine": "easyocr", "languages": ["ko", "en"]})

        assert tr._classify_text("안방") == "room_name"
        assert tr._classify_text("거실") == "room_name"
        assert tr._classify_text("MBR") == "room_name"

    def test_classify_area(self):
        from src.text_recognizer import TextRecognizer
        tr = TextRecognizer({})

        assert tr._classify_text("3.3㎡") == "area"
        assert tr._classify_text("10.5평") == "area"
        assert tr._classify_text("12.3m²") == "area"

    def test_classify_dimension(self):
        from src.text_recognizer import TextRecognizer
        tr = TextRecognizer({})

        assert tr._classify_text("3,600") == "dimension"
        assert tr._classify_text("2400") == "dimension"


class TestWallExtractor:
    """벽 추출 모듈 테스트"""

    def test_wall_segment(self):
        from src.wall_extractor import WallSegment
        w = WallSegment(
            start=(0, 0), end=(100, 0),
            thickness=5.0, orientation="horizontal", length=100.0,
        )
        d = w.to_dict()
        assert d["orientation"] == "horizontal"
        assert d["length"] == 100.0

    def test_extract_basic(self):
        from src.wall_extractor import WallExtractor
        config = {
            "method": "hough",
            "hough": {"threshold": 50, "min_line_length": 30, "max_line_gap": 10},
            "merge": {"angle_tolerance": 5, "distance_tolerance": 10, "min_wall_length": 20},
        }
        we = WallExtractor(config)

        # 이진 이미지 (직선 패턴)
        binary = np.zeros((500, 500), dtype=np.uint8)
        binary[100, 50:450] = 255  # 수평선
        binary[300, 50:450] = 255  # 수평선
        binary[100:300, 50] = 255  # 수직선
        binary[100:300, 450] = 255  # 수직선

        # 선을 두껍게
        import cv2
        kernel = np.ones((3, 3), np.uint8)
        binary = cv2.dilate(binary, kernel, iterations=2)

        result = we.extract(binary)
        assert "walls" in result
        assert "rooms" in result

    def test_room_detection(self):
        from src.wall_extractor import WallExtractor
        we = WallExtractor({"method": "hybrid"})

        # 닫힌 사각형 그리기
        import cv2
        binary = np.zeros((500, 500), dtype=np.uint8)
        cv2.rectangle(binary, (50, 50), (400, 400), 255, 5)

        result = we.extract(binary)
        assert len(result["rooms"]) >= 1


class TestVectorizer:
    """벡터화 모듈 테스트"""

    def test_to_json(self, tmp_path):
        from src.vectorizer import FloorPlanVectorizer
        v = FloorPlanVectorizer({"scale_factor": 1.0, "output_format": "json"})

        data = {
            "version": "1.0", "unit": "mm", "scale_factor": 1.0,
            "canvas": {"width": 1000, "height": 800},
            "walls": [], "rooms": [], "symbols": [], "texts": [],
        }
        output = str(tmp_path / "test.json")
        v.to_json(data, output)
        assert Path(output).exists()

    def test_to_svg(self, tmp_path):
        from src.vectorizer import FloorPlanVectorizer
        v = FloorPlanVectorizer({"scale_factor": 1.0})

        data = {
            "canvas": {"width": 1000, "height": 800},
            "walls": [{"start": {"x": 0, "y": 0}, "end": {"x": 100, "y": 0}}],
            "rooms": [], "symbols": [],
        }
        output = str(tmp_path / "test.svg")
        v.to_svg(data, output)
        content = Path(output).read_text()
        assert "<svg" in content
        assert "<line" in content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
