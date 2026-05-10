"""
Image generation pipeline — model-agnostic.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md §6 (RunPod / GPU worker 설계)

Phase 5 (현재): scaffold — 실제 모델 로드는 placeholder.
Phase 6 이후: control_images로 받은 perspective canny/depth/seg를 ControlNet에 전달.

설계 원칙:
- 모델 ID는 환경변수/요청으로 동적 결정
- ControlNet 가중치는 ControlSpec.controlStrength
- LoRA는 InPick 스타일 — 학습 완료 후 마운트 (Phase 8+)
- 출력은 PIL.Image (handler가 인코딩/업로드 결정)
"""
from __future__ import annotations
import os
import time
import io
from typing import Optional, Dict, Any, List

from PIL import Image

# Phase 5에서는 lazy import — cold start는 model registry 검증 후에만
# (production guard에 막힌 모델로 12B 다운로드 방지)


# ─── 모델 캐시 (cold start 1회) ───
_PIPELINE_CACHE: Dict[str, Any] = {}
_CACHE_LOAD_TIME: Dict[str, float] = {}


def load_pipeline(model_id: str, lora_path: Optional[str] = None):
    """
    모델 파이프라인 로드 (cold start). 한번 로드한 모델은 캐시.

    Phase 5: 실제 로드는 placeholder. 실제 구현은 모델 ID별로 분기 필요.
    예: FLUX.2-klein-4b → diffusers FluxPipeline
        FLUX.1-dev → diffusers FluxControlNetPipeline (라이선스 confirm 필요)
        gpt-image-2 → 사용 X (RunPod에서는 안 돌림)
    """
    cache_key = f"{model_id}|{lora_path or ''}"
    if cache_key in _PIPELINE_CACHE:
        return _PIPELINE_CACHE[cache_key]

    t0 = time.time()
    print(f"[generate] Loading model: {model_id} (lora={lora_path})")

    # ─── Phase 5 placeholder ───
    # Phase 6+에서 실제 diffusers 로드:
    #   from diffusers import FluxPipeline, FluxControlNetPipeline
    #   pipe = FluxPipeline.from_pretrained(model_id, torch_dtype=torch.bfloat16)
    #   if lora_path: pipe.load_lora_weights(lora_path)
    pipe = _PlaceholderPipeline(model_id=model_id, lora_path=lora_path)

    elapsed = time.time() - t0
    _PIPELINE_CACHE[cache_key] = pipe
    _CACHE_LOAD_TIME[cache_key] = elapsed
    print(f"[generate] Loaded in {elapsed:.1f}s")
    return pipe


def is_cold_start(model_id: str, lora_path: Optional[str] = None) -> bool:
    cache_key = f"{model_id}|{lora_path or ''}"
    return cache_key not in _PIPELINE_CACHE


def generate_image(
    *,
    pipe,
    prompt: str,
    negative_prompt: Optional[str] = None,
    control_images: Optional[List[Image.Image]] = None,
    control_strength: float = 0.65,
    width: int = 1024,
    height: int = 1024,
    steps: int = 24,
    guidance: float = 3.5,
    seed: Optional[int] = None,
    lora_scale: Optional[float] = None,
) -> Image.Image:
    """
    이미지 생성. 단일 진입점.

    Phase 5: placeholder — 실제 모델 호출 X. dummy 1024x1024 회색 이미지 반환.
    Phase 6+: pipe.__call__로 diffusion 호출.
    """
    return pipe.run(
        prompt=prompt,
        negative_prompt=negative_prompt,
        control_images=control_images or [],
        control_strength=control_strength,
        width=width,
        height=height,
        steps=steps,
        guidance=guidance,
        seed=seed,
        lora_scale=lora_scale,
    )


# ─── Placeholder pipeline (Phase 5) ───
class _PlaceholderPipeline:
    """Phase 5 — 실제 모델 없이 메타만 반환하는 더미. 호출 시 회색 이미지."""

    def __init__(self, model_id: str, lora_path: Optional[str] = None):
        self.model_id = model_id
        self.lora_path = lora_path

    def run(
        self,
        *,
        prompt: str,
        negative_prompt: Optional[str],
        control_images: List[Image.Image],
        control_strength: float,
        width: int,
        height: int,
        steps: int,
        guidance: float,
        seed: Optional[int],
        lora_scale: Optional[float],
    ) -> Image.Image:
        # debug 로그
        print(
            f"[generate:placeholder] model={self.model_id} "
            f"prompt_len={len(prompt)} controls={len(control_images)} "
            f"size={width}x{height} steps={steps} seed={seed}"
        )
        # Phase 5 — 실제 diffusion 미구현. 회색 이미지 + 메타 텍스트.
        img = Image.new("RGB", (width, height), color=(180, 180, 185))
        # PIL ImageDraw로 디버그 텍스트 (옵션)
        try:
            from PIL import ImageDraw

            draw = ImageDraw.Draw(img)
            draw.text(
                (16, 16),
                f"Phase 5 placeholder\nmodel: {self.model_id}\nseed: {seed}",
                fill=(40, 40, 40),
            )
        except Exception:
            pass
        return img
