"""RunPod Serverless Worker — Flux.1-dev + ControlNet (Canny) + InPick LoRA (옵션).

가이드: README_DEPLOY.md
사용 시점: gpt-image-2 백엔드 대안 (IMAGE_GEN_BACKEND=runpod)

요청 입력:
{
  "input": {
    "prompt": "Empty Korean apartment living room, 2026 minimal style, ...",
    "floorplan_image_b64": "...",          # 평면도 이미지 base64 (PNG)
    "width": 1024,                          # 출력 가로
    "height": 1024,                         # 출력 세로
    "controlnet_strength": 0.8,             # Canny 영향도 (0.0~1.0)
    "lora_scale": 0.7,                      # InPick LoRA 영향도 (0.0~1.0)
    "steps": 28,                            # diffusion steps (Flux 권장 28)
    "guidance_scale": 3.5,                  # CFG (Flux 권장 3.5)
    "seed": -1                              # -1 = random
  }
}

응답:
{
  "imageUrl": "data:image/png;base64,...",  # 또는 Storage URL
  "model": "flux-controlnet-canny",
  "costUsd": 0.02,                          # 추정
  "elapsed_ms": 12500
}
"""
import os
import io
import time
import base64
import traceback

import runpod
import torch
import numpy as np
from PIL import Image
import cv2


# ════════════════════════════════════════════════════════════════════════════
# 모델 로드 (cold start 1회)
# ════════════════════════════════════════════════════════════════════════════
print("[InPick Flux Worker] Loading models...")
_LOAD_START = time.time()

device = "cuda" if torch.cuda.is_available() else "cpu"

# Flux + ControlNet 파이프라인 (diffusers)
# 주의: Flux는 12B params — H100 80GB 권장 (또는 Q4 양자화로 A100 40GB)
from diffusers import FluxControlNetPipeline, FluxControlNetModel
from diffusers.utils import load_image

FLUX_MODEL = os.environ.get("FLUX_MODEL", "black-forest-labs/FLUX.1-dev")
CONTROLNET_MODEL = os.environ.get(
    "CONTROLNET_MODEL", "InstantX/FLUX.1-dev-Controlnet-Canny"
)
LORA_PATH = os.environ.get("INPICK_LORA_PATH", "")  # 학습 완료 후 마운트

print(f"  Flux base: {FLUX_MODEL}")
print(f"  ControlNet: {CONTROLNET_MODEL}")
print(f"  Device: {device}")

controlnet = FluxControlNetModel.from_pretrained(
    CONTROLNET_MODEL, torch_dtype=torch.bfloat16
)
pipe = FluxControlNetPipeline.from_pretrained(
    FLUX_MODEL, controlnet=controlnet, torch_dtype=torch.bfloat16
)
pipe.to(device)
pipe.enable_model_cpu_offload()  # H100 80GB 미만 시 메모리 절약

# InPick LoRA 자동 로드 (있으면)
if LORA_PATH and os.path.isdir(LORA_PATH):
    try:
        pipe.load_lora_weights(LORA_PATH)
        print(f"  ✓ InPick LoRA loaded: {LORA_PATH}")
    except Exception as e:
        print(f"  ✗ LoRA load failed (using base): {e}")
elif LORA_PATH:
    print(f"  ! LoRA path set but not found: {LORA_PATH}")
else:
    print("  - LoRA not configured (using base Flux only)")

print(f"[InPick Flux Worker] Models loaded in {time.time() - _LOAD_START:.1f}s")


# ════════════════════════════════════════════════════════════════════════════
# 유틸
# ════════════════════════════════════════════════════════════════════════════
def decode_image_b64(image_b64: str) -> Image.Image:
    """base64 → PIL Image (RGB)."""
    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]
    image_bytes = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def encode_image_b64(image: Image.Image) -> str:
    """PIL Image → base64 PNG."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode()


def extract_canny(image: Image.Image, low: int = 100, high: int = 200) -> Image.Image:
    """평면도 → Canny edge (벽/문/창 구조선 강조)."""
    arr = np.array(image)
    if arr.shape[-1] == 4:
        arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2RGB)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    # 평면도는 보통 흰 배경 + 검은 선이라 적당한 임계값
    edges = cv2.Canny(gray, low, high)
    edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(edges_rgb)


# ════════════════════════════════════════════════════════════════════════════
# 메인 inference
# ════════════════════════════════════════════════════════════════════════════
def run_inference(job_input: dict) -> dict:
    """평면도 + prompt → 인테리어 이미지."""
    t0 = time.time()

    prompt = job_input.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    floorplan_b64 = job_input.get("floorplan_image_b64", "")
    if not floorplan_b64:
        return {"error": "floorplan_image_b64 is required"}

    width = int(job_input.get("width", 1024))
    height = int(job_input.get("height", 1024))
    controlnet_strength = float(job_input.get("controlnet_strength", 0.8))
    lora_scale = float(job_input.get("lora_scale", 0.7))
    steps = int(job_input.get("steps", 28))
    guidance_scale = float(job_input.get("guidance_scale", 3.5))
    seed = int(job_input.get("seed", -1))

    # 1) 평면도 → Canny edge
    floorplan = decode_image_b64(floorplan_b64)
    canny_image = extract_canny(floorplan)
    # ControlNet 입력 크기 맞춤
    canny_image = canny_image.resize((width, height), Image.LANCZOS)

    # 2) generator (재현성)
    generator = None
    if seed >= 0:
        generator = torch.Generator(device=device).manual_seed(seed)

    # 3) LoRA scale 설정 (있을 경우)
    cross_attention_kwargs = {}
    if LORA_PATH and os.path.isdir(LORA_PATH):
        cross_attention_kwargs["scale"] = lora_scale

    # 4) Flux + ControlNet 호출
    result = pipe(
        prompt=prompt,
        control_image=canny_image,
        controlnet_conditioning_scale=controlnet_strength,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height,
        generator=generator,
        cross_attention_kwargs=cross_attention_kwargs if cross_attention_kwargs else None,
    )
    output_image = result.images[0]

    elapsed_ms = int((time.time() - t0) * 1000)
    image_b64 = encode_image_b64(output_image)
    return {
        "imageUrl": f"data:image/png;base64,{image_b64}",
        "model": "flux-controlnet-canny" + ("-lora" if LORA_PATH else ""),
        "costUsd": 0.02,  # 추정 — 실제 RunPod billing 기준 조정
        "elapsed_ms": elapsed_ms,
        "params": {
            "controlnet_strength": controlnet_strength,
            "lora_scale": lora_scale if LORA_PATH else None,
            "steps": steps,
            "guidance_scale": guidance_scale,
            "seed": seed,
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# RunPod 핸들러
# ════════════════════════════════════════════════════════════════════════════
def handler(job):
    try:
        job_input = job.get("input", {})
        return run_inference(job_input)
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


print("[InPick Flux Worker] Starting Serverless handler...")
runpod.serverless.start({"handler": handler})
