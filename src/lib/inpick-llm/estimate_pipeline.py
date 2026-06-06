"""End-to-end 파이프라인: InPick LLM 분석 텍스트 → DB 매칭 → 물량 → 견적.

사용:
  from estimate_pipeline import full_estimate_from_response

  response_text = "..."  # InPick 자체 LLM 의 도면 분석 응답
  result = full_estimate_from_response(response_text)
  print(result["estimate"]["total_won"])
  print(result["estimate"]["main_items"])

이 파이프라인은 inpick_demo_app.py / Next.js API route 에서 호출 가능.
"""
from __future__ import annotations
import json
import re
from typing import Any

from material_resolver import resolve_materials
from quantity_calculator import build_estimate


# ── 응답 파싱 ────────────────────────────────────────────────────
DIM_PATTERN = re.compile(
    r"폭\s*([\d,]+)\s*mm\s*[×x]\s*높이\s*([\d,]+)\s*mm",
)
MATERIAL_LINE = re.compile(
    r"^[-•·]\s*(?P<surface>floor|wall|ceiling|fixture)\s*:\s*(?P<material>.+)$",
    re.I | re.M,
)


def parse_dimensions(text: str) -> dict | None:
    m = DIM_PATTERN.search(text)
    if m:
        return {
            "width": int(m.group(1).replace(",", "")),
            "height": int(m.group(2).replace(",", "")),
            "depth": 0,
        }
    return None


def parse_surface_materials(text: str) -> list[dict]:
    out = []
    for m in MATERIAL_LINE.finditer(text):
        out.append({
            "surface": m.group("surface").lower(),
            "material": m.group("material").strip(),
        })

    # surface 별 line이 없으면 "자재: a, b, c" 형태에서 surface 추정
    if not out:
        m = re.search(r"자재\s*[:：]\s*([^\n|]{3,200})", text)
        if m:
            tokens = [t.strip() for t in re.split(r"[,，·•·、]\s*", m.group(1)) if t.strip()]
            for t in tokens:
                surface = "wall"  # default
                if any(k in t for k in ("마루", "타일", "바닥", "floor")):
                    surface = "floor"
                elif any(k in t for k in ("천장", "ceiling")):
                    surface = "ceiling"
                out.append({"surface": surface, "material": t})
    return out


# ── 메인 진입점 ───────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.70  # 이 이하면 Claude Sonnet 으로 자동 재시도


def claude_fallback_analyze(image_path: str, original_response: str) -> dict | None:
    """InPick 모델 응답이 신뢰도 낮을 때 Claude Sonnet 4.6 으로 재분석.
    Hermes 권장: 데모에서 엉터리 견적 방지 + human-in-the-loop 신호."""
    import os
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not image_path:
        return None
    try:
        import anthropic, base64, mimetypes
        client = anthropic.Anthropic(api_key=api_key)
        img_bytes = open(image_path, "rb").read()
        mime = mimetypes.guess_type(image_path)[0] or "image/jpeg"
        b64 = base64.standard_b64encode(img_bytes).decode("ascii")
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            system=(
                "당신은 한국 인테리어·건축 전문가입니다. 주어진 도면/사진을 보고 "
                "다음 JSON 스키마로만 응답하세요:\n"
                "{\n"
                '  "공간_정보": {"타입":"거실|침실|...","면적_추정":"00m²","천장고":"2.4m"},\n'
                '  "자재_상세": [\n'
                '    {"위치":"바닥|벽|천장|...","자재명":"구체명","브랜드":"LX/한솔/KCC/...|null",\n'
                '     "스펙":"두께/규격","SKU":"추정 코드","단가_per_sqm":원,"신뢰도":0~1}\n'
                "  ],\n"
                '  "fallback_reason": "InPick 1차 분석 신뢰도 부족"\n'
                "}"
            ),
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}},
                    {"type": "text", "text": f"InPick 1차 분석 결과 (낮은 신뢰도):\n{original_response[:1000]}\n\n위 결과를 보완해서 스키마대로 답하세요."},
                ],
            }],
        )
        text = msg.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        return {"error": str(e)[:200]}


def full_estimate_from_response(
    llm_response: str,
    *,
    image_path: str | None = None,  # fallback 호출용
    include_aux: bool = True,
    labor_rate_pct: float = 0.30,
    enable_fallback: bool = True,
) -> dict[str, Any]:
    """InPick LLM 의 텍스트 응답 → 완전 견적 dict.

    반환:
    {
      "analysis": {
         "dimensions_mm": {...},
         "refined_materials": [...],
      },
      "resolved": [{materialResolver 결과}, ...],
      "estimate": {Estimate.to_dict()},
    }
    """
    analysis = {
        "dimensions_mm": parse_dimensions(llm_response) or {"width": 0, "height": 0, "depth": 0},
        "refined_materials": parse_surface_materials(llm_response),
    }

    if not analysis["refined_materials"]:
        return {
            "analysis": analysis,
            "resolved": [],
            "estimate": {
                "main_items": [],
                "aux_items": [],
                "total_won": 0,
                "confidence": 0,
                "warnings": ["응답 텍스트에서 자재 추출 실패 — 모델 응답 형식 확인 필요"],
            },
        }

    resolved = resolve_materials([m["material"] for m in analysis["refined_materials"]])
    estimate = build_estimate(
        analysis, resolved,
        include_aux=include_aux,
        labor_rate_pct=labor_rate_pct,
    )

    result = {
        "analysis": analysis,
        "resolved": [r.to_dict() for r in resolved],
        "estimate": estimate.to_dict(),
        "fallback_used": False,
    }

    # Hermes 권장: 신뢰도 낮으면 Claude Sonnet 으로 자동 재시도
    if enable_fallback and image_path and estimate.confidence < CONFIDENCE_THRESHOLD:
        fb = claude_fallback_analyze(image_path, llm_response)
        if fb and "error" not in fb:
            result["fallback_used"] = True
            result["fallback_response"] = fb
            # fallback 결과의 자재로 견적 재계산
            fb_materials = fb.get("자재_상세") or []
            if fb_materials:
                fb_analysis = {
                    "dimensions_mm": analysis["dimensions_mm"],
                    "refined_materials": [
                        {"surface": m.get("위치", "wall"), "material": m.get("자재명", "")}
                        for m in fb_materials
                    ],
                }
                fb_resolved = resolve_materials([m["material"] for m in fb_analysis["refined_materials"]])
                fb_estimate = build_estimate(fb_analysis, fb_resolved, include_aux=include_aux, labor_rate_pct=labor_rate_pct)
                result["estimate_fallback"] = fb_estimate.to_dict()
                result["resolved_fallback"] = [r.to_dict() for r in fb_resolved]

    return result


if __name__ == "__main__":
    sample_response = """본 도면은 거실의 입면도로, 폭 4,500mm × 높이 2,400mm 규모입니다.
스타일: modern.
한국 미감: 정갈함·단아함.

주요 자재:
- floor: 오크 원목마루 12T 헤링본 패턴 (#A88964, KS F 3110, 등급 A)
- wall: 도장 무광 화이트 (#F5F5F5)
- ceiling: 석고보드 9.5T + 무광 도장 화이트
- fixture: 빌트인 조명 (LED 다운라이트)

벽체 판정:
- W1: NON_BEARING (신뢰도 0.85) — 두께 100mm, 가구 배치 벽

공종 코드: ARCH_INT, PAINT, ELEC, CARP

해설: 거실 입면도로 도장 무광 화이트 베이스에 원목마루 헤링본 포인트.
"""
    result = full_estimate_from_response(sample_response)
    print(json.dumps(result, ensure_ascii=False, indent=2))
