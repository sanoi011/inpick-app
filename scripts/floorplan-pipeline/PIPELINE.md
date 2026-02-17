# INPICK 도면 처리 파이프라인

## 개요

네이버 부동산 아파트 평면도 원본(워터마크 포함)을 Gemini Pro AI로 클린 처리하여
고품질 도면 이미지를 생성하는 4단계 배치 파이프라인.

## 파이프라인 단계

```
original.jpg (네이버 원본, 워터마크 포함)
    │
    ▼ [Step 1] Gemini Pro 클린
clean.png (워터마크/텍스트 제거, 벽선+바닥 텍스처 재생성)
    │
    ├──▶ [Step 2] sharp.flop() 좌우 반전
    │    clean_mirror.png
    │
    ├──▶ [Step 3] Gemini Pro 치수 추가
    │    final.png (기본형 + 치수)
    │
    └──▶ [Step 4] Gemini Pro 치수 추가 (미러 버전)
         final_mirror.png (미러형 + 치수)
```

**핵심 규칙**: 치수는 반드시 미러링 후 각각 별도로 추가.
`sharp.flop(final.png)`하면 치수 텍스트가 거꾸로 됨.

## 필수 환경

### API 키
```bash
# .env.local
GOOGLE_GEMINI_API_KEY=AIzaSy...  # Google AI Studio Tier 1 이상
```

- **모델**: `gemini-3-pro-image-preview` (Pro 전용, 이미지 생성 지원)
- **Tier 1 필수**: 무료 티어는 일일 5RPD 제한 → 즉시 소진됨
- **일일 한도**: Tier 1 = 1,500 RPD (도면당 3호출 × 500도면/일 가능)

### Node.js 패키지
```bash
npm install @google/genai sharp
```

## 스크립트 목록

| 스크립트 | 용도 |
|---------|------|
| `batch-process.mjs` | 전체 배치 파이프라인 (4단계) |
| `download-originals.mjs` | 네이버에서 원본 JPG 다운로드 |
| `deploy-processed.mjs` | saved_plans → public/floorplans/images 배포 |
| `process-selected.mjs` | 선택 도면만 Pro 처리 (테스트용) |
| `process-mirror-dim.mjs` | clean_mirror에만 치수 추가 (보조) |

## 디렉토리 구조

```
scripts/floorplan-pipeline/
├── saved_plans/
│   └── 대전유성구/
│       ├── 반석2단지계룡리슈빌/
│       │   ├── 130_97.36m2/
│       │   │   ├── original.jpg      ← 네이버 원본
│       │   │   ├── clean.png         ← Step 1 결과
│       │   │   ├── clean_mirror.png  ← Step 2 결과
│       │   │   ├── final.png         ← Step 3 결과 (웹 표시용)
│       │   │   └── final_mirror.png  ← Step 4 결과 (웹 미러용)
│       │   ├── 162_132.31m2/
│       │   └── 189_150.01m2/
│       ├── 네이처뷰/
│       │   ├── 74A1_51.88m2/   (확장형)
│       │   ├── 85A1_59.69m2/   (확장형)
│       │   └── 85B1_59.99m2/   (확장형)
│       └── 호반써밋그랜드파크3BL/
│           ├── 115A_84.97m2/
│           └── 116B_84.98m2/
│
├── batch-process.mjs
├── download-originals.mjs
├── deploy-processed.mjs
└── PIPELINE.md (이 문서)
```

## 사용법

### 1. 원본 다운로드 (이미 완료된 경우 건너뜀)
```bash
node scripts/floorplan-pipeline/download-originals.mjs
```
- `src/lib/data/naver-cache.json`에서 대전유성구 아파트 목록 읽기
- 네이버 부동산 이미지 URL로 `original.jpg` 다운로드
- 이미 존재하는 파일은 건너뜀

### 2. 배치 처리 실행
```bash
node scripts/floorplan-pipeline/batch-process.mjs
```
- `saved_plans/대전유성구/` 하위의 모든 `original.jpg`를 스캔
- 이미 처리된 파일(final.png + final_mirror.png 존재)은 건너뜀
- Gemini Pro 호출 간 15초 대기 (rate limit 방지)
- 결과: `batch-results.json`에 처리 로그 저장

