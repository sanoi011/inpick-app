"""
FastAPI 기반 평면도 인식 API 서버
InPick 프론트엔드에서 호출하는 REST API
"""

import io
import json
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from loguru import logger


def _convert_numpy(obj):
    """재귀적으로 numpy 타입을 Python 네이티브 타입으로 변환"""
    if isinstance(obj, dict):
        return {k: _convert_numpy(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_convert_numpy(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def numpy_json_response(data: dict, status_code: int = 200) -> Response:
    """numpy 타입을 안전하게 JSON 응답으로 변환"""
    converted = _convert_numpy(data)
    content = json.dumps(converted, ensure_ascii=False)
    return Response(content=content, status_code=status_code, media_type="application/json")

from .pipeline import FloorPlanPipeline

app = FastAPI(
    title="InPick Floor Plan Recognition API",
    description="AI 기반 평면도 자동 인식 시스템",
    version="0.1.0",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 글로벌 파이프라인 (서버 시작 시 1회 초기화)
pipeline: Optional[FloorPlanPipeline] = None
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".pdf", ".tiff", ".bmp"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@app.on_event("startup")
async def startup():
    """서버 시작 시 파이프라인 초기화"""
    global pipeline
    logger.info("파이프라인 초기화 중...")
    pipeline = FloorPlanPipeline()
    logger.info("서버 준비 완료")


@app.get("/api/v1/health")
async def health_check():
    """헬스체크"""
    return {
        "status": "ok",
        "version": "0.1.0",
        "model_loaded": pipeline is not None,
    }


@app.post("/api/v1/recognize")
async def recognize_floorplan(file: UploadFile = File(...)):
    """
    평면도 이미지 업로드 → 전체 인식 결과 (JSON)

    Returns:
        JSON: vector_data, timing, summary
    """
    # 파일 검증
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"지원하지 않는 파일 형식: {ext}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"파일 크기 초과 (최대 {MAX_FILE_SIZE // 1024 // 1024}MB)")

    # 임시 파일로 저장 후 처리
    job_id = str(uuid.uuid4())[:8]
    output_dir = Path(tempfile.mkdtemp()) / job_id

    try:
        # 이미지 로드
        if ext == ".pdf":
            tmp_path = output_dir / f"input{ext}"
            tmp_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path.write_bytes(content)
            result = pipeline.run(image_path=str(tmp_path), output_dir=str(output_dir))
        else:
            nparr = np.frombuffer(content, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise HTTPException(400, "이미지를 디코딩할 수 없습니다")
            result = pipeline.run(image=image, output_dir=str(output_dir))

        return numpy_json_response({
            "job_id": job_id,
            "vector_data": result["vector_data"],
            "timing": result["timing"],
            "summary": result["summary"],
        })

    except Exception as e:
        logger.error(f"인식 실패: {e}")
        raise HTTPException(500, f"인식 처리 중 오류: {str(e)}")


@app.post("/api/v1/recognize/svg")
async def recognize_to_svg(file: UploadFile = File(...)):
    """
    평면도 이미지 업로드 → SVG 파일 직접 반환
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"지원하지 않는 파일 형식: {ext}")

    content = await file.read()
    job_id = str(uuid.uuid4())[:8]
    output_dir = Path(tempfile.mkdtemp()) / job_id

    try:
        if ext == ".pdf":
            tmp_path = output_dir / f"input{ext}"
            tmp_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path.write_bytes(content)
            result = pipeline.run(image_path=str(tmp_path), output_dir=str(output_dir))
        else:
            nparr = np.frombuffer(content, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise HTTPException(400, "이미지를 디코딩할 수 없습니다")
            result = pipeline.run(image=image, output_dir=str(output_dir))

        svg_path = result["svg_path"]
        return FileResponse(
            svg_path,
            media_type="image/svg+xml",
            filename=f"floorplan_{job_id}.svg",
        )

    except Exception as e:
        logger.error(f"SVG 변환 실패: {e}")
        raise HTTPException(500, f"처리 중 오류: {str(e)}")


@app.post("/api/v1/recognize/quick")
async def recognize_quick(file: UploadFile = File(...)):
    """
    빠른 인식 (심볼 + OCR만, 벽 추출 생략)
    프론트엔드 미리보기용
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"지원하지 않는 파일 형식: {ext}")

    content = await file.read()

    try:
        if ext == ".pdf":
            tmp_path = Path(tempfile.mktemp(suffix=ext))
            tmp_path.write_bytes(content)
            result = pipeline.run_quick(str(tmp_path))
        else:
            nparr = np.frombuffer(content, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise HTTPException(400, "이미지를 디코딩할 수 없습니다")
            # run_quick은 파일 경로만 받으므로 임시 저장
            tmp_path = Path(tempfile.mktemp(suffix=".png"))
            cv2.imwrite(str(tmp_path), image)
            result = pipeline.run_quick(str(tmp_path))

        return numpy_json_response(result)

    except Exception as e:
        logger.error(f"빠른 인식 실패: {e}")
        raise HTTPException(500, f"처리 중 오류: {str(e)}")


def start_server(host: str = "0.0.0.0", port: int = 8000):
    """서버 실행"""
    import uvicorn
    uvicorn.run(
        "src.api_server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    start_server()
