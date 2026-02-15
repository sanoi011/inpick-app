#!/usr/bin/env python3
"""
InPick Floor Plan AI - 메인 엔트리포인트

사용법:
  # 단일 이미지 인식
  python main.py recognize --input floorplan.png

  # API 서버 시작
  python main.py serve --port 8000

  # 모델 학습
  python main.py train --data configs/yolo_floorplan.yaml --epochs 100

  # 데이터셋 준비
  python main.py prepare --source sample
"""

import argparse
import sys
from pathlib import Path


def cmd_recognize(args):
    """평면도 인식"""
    from src.pipeline import FloorPlanPipeline
    pipeline = FloorPlanPipeline(args.config)
    result = pipeline.run(
        image_path=args.input,
        output_dir=args.output,
    )
    print(f"\nSVG: {result['svg_path']}")
    print(f"JSON: {result['json_path']}")
    print(f"시각화: {result['vis_path']}")


def cmd_serve(args):
    """API 서버 시작"""
    from src.api_server import start_server
    print(f"서버 시작: http://{args.host}:{args.port}")
    print(f"API 문서: http://{args.host}:{args.port}/docs")
    start_server(host=args.host, port=args.port)


def cmd_train(args):
    """모델 학습"""
    from src.symbol_detector import SymbolDetector
    detector = SymbolDetector({
        "pretrained": args.model,
        "device": args.device,
    })
    best = detector.train(
        data_yaml=args.data,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.img_size,
        name=args.name,
    )
    print(f"학습 완료: {best}")


def cmd_prepare(args):
    """데이터셋 준비"""
    import subprocess
    cmd = [sys.executable, "scripts/prepare_dataset.py", "--source", args.source]
    if args.api_key:
        cmd += ["--api-key", args.api_key]
    subprocess.run(cmd)


def main():
    parser = argparse.ArgumentParser(
        description="InPick Floor Plan AI Recognition System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="명령어")

    # recognize
    p_rec = subparsers.add_parser("recognize", help="평면도 인식")
    p_rec.add_argument("--input", "-i", required=True, help="입력 이미지 경로")
    p_rec.add_argument("--output", "-o", default="outputs", help="출력 디렉토리")
    p_rec.add_argument("--config", default="configs/pipeline_config.yaml")

    # serve
    p_srv = subparsers.add_parser("serve", help="API 서버 시작")
    p_srv.add_argument("--host", default="0.0.0.0")
    p_srv.add_argument("--port", type=int, default=8000)

    # train
    p_train = subparsers.add_parser("train", help="YOLOv8 학습")
    p_train.add_argument("--data", default="configs/yolo_floorplan.yaml")
    p_train.add_argument("--model", default="yolov8n.pt")
    p_train.add_argument("--epochs", type=int, default=100)
    p_train.add_argument("--batch", type=int, default=16)
    p_train.add_argument("--img-size", type=int, default=1280)
    p_train.add_argument("--device", default="auto")
    p_train.add_argument("--name", default="floorplan_v1")

    # prepare
    p_prep = subparsers.add_parser("prepare", help="데이터셋 준비")
    p_prep.add_argument("--source", choices=["cubicasa", "roboflow", "custom", "sample"],
                        default="sample")
    p_prep.add_argument("--api-key", default="")

    args = parser.parse_args()

    if args.command == "recognize":
        cmd_recognize(args)
    elif args.command == "serve":
        cmd_serve(args)
    elif args.command == "train":
        cmd_train(args)
    elif args.command == "prepare":
        cmd_prepare(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
