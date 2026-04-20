# Stage 4: 통합 파이프라인 + API

> 예상 기간: 1~2주
> 선행 조건: Stage 1~3 전부 완료

---

## 1. 목표

Gemini Vision + YOLOv11x + CLIP 매칭을 **하나의 API로 통합**.
사용자가 "AI 자재 분석" 버튼 한 번으로 4개 방 전체의 정밀 견적을 생성.

---

## 2. 기술 스택

| 역할 | 기술 | 비고 |
|------|------|------|
| **오케스트레이터** | Next.js API Route | 클라이언트 요청 수신 + 결과 취합 |
| **Python 추론 서버** | FastAPI + Uvicorn | YOLO + CLIP + OpenCV 통합 |
| **GPU 추론** | Modal.com (서버리스 A10G) | 콜드스타트 ~3초, 추론 $0.0016/초 |
| **맥락 분석** | Gemini 2.5 Pro Vision | 스타일/분위기/전체 맥락 |
| **결과 캐싱** | Supabase | 동일 이미지 재분석 방지 |
| **결과 변환** | vision-material-converter.ts | SelectedMaterial[] 변환 (구현 완료) |

---

## 3. 통합 API 설계

### 3-1. 엔드포인트

```
POST /api/project/analyze-design-precise

타임아웃: 120초 (Vercel Pro maxDuration=120)
인증: 소비자 Supabase Auth (선택적)
```

### 3-2. Request

```typescript
interface PreciseAnalysisRequest {
  images: {
    imageData: string;      // base64 data URL
    roomType: string;       // living, kitchen, bedroom, bathroom
    roomName: string;       // 거실, 주방, 안방, 욕실
    floorArea?: number;     // 해당 방 면적 (m²)
  }[];
  budget?: "economy" | "standard" | "premium";
  totalArea?: number;       // 전체 전용면적 (m²)
  projectId?: string;       // 캐싱/로깅용
}
```

### 3-3. Response

```typescript
interface PreciseAnalysisResponse {
  rooms: {
    roomType: string;
    roomName: string;
    
    // Layer 1: Gemini 맥락 분석
    context: {
      overallStyle: string;             // "모던 내추럴"
      colorPalette: string[];           // ["#8B6F47", "#F5F0E8"]
      lightingType: string;             // "간접조명 + 매입등"
      estimatedGrade: string;           // "standard"
    };
    
    // Layer 2: YOLO 감지 결과
    detections: {
      class: string;                    // "wood_floor_herringbone"
      classId: number;                  // 1
      confidence: number;               // 0.94
      bbox: [number, number, number, number];  // [x1, y1, x2, y2]
    }[];
    
    // Layer 3: 건자재 DB 매칭
    matchedProducts: {
      detectionClass: string;           // "wood_floor_herringbone"
      categoryCode: string;             // "FLOORING"
      topMatches: {
        productId: string;
        brand: string;
        productName: string;
        modelNumber: string | null;
        specification: string | null;
        retailPrice: number;
        laborPrice: number;
        unit: string;
        priceGrade: string;
        thumbnailUrl: string | null;
        similarity: number;             // 융합 스코어
        scores: {
          clip: number;
          color: number;
          texture: number;
        };
      }[];
      selectedIndex: number;            // 자동 선택된 인덱스 (0)
    }[];
    
    // Layer 4: 최종 자재 목록 (SelectedMaterial[] 호환)
    materials: {
      categoryCode: string;
      categoryName: string;
      materialName: string;
      specification: string;
      unitPrice: number;
      laborPrice: number;
      unit: string;
      priceGrade: string;
      confidence: number;
      productId: string | null;
    }[];
  }[];
  
  // 전체 견적 요약
  estimateSummary: {
    totalMaterialCost: number;
    totalLaborCost: number;
    directCost: number;
    overhead: number;
    profit: number;
    vat: number;
    grandTotal: number;
    priceGrade: string;
    perPyeong: number;                  // 평당 단가
  };
  
  // 메타데이터
  analysisId: string;                   // 캐싱 키
  processingTime: {
    gemini: number;                     // ms
    yolo: number;
    matching: number;
    total: number;
  };
}
```

---

## 4. 처리 흐름

