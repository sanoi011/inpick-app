# Stage 2: YOLOv11x 커스텀 자재 감지 모델

> 예상 기간: 2~3주
> 선행 조건: Stage 1 건자재 DB 시드 데이터 확보 (시공사진 참조용)

---

## 1. 목표

인테리어 실사 이미지에서 **30개 클래스의 자재/설비를 정밀 감지**하는 YOLOv11x 커스텀 모델 학습.
감지된 각 영역을 크롭하여 Stage 3의 CLIP 매칭 입력으로 사용.

---

## 2. 기술 스택

| 역할 | 기술 | 선택 근거 |
|------|------|----------|
| **모델** | YOLOv11x (Ultralytics 2025.10) | 최신 SOTA, C2PSA 어텐션, mAP50 54.7 (COCO) |
| **프레임워크** | Ultralytics + PyTorch 2.x | YOLOv11 공식 지원, 학습 코드 1줄 |
| **학습 GPU** | Lambda Cloud A100 80GB | 대규모 학습 최적, $1.29/hr |
| **대안 GPU** | Google Colab Pro+ A100 | $49.99/월, 시간 제한 있음 |
| **합성 데이터** | Gemini Imagen 3 | 포토리얼 인테리어 이미지 대량 생성 |
| **자동 라벨링** | Gemini 2.5 Pro Vision | 바운딩박스 + 클래스 자동 라벨링 |
| **라벨링 검수** | Roboflow (Team $249/월) | 팀 라벨링, 데이터 증강, 버전 관리 |
| **ONNX 변환** | ultralytics export | 브라우저 + 서버 양쪽 배포 |
| **브라우저 추론** | onnxruntime-web | 이미 프로젝트에 설치됨 |
| **서버 추론** | FastAPI + onnxruntime-gpu | Python 추론 서버 |

---

## 3. YOLOv11x 모델 스펙

### 3-1. v8 vs v11 비교

| 항목 | YOLOv8m (현재 보유) | YOLOv11m | YOLOv11x (목표) |
|------|-------------------|---------|----------------|
| 파라미터 | 25.9M | 20.1M | 56.9M |
| mAP50 (COCO) | 50.2 | 51.5 | 54.7 |
| mAP50-95 | 37.4 | 38.7 | 41.2 |
| 추론 (T4 GPU) | 6.3ms | 5.4ms | 11.8ms |
| 추론 (CPU) | 234ms | 195ms | 462ms |
| ONNX 크기 | ~50MB | ~40MB | ~110MB |

> **v11x 선택 이유**: 정확도 최우선. 서버 GPU 추론 기준 12ms로 실시간 충분.
> 브라우저 추론은 v11m(40MB)으로 경량 버전 별도 배포 가능.

### 3-2. YOLOv11 핵심 개선점

- **C2PSA (Cross-Stage Partial with Spatial Attention)**: 공간 어텐션으로 다양한 크기 객체 감지 강화
- **개선된 특징 추출**: 인테리어처럼 한 이미지에 크고 작은 객체가 혼재하는 장면에 적합
- **효율적 아키텍처**: 같은 정확도에서 v8 대비 22% 적은 파라미터
- **새로운 헤드 구조**: 작은 객체(콘센트, 스위치) 감지 개선

---

## 4. 감지 클래스 (30개)

### 4-1. 클래스 정의

```yaml
# datasets/interior-materials/dataset.yaml
path: ./datasets/interior-materials
train: images/train
val: images/val
test: images/test

nc: 30
names:
  # ─── 바닥재 (5) ───
  0: wood_floor_straight        # 직선 패턴 마루 (강마루/강화마루/원목)
  1: wood_floor_herringbone     # 헤링본 패턴 마루
  2: tile_floor_large           # 대형 바닥 타일 (600x600+)
  3: tile_floor_small           # 소형 바닥 타일 (300x300 이하, 모자이크 포함)
  4: marble_floor               # 대리석/폴리싱 타일 바닥

  # ─── 벽면 (4) ───
  5: wallpaper_plain            # 무지 벽지 (실크/합지)
  6: wallpaper_pattern          # 패턴/포인트 벽지
  7: paint_wall                 # 페인트 벽 (단색, 투톤)
  8: tile_wall                  # 벽 타일 (욕실/주방 벽면)

  # ─── 천장 (3) ───
  9: ceiling_flat               # 평천장 (석고보드)
  10: ceiling_coffer            # 우물천장
  11: indirect_lighting         # 간접조명 박스/라인

  # ─── 위생도기 (5) ───
  12: toilet                    # 양변기
  13: vanity_cabinet            # 세면대 하부장 (캐비넷형)
  14: wall_basin                # 벽걸이 세면대
  15: shower_partition          # 샤워 파티션 (유리)
  16: bathtub                   # 욕조

  # ─── 주방 (5) ───
  17: kitchen_upper_cabinet     # 주방 상부장
  18: kitchen_lower_cabinet     # 주방 하부장
  19: kitchen_countertop        # 주방 상판 (인조대리석/엔지니어드스톤)
  20: range_hood                # 레인지후드
  21: kitchen_sink              # 주방 싱크대

  # ─── 문/창호 (3) ───
  22: door_single               # 여닫이문 (ABS/PVC/원목)
  23: door_sliding              # 미닫이문/슬라이딩
  24: door_entrance             # 현관문

  # ─── 기타 설비 (5) ───
  25: baseboard                 # 걸레받이
  26: recessed_light            # 매입등/다운라이트
  27: pendant_light             # 펜던트 조명
  28: built_in_closet           # 붙박이장
  29: shoe_cabinet              # 신발장
```

