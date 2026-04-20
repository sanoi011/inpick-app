# Stage 3: 이미지 임베딩 + 건자재 DB 매칭

> 예상 기간: 1~2주
> 선행 조건: Stage 1 (건자재 DB 500개+), Stage 2 (YOLO 모델 학습 완료)

---

## 1. 목표

YOLO가 감지한 자재 영역(크롭 이미지)을 건자재 DB의 실제 제품과 **1:1 매칭**.
"이건 마루다" → **"이건 LX하우시스 지아소리잠 헤링본 오크 ZSJ-2045, 85,000원/m²"**

---

## 2. 기술 스택

| 역할 | 기술 | 비용 | 내재화 계획 |
|------|------|------|------------|
| **이미지 임베딩** | OpenAI CLIP API (ViT-L/14, 768d) | $0.0001/장 | → open_clip 자체 서버 |
| **벡터 DB** | Supabase pgvector | $25/월 (Pro 포함) | 유지 |
| **색상 분석** | OpenCV KMeans (Python) | 무료 | 자체 운영 |
| **텍스처 분류** | Google Cloud Vision API | $1.5/1000장 | → 자체 CNN |
| **융합 스코어** | 커스텀 가중 평균 | 무료 | 자체 운영 |

---

## 3. 매칭 파이프라인

```
YOLO 감지 결과
  │
  │  예: class=wood_floor_herringbone, confidence=0.94
  │      bbox=[100, 400, 900, 700]  (원본 이미지 좌표)
  │
  ↓
[Step 1] 이미지 크롭
  │  원본 이미지에서 bbox 영역 크롭
  │  여유 마진 10% 추가 (컨텍스트 보존)
  │  정사각형 패딩 → 224x224 리사이즈
  │
  ↓
[Step 2] 3가지 특성 추출 (병렬)
  │
  ├─ [A] CLIP 임베딩 (768d 벡터)
  │   OpenAI API: POST /v1/embeddings
  │   model: "clip-vit-large-patch14"
  │   input: 크롭 이미지 base64
  │   → [0.023, -0.041, 0.089, ...]  (768차원)
  │
  ├─ [B] Dominant Colors (3색)
  │   OpenCV → RGB → KMeans(k=3)
  │   → ["#8B6F47", "#A0845C", "#D4C5B0"]
  │
  └─ [C] 텍스처 라벨
      Google Cloud Vision API → label detection
      → "hardwood floor", "herringbone pattern"
      → 정규화: "wood_grain" + "herringbone"
  │
  ↓
[Step 3] pgvector 유사도 검색
  │
  │  SELECT * FROM match_materials(
  │    query_embedding := [0.023, -0.041, ...],
  │    category_filter := 'FLOORING',     -- YOLO 클래스 → 카테고리 변환
  │    match_count := 10
  │  );
  │
  │  결과: 10개 후보 (CLIP 유사도 기준)
  │
  ↓
[Step 4] 융합 스코어 계산
  │
  │  각 후보에 대해:
  │  final_score = 0.60 × clip_similarity
  │              + 0.25 × color_similarity
  │              + 0.15 × texture_match
  │
  │  color_similarity:
  │    query_colors vs product.dominant_colors
  │    CIE Lab 색공간 거리 → 0~1 정규화
  │
  │  texture_match:
  │    query_texture vs product.pattern_type
  │    완전일치=1.0, 부분일치=0.5, 불일치=0.0
  │
  ↓
[Step 5] Top-3 반환
  │
  │  1. LX하우시스 지아소리잠 헤링본 오크 (score: 0.94, 85,000원/m²)
  │  2. 동화자연마루 프리미엄 헤링본 내추럴 (score: 0.89, 95,000원/m²)
  │  3. 한샘 오크 헤링본 HO-882 (score: 0.85, 75,000원/m²)
  │
  ↓
[자동 선택]
  score 0.85 이상 & 1위와 2위 차이 > 0.05 → 1위 자동 선택
  그 외 → 사용자에게 3개 후보 제시
```

---

## 4. 구현 상세

### 4-1. CLIP 임베딩 생성

