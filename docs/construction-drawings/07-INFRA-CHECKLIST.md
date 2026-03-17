# 07. 장비 구축 체크리스트 + 구현 순서

## 장비/인프라 체크리스트

### 필수 (구현 착수 전)

- [ ] **Supabase Storage 버킷** `construction-drawings` 생성 (public 읽기)
- [ ] **Gemini API 키** — 현재 설정 완료 (`AIzaSyB6...`)
  - [ ] 일일 쿼터 확인: 도면 1세트당 ~40회 호출
  - [ ] Rate Limit 모니터링: 429 발생 빈도 체크
- [ ] **Vercel 플랜** — 현재 Hobby (타임아웃 10초)
  - [ ] Pro 플랜 업그레이드 ($20/월) → 타임아웃 300초 (5분)
  - [ ] 또는 도면 생성을 별도 서버로 분리

### 권장 (품질 향상)

- [ ] **GPU 서버** (3D 렌더 이미지 생성 시)
  - 옵션 A: Gemini 3 Pro Image → 서버리스 (추가 비용만)
  - 옵션 B: Stable Diffusion + ControlNet → GPU 서버 필요
  - 옵션 C: Comfy UI + SDXL → 로컬 GPU (RTX 3060 이상)
- [ ] **벡터 PDF 라이브러리** 검토 (svg-to-pdfkit / pdf-lib)
- [ ] **이미지 CDN** — Supabase Storage vs CloudFlare R2

### 선택 (확장)

- [ ] **ODA File Converter** 설치 (DWG→DXF 변환)
- [ ] **Python 환경** (floorplan-ai, pdf_parser)
  - Railway/Render/AWS 배포 ($5-20/월)
- [ ] **모니터링** — Sentry 에러 트래킹 + API 호출 비용 대시보드

## 구현 순서 (권장)

### Phase 0: 인프라 준비 (1일)
```
1. Supabase Storage 'construction-drawings' 버킷 생성
2. Vercel Pro 업그레이드 또는 대안 확보
3. Gemini API 쿼터 확인 + 테스트 호출
4. 기존 코드 로컬 E2E 테스트 (npm run dev → 계약 생성 → 도면 생성)
```

### Phase 1: 기존 코드 검증 (2-3일)
```
1. 84B 타입 도면으로 전체 파이프라인 E2E 실행
   - 입면도 계산 → 정확도 수동 검증 (벽 길이, 개구부 위치)
   - 전기 배치 → 한국 표준 준수 여부 확인
   - 가구 배치 → 동선 충돌 확인
2. SVG 출력 품질 검수
   - 치수선 정확도 (mm 단위 일치)
   - 개구부/설비 심볼 위치 정합성
   - 다크 배경 가독성
3. PDF 출력 검증
   - A3 인쇄 테스트
   - 한글 폰트 렌더링
   - 페이지 넘김/목차 정확성
```

### Phase 2: AI 보강 품질 검증 (3-5일)
```
1. Gemini 가구 분석 정확도 테스트 (10+ 케이스)
2. 3D 묘사 텍스트 품질 검토
3. 3D 이미지 생성 테스트 (gemini-3-pro-image-preview)
   - 한국 아파트 인테리어 적합성
   - 자재 색상/질감 반영도
   - 개구부 위치 반영 정확도
4. 비용 측정: 도면 1세트당 Gemini API 호출 비용
```

### Phase 3: 사용자 흐름 통합 (2-3일)
```
1. 계약 상세 페이지 도면 섹션 UX 확인
2. 도면 생성 진행률 UI 사용성 테스트
3. 도면 갤러리 뷰어 + PDF 다운로드 테스트
4. 사업자 측 도면 확인 플로우 테스트
5. 모바일 반응형 확인
```

### Phase 4: 프로덕션 배포 (1-2일)
```
1. 빌드 테스트 (npx next build)
2. Vercel 배포 + 환경변수 확인
3. 실사용자 테스트 (84B → 59 → 84A 순)
4. 관리자 로드맵 상태 변경: in_progress → completed
5. CLAUDE.md 업데이트
```

## 예상 소요 시간

| Phase | 일수 | 비고 |
|-------|------|------|
| 0. 인프라 | 1일 | Supabase 버킷 + Vercel Pro |
| 1. 검증 | 2-3일 | SVG/PDF 품질 검수 |
| 2. AI 품질 | 3-5일 | Gemini 이미지 테스트가 핵심 |
| 3. UX 통합 | 2-3일 | 프론트엔드 사용성 |
| 4. 배포 | 1-2일 | 프로덕션 확인 |
| **합계** | **9-14일** | 장비 준비 후 |
