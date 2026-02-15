"""
Stage 1: YOLOv8 기반 평면도 심볼 감지
문, 창문, 기둥, 위생기구 등 건축 심볼을 탐지하고 바운딩박스 + 클래스 반환
"""

import numpy as np
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from loguru import logger


# 클래스 ID → 한국어 매핑
CLASS_NAMES_KO = {
    0: "벽", 1: "여닫이문", 2: "미닫이문", 3: "현관문",
    4: "창문", 5: "기둥", 6: "변기", 7: "욕조",
    8: "세면대", 9: "싱크대", 10: "계단", 11: "엘리베이터",
    12: "치수선",
}

CLASS_NAMES_EN = {
    0: "wall", 1: "door_swing", 2: "door_sliding", 3: "door_entrance",
    4: "window", 5: "column", 6: "toilet", 7: "bathtub",
    8: "sink", 9: "kitchen_sink", 10: "stairs", 11: "elevator",
    12: "dimension_line",
}


@dataclass
class Detection:
    """단일 감지 결과"""
    class_id: int
    class_name: str
    class_name_ko: str
    confidence: float
    bbox: tuple  # (x1, y1, x2, y2) 픽셀 좌표
    center: tuple = field(default=(0, 0))  # (cx, cy)
    area: float = 0.0

    def __post_init__(self):
        x1, y1, x2, y2 = self.bbox
        self.center = ((x1 + x2) / 2, (y1 + y2) / 2)
        self.area = (x2 - x1) * (y2 - y1)

    def to_dict(self) -> dict:
        return {
            "class_id": self.class_id,
            "class_name": self.class_name,
            "class_name_ko": self.class_name_ko,
            "confidence": round(self.confidence, 4),
            "bbox": {
                "x1": round(self.bbox[0], 1),
                "y1": round(self.bbox[1], 1),
                "x2": round(self.bbox[2], 1),
                "y2": round(self.bbox[3], 1),
            },
            "center": {
                "x": round(self.center[0], 1),
                "y": round(self.center[1], 1),
            },
            "area": round(self.area, 1),
        }