```python
# python/services/clip_embedder.py

import openai
import base64
from PIL import Image
import io

client = openai.OpenAI()

def get_clip_embedding(image_bytes: bytes) -> list[float]:
    """이미지 → CLIP 768d 임베딩 벡터"""
    
    # 224x224로 리사이즈
    img = Image.open(io.BytesIO(image_bytes))
    img = img.resize((224, 224), Image.LANCZOS)
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    
    response = client.embeddings.create(
        model="clip-vit-large-patch14",
        input=[{"image": b64}],
        encoding_format="float"
    )
    
    return response.data[0].embedding  # 768d


def get_text_embedding(text: str) -> list[float]:
    """텍스트 → CLIP 768d 임베딩 (제품 설명 매칭용)"""
    
    response = client.embeddings.create(
        model="clip-vit-large-patch14",
        input=[text],
        encoding_format="float"
    )
    
    return response.data[0].embedding
```

### 4-2. 색상 유사도 계산

```python
# python/services/color_matcher.py

import cv2
import numpy as np
from sklearn.cluster import KMeans
from colormath.color_objects import sRGBColor, LabColor
from colormath.color_conversions import convert_color
from colormath.color_diff import delta_e_cie2000

def extract_dominant_colors(image_bytes: bytes, k: int = 3) -> list[str]:
    """이미지에서 dominant colors 3개 추출 (HEX)"""
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pixels = img.reshape(-1, 3).astype(float)
    
    kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
    kmeans.fit(pixels)
    
    colors = kmeans.cluster_centers_.astype(int)
    # 빈도순 정렬
    counts = np.bincount(kmeans.labels_)
    sorted_idx = np.argsort(-counts)
    
    return [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors[sorted_idx]]


def color_similarity(colors_a: list[str], colors_b: list[str]) -> float:
    """두 색상 세트 간 유사도 (0~1, CIE2000 기반)"""
    
    def hex_to_lab(hex_color: str) -> LabColor:
        r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
        rgb = sRGBColor(r / 255, g / 255, b / 255)
        return convert_color(rgb, LabColor)
    
    if not colors_a or not colors_b:
        return 0.0
    
    # 각 색상 쌍의 최소 거리 평균
    total_dist = 0
    for ca in colors_a[:3]:
        lab_a = hex_to_lab(ca)
        min_dist = min(
            delta_e_cie2000(lab_a, hex_to_lab(cb)) for cb in colors_b[:3]
        )
        total_dist += min_dist
    
    avg_dist = total_dist / min(len(colors_a), 3)
    # deltaE 0~100 → similarity 1~0
    return max(0, 1 - avg_dist / 50)
```

### 4-3. 텍스처 매칭

```python
# python/services/texture_matcher.py

from google.cloud import vision

client = vision.ImageAnnotatorClient()

TEXTURE_MAP = {
    # Cloud Vision 라벨 → 내부 텍스처 코드
    "hardwood floor": "wood_grain",
    "wood": "wood_grain",
    "oak": "wood_grain",
    "laminate": "wood_grain",
    "marble": "marble",
    "granite": "stone",
    "tile": "ceramic",
    "porcelain": "ceramic",
    "ceramic": "ceramic",
    "concrete": "concrete",
    "brick": "concrete",
    "fabric": "fabric",
    "wallpaper": "fabric",
    "metal": "metal",
    "stainless": "metal",
}

PATTERN_MAP = {
    "herringbone": "herringbone",
    "chevron": "chevron",
    "subway": "subway",
    "hexagon": "hexagon",
    "mosaic": "mosaic",
    "striped": "striped",
}

def classify_texture(image_bytes: bytes) -> dict:
    """이미지의 텍스처와 패턴 분류"""
    
    image = vision.Image(content=image_bytes)
    response = client.label_detection(image=image, max_results=20)
    
    labels = [label.description.lower() for label in response.label_annotations]
    
    texture = "unknown"
    pattern = "plain"
    
    for label in labels:
        for key, val in TEXTURE_MAP.items():
            if key in label:
                texture = val
                break
        for key, val in PATTERN_MAP.items():
            if key in label:
                pattern = val
                break
    
    return {"texture": texture, "pattern": pattern}


def texture_match_score(
    query: dict,    # {"texture": "wood_grain", "pattern": "herringbone"}
    product: dict   # {"material_texture": "wood_grain", "pattern_type": "herringbone"}
) -> float:
    """텍스처 매칭 점수 (0~1)"""
    
    score = 0.0
    
    # 재질 매칭 (60%)
    if query["texture"] == product.get("material_texture"):
        score += 0.6
    elif query["texture"] != "unknown":
        score += 0.0
    else:
        score += 0.3  # unknown은 중립
    
    # 패턴 매칭 (40%)
    if query["pattern"] == product.get("pattern_type"):
        score += 0.4
    elif query["pattern"] == "plain" and product.get("pattern_type") in ("straight", "plain"):
        score += 0.3
    
    return score
```

