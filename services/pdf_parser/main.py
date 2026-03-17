"""services/pdf_parser/main.py — v4.7
CLI + FastAPI server entry point.
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np

# Ensure parent is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CFG


def setup_logging():
    logging.basicConfig(
        level=getattr(logging, CFG.log_level, logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
    )


def run_cli(args):
    """CLI mode: process a single image/PDF."""
    import cv2
    from pipeline import run_pipeline

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    # Load image
    if input_path.suffix.lower() in (".pdf",):
        # PDF: use pdfjs or PyMuPDF to render
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(input_path))
            page = doc[args.page]
            pix = page.get_pixmap(dpi=args.dpi)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
            doc.close()
        except ImportError:
            print("PyMuPDF (fitz) required for PDF input. pip install PyMuPDF")
            sys.exit(1)
    else:
        img = cv2.imread(str(input_path))
        if img is None:
            print(f"Error: cannot read {input_path}")
            sys.exit(1)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Run pipeline
    output_dir = Path(args.output) if args.output else None
    result = run_pipeline(
        page_rgb=img,
        input_type=args.type,
        dpi=args.dpi,
        known_area_m2=args.known_area,
        output_dir=output_dir,
    )

    # Output
    output = {
        "success": result.success,
        "project": result.project_json,
        "timing": result.timing,
        "warnings": result.warnings,
    }
    if result.error:
        output["error"] = result.error

    if args.output:
        out_path = Path(args.output) / "result.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2, default=str)
        print(f"Output: {out_path}")
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))


def run_server(args):
    """FastAPI server mode."""
    import uvicorn
    from api_server import app
    uvicorn.run(app, host=args.host, port=args.port)


def main():
    parser = argparse.ArgumentParser(description="INPICK Floorplan Parser v4.7")
    subparsers = parser.add_subparsers(dest="command")

    # CLI
    cli_parser = subparsers.add_parser("parse", help="Parse a single file")
    cli_parser.add_argument("input", help="Input image or PDF path")
    cli_parser.add_argument("--type", default="drawing",
                            choices=["drawing", "lidar_spatial", "lidar_pc", "cad"])
    cli_parser.add_argument("--dpi", type=int, default=300)
    cli_parser.add_argument("--page", type=int, default=0)
    cli_parser.add_argument("--known-area", type=float, default=None)
    cli_parser.add_argument("--output", default=None, help="Output directory")

    # Server
    srv_parser = subparsers.add_parser("serve", help="Start FastAPI server")
    srv_parser.add_argument("--host", default="0.0.0.0")
    srv_parser.add_argument("--port", type=int, default=8100)

    args = parser.parse_args()
    setup_logging()

    if args.command == "parse":
        run_cli(args)
    elif args.command == "serve":
        run_server(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
