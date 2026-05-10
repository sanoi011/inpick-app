"""
InPick Renderer — RunPod Serverless handler.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md
       §6 (RunPod / GPU worker 설계)
       Prompt 5 (RunPod worker scaffold 작성)

8단계 파이프라인:
  1. input validation       (schemas.parse_request)
  2. model policy/runtime   (pipelines.model_registry.assert_model_allowed)
  3. floorplan image load   (geometry.control_images.load_image_from_b64_or_url)
  4. control image build    (geometry.control_images.build_control_images)
                            geometry 있으면 Phase 6 proxy, 없으면 flat canny baseline
  5. (없는 경우 fallback baseline은 4에서 함께 처리)
  6. image generation       (pipelines.generate.generate_image)
                            Phase 5 placeholder (gray 이미지) → Phase 6+ 실제 diffusion
  7. storage upload / b64   (storage.upload.deliver_image)
  8. metadata return

로그 (가이드 §6 필수):
  - cold_start (boolean)
  - elapsed_ms (int)
  - model_id
  - seed
  - control_mode (어떤 control image 사용)
  - delivery (uploaded | base64)
"""
from __future__ import annotations
import os
import sys
import time
import json
import traceback
from typing import Any, Dict

# ─── 1회 import (cold start) ───
import runpod  # type: ignore

# 패키지 import — 같은 디렉토리 (RunPod handler entrypoint 기준)
from schemas import parse_request, GenerateRequest
from pipelines.model_registry import (
    assert_model_allowed,
    get_default_model,
    is_production_runtime,
    lookup_model,
)
from pipelines.generate import generate_image, load_pipeline, is_cold_start
from geometry.control_images import load_image_from_b64_or_url, build_control_images
from storage.upload import deliver_image


