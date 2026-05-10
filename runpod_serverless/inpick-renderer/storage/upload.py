"""
Storage upload — signed URL PUT 또는 b64 fallback.

가이드: c:\\Users\\user\\Downloads\\inpick-claude-code-dev-direction-20260510.md §6 (PoC vs production)

정책:
- production: uploadUrl이 있어야 함. 없으면 에러.
- PoC: pocAllowBase64=True 또는 OutputSpec.allowBase64Fallback=True 시 b64 반환 허용.

호환:
- Next.js src/lib/inpick/storage/image-storage.ts와 같은 결과 URL을 사용.
- Phase 3에서 만든 ensureStorageUrl이 worker 응답을 그대로 받을 수 있게 형식 유지.
"""
from __future__ import annotations
import io
import base64
from typing import Optional, Tuple
from PIL import Image


def encode_b64(image: Image.Image, fmt: str = "PNG") -> str:
    """PIL → base64 data URL."""
    buf = io.BytesIO()
    image.save(buf, format=fmt, optimize=True)
    raw = base64.b64encode(buf.getvalue()).decode()
    mime = "image/png" if fmt.upper() == "PNG" else f"image/{fmt.lower()}"
    return f"data:{mime};base64,{raw}"


def upload_signed_put(
    image: Image.Image, upload_url: str, fmt: str = "PNG"
) -> Tuple[bool, Optional[str]]:
    """
    Signed PUT 업로드 (Supabase Storage / S3 / R2).
    성공: (True, None)
    실패: (False, error_message)
    """
    try:
        import urllib.request

        buf = io.BytesIO()
        image.save(buf, format=fmt, optimize=True)
        data = buf.getvalue()
        content_type = "image/png" if fmt.upper() == "PNG" else f"image/{fmt.lower()}"

        req = urllib.request.Request(
            upload_url,
            data=data,
            method="PUT",
            headers={
                "Content-Type": content_type,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            if 200 <= resp.status < 300:
                return (True, None)
            return (False, f"HTTP {resp.status}")
    except Exception as e:
        return (False, str(e))


def deliver_image(
    image: Image.Image,
    *,
    upload_url: Optional[str],
    public_url: Optional[str],
    allow_b64_fallback: bool,
    is_production: bool,
) -> dict:
    """
    이미지 전달 정책.

    1. uploadUrl 있고 PUT 성공 → publicUrl 반환
    2. uploadUrl 실패 + production → 에러
    3. uploadUrl 실패 + (PoC 또는 allow_b64_fallback) → b64 반환
    4. uploadUrl 없음 + production → 에러 (정책 위반)
    5. uploadUrl 없음 + PoC + allow_b64_fallback → b64 반환

    반환:
        {
            "imageUrl": str,          # public URL 또는 data URL
            "delivery": "uploaded" | "base64",
            "uploadError": str | None,
        }
    """
    # 1. signed PUT 시도
    if upload_url:
        ok, err = upload_signed_put(image, upload_url)
        if ok:
            return {
                "imageUrl": public_url or "",  # publicUrl이 없으면 호출자가 빈 문자열 처리
                "delivery": "uploaded",
                "uploadError": None,
            }
        # 업로드 실패
        if is_production and not allow_b64_fallback:
            raise RuntimeError(
                f"Storage upload failed in production: {err}. "
                "Set output.allowBase64Fallback=true to bypass (NOT recommended)."
            )
        # PoC 폴백
        return {
            "imageUrl": encode_b64(image),
            "delivery": "base64",
            "uploadError": err,
        }

    # 2. uploadUrl 없음
    if is_production and not allow_b64_fallback:
        raise RuntimeError(
            "Production runtime requires output.uploadUrl. "
            "PoC users can set pocAllowBase64=true."
        )
    return {
        "imageUrl": encode_b64(image),
        "delivery": "base64",
        "uploadError": None,
    }