### 4-2. 클래스별 견적 연결 (itemCode 매핑)

| YOLO 클래스 | estimate-calculator itemCode | 카테고리 |
|------------|------------------------------|---------|
| wood_floor_straight | 07.MAIN | FLOORING |
| wood_floor_herringbone | 07.MAIN | FLOORING |
| tile_floor_large | 05.FLOOR | BATH_TILE / KITCHEN_TILE |
| tile_floor_small | 05.FLOOR | BATH_TILE |
| marble_floor | 07.MAIN | FLOORING |
| wallpaper_plain | 08.WALLPAPER | WALLPAPER |
| wallpaper_pattern | 08.WALLPAPER | WALLPAPER |
| paint_wall | 08.PAINT | PAINT |
| tile_wall | 05.WALL | BATH_TILE / KITCHEN_TILE |
| ceiling_flat | 09.GYPSUM | CEILING |
| ceiling_coffer | 06.CEILING_FRAME | CEILING |
| indirect_lighting | 06.LIGHT_BOX | CEILING |
| toilet | 13.TOILET | TOILET |
| vanity_cabinet | 13.BASIN_CABINET | VANITY |
| wall_basin | 13.BASIN | VANITY |
| shower_partition | 13.SHOWER_BOOTH | SHOWER_BATH |
| bathtub | 13.BATHTUB | SHOWER_BATH |
| kitchen_upper_cabinet | 15.KITCHEN_UPPER_CABINET | KITCHEN_CABINET |
| kitchen_lower_cabinet | 15.KITCHEN_LOWER_CABINET | KITCHEN_CABINET |
| kitchen_countertop | 15.KITCHEN_COUNTER | KITCHEN_CABINET |
| range_hood | 15.RANGE_HOOD | KITCHEN_SINK |
| kitchen_sink | 15.KITCHEN_SINK | KITCHEN_SINK |
| door_single | 10.DOOR_SINGLE_DOOR | DOOR_ROOM |
| door_sliding | 10.DOOR_SLIDING_DOOR | DOOR_ROOM |
| door_entrance | 10.DOOR_ENTRANCE_DOOR | ENTRY_DOOR |
| baseboard | 16.BASEBOARD | BASEBOARD |
| recessed_light | 14.LIGHT | LIGHTING |
| pendant_light | 14.LIGHT | LIGHTING |
| built_in_closet | 15.WARDROBE | WARDROBE |
| shoe_cabinet | 15.SHOE_CABINET | SHOE_CABINET |

---

## 5. 학습 데이터 확보

### 5-1. 데이터 파이프라인

