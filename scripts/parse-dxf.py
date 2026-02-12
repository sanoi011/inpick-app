#!/usr/bin/env python3
"""
DXF → ParsedFloorPlan JSON 변환 스크립트
ezdxf 기반 CAD 도면 파서

사용법:
  python scripts/parse-dxf.py                           # drawings/_arch/*.dxf 전체
  python scripts/parse-dxf.py drawings/_arch/59형.dxf    # 단일 파일

출력: public/floorplans/dwg-{name}.json

사전 요구사항:
  pip install ezdxf
"""

import os
import sys
import json
import math
import glob
import re
from pathlib import Path
from collections import defaultdict

try:
    import ezdxf
    from ezdxf.math import Vec2
except ImportError:
    print("ezdxf가 필요합니다: pip install ezdxf")
    sys.exit(1)

# ─── 레이어 패턴 매핑 ───

WALL_LAYER_PATTERNS = [
    r"(?i).*wall.*", r"(?i).*벽.*", r"(?i)A-WALL.*", r"(?i)S-WALL.*",
    r"(?i).*STRU.*", r"(?i).*구조.*",
]
DOOR_LAYER_PATTERNS = [
    r"(?i).*door.*", r"(?i).*문.*", r"(?i)A-DOOR.*",
]
WINDOW_LAYER_PATTERNS = [
    r"(?i).*wind.*", r"(?i).*창.*", r"(?i)A-GLAZ.*", r"(?i)A-WIND.*",
]
TEXT_LAYER_PATTERNS = [
    r"(?i).*text.*", r"(?i).*dim.*", r"(?i).*anno.*", r"(?i).*DIM.*",
]
FIXTURE_LAYER_PATTERNS = [
    r"(?i).*fixt.*", r"(?i).*설비.*", r"(?i).*P-.*", r"(?i).*EQPT.*",
    r"(?i).*PLMB.*", r"(?i).*SANIT.*",
]

def match_layer(layer_name: str, patterns: list) -> bool:
    """레이어 이름이 패턴에 매칭되는지 확인"""
    for pat in patterns:
        if re.match(pat, layer_name):
            return True
    return False

# ─── 실명 → RoomType 매핑 ───

ROOM_TYPE_MAP = {
    "거실": "LIVING", "LV": "LIVING", "Living": "LIVING", "LIVING": "LIVING",
    "주방": "KITCHEN", "KIT": "KITCHEN", "Kitchen": "KITCHEN", "KITCHEN": "KITCHEN",
    "안방": "MASTER_BED", "주침실": "MASTER_BED", "M.Bed": "MASTER_BED",
    "침실": "BED", "Bed": "BED", "BED": "BED", "BEDROOM": "BED",
    "욕실": "BATHROOM", "화장실": "BATHROOM", "UB": "BATHROOM", "Bath": "BATHROOM",
    "현관": "ENTRANCE", "Entrance": "ENTRANCE", "ENT": "ENTRANCE",
    "발코니": "BALCONY", "Balcony": "BALCONY", "BAL": "BALCONY",
    "다용도": "UTILITY", "Utility": "UTILITY", "세탁": "UTILITY",
    "복도": "CORRIDOR", "Hall": "CORRIDOR", "HALL": "CORRIDOR",
    "드레스룸": "DRESSROOM", "D.R": "DRESSROOM", "W.I.C": "DRESSROOM",
    "팬트리": "UTILITY", "창고": "UTILITY",
}

def guess_room_type(name: str) -> str:
    """텍스트에서 RoomType 추론"""
    for key, rtype in ROOM_TYPE_MAP.items():
        if key in name:
            return rtype
    return "UTILITY"

# ─── DXF 파싱 ───

