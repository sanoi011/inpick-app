# Vision 기반 정밀 견적 시스템 - 개요

> 최종 수정: 2026-04-10

## 문서 목록

| 문서 | 내용 | 스테이지 |
|------|------|---------|
| [00-overview.md](./00-overview.md) | 전체 개요 + 아키텍처 | - |
| [01-material-db.md](./01-material-db.md) | 건자재 이미지 DB 구축 | Stage 1 |
| [02-yolo-model.md](./02-yolo-model.md) | YOLOv11x 커스텀 모델 학습 | Stage 2 |
| [03-embedding-matching.md](./03-embedding-matching.md) | 이미지 임베딩 + 제품 매칭 | Stage 3 |
| [04-integration-api.md](./04-integration-api.md) | 통합 파이프라인 + API | Stage 4 |
| [05-crawling-pipeline.md](./05-crawling-pipeline.md) | 건자재 크롤링 자동화 | 인프라 |
| [06-cost-infra.md](./06-cost-infra.md) | 비용 + 인프라 + 내재화 계획 | 운영 |

---

## 전체 아키텍처

```
AI 생성 인테리어 이미지 (4컷: 거실/주방/침실/욕실)
    │
    ├─ [Layer 1] Gemini 2.5 Pro Vision
    │   └─ 전체 맥락 분석: 스타일, 색감, 분위기, 대략적 자재 카테고리
    │   └─ 역할: "이 방은 모던 내추럴이고, 밝은 우드톤 마루에 아이보리 벽"
    │
    ├─ [Layer 2] YOLOv11x 커스텀 모델
    │   └─ 30개 클래스 개별 객체 감지 (바운딩박스 + confidence)
    │   └─ 역할: "이 위치에 herringbone 마루, 저 위치에 우물천장"
    │   └─ 각 감지 영역을 이미지에서 크롭
    │
    ├─ [Layer 3] CLIP 임베딩 + 건자재 DB 매칭
    │   └─ 크롭된 이미지 → 768d 벡터 → pgvector 코사인 유사도 검색
    │   └─ 역할: "이 마루는 LX하우시스 지아소리잠 오크 (유사도 0.94)"
    │   └─ Top-3 후보 제품 + 실제 시장 단가
    │
    └─ [Layer 4] 결과 융합 + 견적 연결
        └─ Gemini 맥락 + YOLO 정밀도 + DB 실제 가격
        └─ SelectedMaterial[] 변환 → 물량산출 엔진 → 견적서
```

## 데이터 흐름

```
[입력]
  사용자가 AI 디자인 상담 → "디자인 생성" 클릭
  → Gemini Imagen 3가 4컷 렌더링 생성
  → 사용자가 "AI 자재 분석" 클릭

[처리]
  Next.js API → Python 추론 서버 (FastAPI)
    ├── Gemini 2.5 Pro Vision: JSON 구조화 분석 (3~5초)
    ├── YOLOv11x: 30클래스 감지 (1~2초 GPU)
    ├── CLIP 임베딩: 감지 영역별 768d 벡터 (0.5초)
    └── pgvector: 카테고리별 Top-3 매칭 (0.1초)
  총 소요: 10~15초

[출력]
  방별 자재 목록:
    거실 → 바닥재: LX하우시스 지아소리잠 오크 (85,000원/m²)
           벽지: 신한벽지 실크 아이보리 (7,000원/m²)
           천장: 우물천장 석고보드 + 간접등 (30,000원/m²)
           ...
    주방 → 상부장: 한샘 래핑도어 화이트 (450,000원/LM)
           ...
  
  → SelectedMaterial[] → calculateEstimate() → 견적서 PDF
```

## 핵심 원칙

1. **최고 API 우선 → 내재화**: 빠르게 프로덕션 품질 달성 후, 비용 최적화 단계에서 자체 모델로 전환
2. **3중 검증**: Gemini(맥락) + YOLO(객체) + CLIP(제품) 교차 검증으로 정확도 극대화
3. **건자재 DB = 핵심 자산**: 크롤링 + 수동 검증으로 한국 시장 실제 제품/단가 확보
4. **YOLO 모델 = 핵심 IP**: 자체 학습 모델은 기술 진입장벽이자 경쟁력
