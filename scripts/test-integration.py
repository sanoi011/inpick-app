"""
통합 테스트: Next.js /api/project/parse-drawing 엔드포인트
Gemini Vision + floorplan-ai + PyMuPDF 3소스 융합 검증
"""
import sys
import json
import time
import requests

NEXTJS = "http://localhost:3000"
AI_SERVER = "http://localhost:8100"

FILES = [
    ("59.png", "drawings/_arch/59.png", 59),
    ("84A.png", "drawings/_arch/84A.png", 84),
    ("84d.png", "drawings/_arch/84d.png", 84),
]

def check_servers():
    """서버 상태 확인"""
    print("=== Server Status ===")
    # Next.js
    try:
        r = requests.get(NEXTJS, timeout=5)
        print(f"  Next.js:      OK (HTTP {r.status_code})")
    except Exception as e:
        print(f"  Next.js:      FAIL ({e})")
        return False

    # floorplan-ai
    try:
        r = requests.get(f"{AI_SERVER}/api/v1/health", timeout=5)
        h = r.json()
        print(f"  floorplan-ai: OK (model_loaded={h.get('model_loaded')})")
    except Exception as e:
        print(f"  floorplan-ai: FAIL ({e})")
        print("  (Gemini-only mode will be used)")

    return True


def test_parse_drawing(label, path, known_area):
    """POST /api/project/parse-drawing 테스트"""
    print(f"\n{'='*60}")
    print(f"  {label} (knownArea={known_area}m2)")
    print(f"{'='*60}")

    full_path = f"C:/Users/User/Desktop/inpick-app/{path}"

    start = time.time()
    try:
        with open(full_path, "rb") as f:
            resp = requests.post(
                f"{NEXTJS}/api/project/parse-drawing",
                files={"file": (label, f, "image/png")},
                data={"knownArea": str(known_area), "source": "pdf"},
                timeout=120,
            )
        elapsed = time.time() - start
    except Exception as e:
        print(f"  REQUEST FAILED: {e}")
        return None

    print(f"  HTTP Status: {resp.status_code}")
    print(f"  Response Time: {elapsed:.1f}s")

    if resp.status_code != 200:
        print(f"  Error: {resp.text[:500]}")
        return None

    d = resp.json()

    # Basic info
    fp = d.get("floorPlan", {})
    print(f"\n  --- Floor Plan ---")
    print(f"  Total Area: {d.get('totalArea', '?')}m2")
    print(f"  Room Count: {d.get('roomCount', '?')}")
    print(f"  Confidence: {d.get('confidence', '?')}")
    print(f"  Method: {d.get('method', '?')}")
    print(f"  Processing: {d.get('processingTimeMs', '?')}ms")

    # Rooms
    rooms = fp.get("rooms", [])
    print(f"\n  --- Rooms ({len(rooms)}) ---")
    for r in rooms:
        print(f"    {r.get('name','?'):15s}  type={r.get('type','?'):12s}  "
              f"area={r.get('area',0):6.1f}m2  "
              f"polygon={'Y' if r.get('polygon') else 'N'}")

    # Walls
    walls = fp.get("walls", [])
    ext_walls = [w for w in walls if w.get("isExterior")]
    int_walls = [w for w in walls if not w.get("isExterior")]
    print(f"\n  --- Walls ({len(walls)}: {len(ext_walls)} exterior + {len(int_walls)} interior) ---")

    # Doors
    doors = fp.get("doors", [])
    print(f"\n  --- Doors ({len(doors)}) ---")
    for door in doors[:5]:
        print(f"    {door.get('id','?'):10s}  type={door.get('type','?'):8s}  "
              f"width={door.get('width',0):.2f}m  "
              f"rooms={door.get('connectedRooms', [])}")
    if len(doors) > 5:
        print(f"    ... ({len(doors)-5} more)")

    # Windows
    windows = fp.get("windows", [])
    print(f"\n  --- Windows ({len(windows)}) ---")
    for win in windows[:5]:
        print(f"    {win.get('id','?'):10s}  width={win.get('width',0):.2f}m  "
              f"wall={win.get('wallId','?')}")
    if len(windows) > 5:
        print(f"    ... ({len(windows)-5} more)")

    # Fixtures
    fixtures = fp.get("fixtures", [])
    print(f"\n  --- Fixtures ({len(fixtures)}) ---")
    for fix in fixtures[:8]:
        print(f"    {fix.get('id','?'):10s}  type={fix.get('type','?'):12s}  "
              f"room={fix.get('roomId','?')}")
    if len(fixtures) > 8:
        print(f"    ... ({len(fixtures)-8} more)")

    # Dimensions
    dims = fp.get("dimensions", [])
    print(f"\n  --- Dimensions ({len(dims)}) ---")
    for dim in dims[:5]:
        print(f"    {dim.get('id','?'):10s}  value={dim.get('valueMm',0)}mm  "
              f"label={dim.get('label','?')}")
    if len(dims) > 5:
        print(f"    ... ({len(dims)-5} more)")

    # Pipeline info
    print(f"\n  --- Pipeline Info ---")
    print(f"  AI Pipeline Used: {d.get('aiPipelineUsed', False)}")
    if d.get("aiPipelineStats"):
        stats = d["aiPipelineStats"]
        print(f"  AI Stats: geminiRooms={stats.get('geminiRooms',0)}, "
              f"aiRooms={stats.get('aiRooms',0)}, "
              f"geminiWalls={stats.get('geminiWalls',0)}, "
              f"aiWalls={stats.get('aiWalls',0)}")
        print(f"            doors={stats.get('totalDoors',0)}, "
              f"windows={stats.get('totalWindows',0)}, "
              f"fixtures={stats.get('totalFixtures',0)}")
    if d.get("aiPipelineSources"):
        src = d["aiPipelineSources"]
        print(f"  Sources: rooms={src.get('rooms')}, walls={src.get('walls')}, "
              f"doors={src.get('doors')}, windows={src.get('windows')}")

    # Vector hints
    if d.get("vectorHints"):
        vh = d["vectorHints"]
        print(f"\n  --- Vector Hints (PyMuPDF) ---")
        print(f"  Dimension Texts: {len(vh.get('dimensionTexts',[]))}")
        print(f"  Wall Lines: {vh.get('wallLineCount', 0)}")
        print(f"  Scale: {vh.get('scale', '?')}")
    else:
        print(f"\n  Vector Hints: N/A (image, not PDF)")

    # Warnings
    warnings = d.get("warnings", [])
    if warnings:
        print(f"\n  --- Warnings ({len(warnings)}) ---")
        for w in warnings:
            print(f"    - {w}")

    return d


