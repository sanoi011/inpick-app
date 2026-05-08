FROM nvidia/cuda:12.1.0-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# SAM 2.1 설치
RUN git clone https://github.com/facebookresearch/sam2.git /tmp/sam2 \
    && cd /tmp/sam2 \
    && pip install -e . \
    && cp -r /tmp/sam2/sam2/configs /app/configs

# 체크포인트 다운로드
RUN mkdir -p /app/checkpoints \
    && wget -q https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt \
    -O /app/checkpoints/sam2.1_hiera_large.pt

COPY handler.py /app/handler.py

RUN python3 -c "import torch; print(f'PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}')"

CMD ["python3", "-u", "/app/handler.py"]