### 4-4. 건자재 DB 사전 임베딩 (1회 실행)

```python
# scripts/generate-material-embeddings.py

"""
건자재 DB의 모든 제품 이미지에 대해 CLIP 임베딩 생성
Supabase material_embeddings 테이블에 저장
"""

import os
import requests
from supabase import create_client
from clip_embedder import get_clip_embedding

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"]
)

# 모든 제품 조회
products = supabase.table("material_products") \
    .select("id, texture_url, thumbnail_url") \
    .execute()

for product in products.data:
    image_url = product["texture_url"] or product["thumbnail_url"]
    if not image_url:
        continue
    
    # 이미지 다운로드
    img_response = requests.get(image_url)
    if img_response.status_code != 200:
        continue
    
    # CLIP 임베딩 생성
    embedding = get_clip_embedding(img_response.content)
    
    # 저장
    supabase.table("material_embeddings").insert({
        "product_id": product["id"],
        "embedding_type": "texture",
        "embedding": embedding,
        "source_image_url": image_url,
    }).execute()
    
    print(f"Embedded: {product['id']}")

print("Done!")
```

---

## 5. 융합 매칭 API

```python
# python/services/material_matcher.py

from clip_embedder import get_clip_embedding
from color_matcher import extract_dominant_colors, color_similarity
from texture_matcher import classify_texture, texture_match_score
from supabase import create_client
import os

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# YOLO 클래스 → 건자재 카테고리 매핑
YOLO_TO_CATEGORY = {
    "wood_floor_straight": "FLOORING",
    "wood_floor_herringbone": "FLOORING",
    "tile_floor_large": "BATH_TILE",
    "tile_floor_small": "BATH_TILE",
    "marble_floor": "FLOORING",
    "wallpaper_plain": "WALLPAPER",
    "wallpaper_pattern": "WALLPAPER",
    "paint_wall": "PAINT",
    "tile_wall": "BATH_TILE",
    "toilet": "TOILET",
    "vanity_cabinet": "VANITY",
    "wall_basin": "VANITY",
    "shower_partition": "SHOWER_BATH",
    "bathtub": "SHOWER_BATH",
    "kitchen_upper_cabinet": "KITCHEN_CABINET",
    "kitchen_lower_cabinet": "KITCHEN_CABINET",
    "kitchen_countertop": "KITCHEN_CABINET",
    "range_hood": "KITCHEN_SINK",
    "kitchen_sink": "KITCHEN_SINK",
    "door_single": "DOOR_ROOM",
    "door_sliding": "DOOR_ROOM",
    "door_entrance": "ENTRY_DOOR",
    "baseboard": "BASEBOARD",
    "recessed_light": "LIGHTING",
    "pendant_light": "LIGHTING",
    "built_in_closet": "WARDROBE",
    "shoe_cabinet": "SHOE_CABINET",
}


async def match_material(
    cropped_image: bytes,
    yolo_class: str,
    top_k: int = 3,
) -> list[dict]:
    """크롭 이미지 → 건자재 DB Top-K 매칭"""
    
    category = YOLO_TO_CATEGORY.get(yolo_class)
    if not category:
        return []
    
    # [병렬] 3가지 특성 추출
    clip_emb = get_clip_embedding(cropped_image)
    colors = extract_dominant_colors(cropped_image)
    texture = classify_texture(cropped_image)
    
    # pgvector 검색 (CLIP 기준 Top-10)
    candidates = supabase.rpc("match_materials", {
        "query_embedding": clip_emb,
        "category_filter": category,
        "match_count": 10,
        "similarity_threshold": 0.3,
    }).execute()
    
    # 융합 스코어 계산
    results = []
    for cand in candidates.data:
        # 제품 상세 조회
        product = supabase.table("material_products") \
            .select("*").eq("id", cand["product_id"]).single().execute()
        
        p = product.data
        
        # 색상 유사도
        c_sim = color_similarity(colors, p.get("dominant_colors", []))
        
        # 텍스처 매칭
        t_score = texture_match_score(texture, {
            "material_texture": p.get("material_texture"),
            "pattern_type": p.get("pattern_type"),
        })
        
        # 융합
        final = (0.60 * cand["similarity"]
               + 0.25 * c_sim
               + 0.15 * t_score)
        
        results.append({
            "productId": p["id"],
            "brand": p["brand"],
            "productName": p["product_name"],
            "modelNumber": p.get("model_number"),
            "specification": p.get("specification"),
            "retailPrice": p.get("retail_price"),
            "laborPrice": p.get("labor_price"),
            "unit": p["unit"],
            "priceGrade": p.get("price_grade"),
            "thumbnailUrl": p.get("thumbnail_url"),
            "similarity": round(final, 4),
            "scores": {
                "clip": round(cand["similarity"], 4),
                "color": round(c_sim, 4),
                "texture": round(t_score, 4),
            }
        })
    
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]
```

