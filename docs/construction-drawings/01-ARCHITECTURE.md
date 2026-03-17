# 01. 전체 아키텍처

## 시스템 개요

사용자의 평면도(ParsedFloorPlan)만으로 **입면전개도 + 가구배치도 + 전기배선도** 3종 시공도면을 자동 생성하는 시스템.

## 데이터 플로우

```
[입력] 사용자 도면 데이터
  │
  ▼
ParsedFloorPlan (미터 좌표)
  │
  ├─ adaptParsedFloorPlan()
  │   → FloorPlanProject (mm 좌표, BIM 모델)
  │
  ▼
[계산 엔진]
  │
  ├─ calculateAllElevations(project, materials)
  │   → 방별 4대 벽면(A/B/C/D) 전개 데이터
  │   → 개구부(문/창) 위치 + 설비 위치 + 자재 정보
  │
  ├─ generateAllElectricalPlacements(project, wallElevations)
  │   → 한국 주거 표준 기반 전기 심볼 배치
  │   → 13개 방 타입별 룰 기반
  │
  └─ autoPlaceFurniture(project)
      → 방 타입별 기본 가구 세트 자동 배치
      → 벽 근접 배치 알고리즘
  │
  ▼
[SVG 도면 생성] (svg-generators.ts)
  │
  ├─ generateFurnitureLayoutSVG()     → 가구배치도
  ├─ generateElectricalPlanSVG()      → 전기배선도
  └─ generateElevationSVG() × N방     → 입면전개도 (방당 4면)
  │
  ▼
[AI 보강] (gemini-enhancer.ts) — 선택사항
  │
  ├─ analyzeFurnitureLayout()         → 가구 배치 품질 평가
  ├─ generateElevation3DDescription() → 3D 렌더 묘사 텍스트
  └─ generateElevation3DImage()       → 포토리얼 이미지 (미래)
  │
  ▼
[출력]
  │
  ├─ Supabase Storage 업로드 (SVG/PNG)
  ├─ DB 저장 (construction_drawings 테이블)
  └─ PDF 패키징 (A3 가로, 표지 + 도면 N장)
```

## SSE 7단계 파이프라인 (generate-drawings API)

```
POST /api/project/generate-drawings { contractId }
  │
  ├─ Step 0 (0-5%)    데이터 로드 (계약/프로젝트/도면)
  ├─ Step 1 (5-25%)   입면도 계산 + 전기 배치
  ├─ Step 2 (25-40%)  가구배치도 + 전기배선도 SVG
  ├─ Step 3 (40-55%)  입면전개도 SVG (방별 4면)
  ├─ Step 4 (55-75%)  Gemini AI 보강 (가구 분석 + 3D 묘사)
  ├─ Step 5 (75-90%)  Supabase Storage 이미지 업로드
  └─ Step 6 (90-100%) DB 저장 + 완료
```

## 좌표계 변환

```
ParsedFloorPlan (미터)
  → adaptParsedFloorPlan()
  → FloorPlanProject (밀리미터, BIM)
    → elevation-calculator (mm 기준)
    → svg-generators (mm × SCALE → SVG px)
```

| 단계 | 단위 | 용도 |
|------|------|------|
| ParsedFloorPlan | 미터(m) | 도면 인식 결과 |
| FloorPlanProject | 밀리미터(mm) | BIM 계산 |
| SVG 렌더링 | px (mm × 0.15 평면 / mm × 0.12 입면) | 화면 출력 |
| PDF | mm (A3: 420×297mm) | 인쇄 출력 |

## 의존성 맵

```
construction-drawing.ts (타입)
  ↑
  ├── elevation-calculator.ts ← floor-plan.ts (BIM 타입)
  ├── electrical-placement.ts ← elevation-calculator 결과
  ├── svg-generators.ts ← drawing-constants.ts + 위 두 엔진 결과
  ├── gemini-enhancer.ts ← gemini-client.ts
  └── construction-drawing-pdf.ts ← jsPDF + NanumGothic 폰트
```

## 통합 지점

| 위치 | 파일 | 역할 |
|------|------|------|
| 소비자 계약 상세 | `contract/[id]/page.tsx` | 도면 생성 버튼 + 갤러리 |
| 사업자 프로젝트 | `contractor/projects/page.tsx` | "시공도면 보기" 링크 |
| 관리자 로드맵 | `admin/roadmap/page.tsx` | 기능 소개 (in_progress) |
