"""
processor.py - Gemini Pro 이미지 생성으로 클린 도면 변환

네이버 도면 이미지 → Gemini Pro → 클린 건축 도면
- 텍스트/가구/설비/바닥색 제거
- 벽체/문/창문만 보존
- 내부 치수(mm) 자동 생성
- 건축 표준 개구부 표현
"""

import os
import sys
import base64
import time
from pathlib import Path

# google-genai SDK (최신)
try:
    from google import genai
    from google.genai import types
    USE_NEW_SDK = True
except ImportError:
    USE_NEW_SDK = False
    try:
        import google.generativeai as old_genai
    except ImportError:
        print("ERROR: google-genai 또는 google-generativeai 패키지를 설치하세요")
        print("  pip install google-genai")
        sys.exit(1)


# ─── Gemini 프롬프트 ───

CLEAN_PROMPT = """You are an architectural drawing cleanup tool. Transform this Korean apartment floor plan into a clean architectural line drawing.

REMOVE COMPLETELY (replace with pure white #FFFFFF):
1. ALL text and labels (Korean/English room names, area numbers, dimension numbers)
2. ALL furniture (beds, sofas, tables, chairs, wardrobes, shoe racks, shelves)
3. ALL fixtures (toilets, sinks, bathtubs, kitchen sinks, stoves, washing machines, dryers)
4. ALL floor colors and patterns (wood flooring, tiles, beige, brown, any color fill)
5. ALL watermarks (NAVER, BUSINESS PLATFORM, any overlay text)
6. ALL balcony hatching (X-cross patterns, diagonal lines)
7. ALL exterior dimension lines and dimension frames
8. ALL colored backgrounds - everything should be WHITE

KEEP ONLY these elements as BLACK lines on WHITE background:
- Wall lines (thick black structural lines)
- Door arcs (90-degree quarter circle swing lines)
- Window symbols (double parallel lines)

The result must be a clean BLACK and WHITE architectural drawing with ONLY walls, doors, and windows. No colors, no text, no furniture, no fixtures. Pure white background everywhere except wall/door/window lines.

Do NOT add any dimensions or measurements."""


# 시도할 모델 (작동 확인된 순서)
MODELS = [
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.5-flash-image",
    "gemini-3-pro-image-preview",
]


def load_api_key(project_root: str) -> str:
    """프로젝트 .env.local에서 API 키 로드"""
    env_path = os.path.join(project_root, ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GOOGLE_GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    # 환경변수 폴백
    return os.environ.get("GOOGLE_GEMINI_API_KEY", "")


class FloorPlanProcessor:
    def __init__(self, api_key: str):
        self.api_key = api_key
        if USE_NEW_SDK:
            self.client = genai.Client(api_key=api_key)
        else:
            old_genai.configure(api_key=api_key)

    def process_image(self, image_path: str, output_path: str) -> dict:
        """
        단일 이미지를 Gemini로 처리

        Returns:
            {"success": bool, "model": str, "time_sec": float, "error": str}
        """
        start = time.time()

        # 이미지 읽기
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = "image/png" if image_path.endswith(".png") else "image/jpeg"

        # 모델 순차 시도
        for model_name in MODELS:
            try:
                result = self._call_gemini(model_name, b64_image, mime_type)
                if result:
                    # 이미지 저장
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(result["image_bytes"])

                    elapsed = time.time() - start
                    return {
                        "success": True,
                        "model": model_name,
                        "time_sec": round(elapsed, 1),
                        "error": "",
                    }
            except Exception as e:
                error_msg = str(e)
                # Rate limit → 잠시 대기 후 다음 모델
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    time.sleep(5)
                continue

        elapsed = time.time() - start
        return {
            "success": False,
            "model": "",
            "time_sec": round(elapsed, 1),
            "error": "All models failed",
        }

    def _call_gemini(self, model_name: str, b64_image: str, mime_type: str) -> dict | None:
        """Gemini API 호출 (이미지 생성)"""
        if USE_NEW_SDK:
            return self._call_new_sdk(model_name, b64_image, mime_type)
        else:
            return self._call_old_sdk(model_name, b64_image, mime_type)

    def _call_new_sdk(self, model_name: str, b64_image: str, mime_type: str) -> dict | None:
        """google-genai SDK 호출"""
        response = self.client.models.generate_content(
            model=model_name,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(
                            inline_data=types.Blob(
                                mime_type=mime_type,
                                data=base64.b64decode(b64_image),
                            )
                        ),
                        types.Part(text=CLEAN_PROMPT),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    return {"image_bytes": part.inline_data.data}

        return None

    def _call_old_sdk(self, model_name: str, b64_image: str, mime_type: str) -> dict | None:
        """google-generativeai SDK 폴백"""
        model = old_genai.GenerativeModel(model_name)
        response = model.generate_content(
            [
                {"mime_type": mime_type, "data": b64_image},
                CLEAN_PROMPT,
            ],
            generation_config={"response_mime_type": "image/png"},
        )

        if hasattr(response, "candidates") and response.candidates:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    return {"image_bytes": base64.b64decode(part.inline_data.data)}

        return None
