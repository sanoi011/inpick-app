"""providers/__init__.py — v4.7"""
from __future__ import annotations
from typing import Optional
import sys
import os

# Add parent to path for config import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import CFG
from providers.base import ProviderError
from providers.seg.noop_provider import NoopSegProvider
from providers.seg.seg_router import SegRouterProvider, SegRouter


def get_seg_router() -> Optional[SegRouter]:
    if CFG.seg_provider == "none":
        return None
    if CFG.seg_provider == "yolo":
        return SegRouterProvider.get()
    return None


def get_seg_single():
    """Targeted Viewing OFF: return single provider"""
    if CFG.seg_provider == "none":
        return NoopSegProvider()
    router = get_seg_router()
    return router.pass2 if router else NoopSegProvider()
