"""샘물타운 4개 타입 Gemini 클린 처리만"""
import sys
import os
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from processor import FloorPlanProcessor, load_api_key
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
OUTPUT_BASE = SCRIPT_DIR / "saved_plans" / "대전유성구" / "샘물타운"

# API 키
api_key = load_api_key(str(PROJECT_ROOT))
if not api_key:
    print("[ERROR] API key not found")
    sys.exit(1)
print(f"API key loaded (len={len(api_key)})")

processor = FloorPlanProcessor(api_key)

# 샘물타운 4개 타입
types = ["76_60m2", "93_74.94m2", "105_84.94m2", "119_99.39m2"]

for name in types:
    plan_dir = OUTPUT_BASE / name
    original = plan_dir / "original.jpg"
    clean = plan_dir / "clean.png"

    if not original.exists():
        print(f"\n[SKIP] {name} - no original.jpg")
        continue

    if clean.exists() and clean.stat().st_size > 1000:
        print(f"[EXIST] {name} - clean.png ({clean.stat().st_size} bytes)")
        continue

    print(f"[GEMINI] {name} - processing...", flush=True)
    result = processor.process_image(str(original), str(clean))
    if result["success"]:
        print(f"  [OK] model={result['model']}, time={result['time_sec']}s, size={clean.stat().st_size} bytes")
    else:
        print(f"  [FAIL] {result['error']}")

    time.sleep(2)

print("\n=== Gemini clean done ===")
