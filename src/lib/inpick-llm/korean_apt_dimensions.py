"""한국 아파트 표준 평형별 실별 치수 DB.

근거 자료:
- 한국주택공사·국토교통부 표준 주택형 가이드
- 부동산 평면도 통계 (네이버부동산·다방·직방 분석)
- 평형 = 전용면적 기준 (공급면적 X)

평형 분류:
  15평형 (전용 49㎡ 이하) — 원룸·1.5룸
  20평형 (전용 50~66㎡)  — 2룸·소형
  24평형 (전용 67~75㎡)  — 2~3룸·신혼
  30평형 (전용 76~85㎡)  — 3룸·표준 (국민평형)
  34평형 (전용 86~99㎡)  — 3~4룸
  40평형 (전용 100~115㎡)— 4룸·대형
  50평형 (전용 116~135㎡)— 4~5룸·고급

각 실 치수 = (가로 mm, 세로 mm) — 한국 아파트 표준 비율
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal

PyungType = Literal["15평", "20평", "24평", "30평", "34평", "40평", "50평"]


@dataclass
class RoomDim:
    name: str            # "거실", "안방"
    width_mm: int        # 가로
    depth_mm: int        # 세로(깊이)
    height_mm: int = 2400  # 천장고 (한국 아파트 표준)

    @property
    def area_m2(self) -> float:
        return round(self.width_mm * self.depth_mm / 1_000_000, 2)


# 평형별 표준 실 치수 (한국 아파트 평균 — 단위 mm)
APT_STANDARD: dict[PyungType, dict[str, RoomDim]] = {
    "15평": {
        "거실": RoomDim("거실", 3500, 3000),
        "안방": RoomDim("안방", 3000, 3000),
        "주방": RoomDim("주방", 2400, 2200),
        "욕실": RoomDim("욕실", 1800, 1500),
        "현관": RoomDim("현관", 1500, 1200),
        "발코니": RoomDim("발코니", 3500, 1200),
    },
    "20평": {
        "거실": RoomDim("거실", 4200, 3500),
        "안방": RoomDim("안방", 3500, 3200),
        "침실": RoomDim("침실", 3000, 2800),
        "주방": RoomDim("주방", 3000, 2400),
        "욕실": RoomDim("욕실", 2000, 1700),
        "현관": RoomDim("현관", 1800, 1300),
        "발코니": RoomDim("발코니", 4200, 1500),
    },
    "24평": {
        "거실": RoomDim("거실", 4800, 3800),
        "안방": RoomDim("안방", 3800, 3500),
        "침실1": RoomDim("침실1", 3200, 2800),
        "침실2": RoomDim("침실2", 3000, 2700),
        "주방": RoomDim("주방", 3300, 2700),
        "욕실": RoomDim("욕실", 2100, 1800),
        "현관": RoomDim("현관", 1900, 1400),
        "발코니": RoomDim("발코니", 4800, 1500),
    },
    "30평": {
        "거실": RoomDim("거실", 5800, 4200),
        "안방": RoomDim("안방", 4200, 3500),
        "침실1": RoomDim("침실1", 3500, 3000),
        "침실2": RoomDim("침실2", 3300, 2800),
        "주방": RoomDim("주방", 3800, 3000),
        "욕실1": RoomDim("욕실1", 2200, 1800),
        "욕실2": RoomDim("욕실2", 2000, 1500),
        "드레스룸": RoomDim("드레스룸", 2500, 1800),
        "현관": RoomDim("현관", 2100, 1500),
        "발코니": RoomDim("발코니", 5800, 1500),
    },
    "34평": {
        "거실": RoomDim("거실", 6200, 4500),
        "안방": RoomDim("안방", 4500, 3800),
        "침실1": RoomDim("침실1", 3800, 3200),
        "침실2": RoomDim("침실2", 3500, 3000),
        "침실3": RoomDim("침실3", 3200, 2800),
        "주방": RoomDim("주방", 4200, 3200),
        "욕실1": RoomDim("욕실1", 2400, 1900),
        "욕실2": RoomDim("욕실2", 2100, 1700),
        "드레스룸": RoomDim("드레스룸", 2800, 2000),
        "현관": RoomDim("현관", 2300, 1700),
        "발코니": RoomDim("발코니", 6200, 1500),
    },
    "40평": {
        "거실": RoomDim("거실", 7000, 4800, 2700),  # 대형은 천장고 2.7m 도 흔함
        "안방": RoomDim("안방", 5000, 4200, 2700),
        "침실1": RoomDim("침실1", 4200, 3500, 2700),
        "침실2": RoomDim("침실2", 3800, 3200, 2700),
        "침실3": RoomDim("침실3", 3500, 3000, 2700),
        "주방": RoomDim("주방", 4800, 3500, 2700),
        "다이닝": RoomDim("다이닝", 3500, 3000, 2700),
        "욕실1": RoomDim("욕실1", 2700, 2100, 2700),
        "욕실2": RoomDim("욕실2", 2400, 1900, 2700),
        "드레스룸": RoomDim("드레스룸", 3200, 2400, 2700),
        "팬트리": RoomDim("팬트리", 2200, 1800, 2700),
        "현관": RoomDim("현관", 2500, 1900, 2700),
        "발코니": RoomDim("발코니", 7000, 1800, 2400),
    },
    "50평": {
        "거실": RoomDim("거실", 8200, 5500, 2700),
        "안방": RoomDim("안방", 5800, 4500, 2700),
        "침실1": RoomDim("침실1", 4500, 3800, 2700),
        "침실2": RoomDim("침실2", 4200, 3500, 2700),
        "침실3": RoomDim("침실3", 3800, 3300, 2700),
        "주방": RoomDim("주방", 5500, 4000, 2700),
        "다이닝": RoomDim("다이닝", 4200, 3500, 2700),
        "욕실1": RoomDim("욕실1", 3000, 2400, 2700),
        "욕실2": RoomDim("욕실2", 2700, 2100, 2700),
        "욕실3": RoomDim("욕실3", 2400, 1900, 2700),
        "드레스룸1": RoomDim("드레스룸1", 3800, 2700, 2700),
        "드레스룸2": RoomDim("드레스룸2", 2700, 2100, 2700),
        "팬트리": RoomDim("팬트리", 2800, 2200, 2700),
        "서재": RoomDim("서재", 3500, 3000, 2700),
        "현관": RoomDim("현관", 3000, 2200, 2700),
        "발코니": RoomDim("발코니", 8200, 2000, 2400),
    },
}


def classify_pyeong(exclusive_area_m2: float) -> PyungType:
    """전용면적 m² → 평형 분류."""
    if exclusive_area_m2 < 50:
        return "15평"
    elif exclusive_area_m2 < 67:
        return "20평"
    elif exclusive_area_m2 < 76:
        return "24평"
    elif exclusive_area_m2 < 86:
        return "30평"
    elif exclusive_area_m2 < 100:
        return "34평"
    elif exclusive_area_m2 < 116:
        return "40평"
    else:
        return "50평"


def get_standard_rooms(pyeong: PyungType) -> dict[str, RoomDim]:
    """평형별 표준 실 치수 dict 반환."""
    return APT_STANDARD.get(pyeong, APT_STANDARD["30평"])


def get_total_area(pyeong: PyungType, exclude: tuple = ("발코니",)) -> float:
    """평형의 총 전용면적 (발코니 제외 기본)."""
    rooms = APT_STANDARD[pyeong]
    return round(sum(r.area_m2 for n, r in rooms.items() if n not in exclude), 2)


def estimate_room_dims_from_pyeong(
    pyeong_or_area: float | PyungType,
    detected_room_count: dict[str, int] | None = None,
) -> dict[str, RoomDim]:
    """평형 또는 전용면적 → 실별 표준 치수.

    Args:
        pyeong_or_area: float (전용면적 m²) 또는 PyungType ("30평" 등)
        detected_room_count: 평면도에서 인식된 실 수 (예: {"침실": 3, "욕실": 2})
                            제공 시 표준 DB 와 매칭해서 누락 추가

    Returns:
        {실명: RoomDim} 딕셔너리
    """
    if isinstance(pyeong_or_area, (int, float)):
        pyeong = classify_pyeong(float(pyeong_or_area))
    else:
        pyeong = pyeong_or_area  # type: ignore

    rooms = dict(get_standard_rooms(pyeong))

    # 인식된 실 수와 표준 DB 비교 — 누락 추가
    if detected_room_count:
        for room_type, count in detected_room_count.items():
            existing = [k for k in rooms if room_type in k]
            if len(existing) < count:
                # 누락된 실 추가 (작은 사이즈 기본)
                for i in range(len(existing), count):
                    name = f"{room_type}{i+1}" if count > 1 else room_type
                    if name not in rooms:
                        # 같은 타입의 가장 작은 거 복사
                        if existing:
                            ref = rooms[existing[-1]]
                            rooms[name] = RoomDim(name, int(ref.width_mm * 0.9), int(ref.depth_mm * 0.9), ref.height_mm)
                        else:
                            rooms[name] = RoomDim(name, 3000, 2800, 2400)

    return rooms


if __name__ == "__main__":
    import json
    print("=== 30평 표준 ===")
    for n, r in get_standard_rooms("30평").items():
        print(f"  {n}: {r.width_mm}×{r.depth_mm}mm = {r.area_m2}m² (천장고 {r.height_mm}mm)")
    print(f"\n총 전용면적 (발코니 제외): {get_total_area('30평')}m²")
    print(f"\n=== 전용 84.5m² 매칭 ===")
    print(f"평형: {classify_pyeong(84.5)}")
    rooms = estimate_room_dims_from_pyeong(84.5, {"침실": 3, "욕실": 2})
    print(json.dumps({n: {"w": r.width_mm, "d": r.depth_mm, "area": r.area_m2} for n, r in rooms.items()}, ensure_ascii=False, indent=2))
