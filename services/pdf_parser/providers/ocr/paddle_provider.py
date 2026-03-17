"""providers/ocr/paddle_provider.py — v4.7
PaddleOCR provider for text recognition.
"""
from __future__ import annotations
from typing import List
import numpy as np

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from providers.base import OcrProvider, OcrResult, OcrWord, ProviderMeta, ProviderError


class PaddleOcrProvider(OcrProvider):
    meta = ProviderMeta(name="paddle-ocr", version="1.0", runtime="local")

    def __init__(self, lang: str = "ko,en"):
        self._lang = lang
        self._reader = None

    def _load(self):
        if self._reader is not None:
            return
        try:
            from paddleocr import PaddleOCR
            self._reader = PaddleOCR(use_angle_cls=True, lang="korean", show_log=False)
        except ImportError:
            try:
                import easyocr
                langs = [l.strip() for l in self._lang.split(",")]
                self._reader = easyocr.Reader(langs, gpu=False)
            except ImportError:
                raise ProviderError("Neither paddleocr nor easyocr is installed")

    def run_words(self, page_rgb: np.ndarray) -> OcrResult:
        self._load()
        words: List[OcrWord] = []

        try:
            if hasattr(self._reader, 'ocr'):
                # PaddleOCR
                results = self._reader.ocr(page_rgb, cls=True)
                if results and results[0]:
                    for line in results[0]:
                        bbox_pts = line[0]
                        text = line[1][0]
                        conf = float(line[1][1])
                        x0 = int(min(p[0] for p in bbox_pts))
                        y0 = int(min(p[1] for p in bbox_pts))
                        x1 = int(max(p[0] for p in bbox_pts))
                        y1 = int(max(p[1] for p in bbox_pts))
                        cx = (x0 + x1) / 2.0
                        cy = (y0 + y1) / 2.0
                        words.append(OcrWord(text=text, conf=conf,
                                             bbox_px=(x0, y0, x1, y1),
                                             center_px=(cx, cy)))
            else:
                # EasyOCR fallback
                results = self._reader.readtext(page_rgb)
                for bbox, text, conf in results:
                    x0 = int(min(p[0] for p in bbox))
                    y0 = int(min(p[1] for p in bbox))
                    x1 = int(max(p[0] for p in bbox))
                    y1 = int(max(p[1] for p in bbox))
                    cx = (x0 + x1) / 2.0
                    cy = (y0 + y1) / 2.0
                    words.append(OcrWord(text=text, conf=float(conf),
                                         bbox_px=(x0, y0, x1, y1),
                                         center_px=(cx, cy)))
        except Exception as e:
            return OcrResult(words=[], meta={"error": str(e)})

        return OcrResult(words=words, meta={"provider": "paddle", "word_count": len(words)})
