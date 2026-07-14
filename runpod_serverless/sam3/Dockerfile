FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ARG SAM3_GIT_REF=main

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SAM_MODEL_VERSION=3.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3-pip python3.12-venv git ca-certificates libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# RunPod GitHub 연동은 저장소 루트를 build context로 사용한다.
# 로컬에서도 `docker build -f runpod_serverless/sam3/Dockerfile .`로 동일하게 빌드한다.
COPY runpod_serverless/sam3/requirements.txt .
RUN python3.12 -m pip install --break-system-packages -r requirements.txt \
    && python3.12 -m pip install --break-system-packages \
      torch==2.10.0 torchvision --index-url https://download.pytorch.org/whl/cu128 \
    && git clone --depth 1 https://github.com/facebookresearch/sam3.git /opt/sam3 \
    && cd /opt/sam3 && git fetch --depth 1 origin "${SAM3_GIT_REF}" && git checkout FETCH_HEAD \
    && python3.12 -m pip install --break-system-packages -e /opt/sam3

COPY runpod_serverless/sam3/handler.py .
CMD ["python3.12", "-u", "handler.py"]
