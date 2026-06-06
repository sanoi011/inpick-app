"""
main.py - 네이버 도면 => Gemini Pro 클린 도면 파이프라인

1. naver-cache.json에서 도면 이미지 수집 (crawler)
2. Gemini Pro로 클린 건축 도면 변환 (processor)
3. 결과를 saved_plans 폴더에 저장

사용법:
    pip install google-genai tqdm
    python main.py
"""

import os
import sys
import json
import time
from pathlib import Path

# Windows cp949 콘솔 UTF-8 강제
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    from tqdm import tqdm
except ImportError:
    print("tqdm 설치 중...")
    os.system(f"{sys.executable} -m pip install tqdm")
    from tqdm import tqdm

from crawler import collect_floorplans, load_naver_cache
from processor import FloorPlanProcessor, load_api_key
from dimension_renderer import render_dimensions

# ─── 경로 설정 ───

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # inpick-app/
OUTPUT_BASE = SCRIPT_DIR / "saved_plans" / "대전유성구"
RESULTS_FILE = SCRIPT_DIR / "processing_results.json"


def main():
    print("=" * 60)
    print("  네이버 도면 => Gemini Pro 클린 도면 파이프라인")
    print("=" * 60)

    # 1. API 키 로드
    api_key = load_api_key(str(PROJECT_ROOT))
    if not api_key:
        print("\n[ERROR] GOOGLE_GEMINI_API_KEY를 찾을 수 없습니다.")
        print("  .env.local 파일에 GOOGLE_GEMINI_API_KEY=... 를 추가하세요.")
        sys.exit(1)
    print(f"\n[1/3] API 키 로드 완료 (길이: {len(api_key)})")

    # 2. 도면 이미지 수집
    print(f"\n[2/3] 도면 이미지 수집 중...")
    tasks = collect_floorplans(str(PROJECT_ROOT), str(OUTPUT_BASE))
    if not tasks:
        print("  처리할 도면이 없습니다.")
        sys.exit(0)

    # 이미 처리된 파일 확인 (clean = Gemini 클리닝만)
    pending = []
    skipped = 0
    for task in tasks:
        clean_path = os.path.join(task["output_dir"], "clean.png")
        if os.path.exists(clean_path) and os.path.getsize(clean_path) > 1000:
            skipped += 1
        else:
            pending.append(task)

    print(f"  전체: {len(tasks)} / 처리 완료: {skipped} / 남은 작업: {len(pending)}")

    if not pending:
        print("\n  모든 도면이 이미 처리되었습니다!")
        copy_to_public(tasks)
        return

    # 3. Gemini Pro 처리
    print(f"\n[3/3] Gemini Pro 처리 시작 ({len(pending)}개)")
    processor = FloorPlanProcessor(api_key)

    results = []
    success_count = 0
    fail_count = 0

    with tqdm(total=len(pending), desc="Gemini 처리", unit="img") as pbar:
        for i, task in enumerate(pending):
            complex_name = task["complexName"]
            pyeong_name = task["pyeongName"]
            area = task["exclusiveArea"]

            original_path = task["original_path"]
            clean_path = os.path.join(task["output_dir"], "clean.png")

            pbar.set_postfix_str(f"{complex_name} {pyeong_name}")

            result = processor.process_image(original_path, clean_path)

            result_entry = {
                "complexNo": task["complexNo"],
                "complexName": complex_name,
                "pyeongNo": task["pyeongNo"],
                "pyeongName": pyeong_name,
                "exclusiveArea": area,
                "success": result["success"],
                "model": result["model"],
                "time_sec": result["time_sec"],
                "error": result["error"],
                "original_path": original_path,
                "clean_path": clean_path if result["success"] else "",
            }
            results.append(result_entry)

            if result["success"]:
                success_count += 1
                tqdm.write(
                    f"  [OK] {complex_name} {pyeong_name} ({area}m2) "
                    f"=> {result['model']} ({result['time_sec']}s)"
                )
            else:
                fail_count += 1
                tqdm.write(
                    f"  [FAIL] {complex_name} {pyeong_name} ({area}m2) "
                    f"=> {result['error']}"
                )

            pbar.update(1)

            # Rate limit 대비: 요청 간 2초 대기
            if i < len(pending) - 1:
                time.sleep(2)

    print(f"\n  Gemini 완료: 성공 {success_count} / 실패 {fail_count}")

    # 4. 치수선 오버레이 (Layer 3)
    print(f"\n[4/4] 치수선 렌더링 중...")
    dim_ok = 0
    dim_fail = 0

    for task in tqdm(tasks, desc="치수 렌더링", unit="img"):
        clean_path = os.path.join(task["output_dir"], "clean.png")
        final_path = os.path.join(task["output_dir"], "final.png")

        if not os.path.exists(clean_path):
            continue

        # 이미 final이 있으면 스킵
        if os.path.exists(final_path) and os.path.getsize(final_path) > 1000:
            dim_ok += 1
            continue

        supply_area = task.get("supplyArea", 0) or task["exclusiveArea"] * 1.3
        if render_dimensions(clean_path, final_path, supply_area):
            dim_ok += 1
        else:
            dim_fail += 1

    print(f"  치수 완료: 성공 {dim_ok} / 실패 {dim_fail}")

    # 결과 저장
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total": len(pending),
                "gemini_success": success_count,
                "gemini_failed": fail_count,
                "dimension_ok": dim_ok,
                "results": results,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\n{'=' * 60}")
    print(f"  파이프라인 완료!")
    print(f"  Gemini: {success_count}/{len(pending)} | 치수: {dim_ok}")
    print(f"  결과: {RESULTS_FILE}")
    print(f"{'=' * 60}")

    # 5. public 폴더로 복사
    if success_count > 0:
        copy_to_public(tasks)