def _log_event(event: str, **fields):
    """structured log (line-delimited JSON)."""
    payload = {"event": event, **fields}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def run_inference(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """단일 job 처리."""
    t0 = time.time()
    is_prod = is_production_runtime()
    runtime = "production" if is_prod else "poc"

    # ─── Step 1: input validation ───
    try:
        req: GenerateRequest = parse_request(job_input)
    except (KeyError, ValueError) as e:
        return {"error": f"invalid input: {e}", "phase": "validate"}

    # 모델 ID 결정 (요청 → 환경변수 default)
    model_id = req.modelId or get_default_model()

    # ─── Step 2: model policy / runtime guard ───
    try:
        assert_model_allowed(model_id)
    except PermissionError as e:
        _log_event(
            "model_blocked",
            jobId=req.jobId,
            modelId=model_id,
            runtime=runtime,
            error=str(e),
        )
        return {
            "status": "failed",
            "error": str(e),
            "modelId": model_id,
            "phase": "model_policy",
        }

    # cold start 측정 (load_pipeline 호출 전 체크)
    cold = is_cold_start(model_id, lora_path=req.lora.name if req.lora else None)

    # ─── Step 3: floorplan image load ───
    floorplan_image = None
    if req.floorplanImageB64 or req.floorplanImageUrl:
        floorplan_image = load_image_from_b64_or_url(
            req.floorplanImageB64, req.floorplanImageUrl
        )
        if floorplan_image is None:
            return {
                "status": "failed",
                "error": "Failed to load floorplan image",
                "modelId": model_id,
                "phase": "load_floorplan",
            }

    # ─── Step 4 & 5: control images (geometry proxy 또는 flat baseline) ───
    control_images_dict = build_control_images(
        floorplan_image=floorplan_image,
        geometry=req.roomGeometry,
        camera=req.camera,
        control_spec=req.control,
        width=req.width,
        height=req.height,
        save_debug=os.environ.get("DEBUG_CONTROL_IMAGES_DIR"),
    )
    control_mode = (
        "geometry_proxy"
        if req.roomGeometry and req.control and req.control.usePerspectiveCanny
        else "floorplan_canny"
        if req.control and req.control.useFloorplanCanny
        else "prompt_only"
    )
    control_kinds = list(control_images_dict.keys())

    # ─── Step 6: image generation ───
    try:
        pipe = load_pipeline(
            model_id, lora_path=req.lora.name if req.lora else None
        )
        # control_images_dict → list (현재는 perspective_canny 우선, 없으면 floorplan_canny)
        priority = [
            "perspective_canny",
            "floorplan_canny",
            "depth",
            "segmentation",
            "wall_mask",
            "floor_mask",
        ]
        ordered = [
            control_images_dict[k] for k in priority if k in control_images_dict
        ]
        output_image = generate_image(
            pipe=pipe,
            prompt=req.prompt,
            negative_prompt=req.negativePrompt,
            control_images=ordered,
            control_strength=req.control.controlStrength if req.control else 0.65,
            width=req.width,
            height=req.height,
            steps=req.steps,
            guidance=req.guidance,
            seed=req.seed,
            lora_scale=req.lora.scale if req.lora else None,
        )
    except Exception as e:
        _log_event(
            "generate_failed",
            jobId=req.jobId,
            modelId=model_id,
            error=str(e),
            traceback=traceback.format_exc()[-2000:],
        )
        return {
            "status": "failed",
            "error": f"generation failed: {e}",
            "modelId": model_id,
            "phase": "generate",
        }

    # ─── Step 7: storage upload / b64 ───
    output = req.output
    upload_url = output.uploadUrl if output else None
    public_url = output.publicUrl if output else None
    allow_b64_fallback = (
        bool(req.pocAllowBase64)
        or (output.allowBase64Fallback if output else False)
    )
    try:
        delivery = deliver_image(
            output_image,
            upload_url=upload_url,
            public_url=public_url,
            allow_b64_fallback=allow_b64_fallback,
            is_production=is_prod,
        )
    except RuntimeError as e:
        _log_event(
            "delivery_failed",
            jobId=req.jobId,
            modelId=model_id,
            error=str(e),
        )
        return {
            "status": "failed",
            "error": str(e),
            "modelId": model_id,
            "phase": "deliver",
        }

    elapsed_ms = int((time.time() - t0) * 1000)

    # ─── Step 8: metadata return ───
    meta = lookup_model(model_id) or {}
    response = {
        "status": "completed",
        "imageUrl": delivery["imageUrl"],
        "model": model_id,
        "elapsedMs": elapsed_ms,
        "seed": req.seed,
        "metadata": {
            "coldStart": cold,
            "controlMode": control_mode,
            "controlImages": control_kinds,
            "delivery": delivery["delivery"],
            "lora": req.lora.name if req.lora else None,
            "loraScale": req.lora.scale if req.lora else None,
            "runtime": runtime,
            "modelLicense": meta.get("license"),
            "uploadError": delivery.get("uploadError"),
            "phase": 5,  # scaffold — placeholder pipeline
            "guidance": req.guidance,
            "steps": req.steps,
            "controlStrength": req.control.controlStrength if req.control else None,
        },
    }

    _log_event(
        "completed",
        jobId=req.jobId,
        modelId=model_id,
        coldStart=cold,
        elapsedMs=elapsed_ms,
        seed=req.seed,
        controlMode=control_mode,
        delivery=delivery["delivery"],
        runtime=runtime,
    )
    return response


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    try:
        job_input = job.get("input", {}) if isinstance(job, dict) else {}
        return run_inference(job_input)
    except Exception as e:
        return {
            "status": "failed",
            "error": f"unexpected: {e}",
            "traceback": traceback.format_exc()[-2000:],
        }


if __name__ == "__main__":
    print(
        f"[InPick Renderer] runtime={('production' if is_production_runtime() else 'poc')}",
        flush=True,
    )
    print(
        f"[InPick Renderer] default_model={get_default_model()}", flush=True
    )
    runpod.serverless.start({"handler": handler})