```
클라이언트 → POST /api/project/analyze-design-precise
                │
                ↓
  [Next.js API Route] (오케스트레이터)
                │
     ┌──────────┼──────────┐
     ↓                      ↓
  [Gemini 2.5 Pro]    [Python 추론 서버]
  맥락 분석 (3~5초)    │
  - 스타일             ├─ YOLO 감지 (1~2초)
  - 색감               ├─ 크롭 이미지 생성
  - 전체 분위기         ├─ CLIP 임베딩 (0.5초)
                       ├─ 색상 추출 (0.1초)
                       ├─ 텍스처 분류 (0.3초)
                       └─ pgvector 매칭 (0.1초)
     │                      │
     └──────────┬──────────┘
                │
                ↓
  [결과 융합] (Next.js)
  - Gemini 맥락 + YOLO 감지 + DB 매칭
  - SelectedMaterial[] 변환
  - calculateEstimate() 실행
  - 견적 요약 생성
                │
                ↓
  [캐싱] Supabase design_analysis_cache
                │
                ↓
  클라이언트 ← Response JSON
```

### 4-1. 병렬 처리 최적화

```
시간축 →
0s ─── 1s ─── 2s ─── 3s ─── 4s ─── 5s ─── 6s ─── 7s

[Gemini Vision] ████████████████████████  (3~5초)

[YOLO 감지]     ████████  (1~2초)
[크롭 생성]             ██  (0.2초)
[CLIP 임베딩]            █████  (0.5초/감지)    ← 감지 완료 후
[색상 추출]              ██  (0.1초)            ← 병렬
[텍스처 분류]            ████  (0.3초)           ← 병렬
[pgvector 검색]               ██  (0.1초)
[융합 스코어]                  ██  (0.1초)

[결과 병합]                        ██  (0.2초)
[견적 계산]                          ██  (0.1초)

총 예상: 5~8초 (4개 방 순차 시 20~30초)
4개 방 병렬 시: 8~12초
```

---

## 5. Python 추론 서버 (FastAPI)

### 5-1. 서버 구조

```python
# python/inference-server/main.py

from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from services.clip_embedder import get_clip_embedding
from services.color_matcher import extract_dominant_colors, color_similarity
from services.texture_matcher import classify_texture, texture_match_score
from services.material_matcher import match_material
import cv2
import numpy as np
import time

app = FastAPI(title="INPICK Vision Inference Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

# 모델 로드 (서버 시작 시 1회)
yolo_model = YOLO("models/interior-yolo-v11x.onnx", task="detect")

@app.post("/analyze")
async def analyze_image(
    file: UploadFile,
    room_type: str = Form("living"),
):
    """단일 이미지 분석 (YOLO 감지 + 매칭)"""
    
    t_start = time.time()
    image_bytes = await file.read()
    
    # 1. YOLO 감지
    t_yolo = time.time()
    results = yolo_model.predict(
        source=image_bytes, conf=0.4, iou=0.5, imgsz=1024
    )
    yolo_time = time.time() - t_yolo
    
    # 2. 감지 결과 처리
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    detections = []
    matched_products = []
    
    for r in results:
        for box in r.boxes:
            cls_name = yolo_model.names[int(box.cls)]
            conf = float(box.conf)
            bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
            
            detections.append({
                "class": cls_name,
                "classId": int(box.cls),
                "confidence": conf,
                "bbox": bbox,
            })
            
            # 3. 바운딩박스 크롭
            x1, y1, x2, y2 = [int(v) for v in bbox]
            margin = int(max(x2 - x1, y2 - y1) * 0.1)
            x1 = max(0, x1 - margin)
            y1 = max(0, y1 - margin)
            x2 = min(img.shape[1], x2 + margin)
            y2 = min(img.shape[0], y2 + margin)
            crop = img[y1:y2, x1:x2]
            crop_bytes = cv2.imencode('.jpg', crop)[1].tobytes()
            
            # 4. 건자재 매칭
            t_match = time.time()
            matches = await match_material(crop_bytes, cls_name, top_k=3)
            match_time = time.time() - t_match
            
            if matches:
                matched_products.append({
                    "detectionClass": cls_name,
                    "categoryCode": matches[0].get("categoryCode", ""),
                    "topMatches": matches,
                    "selectedIndex": 0,
                })
    
    total_time = time.time() - t_start
    
    return {
        "detections": detections,
        "matchedProducts": matched_products,
        "processingTime": {
            "yolo": round(yolo_time * 1000),
            "matching": round((total_time - yolo_time) * 1000),
            "total": round(total_time * 1000),
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model": "interior-yolo-v11x"}
```

### 5-2. Modal.com 배포 (서버리스 GPU)

