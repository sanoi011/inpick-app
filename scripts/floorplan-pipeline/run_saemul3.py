"""93타입 gemini-2.0-flash-exp로 재처리"""
import sys
import os
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from processor import load_api_key, CLEAN_PROMPT
from pathlib import Path

from google import genai
from google.genai import types

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
OUTPUT_BASE = SCRIPT_DIR / "saved_plans" / "대전유성구" / "샘물타운"

api_key = load_api_key(str(PROJECT_ROOT))
client = genai.Client(api_key=api_key)

name = "76_60m2"
plan_dir = OUTPUT_BASE / name
original = plan_dir / "original.jpg"
clean = plan_dir / "clean.png"

with open(original, "rb") as f:
    image_bytes = f.read()

model_name = "gemini-2.0-flash-exp-image-generation"
print(f"[{name}] Processing with {model_name}...", flush=True)

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
            print(f"  [OK] {clean.stat().st_size} bytes")
            break
    else:
        print("  [NO IMAGE]")
else:
    print("  [EMPTY]")
