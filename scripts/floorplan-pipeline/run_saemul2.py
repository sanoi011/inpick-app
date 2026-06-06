"""샘물타운 실패 타입 재처리 - 다른 모델 시도"""
import sys
import os
import time
import base64

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from processor import load_api_key, CLEAN_PROMPT
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("google-genai not installed")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
OUTPUT_BASE = SCRIPT_DIR / "saved_plans" / "대전유성구" / "샘물타운"

api_key = load_api_key(str(PROJECT_ROOT))
client = genai.Client(api_key=api_key)

# 재처리 대상과 시도할 모델
targets = ["105_84.94m2", "119_99.39m2"]
models = [
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.5-flash-preview-04-17",
]

for name in targets:
    plan_dir = OUTPUT_BASE / name
    original = plan_dir / "original.jpg"
    clean = plan_dir / "clean.png"

    with open(original, "rb") as f:
        image_bytes = f.read()

    for model_name in models:
        print(f"\n[{name}] Trying {model_name}...", flush=True)
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type="image/jpeg",
                                    data=image_bytes,
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
                        with open(str(clean), "wb") as f:
                            f.write(part.inline_data.data)
                        print(f"  [OK] {model_name} - {clean.stat().st_size} bytes")
                        break
                else:
                    print(f"  [NO IMAGE] {model_name} - no image in response")
                    # Check for text response
                    for part in response.candidates[0].content.parts:
                        if part.text:
                            print(f"  Text: {part.text[:200]}")
                    continue
                break  # Success, move to next target
            else:
                print(f"  [EMPTY] {model_name}")
                continue

        except Exception as e:
            err = str(e)
            print(f"  [ERROR] {model_name}: {err[:200]}")
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                time.sleep(5)
            continue

    time.sleep(2)

print("\n=== Done ===")
