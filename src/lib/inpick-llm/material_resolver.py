"""자재명 텍스트 → Supabase 자재 DB 매칭 + LLM fallback.

InPick 자체 LLM이 추출한 자재명 (예: "오크 원목마루 12T 헤링본 패턴")을
Supabase의 material_price_lookup·aux_materials_master 등에서 검색하여
브랜드·가격·KS 코드·규격 정보를 반환. 매칭 실패 시 Claude API 로 일반 정보 추론.

스키마 (반환):
{
  "query": "원본 자재명",
  "matched": true/false,
  "source": "supabase_lookup|aux_master|llm_fallback",
  "confidence": 0.0~1.0,
  "name": "정규화된 자재명",
  "brand": "LX하우시스|KCC|한솔|...|null",
  "ks_code": "KS F 3110|null",
  "thickness_mm": 12,
  "unit_price_won": 95000,
  "unit": "m²|m|EA|set",
  "spec": "헤링본 패턴, 오크 색상",
  "alternatives": ["..."],
  "notes": ""
}

사용:
  from material_resolver import resolve_materials
  results = resolve_materials([
      {"surface": "floor", "material": "오크 원목마루 12T"},
      {"surface": "wall", "material": "포세린 타일 600x600"},
  ])

환경:
  • DATABASE_URL 또는 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  • ANTHROPIC_API_KEY (LLM fallback용)
"""
from __future__ import annotations
import json
import os
import re
import time
from dataclasses import dataclass, asdict
from typing import Iterable

# Supabase / Postgres 연결
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None


# ── DB 연결 ────────────────────────────────────────────────────────────
_conn = None


def get_conn():
    global _conn
    if _conn is not None and not _conn.closed:
        return _conn
    if psycopg2 is None:
        raise RuntimeError("psycopg2 미설치 — pip install psycopg2-binary")
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("DATABASE_URL 환경변수 없음")
    _conn = psycopg2.connect(url)
    return _conn


# ── 데이터 클래스 ─────────────────────────────────────────────────────
@dataclass
class MaterialResolution:
    query: str
    matched: bool
    source: str
    confidence: float
    name: str
    brand: str | None
    ks_code: str | None
    thickness_mm: int | None
    unit_price_won: int | None
    unit: str
    spec: str
    alternatives: list[str]
    notes: str

    def to_dict(self) -> dict:
        return asdict(self)


# ── 자재명 정규화 ────────────────────────────────────────────────────
KOREAN_SYNONYMS = {
    "원목마루": ["원목", "마루", "engineered wood", "wood floor"],
    "강마루": ["라미네이트", "laminate"],
    "포세린타일": ["포세린", "porcelain", "도자기타일"],
    "대리석": ["marble", "마블"],
    "도장": ["페인트", "paint"],
    "벽지": ["wallpaper"],
    "강화유리": ["tempered glass"],
}


def normalize_name(text: str) -> str:
    """자재명에서 핵심 키워드 추출 (검색용)."""
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[()\[\]\"',.]", " ", text)
    return text


def extract_keywords(text: str) -> list[str]:
    """검색 키워드 후보 (한국어·영어 혼합)."""
    keywords = []
    norm = normalize_name(text)
    for canonical, syns in KOREAN_SYNONYMS.items():
        if canonical in norm or any(s in norm for s in syns):
            keywords.append(canonical)
    # 두께 (12T, 18mm)
    m = re.search(r"(\d{1,3})\s*(?:t|mm|티)\b", norm)
    thickness = int(m.group(1)) if m else None
    # 색상·재질 키워드
    for kw in ("오크", "월넛", "메이플", "체리", "헤링본", "마블",
               "그레이", "화이트", "블랙", "베이지", "브라운",
               "무광", "유광", "광택", "아이보리"):
        if kw in norm:
            keywords.append(kw)
    return keywords or [norm]


# ── DB 매칭 ─────────────────────────────────────────────────────────
def search_supabase(material: str) -> dict | None:
    """material_price_lookup + aux_materials_master 에서 검색."""
    try:
        conn = get_conn()
    except Exception as e:
        return None

    keywords = extract_keywords(material)
    norm = normalize_name(material)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 1) material_price_lookup 정확 매칭
        cur.execute(
            """
            SELECT category, subcategory, brand, product_name, ks_code,
                   thickness_mm, unit_price_min, unit_price_max, unit, spec
            FROM material_price_lookup
            WHERE LOWER(product_name) ILIKE %s
               OR LOWER(subcategory) ILIKE %s
            ORDER BY similarity(LOWER(product_name), %s) DESC NULLS LAST
            LIMIT 5
            """,
            (f"%{norm}%", f"%{norm}%", norm),
        )
        rows = cur.fetchall()
        if rows:
            top = rows[0]
            avg_price = None
            if top.get("unit_price_min") and top.get("unit_price_max"):
                avg_price = (top["unit_price_min"] + top["unit_price_max"]) // 2
            return {
                "matched": True,
                "source": "supabase_lookup",
                "confidence": 0.85,
                "name": top.get("product_name") or top.get("subcategory"),
                "brand": top.get("brand"),
                "ks_code": top.get("ks_code"),
                "thickness_mm": top.get("thickness_mm"),
                "unit_price_won": avg_price,
                "unit": top.get("unit") or "m²",
                "spec": top.get("spec") or "",
                "alternatives": [r.get("product_name") for r in rows[1:4] if r.get("product_name")],
                "notes": "",
            }

        # 2) aux_materials_master fallback (부자재 매칭)
        cur.execute(
            """
            SELECT trade_code, master_code, name_ko, unit, default_price
            FROM aux_materials_master
            WHERE LOWER(name_ko) ILIKE %s
            ORDER BY similarity(LOWER(name_ko), %s) DESC NULLS LAST
            LIMIT 3
            """,
            (f"%{norm}%", norm),
        )
        rows = cur.fetchall()
        if rows:
            top = rows[0]
            return {
                "matched": True,
                "source": "aux_master",
                "confidence": 0.70,
                "name": top["name_ko"],
                "brand": None,
                "ks_code": None,
                "thickness_mm": None,
                "unit_price_won": top.get("default_price"),
                "unit": top.get("unit") or "EA",
                "spec": "",
                "alternatives": [r["name_ko"] for r in rows[1:]],
                "notes": f"부자재 ({top.get('trade_code')})",
            }

    return None


