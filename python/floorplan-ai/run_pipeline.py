#!/usr/bin/env python3
"""
child_process용 CLI 파이프라인 실행기

Usage:
  python run_pipeline.py <image_path> [--known-area 59] [--quick]

Output:
  stdout: JSON (vector_data)
  stderr: 로그/경고
"""

import sys
import json
import argparse
import numpy as np
from pathlib import Path

# loguru 로그를 stderr로 보내기
from loguru import logger
logger.remove()
logger.add(sys.stderr, level="WARNING")


def numpy_encoder(obj):
    """numpy 타입 JSON 직렬화"""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def main():
    parser = argparse.ArgumentParser(description="InPick Floor Plan AI Pipeline CLI")
    parser.add_argument("image_path", help="이미지 또는 PDF 파일 경로")
    parser.add_argument("--known-area", type=float, default=None,
                        help="알려진 전용면적 (m²)")
    parser.add_argument("--quick", action="store_true",
                        help="빠른 모드 (벽 추출 생략)")
    parser.add_argument("--output-dir", default=None,
                        help="결과 파일 저장 디렉토리 (기본: 임시)")
    args = parser.parse_args()

    image_path = Path(args.image_path)
    if not image_path.exists():
        print(json.dumps({"error": f"파일을 찾을 수 없습니다: {image_path}"}),
              file=sys.stderr)
        sys.exit(1)

    # 파이프라인 초기화
    root = Path(__file__).parent
    config_path = str(root / "configs" / "pipeline_config.yaml")

    from src.pipeline import FloorPlanPipeline
    pipeline = FloorPlanPipeline(config_path=config_path)

    try:
        if args.quick:
            result = pipeline.run_quick(str(image_path))
        else:
            import tempfile
            output_dir = args.output_dir or tempfile.mkdtemp(prefix="inpick-ai-")
            result = pipeline.run(
                image_path=str(image_path),
                output_dir=output_dir,
            )
            # vector_data만 추출 (파일 경로 제외)
            result = {
                "vector_data": result.get("vector_data", {}),
                "timing": result.get("timing", {}),
                "summary": result.get("summary", {}),
            }

        # JSON stdout 출력
        print(json.dumps(result, ensure_ascii=False, default=numpy_encoder))

    except Exception as e:
        logger.error(f"파이프라인 실행 실패: {e}")
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