if __name__ == "__main__":
    if not check_servers():
        print("\nNext.js server not available. Exiting.")
        sys.exit(1)

    results = {}
    for label, path, area in FILES:
        result = test_parse_drawing(label, path, area)
        if result:
            results[label] = result

    # Summary table
    print(f"\n\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"{'File':10s} {'Area':>6s} {'Rooms':>6s} {'Walls':>6s} {'Doors':>6s} "
          f"{'Windows':>8s} {'Fixtures':>9s} {'Dims':>5s} {'AI':>4s} {'Conf':>5s}")
    print("-" * 75)
    for label, path, area in FILES:
        if label in results:
            d = results[label]
            fp = d.get("floorPlan", {})
            area_val = d.get('totalArea', '?')
            conf_val = d.get('confidence', '?')
            area_str = f"{area_val}" if isinstance(area_val, (int, float)) else str(area_val)
            conf_str = f"{conf_val}" if isinstance(conf_val, (int, float)) else str(conf_val)
            print(f"{label:10s} {area_str:>6s} "
                  f"{len(fp.get('rooms',[])):>6d} "
                  f"{len(fp.get('walls',[])):>6d} "
                  f"{len(fp.get('doors',[])):>6d} "
                  f"{len(fp.get('windows',[])):>8d} "
                  f"{len(fp.get('fixtures',[])):>9d} "
                  f"{len(fp.get('dimensions',[])):>5d} "
                  f"{'Y' if d.get('aiPipelineUsed') else 'N':>4s} "
                  f"{conf_str:>5s}")
        else:
            print(f"{label:10s}  FAILED")

    print(f"\n{'='*60}")
    print("  INTEGRATION TEST COMPLETE")
    print(f"{'='*60}")