### 3. 웹 앱 배포
```bash
node scripts/floorplan-pipeline/deploy-processed.mjs
```
- `saved_plans/` → `public/floorplans/images/` 복사
- `manifest.json` 자동 갱신
- 네이버 캐시 데이터와 교차 검증

### 4. Git 커밋 + Vercel 배포
```bash
git add public/floorplans/images/
git commit -m "Add processed floor plans"
git push  # Vercel 자동 배포
```

## Gemini Pro 프롬프트

### CLEAN_PROMPT (Step 1)
- 모든 텍스트/글자 완전 제거 (방 이름, 면적, 치수)
- 모든 설비/가구 제거
- 워터마크 제거 (NAVER, BUSINESS PLATFORM 등)
- 공용 면적 제거 (엘리베이터, 계단실, 복도)
- 벽체: 외벽 두꺼운 실선, 내벽 얇은 실선, 솔리드 채움
- 문: 여닫이 90도 아크, 미닫이 슬라이딩
- 창문: 이중 평행선 + 유리선, 열림방향
- 바닥: 방별 자재 텍스처 (우드 마루, 타일 등)

### DIM_PROMPT (Step 3, 4)
- 각 방 내부에 가로/세로 치수선 표시
- mm 단위 (예: 3,600)
- 가늘고 얇은 치수선 + 틱마크
- 벽선/문/창문 변경 없음
- 공간 이름 미표시, 치수만

## Rate Limit 대응

| 상황 | 대응 |
|------|------|
| 429 / RESOURCE_EXHAUSTED | 30초 대기 후 재시도 (최대 5회) |
| 일일 한도 소진 (limit: 0) | 다음 날 자정(UTC) 리셋 대기 |
| 두 번째 API 키 | `.env.local`에서 키 교체 |

### API 키 관리
- Google AI Studio에서 여러 프로젝트 생성 가능
- 각 프로젝트별 독립 할당량
- Tier 1 결제: $2~5/월 수준 (이미지 생성 기준)

## 처리 현황 (2026-02-17 기준)

| 단지 | complexNo | 타입수 | 처리 상태 |
|------|-----------|--------|----------|
| 반석2단지계룡리슈빌 | 11021 | 3 (130/162/189) | Pro 처리 완료 |
| 네이처뷰 (확장형) | 142785 | 3 (74A1/85A1/85B1) | Pro 처리 완료 |
| 네이처뷰 (기본형) | 142785 | 3 (74A/85A/85B) | 원본만 (미처리) |
| 호반써밋그랜드파크3BL | 135826 | 2 (115A/116B) | 원본만 (미처리) |

### 다음 처리 대상
1. 네이처뷰 기본형 3타입 (74A, 85A, 85B)
2. 호반써밋그랜드파크3BL 2타입 (115A, 116B)
3. 기타 대전유성구 아파트 (saved_plans에 719개 원본 대기 중)

## 새 아파트 추가 절차

1. `src/lib/data/naver-cache.json`에 아파트 데이터 확인
2. `download-originals.mjs` 실행 → `saved_plans/`에 원본 다운로드
3. `batch-process.mjs` 실행 → Pro 클린 + 미러 + 치수 생성
4. `deploy-processed.mjs` 실행 → `public/floorplans/images/` 배포
5. `manifest.json` 확인 → git push

## 트러블슈팅

### "limit: 0" 에러
- 일일 할당량 완전 소진 → 자정(UTC) 리셋 대기
- 또는 다른 API 키(프로젝트)로 교체

### clean.png 품질 저하 (워터마크 잔존)
- Flash 모델(`gemini-2.5-flash-image`) 사용 시 발생
- 반드시 Pro 모델(`gemini-3-pro-image-preview`) 사용

### final_mirror.png 치수 거꾸로
- `sharp.flop(final.png)` 사용 시 발생
- 올바른 방법: `clean_mirror.png` → Gemini Pro dim → `final_mirror.png`

### sharp PNG 파싱 에러
- node-canvas의 loadImage() 대신 sharp 사용
- Gemini가 생성한 PNG는 libpng 호환성 문제가 있을 수 있음