def copy_to_public(tasks: list[dict]):
    """처리된 클린 도면을 public/floorplans/images/ 폴더로 복사"""
    import shutil

    public_images = PROJECT_ROOT / "public" / "floorplans" / "images"
    copied = 0

    for task in tasks:
        complex_name = task["complexName"].replace(" ", "")
        pyeong_name = task["pyeongName"].replace(" ", "")
        area = task["exclusiveArea"]
        dest_dir = public_images / f"{task['complexNo']}-{complex_name}"

        final_path = os.path.join(task["output_dir"], "final.png")
        clean_path = os.path.join(task["output_dir"], "clean.png")

        if not os.path.exists(clean_path):
            continue

        dest_dir.mkdir(parents=True, exist_ok=True)

        # final.png (치수 포함) => 소비자에게 보여줄 도면
        if os.path.exists(final_path):
            dest_final = dest_dir / f"{pyeong_name}_{area}m2_final.png"
            shutil.copy2(final_path, str(dest_final))

        # clean.png (벽+개구부만) => 3D 모델링용
        dest_clean = dest_dir / f"{pyeong_name}_{area}m2_clean.png"
        shutil.copy2(clean_path, str(dest_clean))
        copied += 1

    print(f"\n  public 폴더로 {copied}개 클린 도면 복사 완료")
    print(f"  경로: {public_images}")

    # manifest.json 업데이트 (클린 도면 경로 반영)
    update_manifest(tasks, public_images)


def update_manifest(tasks: list[dict], public_images: Path):
    """manifest.json을 클린 도면 경로로 업데이트"""
    manifest_path = public_images / "manifest.json"
    manifest = []

    for task in tasks:
        complex_name = task["complexName"].replace(" ", "")
        pyeong_name = task["pyeongName"].replace(" ", "")
        area = task["exclusiveArea"]

        folder = f"{task['complexNo']}-{complex_name}"
        final_file = f"{pyeong_name}_{area}m2_final.png"
        clean_file = f"{pyeong_name}_{area}m2_clean.png"
        orig_file = f"{pyeong_name}_{area}m2.jpg"

        # final(치수 포함) > clean(3D용) > 원본 순서
        if (public_images / folder / final_file).exists():
            image_path = f"/floorplans/images/{folder}/{final_file}"
        elif (public_images / folder / clean_file).exists():
            image_path = f"/floorplans/images/{folder}/{clean_file}"
        elif (public_images / folder / orig_file).exists():
            image_path = f"/floorplans/images/{folder}/{orig_file}"
        else:
            continue

        manifest.append({
            "complexNo": task["complexNo"],
            "pyeongNo": task["pyeongNo"],
            "imagePath": image_path,
        })

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"  manifest.json 업데이트 완료 ({len(manifest)}개 항목)")


if __name__ == "__main__":
    main()
