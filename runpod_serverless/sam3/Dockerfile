FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3-pip python3.12-venv git ca-certificates libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN python3.12 -m pip install --break-system-packages -r requirements.txt \
    && python3.12 -m pip install --break-system-packages \
      torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu128 \
    && git clone --depth 1 https://github.com/facebookresearch/sam3.git /opt/sam3 \
    && python3.12 -m pip install --break-system-packages -e /opt/sam3

COPY handler.py .
CMD ["python3.12", "-u", "handler.py"]
