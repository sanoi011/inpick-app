"""
ADE20K → SAM 2.1 fine-tune 학습 포맷 변환.

입력:
  ADE20K_ROOT/
    images/training/*.jpg
    annotations/training/*.png   # pixel value = category idx (1~150)

출력:
  OUT_DIR/
    train.jsonl    # 한 줄당 한 (image, click, GT mask) 학습 샘플
    val.jsonl
    masks/
      <hash>.png   # binary mask (0/255)

각 학습 샘플:
{
  "image_path": "ade20k/.../adeXXXXX.jpg",
  "mask_path": "masks/<hash>.png",
  "click_xy": [x, y],         # mask 내부 random point
  "label": 1,                  # positive
  "ade20k_class": 4,
  "inpick_category": "floor"
}

가이드: InPick_Pipeline_Validation_v2.md §6 Phase 3 SAM fine-tune
사용:
  python prepare_dataset.py \
    --ade-root E:/InPick/data/datasets/ade20k/ADEChallengeData2016 \
    --out-dir ./prepared \
    --max-samples-per-class 2000
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import sys

import numpy as np
from PIL import Image


def load_mapping(mapping_json: Path) -> dict[int, str]:
    with open(mapping_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {int(k): v for k, v in data["ade20k_to_inpick"].items()}


def random_point_in_mask(mask: np.ndarray, rng: random.Random) -> tuple[int, int] | None:
    """mask 내부의 random point. mask가 비어 있으면 None."""
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return None
    i = rng.randint(0, len(xs) - 1)
    return int(xs[i]), int(ys[i])


def hash_id(image_id: str, class_id: int, instance_id: int) -> str:
    raw = f"{image_id}|{class_id}|{instance_id}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def process_split(
    split: str,
    ade_root: Path,
    out_dir: Path,
    mapping: dict[int, str],
    max_per_class: int,
    seed: int = 42,
) -> int:
    rng = random.Random(seed)
    img_dir = ade_root / "images" / split
    ann_dir = ade_root / "annotations" / split
    masks_dir = out_dir / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)

    samples_per_class: dict[int, int] = {cid: 0 for cid in mapping}
    out_path = out_dir / f"{split}.jsonl"

    image_files = sorted(img_dir.glob("*.jpg"))
    print(f"[{split}] {len(image_files)}장 이미지 처리 시작")

    written = 0
    with open(out_path, "w", encoding="utf-8") as out_f:
        for idx, img_path in enumerate(image_files):
            ann_path = ann_dir / (img_path.stem + ".png")
            if not ann_path.exists():
                continue
            try:
                ann = np.array(Image.open(ann_path))
            except Exception as e:
                print(f"  skip {img_path.name}: {e}", file=sys.stderr)
                continue

            for class_id, inpick_cat in mapping.items():
                if samples_per_class[class_id] >= max_per_class:
                    continue
                cls_mask = (ann == class_id).astype(np.uint8) * 255
                if cls_mask.sum() < 1000:  # 너무 작으면 skip
                    continue

                # mask를 connected component로 분할 (인스턴스화)
                from scipy.ndimage import label as cc_label
                labeled, n_inst = cc_label(cls_mask)
                for inst_id in range(1, n_inst + 1):
                    if samples_per_class[class_id] >= max_per_class:
                        break
                    inst_mask = (labeled == inst_id).astype(np.uint8) * 255
                    if inst_mask.sum() < 1000:
                        continue
                    pt = random_point_in_mask(inst_mask, rng)
                    if pt is None:
                        continue

                    h = hash_id(img_path.stem, class_id, inst_id)
                    mask_out = masks_dir / f"{h}.png"
                    Image.fromarray(inst_mask, mode="L").save(mask_out)

                    record = {
                        "image_path": str(img_path.relative_to(ade_root.parent)),
                        "mask_path": f"masks/{h}.png",
                        "click_xy": list(pt),
                        "label": 1,
                        "ade20k_class": class_id,
                        "inpick_category": inpick_cat,
                    }
                    out_f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    samples_per_class[class_id] += 1
                    written += 1

            if (idx + 1) % 500 == 0:
                print(f"  진행 {idx + 1}/{len(image_files)} — 누적 {written} 샘플")

    print(f"[{split}] 완료: {written} 샘플 -> {out_path}")
    print(f"[{split}] 클래스별 분포: " + ", ".join(
        f"{mapping[c]}={n}" for c, n in samples_per_class.items() if n > 0
    ))
    return written


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ade-root", required=True, type=Path,
                    help="ADEChallengeData2016 디렉토리")
    ap.add_argument("--out-dir", required=True, type=Path,
                    help="변환 결과 저장 디렉토리")
    ap.add_argument("--mapping", type=Path,
                    default=Path(__file__).parent / "inpick_to_ade20k_mapping.json")
    ap.add_argument("--max-samples-per-class", type=int, default=2000,
                    help="클래스당 최대 샘플 수 (불균형 완화)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    mapping = load_mapping(args.mapping)
    print(f"매핑: {len(mapping)} 클래스 → 인픽 카테고리")

    total = 0
    for split in ("training", "validation"):
        total += process_split(
            split=split,
            ade_root=args.ade_root,
            out_dir=args.out_dir,
            mapping=mapping,
            max_per_class=args.max_samples_per_class,
            seed=args.seed,
        )
    print(f"\n총 {total} 학습 샘플 생성 완료")


if __name__ == "__main__":
    main()