---

## 6. 내재화 단계

### 6-1. 1단계 (현재): OpenAI CLIP API

```
비용: ~$0.0001/이미지, 4컷 × 평균 8개 감지 = 32회 = $0.0032/분석
월 1,000건 분석 시: ~$3.2/월
장점: 즉시 사용, 최고 정확도
```

### 6-2. 2단계 (3개월 후): open_clip 자체 서버

```python
# open_clip으로 전환
import open_clip
import torch

model, _, preprocess = open_clip.create_model_and_transforms(
    "ViT-L-14", pretrained="openai"
)

def get_embedding_local(image_pil):
    image = preprocess(image_pil).unsqueeze(0)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding[0].numpy().tolist()

# 비용: GPU 서버 $15/월 (Railway T4)
# 속도: ~50ms/이미지 (API 대비 2x 빠름)
```

### 6-3. 3단계 (6개월 후): 건자재 특화 fine-tuning

```python
# 건자재 이미지 쌍으로 CLIP fine-tuning
# anchor: 제품 텍스처 이미지
# positive: 같은 제품 시공 사진
# negative: 다른 제품 이미지

# Contrastive Learning으로 건자재 도메인 특화
# 예상 정확도 향상: +10~15% (Top-3 기준)
```

---

## 7. 파일 구조

```
python/services/
├── clip_embedder.py          ← CLIP 임베딩 생성
├── color_matcher.py          ← 색상 유사도
├── texture_matcher.py        ← 텍스처 분류
└── material_matcher.py       ← 융합 매칭 엔진

scripts/
├── generate-material-embeddings.py  ← DB 사전 임베딩
└── test-matching-accuracy.py        ← 매칭 정확도 검증

src/app/api/materials/
└── match/route.ts                   ← Next.js → Python 서버 프록시
```

---

## 8. 체크리스트

- [ ] OpenAI API 키 발급 (CLIP 임베딩용)
- [ ] Google Cloud Vision API 활성화
- [ ] clip_embedder.py 구현
- [ ] color_matcher.py 구현
- [ ] texture_matcher.py 구현
- [ ] material_matcher.py 융합 엔진 구현
- [ ] 건자재 DB 전체 사전 임베딩 실행
- [ ] pgvector match_materials RPC 함수 생성
- [ ] FastAPI 매칭 엔드포인트 구현
- [ ] Next.js 프록시 API 구현
- [ ] 매칭 정확도 테스트 (Top-1: 70%+, Top-3: 80%+)
- [ ] 응답 시간 테스트 (< 3초/감지 영역)
