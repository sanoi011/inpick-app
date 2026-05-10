# InPick Renderer — Phase 5 scaffold Dockerfile.
#
# Phase 5: CPU 기반 (placeholder pipeline). 빠른 cold start.
# Phase 6+: GPU base image + diffusers (별도 Dockerfile.gpu 권장).

FROM python:3.11-slim

# 시스템 의존성 (opencv용)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 소스
COPY schemas.py .
COPY handler.py .
COPY pipelines/ ./pipelines/
COPY geometry/ ./geometry/
COPY storage/ ./storage/

# RunPod handler entrypoint
ENV PYTHONUNBUFFERED=1
ENV RENDERER_RUNTIME=poc

CMD ["python", "-u", "handler.py"]
