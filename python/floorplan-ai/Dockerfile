FROM python:3.11-slim

# 시스템 종속성
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    poppler-utils tesseract-ocr tesseract-ocr-kor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python scripts/prepare_dataset.py --source sample

EXPOSE 8000
CMD ["python", "main.py", "serve", "--port", "8000"]
