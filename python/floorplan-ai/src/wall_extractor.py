"""
Stage 3: 벽 선분 추출 & 방 영역 감지
이진화 이미지에서 벽 직선 세그먼트를 추출하고, 닫힌 영역(방)을 탐지
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from loguru import logger


@dataclass
class WallSegment:
    """벽 선분"""
    start: Tuple[float, float]  # (x1, y1)
    end: Tuple[float, float]    # (x2, y2)
    thickness: float            # 추정 두께 (픽셀)
    orientation: str            # horizontal, vertical, diagonal
    length: float               # 길이 (픽셀)

    def to_dict(self) -> dict:
        return {
            "start": {"x": round(self.start[0], 1), "y": round(self.start[1], 1)},
            "end": {"x": round(self.end[0], 1), "y": round(self.end[1], 1)},
            "thickness": round(self.thickness, 1),
            "orientation": self.orientation,
            "length": round(self.length, 1),
        }


@dataclass
class RoomPolygon:
    """방 폴리곤"""
    contour: np.ndarray       # OpenCV contour
    area: float               # 면적 (픽셀²)
    center: Tuple[float, float]
    bounding_rect: Tuple[int, int, int, int]  # (x, y, w, h)
    room_name: Optional[str] = None

    def to_dict(self) -> dict:
        pts = self.contour.reshape(-1, 2).tolist()
        return {
            "vertices": [{"x": round(p[0], 1), "y": round(p[1], 1)} for p in pts],
            "area_px": round(self.area, 1),
            "center": {"x": round(self.center[0], 1), "y": round(self.center[1], 1)},
            "bounding_rect": {
                "x": self.bounding_rect[0], "y": self.bounding_rect[1],
                "w": self.bounding_rect[2], "h": self.bounding_rect[3],
            },
            "room_name": self.room_name,
        }


class WallExtractor:
    """벽 선분 추출기"""

    def __init__(self, config: dict):
        self.method = config.get("method", "hybrid")
        # Hough 파라미터
        hough = config.get("hough", {})
        self.hough_rho = hough.get("rho", 1)
        self.hough_theta = np.pi / 180 * hough.get("theta_resolution", 1)
        self.hough_threshold = hough.get("threshold", 100)
        self.hough_min_length = hough.get("min_line_length", 50)
        self.hough_max_gap = hough.get("max_line_gap", 10)
        # 형태학적 파라미터
        morph = config.get("morphology", {})
        self.wall_thickness_min = morph.get("wall_thickness_min", 3)
        self.wall_thickness_max = morph.get("wall_thickness_max", 20)
        self.morph_kernel = morph.get("kernel_size", 3)
        # 벽 병합 파라미터
        merge = config.get("merge", {})
        self.angle_tol = merge.get("angle_tolerance", 5)
        self.dist_tol = merge.get("distance_tolerance", 10)
        self.min_wall_length = merge.get("min_wall_length", 30)

    def extract(self, binary_image: np.ndarray) -> Dict:
        """
        벽 선분 + 방 폴리곤 추출

        Args:
            binary_image: 이진화 이미지 (전경=255, 배경=0)

        Returns:
            dict: {"walls": List[WallSegment], "rooms": List[RoomPolygon]}
        """
        logger.info(f"벽 추출 시작 - 방법: {self.method}")

        if self.method == "hough":
            walls = self._extract_hough(binary_image)
        elif self.method == "morphology":
            walls = self._extract_morphology(binary_image)
        else:  # hybrid
            walls = self._extract_hybrid(binary_image)

        # 벽 병합 (근접 선분 합치기)
        walls = self._merge_walls(walls)

        # 방 영역 감지
        rooms = self._detect_rooms(binary_image)

        logger.info(f"벽 추출 완료 - 벽: {len(walls)}개, 방: {len(rooms)}개")
        return {"walls": walls, "rooms": rooms}

    def _extract_hough(self, binary: np.ndarray) -> List[WallSegment]:
        """Hough Line Transform으로 직선 추출"""
        lines = cv2.HoughLinesP(
            binary,
            rho=self.hough_rho,
            theta=self.hough_theta,
            threshold=self.hough_threshold,
            minLineLength=self.hough_min_length,
            maxLineGap=self.hough_max_gap,
        )

        walls = []
        if lines is None:
            logger.warning("Hough Transform 결과 없음")
            return walls

        for line in lines:
            x1, y1, x2, y2 = line[0]
            wall = self._create_wall_segment(x1, y1, x2, y2)
            if wall and wall.length >= self.min_wall_length:
                walls.append(wall)

        return walls

    def _extract_morphology(self, binary: np.ndarray) -> List[WallSegment]:
        """형태학적 처리로 벽 영역 추출 후 골격화"""
        # 수평 벽 추출
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        h_walls = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel, iterations=1)

        # 수직 벽 추출
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        v_walls = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel, iterations=1)

        # 합치기
        combined = cv2.bitwise_or(h_walls, v_walls)

        # 골격화 (Skeletonize)
        skeleton = self._skeletonize(combined)

        # 골격에서 Hough로 직선 추출
        lines = cv2.HoughLinesP(
            skeleton, 1, np.pi / 180,
            threshold=30, minLineLength=30, maxLineGap=15
        )

        walls = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                wall = self._create_wall_segment(x1, y1, x2, y2)
                if wall:
                    walls.append(wall)

        return walls

    def _extract_hybrid(self, binary: np.ndarray) -> List[WallSegment]:
        """형태학적 전처리 + Hough 결합"""
        # Step 1: 형태학적 필터로 벽 영역만 남기기
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (self.morph_kernel, self.morph_kernel)
        )
        # 작은 노이즈 제거
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        # 벽 연결 강화
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

        # 벽 두께 범위 필터 (너무 두꺼운 것은 영역, 너무 얇은 것은 노이즈)
        dist = cv2.distanceTransform(cleaned, cv2.DIST_L2, 5)
        wall_mask = np.zeros_like(binary)
        wall_mask[
            (dist >= self.wall_thickness_min / 2) &
            (dist <= self.wall_thickness_max / 2)
        ] = 255

        # 벽 mask가 너무 작으면 원본 사용
        if np.sum(wall_mask > 0) < np.sum(binary > 0) * 0.05:
            wall_mask = cleaned

        # Step 2: Hough Transform
        walls_hough = self._extract_hough(wall_mask)

        # Step 3: 형태학적 결과도 보충
        walls_morph = self._extract_morphology(binary)

        # 합치기 (중복 제거)
        all_walls = walls_hough + walls_morph
        return self._deduplicate_walls(all_walls)

    def _create_wall_segment(
        self, x1: int, y1: int, x2: int, y2: int
    ) -> Optional[WallSegment]:
        """좌표로부터 WallSegment 생성"""
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length < 5:
            return None

        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) < 10 or abs(abs(angle) - 180) < 10:
            orientation = "horizontal"
        elif abs(abs(angle) - 90) < 10:
            orientation = "vertical"
        else:
            orientation = "diagonal"

        return WallSegment(
            start=(float(x1), float(y1)),
            end=(float(x2), float(y2)),
            thickness=5.0,  # 기본값 (정밀 측정은 후처리)
            orientation=orientation,
            length=length,
        )

    def _merge_walls(self, walls: List[WallSegment]) -> List[WallSegment]:
        """근접한 같은 방향 벽 선분 병합"""
        if not walls:
            return walls

        merged = []
        used = set()

        for i, w1 in enumerate(walls):
            if i in used:
                continue
            best_merge = w1
            for j, w2 in enumerate(walls):
                if j <= i or j in used:
                    continue
                if w1.orientation != w2.orientation:
                    continue
                if self._should_merge(w1, w2):
                    best_merge = self._merge_two_walls(best_merge, w2)
                    used.add(j)
            merged.append(best_merge)
            used.add(i)

        return merged

    def _should_merge(self, w1: WallSegment, w2: WallSegment) -> bool:
        """두 벽 선분이 병합 가능한지 판단"""
        if w1.orientation == "horizontal":
            # Y좌표 차이가 작고, X범위가 겹치거나 근접
            y_diff = abs((w1.start[1] + w1.end[1]) / 2 - (w2.start[1] + w2.end[1]) / 2)
            if y_diff > self.dist_tol:
                return False
            x_min1, x_max1 = min(w1.start[0], w1.end[0]), max(w1.start[0], w1.end[0])
            x_min2, x_max2 = min(w2.start[0], w2.end[0]), max(w2.start[0], w2.end[0])
            gap = max(x_min1, x_min2) - min(x_max1, x_max2)
            return gap < self.dist_tol
        elif w1.orientation == "vertical":
            x_diff = abs((w1.start[0] + w1.end[0]) / 2 - (w2.start[0] + w2.end[0]) / 2)
            if x_diff > self.dist_tol:
                return False
            y_min1, y_max1 = min(w1.start[1], w1.end[1]), max(w1.start[1], w1.end[1])
            y_min2, y_max2 = min(w2.start[1], w2.end[1]), max(w2.start[1], w2.end[1])
            gap = max(y_min1, y_min2) - min(y_max1, y_max2)
            return gap < self.dist_tol
        return False

    def _merge_two_walls(self, w1: WallSegment, w2: WallSegment) -> WallSegment:
        """두 벽 선분을 하나로 병합"""
        all_pts = [w1.start, w1.end, w2.start, w2.end]
        if w1.orientation == "horizontal":
            all_pts.sort(key=lambda p: p[0])
            start = all_pts[0]
            end = all_pts[-1]
        elif w1.orientation == "vertical":
            all_pts.sort(key=lambda p: p[1])
            start = all_pts[0]
            end = all_pts[-1]
        else:
            start = w1.start
            end = w2.end

        length = np.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2)
        return WallSegment(
            start=start, end=end,
            thickness=max(w1.thickness, w2.thickness),
            orientation=w1.orientation,
            length=length,
        )

    def _deduplicate_walls(self, walls: List[WallSegment]) -> List[WallSegment]:
        """중복 벽 선분 제거"""
        if len(walls) <= 1:
            return walls

        unique = []
        for w in walls:
            is_dup = False
            for u in unique:
                d1 = np.sqrt((w.start[0] - u.start[0])**2 + (w.start[1] - u.start[1])**2)
                d2 = np.sqrt((w.end[0] - u.end[0])**2 + (w.end[1] - u.end[1])**2)
                if d1 < self.dist_tol and d2 < self.dist_tol:
                    is_dup = True
                    break
            if not is_dup:
                unique.append(w)
        return unique

    def _detect_rooms(self, binary: np.ndarray) -> List[RoomPolygon]:
        """닫힌 영역(방) 감지"""
        # 벽 영역을 팽창시켜 틈새 메우기
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)

        # 반전 (방=전경)
        inverted = cv2.bitwise_not(closed)

        # 컨투어 추출
        contours, hierarchy = cv2.findContours(
            inverted, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )

        rooms = []
        img_area = binary.shape[0] * binary.shape[1]

        for contour in contours:
            area = cv2.contourArea(contour)
            # 너무 작거나 너무 큰 영역 필터
            if area < img_area * 0.005 or area > img_area * 0.5:
                continue

            # 단순화
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            # 최소 4개 꼭짓점 (방은 보통 직사각형 기반)
            if len(approx) < 4:
                continue

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]

            x, y, w, h = cv2.boundingRect(contour)

            rooms.append(RoomPolygon(
                contour=approx,
                area=area,
                center=(cx, cy),
                bounding_rect=(x, y, w, h),
            ))

        # 면적 기준 정렬 (큰 방 먼저)
        rooms.sort(key=lambda r: r.area, reverse=True)
        return rooms

    def _skeletonize(self, binary: np.ndarray) -> np.ndarray:
        """이미지 골격화 (Zhang-Suen Thinning)"""
        skeleton = np.zeros_like(binary)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        temp = binary.copy()

        while True:
            eroded = cv2.erode(temp, element)
            dilated = cv2.dilate(eroded, element)
            diff = cv2.subtract(temp, dilated)
            skeleton = cv2.bitwise_or(skeleton, diff)
            temp = eroded.copy()
            if cv2.countNonZero(temp) == 0:
                break

        return skeleton
