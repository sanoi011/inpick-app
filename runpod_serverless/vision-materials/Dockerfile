# Vision Materials worker — Phase 3 scaffold (CPU base for mock 응답).
#
# Phase 후속에서 GPU base image (nvidia/cuda) + GroundingDINO + SAM2 추가 예정.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY schemas.py .
COPY handler.py .
COPY pipelines/ ./pipelines/
COPY storage/ ./storage/

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "handler.py"]