```
[Step 1] AI 합성 이미지 생성 (3,000장)
  │
  │  Gemini Imagen 3 프롬프트:
  │  "한국 아파트 {방타입}의 {스타일} 인테리어 사진, 
  │   {바닥재} 바닥, {벽면마감} 벽, {천장타입} 천장, 
  │   8K, 건축 사진 스타일"
  │
  │  변수 조합:
  │  - 방 타입: 거실, 주방, 침실, 욕실, 현관 (5)
  │  - 스타일: 모던, 북유럽, 클래식, 미니멀, 내추럴 (5)
  │  - 예산: economy, standard, premium (3)
  │  - 시점: 정면, 대각선, 코너, 와이드 (4)
  │  = 300 조합 × 10장 변형 = 3,000장
  │
  ↓
[Step 2] Gemini 2.5 Pro Vision 자동 라벨링
  │
  │  프롬프트:
  │  "이 인테리어 이미지에서 다음 30개 클래스의 객체를 감지하고
  │   YOLO 포맷(class x_center y_center width height)으로
  │   정규화 좌표를 반환해줘. 이미지 크기는 1024x1024.
  │   [클래스 목록...]"
  │
  │  출력: labels/image-0001.txt
  │  예: "0 0.45 0.75 0.85 0.35"  (wood_floor_straight)
  │      "10 0.50 0.15 0.90 0.25"  (ceiling_coffer)
  │
  ↓
[Step 3] Roboflow 수동 검수
  │
  │  - 전체의 30% (900장) 수동 검수
  │  - 바운딩박스 위치/크기 보정
  │  - 잘못된 클래스 수정
  │  - 누락된 객체 추가
  │
  ↓
[Step 4] 실사 데이터 추가 (5,000장)
  │
  │  소스: 오늘의집 시공사례, 집꾸미기, 인스타그램
  │  크롤링 → Gemini 자동 라벨링 → 30% 수동 검수
  │
  ↓
[Step 5] 데이터 증강
  │
  │  Roboflow 증강:
  │  - 회전: ±15°
  │  - 밝기: ±25%
  │  - 크롭: 0~15%
  │  - 노이즈: up to 3%
  │  - 모자이크: 4장 합성
  │  - 색조 변환: ±15°
  │
  │  증강 후 최종: ~15,000장
  │
  ↓
[최종 데이터셋]
  train: 12,000장 (80%)
  val:    2,250장 (15%)
  test:     750장 (5%)
```

### 5-2. Gemini 자동 라벨링 스크립트

```python
# scripts/auto-label-interiors.py

import json
from google import genai

CLASSES = [
    "wood_floor_straight", "wood_floor_herringbone",
    "tile_floor_large", "tile_floor_small", "marble_floor",
    # ... 30개 전체
]

PROMPT = """이 인테리어 사진에서 다음 클래스의 객체를 감지해주세요.
각 객체에 대해 YOLO 포맷으로 응답하세요.

클래스 목록: {classes}

YOLO 포맷: class_index x_center y_center width height
(좌표는 0~1 정규화, 이미지 크기 기준)

예시:
0 0.45 0.75 0.85 0.35
10 0.50 0.15 0.90 0.25
12 0.25 0.60 0.15 0.30

각 라인은 하나의 객체입니다. 보이는 객체만 포함하세요.
겹치는 영역은 각각 별도 라인으로 출력하세요.
JSON이 아닌 YOLO txt 포맷으로만 응답하세요."""

def auto_label(image_path: str) -> str:
    client = genai.Client()
    
    with open(image_path, "rb") as f:
        image_data = f.read()
    
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=[
            {"inline_data": {"mime_type": "image/jpeg", "data": image_data}},
            {"text": PROMPT.format(classes="\n".join(
                f"{i}: {c}" for i, c in enumerate(CLASSES)
            ))}
        ]
    )
    
    return response.text.strip()
```

---

## 6. 모델 학습

### 6-1. 학습 코드

```python
# scripts/train-interior-yolo.py

from ultralytics import YOLO
import torch

print(f"PyTorch: {torch.__version__}")
print(f"CUDA: {torch.cuda.is_available()}")
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")

# YOLOv11x 사전학습 모델 로드
model = YOLO("yolo11x.pt")

# 학습
results = model.train(
    data="datasets/interior-materials/dataset.yaml",
    epochs=300,
    imgsz=1024,
    batch=16,               # A100 80GB 기준 (T4는 batch=4)
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,               # 최종 LR = lr0 * lrf
    cos_lr=True,             # 코사인 스케줄링
    warmup_epochs=5,
    
    # 증강
    mosaic=1.0,
    mixup=0.15,
    copy_paste=0.1,
    augment=True,
    hsv_h=0.015,
    hsv_s=0.4,
    hsv_v=0.3,
    flipud=0.0,              # 상하 반전 비활성 (인테리어는 방향성 있음)
    fliplr=0.5,              # 좌우 반전
    
    # 출력
    device=0,
    project="runs/interior-yolo",
    name="v11x-materials-v1",
    save=True,
    save_period=50,          # 50 에폭마다 체크포인트
    plots=True,
    
    # 성능
    workers=8,
    cache="disk",
    amp=True,                # 혼합 정밀도 (메모리 절약)
)

# 검증
metrics = model.val()
print(f"mAP50: {metrics.box.map50:.4f}")
print(f"mAP50-95: {metrics.box.map:.4f}")

# ONNX 내보내기
model.export(format="onnx", imgsz=1024, simplify=True, opset=17)

# 경량 버전 (브라우저용)
model_m = YOLO("yolo11m.pt")
model_m.train(
    data="datasets/interior-materials/dataset.yaml",
    epochs=200,
    imgsz=640,
    batch=32,
    device=0,
    project="runs/interior-yolo",
    name="v11m-materials-v1-browser",
)
model_m.export(format="onnx", imgsz=640, simplify=True)
```