def parse_dxf(filepath: str) -> dict:
    """DXF 파일을 ParsedFloorPlan JSON으로 변환"""
    doc = ezdxf.readfile(filepath)
    msp = doc.modelspace()

    # 레이어 분석
    print(f"\n  레이어 목록:")
    layer_entities = defaultdict(list)
    for entity in msp:
        layer = entity.dxf.layer
        layer_entities[layer].append(entity)

    for layer_name, entities in sorted(layer_entities.items()):
        types = defaultdict(int)
        for e in entities:
            types[e.dxftype()] += 1
        type_str = ", ".join(f"{k}:{v}" for k, v in sorted(types.items()))
        print(f"    [{layer_name}] ({len(entities)}) - {type_str}")

    # 벽체 추출
    walls = extract_walls(layer_entities)

    # 텍스트 추출 (실명, 치수)
    texts = extract_texts(layer_entities)

    # 문 추출 (ARC + INSERT)
    doors = extract_doors(layer_entities)

    # 창 추출
    windows = extract_windows(layer_entities)

    # 설비 추출
    fixtures = extract_fixtures(layer_entities)

    # 바운딩박스로 좌표 정규화 (mm → m, 원점 기준)
    all_points = []
    for w in walls:
        all_points.extend([w["start"], w["end"]])
    for t in texts:
        all_points.append(t["position"])

    if not all_points:
        print("  경고: 좌표 데이터 없음")
        return empty_result()

    min_x = min(p[0] for p in all_points)
    min_y = min(p[1] for p in all_points)

    # mm → m 변환 + 원점 정규화
    def norm(x, y):
        return (round((x - min_x) / 1000, 3), round((y - min_y) / 1000, 3))

    # 실명 텍스트로 공간 추론
    room_texts = []
    dimension_texts = []
    for t in texts:
        text = t["text"].strip()
        room_type = guess_room_type(text)
        if room_type != "UTILITY" or any(k in text for k in ROOM_TYPE_MAP):
            room_texts.append({
                "text": text,
                "type": room_type,
                "position": norm(*t["position"]),
            })
        # 치수 텍스트 (3,600 등)
        m = re.match(r"(\d{1,2}[,.]?\d{3})", text.replace(" ", ""))
        if m:
            dimension_texts.append({
                "value_mm": int(m.group(1).replace(",", "").replace(".", "")),
                "position": norm(*t["position"]),
            })

    # 벽 변환
    wall_data = []
    for i, w in enumerate(walls):
        s = norm(*w["start"])
        e = norm(*w["end"])
        length = math.sqrt((e[0]-s[0])**2 + (e[1]-s[1])**2)
        if length < 0.3:
            continue
        wall_data.append({
            "id": f"wall-{i}",
            "start": {"x": s[0], "y": s[1]},
            "end": {"x": e[0], "y": e[1]},
            "thickness": 0.18 if w.get("exterior", True) else 0.12,
            "isExterior": w.get("exterior", True),
        })

    # 공간 생성 (텍스트 위치 기반 + 벽으로 바운딩)
    rooms = create_rooms_from_texts(room_texts, wall_data)

    # 문 변환
    door_data = []
    for i, d in enumerate(doors):
        pos = norm(*d["position"])
        door_data.append({
            "id": f"door-{i}",
            "position": {"x": pos[0], "y": pos[1]},
            "width": round(d.get("width", 900) / 1000, 2),
            "rotation": d.get("rotation", 0),
            "type": d.get("type", "swing"),
            "connectedRooms": ["", ""],
        })

    # 창 변환
    window_data = []
    for i, w in enumerate(windows):
        pos = norm(*w["position"])
        closest_wall = "wall-0"
        min_dist = float("inf")
        for wd in wall_data:
            mx = (wd["start"]["x"] + wd["end"]["x"]) / 2
            my = (wd["start"]["y"] + wd["end"]["y"]) / 2
            dist = math.sqrt((pos[0]-mx)**2 + (pos[1]-my)**2)
            if dist < min_dist:
                min_dist = dist
                closest_wall = wd["id"]

        window_data.append({
            "id": f"window-{i}",
            "position": {"x": pos[0], "y": pos[1]},
            "width": round(w.get("width", 1200) / 1000, 2),
            "height": 1.2,
            "rotation": w.get("rotation", 0),
            "wallId": closest_wall,
        })

    # 설비 변환
    fixture_data = []
    for i, f in enumerate(fixtures):
        pos = norm(*f["position"])
        fixture_data.append({
            "id": f"fixture-{i}",
            "type": f["type"],
            "position": {
                "x": round(pos[0] - 0.25, 3),
                "y": round(pos[1] - 0.25, 3),
                "width": 0.5,
                "height": 0.5,
            },
            "roomId": None,
        })

    total_area = round(sum(r["area"] for r in rooms), 1)

    result = {
        "totalArea": total_area,
        "rooms": rooms,
        "walls": wall_data,
        "doors": door_data,
        "windows": window_data,
        "fixtures": fixture_data,
    }

    print(f"  결과: {len(rooms)}개 공간, {len(wall_data)}개 벽, {len(door_data)}개 문, {len(window_data)}개 창, {len(fixture_data)}개 설비")
    print(f"  총면적: {total_area}m²")

    return result


def extract_walls(layer_entities: dict) -> list:
    """벽체 엔티티 추출"""
    walls = []
    for layer_name, entities in layer_entities.items():
        is_wall_layer = match_layer(layer_name, WALL_LAYER_PATTERNS)
        for e in entities:
            if e.dxftype() == "LINE":
                s = (e.dxf.start.x, e.dxf.start.y)
                en = (e.dxf.end.x, e.dxf.end.y)
                walls.append({"start": s, "end": en, "exterior": is_wall_layer})
            elif e.dxftype() == "LWPOLYLINE":
                points = list(e.get_points(format="xy"))
                for i in range(len(points) - 1):
                    walls.append({
                        "start": points[i],
                        "end": points[i + 1],
                        "exterior": is_wall_layer,
                    })
                if e.closed and len(points) > 2:
                    walls.append({
                        "start": points[-1],
                        "end": points[0],
                        "exterior": is_wall_layer,
                    })
    return walls


