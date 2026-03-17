"""
crawler.py - 네이버 부동산 도면 이미지 수집기

이미 다운로드된 이미지 (public/floorplans/images/) 또는
naver-cache.json의 grandPlanUrl에서 이미지를 다운로드하여
saved_plans 구조로 정리한다.
"""

import os
import json
import shutil
import urllib.request
from pathlib import Path


def sanitize(name: str) -> str:
    """폴더명에 쓸 수 없는 문자 제거"""
    return name.replace("<", "").replace(">", "").replace(":", "").replace('"', "") \
        .replace("/", "").replace("\\", "").replace("|", "").replace("?", "").replace("*", "").strip()


def load_naver_cache(project_root: str) -> list[dict]:
    """naver-cache.json에서 도면 정보 추출"""
    cache_path = os.path.join(project_root, "src", "lib", "data", "naver-cache.json")
    with open(cache_path, "r", encoding="utf-8") as f:
        cache = json.load(f)

    entries = []
    for cortar_no, region in cache.items():
        for c in region.get("complexes", []):
            for p in c.get("pyeongList", []):
                if not p.get("grandPlanUrl"):
                    continue
                entries.append({
                    "complexNo": c["complexNo"],
                    "complexName": c["complexName"],
                    "address": c.get("address", ""),
                    "pyeongNo": p["pyeongNo"],
                    "pyeongName": p["pyeongName"],
                    "exclusiveArea": p["exclusiveArea"],
                    "supplyArea": p.get("supplyArea", 0),
                    "roomCnt": p.get("roomCnt", 0),
                    "bathroomCnt": p.get("bathroomCnt", 0),
                    "grandPlanUrl": p["grandPlanUrl"],
                })
    return entries


def download_image(url: str, dest_path: str, timeout: int = 15) -> bool:
    """URL에서 이미지 다운로드"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            with open(dest_path, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"    [DOWNLOAD FAIL] {e}")
        return False


def collect_floorplans(project_root: str, output_base: str) -> list[dict]:
    """
    도면 이미지를 수집하여 saved_plans 구조로 정리

    Returns:
        처리 대상 목록 [{complexName, pyeongName, original_path, output_dir, ...}]
    """
    entries = load_naver_cache(project_root)
    print(f"  네이버 캐시에서 {len(entries)}개 평형 발견 (grandPlanUrl 보유)")

    # 이미 다운로드된 이미지 경로
    downloaded_dir = os.path.join(project_root, "public", "floorplans", "images")

    tasks = []
    downloaded = 0
    reused = 0
    failed = 0

    for entry in entries:
        complex_name = sanitize(entry["complexName"])
        pyeong_id = f"{sanitize(entry['pyeongName'])}_{entry['exclusiveArea']}m2"

        # 출력 폴더
        plan_dir = os.path.join(output_base, complex_name, pyeong_id)
        original_path = os.path.join(plan_dir, "original.jpg")

        # 이미 처리됨
        if os.path.exists(original_path):
            reused += 1
            tasks.append({**entry, "original_path": original_path, "output_dir": plan_dir})
            continue

        os.makedirs(plan_dir, exist_ok=True)

        # 1순위: 이미 다운로드된 이미지에서 복사
        existing_folder = f"{entry['complexNo']}-{complex_name}"
        existing_file = f"{sanitize(entry['pyeongName'])}_{entry['exclusiveArea']}m2.jpg"
        existing_path = os.path.join(downloaded_dir, existing_folder, existing_file)

        if os.path.exists(existing_path):
            shutil.copy2(existing_path, original_path)
            reused += 1
            tasks.append({**entry, "original_path": original_path, "output_dir": plan_dir})
            continue

        # 2순위: URL에서 다운로드
        if download_image(entry["grandPlanUrl"], original_path):
            downloaded += 1
            tasks.append({**entry, "original_path": original_path, "output_dir": plan_dir})
        else:
            failed += 1

    print(f"  수집 완료: 재사용 {reused} / 다운로드 {downloaded} / 실패 {failed} / 총 {len(tasks)}")
    return tasks