class SymbolDetector:
    """YOLOv8 기반 평면도 심볼 감지기"""

    def __init__(self, config: dict):
        self.model_path = config.get("model_path", "models/floorplan_yolov8n.pt")
        self.pretrained = config.get("pretrained", "yolov8n.pt")
        self.conf_threshold = config.get("confidence_threshold", 0.25)
        self.iou_threshold = config.get("iou_threshold", 0.45)
        self.max_det = config.get("max_detections", 300)
        self.device = config.get("device", "auto")
        self.img_size = config.get("img_size", 1280)
        self.model = None

    def load_model(self) -> None:
        """모델 로드 - 학습된 모델 또는 사전학습 모델"""
        try:
            from ultralytics import YOLO

            model_file = Path(self.model_path)
            if model_file.exists():
                logger.info(f"학습된 모델 로드: {self.model_path}")
                self.model = YOLO(str(model_file))
            else:
                logger.warning(f"학습 모델 없음 → 사전학습 모델 사용: {self.pretrained}")
                self.model = YOLO(self.pretrained)

            # 디바이스 설정
            if self.device == "auto":
                import torch
                self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
            logger.info(f"모델 로드 완료 - 디바이스: {self.device}")

        except ImportError:
            logger.error("ultralytics 패키지가 설치되지 않았습니다: pip install ultralytics")
            raise

    def detect(self, image: np.ndarray, scale_info: Optional[dict] = None) -> List[Detection]:
        """
        이미지에서 심볼 감지

        Args:
            image: BGR 이미지 (원본 크기 또는 YOLO용 리사이즈)
            scale_info: 전처리 스케일 정보 (좌표 역변환용)

        Returns:
            List[Detection]: 감지된 심볼 리스트
        """
        if self.model is None:
            self.load_model()

        logger.info(f"심볼 감지 시작 - 이미지: {image.shape[:2]}")

        results = self.model.predict(
            source=image,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            max_det=self.max_det,
            imgsz=self.img_size,
            device=self.device,
            verbose=False,
        )

        detections = []
        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()

                # 원본 좌표로 역변환
                if scale_info:
                    factor = scale_info.get("scale_factor", 1.0)
                    if factor != 1.0:
                        x1, y1, x2, y2 = x1 / factor, y1 / factor, x2 / factor, y2 / factor

                det = Detection(
                    class_id=cls_id,
                    class_name=CLASS_NAMES_EN.get(cls_id, f"class_{cls_id}"),
                    class_name_ko=CLASS_NAMES_KO.get(cls_id, f"클래스_{cls_id}"),
                    confidence=conf,
                    bbox=(x1, y1, x2, y2),
                )
                detections.append(det)

        # 신뢰도 기준 정렬
        detections.sort(key=lambda d: d.confidence, reverse=True)

        logger.info(f"심볼 감지 완료 - {len(detections)}개 탐지")
        self._log_detection_summary(detections)
        return detections

    def _log_detection_summary(self, detections: List[Detection]) -> None:
        """감지 결과 요약 로깅"""
        from collections import Counter
        counter = Counter(d.class_name_ko for d in detections)
        for name, count in counter.most_common():
            logger.debug(f"  {name}: {count}개")

    def train(
        self,
        data_yaml: str,
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 1280,
        project: str = "runs/train",
        name: str = "floorplan_v1",
    ) -> str:
        """
        YOLOv8 fine-tuning 학습

        Args:
            data_yaml: 데이터셋 설정 YAML 경로
            epochs: 학습 에포크
            batch_size: 배치 크기
            img_size: 학습 이미지 크기
            project: 결과 저장 디렉토리
            name: 실험 이름

        Returns:
            str: 최적 모델 경로
        """
        from ultralytics import YOLO

        logger.info(f"YOLOv8 학습 시작 - 데이터셋: {data_yaml}")
        logger.info(f"설정: epochs={epochs}, batch={batch_size}, img={img_size}")

        model = YOLO(self.pretrained)

        results = model.train(
            data=data_yaml,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            project=project,
            name=name,
            device=self.device if self.device != "auto" else None,
            # 평면도 최적화 하이퍼파라미터
            lr0=0.01,
            lrf=0.01,
            momentum=0.937,
            weight_decay=0.0005,
            warmup_epochs=3,
            warmup_momentum=0.8,
            box=7.5,
            cls=0.5,
            dfl=1.5,
            # Data Augmentation (도면 특화)
            hsv_h=0.0,       # 도면은 색상 변화 없음
            hsv_s=0.0,
            hsv_v=0.2,       # 밝기만 약간 변화
            degrees=5.0,     # 약간의 회전
            translate=0.1,
            scale=0.3,
            shear=2.0,
            flipud=0.0,      # 상하 반전 금지 (도면 방향 유지)
            fliplr=0.5,      # 좌우 반전은 허용
            mosaic=0.5,
        )

        best_model = Path(project) / name / "weights" / "best.pt"
        logger.info(f"학습 완료 - 최적 모델: {best_model}")
        return str(best_model)

    def export_results_image(
        self,
        image: np.ndarray,
        detections: List[Detection],
        output_path: str,
    ) -> None:
        """감지 결과를 이미지에 시각화하여 저장"""
        import cv2

        vis_image = image.copy()
        colors = {
            "wall": (100, 100, 100), "door_swing": (0, 180, 0),
            "door_sliding": (0, 255, 0), "door_entrance": (0, 128, 255),
            "window": (255, 180, 0), "column": (0, 0, 200),
            "toilet": (200, 0, 200), "bathtub": (200, 100, 200),
            "sink": (150, 0, 150), "kitchen_sink": (100, 0, 100),
            "stairs": (0, 200, 200), "elevator": (200, 200, 0),
            "dimension_line": (128, 128, 128),
        }

        for det in detections:
            x1, y1, x2, y2 = [int(v) for v in det.bbox]
            color = colors.get(det.class_name, (0, 255, 0))
            cv2.rectangle(vis_image, (x1, y1), (x2, y2), color, 2)

            label = f"{det.class_name_ko} {det.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(vis_image, (x1, y1 - th - 6), (x1 + tw, y1), color, -1)
            cv2.putText(vis_image, label, (x1, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        cv2.imwrite(output_path, vis_image)
        logger.info(f"시각화 저장: {output_path}")