### 6-2. 학습 환경 세팅

```bash
# Lambda Cloud A100 세팅
pip install ultralytics torch torchvision
pip install roboflow  # 데이터셋 다운로드

# 데이터셋 다운로드 (Roboflow)
from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_KEY")
project = rf.workspace("inpick").project("interior-materials")
dataset = project.version(1).download("yolov11")

# 학습 실행
python scripts/train-interior-yolo.py
```

### 6-3. 목표 성능

| 지표 | 목표 | 비고 |
|------|------|------|
| mAP50 | 0.85+ | 전체 30클래스 평균 |
| mAP50-95 | 0.65+ | 엄격 기준 |
| 바닥재 AP50 | 0.90+ | 핵심 카테고리 |
| 위생도기 AP50 | 0.92+ | 형태가 뚜렷 |
| 주방설비 AP50 | 0.88+ | 중요 카테고리 |
| 추론 속도 (GPU) | < 15ms | T4 기준 |
| ONNX 크기 (x) | ~110MB | 서버용 |
| ONNX 크기 (m) | ~40MB | 브라우저용 |

---

## 7. 배포

### 7-1. 서버 배포 (Python)

```python
# python/interior-yolo/server.py

from fastapi import FastAPI, UploadFile
from ultralytics import YOLO
import numpy as np

app = FastAPI()
model = YOLO("models/interior-yolo-v11x.onnx", task="detect")

@app.post("/detect")
async def detect(file: UploadFile):
    image_bytes = await file.read()
    results = model.predict(source=image_bytes, conf=0.4, iou=0.5)
    
    detections = []
    for r in results:
        for box in r.boxes:
            detections.append({
                "class": model.names[int(box.cls)],
                "class_id": int(box.cls),
                "confidence": float(box.conf),
                "bbox": box.xyxy[0].tolist(),  # [x1, y1, x2, y2]
            })
    
    return {"detections": detections}
```

### 7-2. 브라우저 배포 (ONNX)

```typescript
// src/lib/services/interior-yolo-detector.ts
// 기존 yolo-floorplan-detector.ts 패턴과 동일하게 구현
// 모델 파일: public/models/interior-yolo-v11m.onnx (~40MB)
```

---

## 8. 파일 구조

```
scripts/
├── auto-label-interiors.py         ← Gemini 자동 라벨링
├── generate-synthetic-interiors.ts ← Imagen 3 합성 이미지 생성
├── train-interior-yolo.py          ← 학습 스크립트
└── test-interior-yolo.py           ← 테스트 스크립트

python/interior-yolo/
├── server.py                       ← FastAPI 추론 서버
├── models/
│   ├── interior-yolo-v11x.onnx    ← 서버용 (110MB)
│   └── interior-yolo-v11m.onnx    ← 브라우저용 (40MB)
└── requirements.txt

public/models/
└── interior-yolo-v11m.onnx         ← 브라우저용 (복사)

datasets/interior-materials/
├── dataset.yaml
├── images/
│   ├── train/
│   ├── val/
│   └── test/
└── labels/
    ├── train/
    ├── val/
    └── test/
```

---

## 9. 체크리스트

- [ ] Lambda Cloud 계정 생성 + A100 인스턴스 세팅
- [ ] Roboflow 워크스페이스 생성 (interior-materials 프로젝트)
- [ ] Gemini Imagen 3 합성 이미지 생성 스크립트 작성
- [ ] 합성 이미지 3,000장 생성 (5가지 방 × 5가지 스타일 × ...)
- [ ] Gemini 2.5 Pro Vision 자동 라벨링 스크립트 작성
- [ ] 3,000장 자동 라벨링 실행
- [ ] Roboflow에 업로드 + 30% 수동 검수
- [ ] 오늘의집 시공사례 크롤러 작성
- [ ] 실사 이미지 5,000장 수집 + 자동 라벨링
- [ ] Roboflow 데이터 증강 → 최종 15,000장
- [ ] YOLOv11x 학습 (A100, 300 epochs)
- [ ] mAP50 > 0.85 달성 확인
- [ ] ONNX 변환 (서버용 v11x + 브라우저용 v11m)
- [ ] FastAPI 추론 서버 구현 + 테스트
- [ ] 브라우저 ONNX 추론 모듈 구현
- [ ] 기존 도면 YOLO와 통합 테스트
