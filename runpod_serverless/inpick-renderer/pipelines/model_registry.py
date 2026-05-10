"""
Model registry — license/runtime guard.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md
       §5 (모델 정책), §6 (PoC vs production)

목적:
- 모델 ID마다 license 메타데이터 보유
- production 모드에서는 license=production 허용 모델만 사용
- FLUX.1-dev는 production=False (commercial-license-required) — 기본 차단

대응 src/lib/inpick/image-backends/model-policy.ts:
- 같은 정책을 양쪽에서 enforce. JSON 형식 변동 없으면 동일 결과.
"""
import os
from typing import Dict, Any, Optional


# license tier:
#   "production" — 상업/제품 사용 가능
#   "research_only" — 비상업/내부 PoC만
#   "commercial_license_required" — 별도 계약 필요
MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    # FLUX.1-dev: 비상업 (가이드 §5 명시)
    "black-forest-labs/FLUX.1-dev": {
        "license": "commercial_license_required",
        "production": False,
        "vendor": "BFL",
        "params_b": 12,
        "notes": "FLUX.1-dev — production 사용 시 BFL 상업 라이선스 필수",
    },
    # FLUX.2-klein-4b: Apache 2.0 권장 (가이드 §5)
    "black-forest-labs/FLUX.2-klein-4b": {
        "license": "apache-2.0",
        "production": True,
        "vendor": "BFL",
        "params_b": 4,
        "notes": "Production 허용 모델 (가이드 권장 default)",
    },
    # 기존 OpenAI gpt-image-2 (현재 production)
    "gpt-image-2": {
        "license": "openai-tos",
        "production": True,
        "vendor": "OpenAI",
        "params_b": None,
        "notes": "현재 production 백엔드 default",
    },
    # 추후 추가 가능: stable-diffusion-xl, hunyuan-dit 등
}


def lookup_model(model_id: str) -> Optional[Dict[str, Any]]:
    """모델 메타 조회. 미등록이면 None."""
    return MODEL_REGISTRY.get(model_id)


def is_production_runtime() -> bool:
    """
    환경변수 RENDERER_RUNTIME=production이면 True.
    그 외 (PoC/dev) False.
    """
    return os.environ.get("RENDERER_RUNTIME", "poc").lower() == "production"


def is_commercial_license_confirmed() -> bool:
    """
    BFL 상업 라이선스 confirm 환경변수.
    BFL_COMMERCIAL_LICENSE_CONFIRMED=true로 설정해야 FLUX.1-dev production 허용.
    """
    return os.environ.get("BFL_COMMERCIAL_LICENSE_CONFIRMED", "").lower() == "true"


def assert_model_allowed(model_id: str) -> None:
    """
    Production runtime에서 license가 production이 아니면 차단.
    PoC runtime에서는 모든 모델 허용 (warn 로그만).

    가이드 §5: FLUX.1-dev production 기본값 금지.
    """
    meta = lookup_model(model_id)
    if not meta:
        # 미등록 모델 — production에서 거부, PoC에서는 경고
        if is_production_runtime():
            raise PermissionError(
                f"Model '{model_id}' not in registry. Production runtime requires registered model."
            )
        print(f"[model-registry] WARN: unregistered model '{model_id}' (PoC allowed)")
        return

    runtime = "production" if is_production_runtime() else "poc"

    if runtime == "production" and not meta.get("production", False):
        # 예외: BFL_COMMERCIAL_LICENSE_CONFIRMED=true이면 commercial_license_required도 허용
        if (
            meta.get("license") == "commercial_license_required"
            and is_commercial_license_confirmed()
        ):
            print(
                f"[model-registry] OK: '{model_id}' commercial license confirmed via env"
            )
            return
        raise PermissionError(
            f"Model '{model_id}' license='{meta.get('license')}' "
            f"not allowed in production runtime. "
            f"Set BFL_COMMERCIAL_LICENSE_CONFIRMED=true if you have a license."
        )

    # 통과
    print(
        f"[model-registry] OK: '{model_id}' license='{meta.get('license')}' runtime={runtime}"
    )


def get_default_model() -> str:
    """
    환경변수 INPICK_IMAGE_MODEL_ID 우선. 없으면 production 안전 default.
    가이드 §5 권장: FLUX.2-klein-4b (apache-2.0).
    """
    return os.environ.get("INPICK_IMAGE_MODEL_ID", "black-forest-labs/FLUX.2-klein-4b")
