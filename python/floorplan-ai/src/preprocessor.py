"""
이미지 전처리 모듈
평면도 이미지를 YOLOv8 및 각 Stage에 최적화된 형태로 변환
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Tuple, Optional
from loguru import logger


class FloorPlanPreprocessor:
    """평면도 이미지 전처리기"""

    def __init__(self, config: dict):
        self.target_size = config.get("target_size", 1280)
        self.binarize_threshold = config.get("binarize_threshold", 127)
        self.denoise_kernel = config.get("denoise_kernel", 3)
        self.deskew = config.get("deskew", True)
        self.enhance_contrast = config.get("enhance_contrast", True)

    def process(self, image: np.ndarray) -> dict:
        """
        전처리 파이프라인 실행

        Args:
            image: BGR 원본 이미지

        Returns:
            dict: {
                "original": 원본 이미지,
                "gray": 그레이스케일,
                "binary": 이진화 이미지,
                "enhanced": 대비 강화 이미지,
                "for_yolo": YOLO 입력용 이미지,
                "for_ocr": OCR 입력용 이미지,
                "for_wall": 벽 추출용 이미지,
                "scale_info": 크기 정보
            }
        """
        logger.info(f"전처리 시작 - 원본 크기: {image.shape[:2]}")

        results = {"original": image.copy()}

        # 1. 그레이스케일 변환
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        results["gray"] = gray

        # 2. 대비 강화 (CLAHE)
        if self.enhance_contrast:
            enhanced = self._enhance_contrast(gray)
        else:
            enhanced = gray.copy()
        results["enhanced"] = enhanced

        # 3. 노이즈 제거
        denoised = cv2.fastNlMeansDenoising(
            enhanced, None, h=10, templateWindowSize=7, searchWindowSize=21
        )

        # 4. 이진화 (Adaptive Threshold - 도면에 적합)
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            blockSize=11,
            C=2
        )

        # 소규모 노이즈 제거
        kernel = np.ones((self.denoise_kernel, self.denoise_kernel), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
        results["binary"] = binary

        # 5. 기울기 보정
        if self.deskew:
            angle = self._detect_skew(binary)
            if abs(angle) > 0.5:
                logger.info(f"기울기 감지: {angle:.2f}° → 보정 적용")
                image = self._rotate_image(image, angle)
                gray = self._rotate_image(gray, angle)
                binary = self._rotate_image(binary, angle)
                results["original"] = image
                results["gray"] = gray
                results["binary"] = binary

        # 6. YOLO 입력용 (리사이즈, BGR 유지)
        h, w = image.shape[:2]
        scale = self.target_size / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        yolo_img = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        # YOLO는 정사각형 패딩 필요
        pad_w = self.target_size - new_w
        pad_h = self.target_size - new_h
        yolo_img = cv2.copyMakeBorder(
            yolo_img, 0, pad_h, 0, pad_w,
            cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )
        results["for_yolo"] = yolo_img

        # 7. OCR 입력용 (그레이스케일, 대비 강화)
        results["for_ocr"] = enhanced

        # 8. 벽 추출용 (이진화 이미지)
        results["for_wall"] = binary

        # 9. 스케일 정보
        results["scale_info"] = {
            "original_size": (w, h),
            "yolo_size": (self.target_size, self.target_size),
            "scale_factor": scale,
            "pad": (pad_w, pad_h)
        }

        logger.info(f"전처리 완료 - YOLO 입력: {self.target_size}x{self.target_size}")
        return results

    def _enhance_contrast(self, gray: np.ndarray) -> np.ndarray:
        """CLAHE 기반 대비 강화"""
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(gray)

    def _detect_skew(self, binary: np.ndarray) -> float:
        """Hough Transform으로 기울기 각도 감지"""
        lines = cv2.HoughLinesP(
            binary, 1, np.pi / 180, threshold=100,
            minLineLength=100, maxLineGap=10
        )
        if lines is None:
            return 0.0

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            # 수평/수직에 가까운 선만 고려
            if abs(angle) < 15 or abs(angle - 90) < 15 or abs(angle + 90) < 15:
                if abs(angle) < 15:
                    angles.append(angle)

        if not angles:
            return 0.0

        return float(np.median(angles))

    def _rotate_image(self, image: np.ndarray, angle: float) -> np.ndarray:
        """이미지 회전 (크기 유지)"""
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(image, M, (w, h),
                              flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_REPLICATE)

    @staticmethod
    def load_image(path: str) -> np.ndarray:
        """이미지 파일 로드 (PDF 지원 포함)"""
        path = Path(path)

        if path.suffix.lower() == ".pdf":
            return FloorPlanPreprocessor._load_pdf(path)

        image = cv2.imread(str(path))
        if image is None:
            raise ValueError(f"이미지를 로드할 수 없습니다: {path}")
        return image

    @staticmethod
    def _load_pdf(path: Path) -> np.ndarray:
        """PDF 첫 페이지를 이미지로 변환"""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            page = doc[0]
            # 300 DPI로 렌더링
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8)
            img_array = img_array.reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:  # RGBA → BGR
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:  # RGB → BGR
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            doc.close()
            return img_array
        except ImportError:
            logger.warning("PyMuPDF 미설치 → pdf2image 시도")
            from pdf2image import convert_from_path
            images = convert_from_path(str(path), dpi=300, first_page=1, last_page=1)
            return cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