# ── LLM Fallback ──────────────────────────────────────────────────
LLM_SYSTEM = """당신은 한국 인테리어 자재 전문가입니다. 자재명이 주어지면 다음 JSON 스키마로만 응답:

{
  "name": "정규화된 자재명",
  "category": "FLOORING|WALL|CEILING|FIXTURE|FINISH|OTHER",
  "estimated_unit_price_won": 0,  // 한국 시세 평균
  "unit": "m²|m|EA|set",
  "ks_code_guess": "",
  "thickness_mm": 0,
  "spec": "주요 특성·패턴·색상",
  "common_brands_kr": ["LX하우시스","KCC","한솔홈데코","..."],
  "notes": "추정 근거"
}
"""


def llm_fallback(material: str) -> dict | None:
    """Claude API 로 자재 정보 추론 (DB 매칭 실패 시)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
    except ImportError:
        return None

    client = anthropic.Anthropic(api_key=api_key)
    try:
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=LLM_SYSTEM,
            messages=[{"role": "user", "content": f"자재명: {material}"}],
        )
        text = msg.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        data = json.loads(text)
        return {
            "matched": False,
            "source": "llm_fallback",
            "confidence": 0.55,
            "name": data.get("name") or material,
            "brand": (data.get("common_brands_kr") or [None])[0],
            "ks_code": data.get("ks_code_guess"),
            "thickness_mm": data.get("thickness_mm"),
            "unit_price_won": data.get("estimated_unit_price_won"),
            "unit": data.get("unit") or "m²",
            "spec": data.get("spec") or "",
            "alternatives": data.get("common_brands_kr", [])[1:4],
            "notes": data.get("notes", ""),
        }
    except Exception:
        return None


# ── 메인 진입점 ────────────────────────────────────────────────────
def resolve_one(material_text: str) -> MaterialResolution:
    """자재명 1개 → MaterialResolution."""
    text = material_text.strip()
    if not text:
        return MaterialResolution(
            query=text, matched=False, source="empty", confidence=0,
            name="", brand=None, ks_code=None, thickness_mm=None,
            unit_price_won=None, unit="m²", spec="",
            alternatives=[], notes="빈 입력",
        )

    res = search_supabase(text)
    if not res:
        res = llm_fallback(text)
    if not res:
        return MaterialResolution(
            query=text, matched=False, source="no_match", confidence=0,
            name=text, brand=None, ks_code=None, thickness_mm=None,
            unit_price_won=None, unit="m²", spec="",
            alternatives=[], notes="DB·LLM 모두 실패",
        )

    return MaterialResolution(
        query=text,
        matched=res["matched"],
        source=res["source"],
        confidence=res["confidence"],
        name=res["name"],
        brand=res.get("brand"),
        ks_code=res.get("ks_code"),
        thickness_mm=res.get("thickness_mm"),
        unit_price_won=res.get("unit_price_won"),
        unit=res.get("unit") or "m²",
        spec=res.get("spec") or "",
        alternatives=res.get("alternatives") or [],
        notes=res.get("notes") or "",
    )


def resolve_materials(items: Iterable[str | dict]) -> list[MaterialResolution]:
    """여러 자재명 일괄 처리.
    items 는 자재명 문자열 list 또는 {"surface": ..., "material": ...} dict list."""
    out = []
    for it in items:
        if isinstance(it, dict):
            text = it.get("material") or it.get("name") or ""
        else:
            text = str(it)
        out.append(resolve_one(text))
    return out


if __name__ == "__main__":
    # 빠른 테스트
    samples = [
        "오크 원목마루 12T 헤링본 패턴",
        "포세린 타일 600x600",
        "도무스암 Fendi White Matt 포세린 타일",
        "모르는자재xyz123",
    ]
    print(json.dumps(
        [r.to_dict() for r in resolve_materials(samples)],
        ensure_ascii=False, indent=2,
    ))