def extract_texts(layer_entities: dict) -> list:
    """텍스트 엔티티 추출"""
    texts = []
    for layer_name, entities in layer_entities.items():
        for e in entities:
            if e.dxftype() in ("TEXT", "MTEXT"):
                try:
                    text = e.dxf.text if e.dxftype() == "TEXT" else e.text
                    if not text or not text.strip():
                        continue
                    if e.dxftype() == "TEXT":
                        pos = (e.dxf.insert.x, e.dxf.insert.y)
                    else:
                        pos = (e.dxf.insert.x, e.dxf.insert.y)
                    texts.append({"text": text.strip(), "position": pos, "layer": layer_name})
                except (AttributeError, TypeError):
                    pass
    return texts


def extract_doors(layer_entities: dict) -> list:
    """문 엔티티 추출 (ARC = 여닫이, INSERT 블록 = 미닫이)"""
    doors = []
    for layer_name, entities in layer_entities.items():
        is_door_layer = match_layer(layer_name, DOOR_LAYER_PATTERNS)
        for e in entities:
            if e.dxftype() == "ARC" and is_door_layer:
                center = (e.dxf.center.x, e.dxf.center.y)
                radius = e.dxf.radius
                doors.append({
                    "position": center,
                    "width": radius * 2,  # 호 반지름 ≈ 문 폭
                    "rotation": math.radians(e.dxf.start_angle),
                    "type": "swing",
                })
            elif e.dxftype() == "INSERT" and is_door_layer:
                pos = (e.dxf.insert.x, e.dxf.insert.y)
                doors.append({
                    "position": pos,
                    "width": 900,  # 기본 900mm
                    "rotation": math.radians(e.dxf.rotation) if hasattr(e.dxf, "rotation") else 0,
                    "type": "swing",
                })
    return doors


def extract_windows(layer_entities: dict) -> list:
    """창문 엔티티 추출"""
    windows = []
    for layer_name, entities in layer_entities.items():
        is_window_layer = match_layer(layer_name, WINDOW_LAYER_PATTERNS)
        for e in entities:
            if e.dxftype() == "INSERT" and is_window_layer:
                pos = (e.dxf.insert.x, e.dxf.insert.y)
                windows.append({
                    "position": pos,
                    "width": 1200,  # 기본 1200mm
                    "rotation": math.radians(e.dxf.rotation) if hasattr(e.dxf, "rotation") else 0,
                })
            elif e.dxftype() == "LINE" and is_window_layer:
                mid = ((e.dxf.start.x + e.dxf.end.x) / 2, (e.dxf.start.y + e.dxf.end.y) / 2)
                length = math.sqrt((e.dxf.end.x - e.dxf.start.x)**2 + (e.dxf.end.y - e.dxf.start.y)**2)
                if length > 500:  # 500mm 이상이면 창으로 간주
                    windows.append({
                        "position": mid,
                        "width": length,
                        "rotation": 0,
                    })
    return windows


def extract_fixtures(layer_entities: dict) -> list:
    """설비 엔티티 추출 (INSERT 블록 참조)"""
    fixtures = []
    fixture_block_patterns = {
        "toilet": [r"(?i).*toilet.*", r"(?i).*변기.*", r"(?i).*WC.*"],
        "sink": [r"(?i).*sink.*", r"(?i).*세면.*", r"(?i).*LAV.*"],
        "kitchen_sink": [r"(?i).*k.?sink.*", r"(?i).*주방싱크.*"],
        "bathtub": [r"(?i).*bath.*", r"(?i).*욕조.*", r"(?i).*TUB.*"],
        "stove": [r"(?i).*stove.*", r"(?i).*레인지.*", r"(?i).*RANGE.*"],
    }

    for layer_name, entities in layer_entities.items():
        is_fixture_layer = match_layer(layer_name, FIXTURE_LAYER_PATTERNS)
        for e in entities:
            if e.dxftype() == "INSERT":
                block_name = e.dxf.name
                fixture_type = None

                # 블록 이름으로 설비 타입 매칭
                for ftype, patterns in fixture_block_patterns.items():
                    for pat in patterns:
                        if re.match(pat, block_name):
                            fixture_type = ftype
                            break
                    if fixture_type:
                        break

                if fixture_type or is_fixture_layer:
                    pos = (e.dxf.insert.x, e.dxf.insert.y)
                    fixtures.append({
                        "type": fixture_type or "sink",
                        "position": pos,
                        "block_name": block_name,
                    })

    return fixtures


