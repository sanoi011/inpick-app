"""
INPICK 도면 심볼 감지 YOLO 모델 학습
Usage: python scripts/train-yolo-floorplan.py

사전 요구:
  pip install ultralytics
  npx tsx scripts/generate-synthetic-training.ts  (학습 데이터 생성)

출력:
  public/models/floorplan-yolo.onnx (~6MB)
"""

import os
import sys
import shutil
from pathlib import Path

# 프로젝트 루트
ROOT = Path(__file__).parent.parent
DATASET_DIR = ROOT / "datasets" / "floorplan-yolo"
MODEL_OUTPUT = ROOT / "public" / "models"

CLASSES = [
    "door_swing",
    "door_sliding",
    "window",
    "toilet",
    "sink",
    "kitchen_sink",
    "bathtub",
    "stove",
]


def check_prerequisites():
    """사전 조건 확인"""
    # 데이터셋 존재 확인
    yaml_path = DATASET_DIR / "dataset.yaml"
    if not yaml_path.exists():
        print("❌ dataset.yaml not found!")
        print("   Run: npx tsx scripts/generate-synthetic-training.ts")
        sys.exit(1)

    train_imgs = list((DATASET_DIR / "images" / "train").glob("*.png"))
    val_imgs = list((DATASET_DIR / "images" / "val").glob("*.png"))
    print(f"📊 Dataset: {len(train_imgs)} train, {len(val_imgs)} val images")

    if len(train_imgs) < 10:
        print("⚠️  Very few training images. Results may be poor.")

    # ultralytics 설치 확인
    try:
        import ultralytics
        print(f"✅ ultralytics v{ultralytics.__version__}")
    except ImportError:
        print("❌ ultralytics not installed!")
        print("   Run: pip install ultralytics")
        sys.exit(1)

    return yaml_path


def train_model(yaml_path: Path):
    """YOLOv8n 모델 학습"""
    from ultralytics import YOLO

    print("\n🏋️ Training YOLOv8n model...")
    print(f"   Dataset: {yaml_path}")
    print(f"   Classes: {len(CLASSES)}")

    # YOLOv8 Nano (가장 작은 모델 → ONNX ~6MB)
    model = YOLO("yolov8n.pt")

    # 학습
    results = model.train(
        data=str(yaml_path),
        epochs=100,
        imgsz=640,
        batch=16,
        patience=20,  # early stopping
        save=True,
        project=str(ROOT / "runs"),
        name="floorplan-yolo",
        exist_ok=True,
        # 데이터 증강 (합성 데이터이므로 적당히)
        hsv_h=0.01,
        hsv_s=0.1,
        hsv_v=0.1,
        degrees=5.0,
        translate=0.05,
        scale=0.2,
        flipud=0.3,
        fliplr=0.3,
        mosaic=0.5,
        mixup=0.1,
    )

    print(f"\n✅ Training complete!")
    print(f"   Best model: {results.save_dir / 'weights' / 'best.pt'}")
    return results


def export_onnx(results):
    """ONNX 내보내기"""
    from ultralytics import YOLO

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    if not best_pt.exists():
        print("❌ best.pt not found!")
        return None

    print("\n📦 Exporting to ONNX...")
    model = YOLO(str(best_pt))

    # ONNX 내보내기 (opset 12, dynamic batch)
    onnx_path = model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False,  # 고정 배치 → ONNX Runtime Web 호환
    )

    if onnx_path and os.path.exists(onnx_path):
        # public/models/ 로 복사
        MODEL_OUTPUT.mkdir(parents=True, exist_ok=True)
        dest = MODEL_OUTPUT / "floorplan-yolo.onnx"
        shutil.copy2(onnx_path, dest)
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"✅ ONNX exported: {dest} ({size_mb:.1f} MB)")
        return dest
    else:
        print("❌ ONNX export failed!")
        return None


def validate_model(results):
    """학습 결과 검증"""
    from ultralytics import YOLO

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    model = YOLO(str(best_pt))

    print("\n📊 Validation results:")
    metrics = model.val(data=str(DATASET_DIR / "dataset.yaml"))

    print(f"   mAP50: {metrics.box.map50:.3f}")
    print(f"   mAP50-95: {metrics.box.map:.3f}")

    # 클래스별 AP
    for i, cls_name in enumerate(CLASSES):
        if i < len(metrics.box.ap50):
            print(f"   {cls_name}: AP50={metrics.box.ap50[i]:.3f}")

    return metrics


def main():
    print("=" * 50)
    print("  INPICK Floor Plan Symbol Detector - Training")
    print("=" * 50)

    yaml_path = check_prerequisites()
    results = train_model(yaml_path)
    validate_model(results)
    onnx_path = export_onnx(results)

    print("\n" + "=" * 50)
    if onnx_path:
        print(f"✅ Model ready at: {onnx_path}")
        print("   Next: Use in browser with ONNX Runtime Web")
    else:
        print("⚠️  Training complete but ONNX export failed.")
    print("=" * 50)


if __name__ == "__main__":
    main()
