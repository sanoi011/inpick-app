"""물량 산출 + 견적 계산 모듈.

InPick 자체 LLM 의 도면 분석 결과 (치수 + surface별 자재) 를 받아:
  1. surface별 면적 계산 (벽·바닥·천장)
  2. 자재 단가 곱셈 → 주자재 비용
  3. aux_material_coefficients 조회 → 부자재 자동 산출 (본드·몰딩 등)
  4. 합계 견적 + 견적서 dict 반환

사용:
  from material_resolver import resolve_materials
  from quantity_calculator import build_estimate

  analysis = {
      "dimensions_mm": {"width": 4500, "height": 2400, "depth": 600},
      "refined_materials": [
          {"surface": "floor", "material": "오크 원목마루 12T 헤링본"},
          {"surface": "wall",  "material": "도장 마감 무광 화이트"},
      ],
  }
  resolved = resolve_materials([m["material"] for m in analysis["refined_materials"]])
  estimate = build_estimate(analysis, resolved)
  print(estimate["total_won"])
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict, field

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

from material_resolver import MaterialResolution, get_conn


# 일위대가 surface→공종 매핑 (국토부 건설공사 표준품셈 기반)
SURFACE_TO_TRADE = {
    "floor": "FLOOR",       # 바닥재 시공
    "wall": "WALL",         # 벽 마감 (도배·도장·타일)
    "ceiling": "CEIL",      # 천장 마감
    "fixture": "FIX",       # 위생기구 설치
}


def _fetch_labor_unit_price(trade_code: str, material_keyword: str) -> int:
    """Supabase labor_unit_price_lookup 에서 공종별 일위대가 조회 (원/m² 또는 원/EA).
    fallback: 국토부 표준품셈 평균값 하드코딩."""
    # TODO: Supabase 테이블 labor_unit_price_lookup 신설 후 조회 (대표 검수 필요)
    # 임시 fallback — 2026 국토부 일위대가 평균
    FALLBACK = {
        ("FLOOR", "마루"): 18000,    # 강마루 시공 원/m²
        ("FLOOR", "타일"): 35000,    # 타일 시공
        ("FLOOR", "원목"): 28000,
        ("WALL", "도배"): 8000,      # 실크/합지 도배
        ("WALL", "도장"): 12000,
        ("WALL", "타일"): 40000,
        ("CEIL", "도장"): 10000,
        ("CEIL", "석고"): 15000,
        ("FIX", "변기"): 80000,      # EA
        ("FIX", "세면대"): 60000,
        ("FIX", "싱크대"): 200000,
    }
    for (t, kw), price in FALLBACK.items():
        if t == trade_code and kw in material_keyword:
            return price
    # 미매칭 → 공종 평균
    AVG = {"FLOOR": 25000, "WALL": 15000, "CEIL": 12000, "FIX": 100000}
    return AVG.get(trade_code, 18000)


def _calc_labor_molit(main_items: list) -> int:
    """국토부 일위대가 기준 인건비 합계."""
    total = 0
    for item in main_items:
        trade = SURFACE_TO_TRADE.get(item.surface.lower(), "WALL")
        unit_price = _fetch_labor_unit_price(trade, item.material_name)
        total += int(item.quantity * unit_price)
    return total


# ── 면적 계산 ─────────────────────────────────────────────────────
def area_for_surface(surface: str, w_mm: int, h_mm: int, d_mm: int = 0) -> float:
    """surface 별 면적 m² 산출 (단순화: 입면도/평면도 단면)."""
    w_m = w_mm / 1000.0
    h_m = h_mm / 1000.0
    d_m = d_mm / 1000.0 if d_mm else w_m  # depth 없으면 width 가정 (정사각형 방)

    s = surface.lower()
    if s == "floor":
        return round(w_m * d_m, 3)
    if s == "ceiling":
        return round(w_m * d_m, 3)
    if s == "wall":
        return round(w_m * h_m, 3)  # 단일 벽 기준
    if s == "fixture":
        return 1.0  # 1 EA 기본
    return round(w_m * h_m, 3)


# ── aux_material_coefficients 조회 ──────────────────────────────
def get_aux_for_master(master_code: str | None, name_hint: str) -> list[dict]:
    """주자재 master_code 또는 이름으로 부자재·계수 조회."""
    if psycopg2 is None:
        return []
    try:
        conn = get_conn()
    except Exception:
        return []

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if master_code:
            cur.execute(
                """
                SELECT c.aux_master_code, c.coefficient, c.unit, c.note,
                       m.name_ko, m.default_price
                FROM aux_material_coefficients c
                JOIN aux_materials_master m ON m.master_code = c.aux_master_code
                WHERE c.main_material_code = %s
                """,
                (master_code,),
            )
            return [dict(r) for r in cur.fetchall()]
        # 이름 hint 로 매칭
        cur.execute(
            """
            SELECT c.aux_master_code, c.coefficient, c.unit, c.note,
                   m.name_ko, m.default_price
            FROM aux_material_coefficients c
            JOIN aux_materials_master m ON m.master_code = c.aux_master_code
            WHERE c.main_material_code IN (
                SELECT master_code FROM aux_materials_master
                WHERE LOWER(name_ko) ILIKE %s LIMIT 1
            )
            """,
            (f"%{name_hint.lower()}%",),
        )
        return [dict(r) for r in cur.fetchall()]


# ── 견적 항목 ─────────────────────────────────────────────────────
@dataclass
class LineItem:
    surface: str
    material_name: str
    brand: str | None
    spec: str
    quantity: float
    unit: str
    unit_price_won: int | None
    subtotal_won: int
    source: str           # supabase_lookup|aux_master|llm_fallback|no_match
    confidence: float
    notes: str = ""


@dataclass
class Estimate:
    main_items: list[LineItem] = field(default_factory=list)
    aux_items: list[LineItem] = field(default_factory=list)
    main_total_won: int = 0
    aux_total_won: int = 0
    labor_total_won: int = 0
    total_won: int = 0
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "main_items": [asdict(i) for i in self.main_items],
            "aux_items": [asdict(i) for i in self.aux_items],
            "main_total_won": self.main_total_won,
            "aux_total_won": self.aux_total_won,
            "labor_total_won": self.labor_total_won,
            "total_won": self.total_won,
            "confidence": self.confidence,
            "warnings": self.warnings,
        }


# ── 메인 빌드 ─────────────────────────────────────────────────────
AUX_RATE_PCT = 0.10  # 부자재 = 주자재비의 10% (대표 명시 2026-05-03)
# 인건비는 국토부 일위대가 (건설공사 표준품셈) 따름 — labor_unit_price_lookup 테이블 참조
# 일위대가 = 공종별 표준 작업단가 (목공·도장·타일·미장·전기 등)


def build_estimate(
    analysis: dict,
    resolved: list[MaterialResolution],
    *,
    include_aux: bool = True,
    labor_mode: str = "molit_unit",  # "molit_unit" = 국토부 일위대가, "fixed_pct" = 고정비율 (deprecated)
    labor_rate_pct: float = 0.30,    # labor_mode="fixed_pct" 일 때만 사용 (deprecated)
) -> Estimate:
    """도면 분석 결과 + 매칭된 자재 → 견적.

    analysis: {
      "dimensions_mm": {"width", "height", "depth"},
      "refined_materials": [{"surface", "material", ...}, ...],
    }
    resolved: material_resolver.resolve_materials 결과 (analysis.refined_materials 와 같은 순서)
    """
    est = Estimate()
    dims = analysis.get("dimensions_mm") or {}
    w = int(dims.get("width") or 0)
    h = int(dims.get("height") or 0)
    d = int(dims.get("depth") or 0)

    if not (w and h):
        est.warnings.append("치수 정보 없음 — 면적 추정 불가, 수량 1 EA 가정")

    refined = analysis.get("refined_materials") or []
    if len(refined) != len(resolved):
        est.warnings.append(f"분석/매칭 길이 불일치 ({len(refined)} vs {len(resolved)})")

    confidences: list[float] = []

    for raw, res in zip(refined, resolved):
        surface = raw.get("surface", "wall").lower()
        if w and h:
            area = area_for_surface(surface, w, h, d)
        else:
            area = 1.0

        unit_price = res.unit_price_won or 0
        subtotal = int(area * unit_price)

        item = LineItem(
            surface=surface,
            material_name=res.name or res.query,
            brand=res.brand,
            spec=res.spec,
            quantity=area,
            unit=res.unit,
            unit_price_won=res.unit_price_won,
            subtotal_won=subtotal,
            source=res.source,
            confidence=res.confidence,
            notes=res.notes,
        )
        est.main_items.append(item)
        est.main_total_won += subtotal
        confidences.append(res.confidence)

        # 부자재 자동 산출 — 대표 명시: 부자재 = 주자재비의 10% 고정
        if include_aux:
            aux_rows = get_aux_for_master(None, res.name or res.query)
            if aux_rows:
                # DB 매칭된 부자재 항목별 표시
                for aux in aux_rows:
                    qty = round(area * float(aux.get("coefficient") or 0), 3)
                    price = int(aux.get("default_price") or 0)
                    aux_sub = int(qty * price)
                    est.aux_items.append(LineItem(
                        surface=surface,
                        material_name=aux["name_ko"],
                        brand=None,
                        spec=aux.get("note") or "",
                        quantity=qty,
                        unit=aux.get("unit") or "EA",
                        unit_price_won=price,
                        subtotal_won=aux_sub,
                        source="aux_coefficient",
                        confidence=0.7,
                        notes=f"주자재 1{res.unit} → ×{aux.get('coefficient')}",
                    ))
                    est.aux_total_won += aux_sub
            # 항목 매칭 안 된 잔여 — 주자재의 10% 단순 가산
            min_aux_pct = int(subtotal * AUX_RATE_PCT)
            if est.aux_total_won < min_aux_pct:
                gap = min_aux_pct - est.aux_total_won
                est.aux_items.append(LineItem(
                    surface=surface,
                    material_name=f"{res.name or res.query} 부자재 일괄 (10%)",
                    brand=None, spec="대표 산정 기준 (몰딩·본드·실링 등)",
                    quantity=1, unit="set",
                    unit_price_won=gap, subtotal_won=gap,
                    source="aux_pct_10", confidence=0.85,
                    notes="주자재 단가의 10% (대표 명시 견적 기준)",
                ))
                est.aux_total_won += gap

    # 인건비 산정 — 국토부 일위대가 (Supabase labor_unit_price_lookup 테이블)
    # main_items 의 surface/공종별 면적·수량 → 일위대가 단가 곱셈
    if labor_mode == "molit_unit":
        est.labor_total_won = _calc_labor_molit(est.main_items)
    else:
        # fallback (deprecated, 비율식)
        materials_total = est.main_total_won + est.aux_total_won
        est.labor_total_won = int(materials_total * labor_rate_pct)
    est.total_won = est.main_total_won + est.aux_total_won + est.labor_total_won

    est.confidence = round(
        sum(confidences) / len(confidences), 2
    ) if confidences else 0.0

    if est.main_total_won == 0 and est.main_items:
        est.warnings.append("자재 매칭은 됐지만 단가 없음 — 단가 DB 보강 필요")

    return est


# ── CLI 빠른 테스트 ──────────────────────────────────────────────
if __name__ == "__main__":
    from material_resolver import resolve_materials

    sample = {
        "dimensions_mm": {"width": 4500, "height": 2400, "depth": 3500},
        "refined_materials": [
            {"surface": "floor", "material": "오크 원목마루 12T 헤링본 패턴"},
            {"surface": "wall",  "material": "도장 마감 무광 화이트"},
            {"surface": "ceiling", "material": "석고보드 + 도장"},
        ],
    }
    resolved = resolve_materials([m["material"] for m in sample["refined_materials"]])
    est = build_estimate(sample, resolved)
    print(json.dumps(est.to_dict(), ensure_ascii=False, indent=2))
    print(f"\n총 견적: ₩{est.total_won:,}")
    print(f"신뢰도: {est.confidence:.0%}")