def create_rooms_from_texts(room_texts: list, walls: list) -> list:
    """텍스트 위치 기반으로 공간 생성 (근처 벽으로 바운딩 추정)"""
    rooms = []
    bed_indices = []

    for i, rt in enumerate(room_texts):
        tx, ty = rt["position"]

        # 이 텍스트 주변의 벽으로 바운딩박스 추정
        nearby_walls = []
        for w in walls:
            mx = (w["start"]["x"] + w["end"]["x"]) / 2
            my = (w["start"]["y"] + w["end"]["y"]) / 2
            dist = math.sqrt((tx - mx)**2 + (ty - my)**2)
            if dist < 8:  # 8m 이내
                nearby_walls.append(w)

        if not nearby_walls:
            # 기본 크기
            width, height = 4.0, 3.0
        else:
            # 벽 포인트로 바운딩 추정
            xs = [w["start"]["x"] for w in nearby_walls] + [w["end"]["x"] for w in nearby_walls]
            ys = [w["start"]["y"] for w in nearby_walls] + [w["end"]["y"] for w in nearby_walls]

            # 텍스트 근처 벽만 필터
            near_xs = [x for x in xs if abs(x - tx) < 6]
            near_ys = [y for y in ys if abs(y - ty) < 6]

            if near_xs and near_ys:
                x_left = min(x for x in near_xs if x <= tx) if any(x <= tx for x in near_xs) else tx - 2
                x_right = max(x for x in near_xs if x >= tx) if any(x >= tx for x in near_xs) else tx + 2
                y_bottom = min(y for y in near_ys if y <= ty) if any(y <= ty for y in near_ys) else ty - 2
                y_top = max(y for y in near_ys if y >= ty) if any(y >= ty for y in near_ys) else ty + 2
                width = max(1.0, x_right - x_left)
                height = max(1.0, y_top - y_bottom)
                tx = x_left
                ty = y_bottom
            else:
                width, height = 4.0, 3.0

        area = round(width * height, 1)
        rtype = rt["type"]

        if rtype in ("BED", "MASTER_BED"):
            bed_indices.append(i)

        rooms.append({
            "id": f"room-{i}",
            "type": rtype,
            "name": rt["text"],
            "area": area,
            "position": {
                "x": round(tx, 3),
                "y": round(ty, 3),
                "width": round(width, 3),
                "height": round(height, 3),
            },
        })

    # MASTER_BED 식별
    if bed_indices:
        max_area = 0
        max_idx = bed_indices[0]
        for idx in bed_indices:
            if rooms[idx]["area"] > max_area:
                max_area = rooms[idx]["area"]
                max_idx = idx
        rooms[max_idx]["type"] = "MASTER_BED"
        rooms[max_idx]["name"] = "안방"

    return rooms


def empty_result():
    return {
        "totalArea": 0,
        "rooms": [],
        "walls": [],
        "doors": [],
        "windows": [],
        "fixtures": [],
    }


def main():
    project_root = Path(__file__).parent.parent
    drawings_dir = project_root / "drawings" / "_arch"
    output_dir = project_root / "public" / "floorplans"
    output_dir.mkdir(parents=True, exist_ok=True)

    # 명령줄 인수 처리
    if len(sys.argv) > 1:
        dxf_files = [sys.argv[1]]
    else:
        dxf_files = sorted(glob.glob(str(drawings_dir / "*.dxf")))

    if not dxf_files:
        print(f"DXF 파일이 없습니다: {drawings_dir}")
        print("먼저 convert-dwg.py를 실행하여 DWG→DXF 변환을 수행하세요.")
        print("\n또는 AutoCAD에서 직접 DXF로 내보내기:")
        print("  파일 > 다른 이름으로 저장 > DXF R2018 형식")
        return

    print(f"DXF 파일 {len(dxf_files)}개 처리:")
    for filepath in dxf_files:
        basename = Path(filepath).stem
        print(f"\n{'='*50}")
        print(f"파일: {basename}")

        try:
            result = parse_dxf(filepath)

            # 출력 파일명 결정
            if "59" in basename:
                out_name = "dwg-59"
            elif "84" in basename and ("A" in basename or "a" in basename):
                out_name = "dwg-84a"
            elif "84" in basename and ("B" in basename or "b" in basename or "d" in basename.lower()):
                out_name = "dwg-84b"
            else:
                out_name = f"dwg-{basename}"

            out_path = output_dir / f"{out_name}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            print(f"  → {out_path}")
        except Exception as e:
            print(f"  오류: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n{'='*50}")
    print("완료!")


if __name__ == "__main__":
    main()
