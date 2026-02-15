"""floorplan-ai FastAPI 서버 3개 도면 인식 테스트"""
import sys
import json
import time
import requests

BASE = "http://localhost:8100"
FILES = [
    ("59.png", "drawings/_arch/59.png"),
    ("84A.png", "drawings/_arch/84A.png"),
    ("84d.png", "drawings/_arch/84d.png"),
]

def test_one(label, path):
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")

    start = time.time()
    try:
        with open(path, "rb") as f:
            resp = requests.post(f"{BASE}/api/v1/recognize", files={"file": (label, f)})
        elapsed = time.time() - start
    except Exception as e:
        print(f"  REQUEST FAILED: {e}")
        return

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}: {resp.text[:300]}")
        return

    d = resp.json()
    s = d.get("summary", {})
    t = d.get("timing", {})
    vd = d.get("vector_data", {})

    print(f"  HTTP time: {elapsed:.1f}s")
    print(f"  Pipeline:  {t.get('total', 0):.1f}s")
    print(f"  Rooms: {s.get('rooms',0)}, Walls: {s.get('walls',0)}, "
          f"Symbols: {s.get('symbols',0)}, Texts: {s.get('texts',0)}")
    print(f"  Canvas: {vd.get('canvas',{})}")
    print(f"  Scale: {vd.get('scale_factor',0):.4f} mm/px")

    # Timing breakdown
    print(f"\n  --- Timing ---")
    for k, v in t.items():
        if k != "total":
            print(f"    {k}: {v:.2f}s")

    # Rooms
    rooms = vd.get("rooms", [])
    print(f"\n  --- Rooms ({len(rooms)}) ---")
    for r in rooms:
        n = r.get("name") or "(unnamed)"
        print(f"    {n:15s} area={r.get('area_m2',0):6.1f}m2  verts={len(r.get('vertices',[]))}")

    # Walls summary
    walls = vd.get("walls", [])
    h_walls = [w for w in walls if w.get("orientation") == "H"]
    v_walls = [w for w in walls if w.get("orientation") == "V"]
    print(f"\n  --- Walls ({len(walls)}: {len(h_walls)}H + {len(v_walls)}V) ---")
    for w in walls[:5]:
        print(f"    {w.get('orientation','?'):1s} len={w.get('length_mm',0):7.1f}mm "
              f"thick={w.get('thickness',0):3.0f}")
    if len(walls) > 5:
        print(f"    ... ({len(walls)-5} more)")

    # Symbols
    syms = vd.get("symbols", [])
    print(f"\n  --- Symbols ({len(syms)}) ---")
    for sym in syms:
        print(f"    {sym.get('type','?'):15s} ({sym.get('type_ko','')}) "
              f"conf={sym.get('confidence',0):.2f}")

    # Texts
    texts = vd.get("texts", [])
    dims = [t2 for t2 in texts if t2.get("category") == "dimension"]
    rooms_t = [t2 for t2 in texts if t2.get("category") == "room_name"]
    unkn = [t2 for t2 in texts if t2.get("category") == "unknown"]
    print(f"\n  --- Texts ({len(texts)}: dim={len(dims)}, room={len(rooms_t)}, unknown={len(unkn)}) ---")
    for t2 in rooms_t:
        print(f'    [room] "{t2.get("text","")}"')
    for t2 in dims[:10]:
        print(f'    [dim]  "{t2.get("text","")}"')
    if len(dims) > 10:
        print(f"    ... ({len(dims)-10} more dimensions)")


if __name__ == "__main__":
    # Health check
    try:
        r = requests.get(f"{BASE}/api/v1/health")
        h = r.json()
        print(f"Server: {h.get('status')} (model_loaded={h.get('model_loaded')})")
    except Exception as e:
        print(f"Server not available: {e}")
        sys.exit(1)

    for label, path in FILES:
        full_path = f"C:/Users/User/Desktop/inpick-app/{path}"
        test_one(label, full_path)

    print(f"\n{'='*50}")
    print("  ALL TESTS COMPLETE")
    print(f"{'='*50}")