```python
# python/inference-server/modal_app.py

import modal

app = modal.App("inpick-vision")

image = modal.Image.debian_slim(python_version="3.11") \
    .pip_install("ultralytics", "opencv-python-headless", "openai", 
                 "google-cloud-vision", "scikit-learn", "colormath",
                 "fastapi", "uvicorn", "supabase")

@app.cls(
    image=image,
    gpu="A10G",                  # 저비용 GPU
    container_idle_timeout=300,   # 5분 유휴 후 종료
    allow_concurrent_inputs=10,
)
class InferenceService:
    @modal.enter()
    def load_model(self):
        from ultralytics import YOLO
        self.model = YOLO("models/interior-yolo-v11x.onnx")
    
    @modal.web_endpoint(method="POST")
    async def analyze(self, request):
        # ... 위 FastAPI 로직과 동일
        pass
```

---

## 6. Next.js 통합 API

```typescript
// src/app/api/project/analyze-design-precise/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini-client";
import { convertAllRoomsVisionToMaterials } from "@/lib/services/vision-material-converter";

export const maxDuration = 120;

const PYTHON_SERVER_URL = process.env.VISION_INFERENCE_URL || "http://localhost:8200";

export async function POST(request: NextRequest) {
  const { images, budget, totalArea, projectId } = await request.json();
  
  const roomResults = [];
  
  // 4개 방 병렬 처리
  const promises = images.map(async (img) => {
    // [병렬 A] Gemini 맥락 분석
    const geminiPromise = analyzeWithGemini(img.imageData, img.roomType);
    
    // [병렬 B] Python 서버 (YOLO + 매칭)
    const yoloPromise = analyzeWithPython(img.imageData, img.roomType);
    
    const [geminiResult, yoloResult] = await Promise.all([geminiPromise, yoloPromise]);
    
    // 결과 융합
    return fuseResults(geminiResult, yoloResult, img);
  });
  
  const results = await Promise.all(promises);
  
  // 견적 계산
  const allMaterials = convertAllRoomsVisionToMaterials(
    results.map(r => ({
      roomKey: r.roomType,
      roomId: r.roomType,
      result: r,
    }))
  );
  
  // ... calculateEstimate 호출
  
  return NextResponse.json({ rooms: results, estimateSummary: {...} });
}

async function analyzeWithPython(imageData: string, roomType: string) {
  const formData = new FormData();
  // base64 → Blob 변환
  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  formData.append("file", new Blob([buffer]), "image.jpg");
  formData.append("room_type", roomType);
  
  const res = await fetch(`${PYTHON_SERVER_URL}/analyze`, {
    method: "POST",
    body: formData,
  });
  
  return res.json();
}
```

---

## 7. UI 연동

### 7-1. 디자인 페이지 변경사항

```
기존: "AI 자재 분석" 버튼 → Gemini Vision만 호출
변경: "AI 자재 분석" 버튼 → /analyze-design-precise 호출 (3-Layer 통합)

결과 표시:
1. AI 채팅에 분석 결과 메시지 (자재 목록 + 매칭 제품)
2. 각 자재별 Top-3 후보 카드 (사용자가 변경 가능)
3. "이 자재로 견적 보기" → estimate 탭 이동
```

### 7-2. 렌더링(자재선택) 페이지 변경사항

```
기존: 사용자가 카탈로그에서 수동 선택
변경: Vision 분석 결과가 자동 채워짐 (pre-filled)
  → 사용자는 확인만 하거나, 원하면 변경
  → 변경 시 카탈로그에 건자재 DB 실제 제품 표시
```

---

## 8. 환경 변수

```env
# .env.local 추가 항목

# Python 추론 서버 URL
VISION_INFERENCE_URL=http://localhost:8200

# Modal.com (프로덕션)
# VISION_INFERENCE_URL=https://inpick--vision-analyze.modal.run

# OpenAI API (CLIP 임베딩)
OPENAI_API_KEY=sk-...

# Google Cloud Vision
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

---

## 9. 체크리스트

- [ ] Python 추론 서버 기본 구조 (FastAPI)
- [ ] YOLO + CLIP + 색상 + 텍스처 통합 파이프라인
- [ ] Modal.com 계정 생성 + 배포 테스트
- [ ] Next.js 통합 API (/analyze-design-precise)
- [ ] Gemini + Python 병렬 호출 구현
- [ ] 결과 융합 로직 (fuseResults)
- [ ] SelectedMaterial[] 변환 연동
- [ ] calculateEstimate 자동 실행
- [ ] 디자인 페이지 UI 업데이트 (Top-3 후보 카드)
- [ ] 렌더링 페이지 자동 채움 연동
- [ ] 분석 결과 캐싱 (Supabase)
- [ ] E2E 테스트 (다양한 스타일 × 예산)
- [ ] 성능 테스트 (4개 방 병렬 < 15초 목표)
- [ ] 에러 핸들링 (Python 서버 다운 시 Gemini 단독 폴백)
