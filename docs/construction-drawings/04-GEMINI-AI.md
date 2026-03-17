# 04. Gemini AI 보강 파이프라인

> 파일: `src/lib/floor-plan/drawing/gemini-enhancer.ts` (266줄)

## 사용 모델

| 기능 | 모델 | 입력 | 출력 |
|------|------|------|------|
| 가구배치 분석 | gemini-3-pro-preview | SVG→PNG 이미지 | JSON (점수+제안) |
| 3D 묘사 생성 | gemini-3-pro-preview | 텍스트 (벽면 데이터) | JSON (설명+스타일) |
| 3D 렌더 이미지 | gemini-3-pro-image-preview | SVG→PNG + 프롬프트 | PNG 이미지 |

## 1. 가구배치도 AI 분석

### `analyzeFurnitureLayout(svgPngBuffer)`

**프롬프트 요점**:
- 600mm 최소 통행로 확보 여부
- 가구 그룹 논리성 (식탁 세트, 거실 세트)
- 문/창문 간섭(clearance) 확인
- 동선 패턴 평가

**응답 스키마**:
```json
{
  "layoutScore": 8,          // 0-10
  "suggestions": [
    "소파를 창 방향으로 20cm 이동하면 채광 개선",
    "침대와 옷장 사이 통행로 500mm → 600mm 확보 권장"
  ],
  "furnitureCount": 12,
  "mainIssues": ["거실 동선 협소"]
}
```

## 2. 입면도 3D 묘사 생성

### `generateElevation3DDescription(elevation, roomName)`

**입력**: WallElevation 데이터 (벽 크기, 개구부, 자재 정보)

**프롬프트 요점**:
- 자재 조합의 완성된 인테리어 묘사
- 조명/분위기(ambiance) 표현
- 색상 팔레트 HEX 추출
- 스타일 분류

**응답 스키마**:
```json
{
  "description": "밝은 원목 마루와 따뜻한 베이지 톤 벽지가 조화를 이루는...",
  "ambiance": "은은한 간접 조명이 벽면을 부드럽게 비추며...",
  "colorPalette": ["#E8D5B7", "#F5F0EB", "#8B7355"],
  "style": "모던 내추럴"
}
```

## 3. 3D 렌더 이미지 생성 (향후)

### `generateElevation3DImage(elevation, roomName, svgPngBuffer)`

**현재 상태**: 코드 작성 완료, 실서비스 미적용
**모델**: gemini-3-pro-image-preview
**입력**: 입면도 SVG를 PNG로 변환한 참조 이미지 + 자재 프롬프트
**출력**: 포토리얼리스틱 인테리어 렌더 PNG

**프롬프트 요점**:
```
이 시공도면 입면도를 참고하여 같은 벽면의 완성된 인테리어 3D 렌더링 이미지를 생성해주세요.
방 이름: {roomName}
자재: {바닥: 원목마루, 벽: 실크도배, 천장: 석고보드}
스타일: 한국 아파트 실내
```

## 재시도 로직

```typescript
const MAX_RETRIES = 2;
const RATE_LIMIT_WAIT = 15000; // 15초

async function callGeminiWithRetry(prompt, imageBuffer?, mimeType?) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client.models.generateContent({...});
    } catch (err) {
      if (err.status === 429 && attempt < MAX_RETRIES) {
        await sleep(RATE_LIMIT_WAIT);
        continue;
      }
      throw err;
    }
  }
}
```

## 실서비스 적용 시 고려사항

### 비용 추정 (도면 1세트 기준)
- 가구 분석: 1회 API 호출 (이미지 입력)
- 3D 묘사: 방 수 × 4벽면 = 최대 20회 (텍스트)
- 3D 이미지: 방 수 × 4벽면 = 최대 20회 (이미지 생성) ← 가장 비쌈
- **총합**: 텍스트 ~21회 + 이미지 ~20회

### 최적화 방안
1. 주요 방(거실/주방/안방/욕실)만 AI 보강 → 나머지 SVG only
2. 3D 이미지는 대표 벽면(A면)만 생성 → 나머지 묘사 텍스트만
3. 결과 캐싱 → 같은 도면+자재 조합은 DB 히트
4. 배치(batch) 처리 → 여러 벽면을 하나의 프롬프트로 묶기

### 품질 검증 필요 항목
- [ ] Gemini 3D 이미지의 한국 아파트 인테리어 정확도
- [ ] 자재 색상/질감 반영도
- [ ] 개구부(문/창) 위치 반영 정확도
- [ ] 설비(세면대/양변기 등) 표현 사실성
- [ ] 일관성: 같은 방의 4벽면 스타일 통일
