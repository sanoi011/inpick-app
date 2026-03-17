# AI 시공도면 자동 생성 시스템 - 기술 구현 스펙

> 내부 장비 구축 완료 후 즉시 구현 착수 가능하도록 정리한 기술 문서

## 문서 목록

| 문서 | 내용 | 비고 |
|------|------|------|
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | 전체 아키텍처 + 데이터 플로우 | 시스템 설계 |
| [02-ELEVATION.md](./02-ELEVATION.md) | 입면전개도 엔진 상세 스펙 | 핵심 엔진 |
| [03-FLOORPLAN-SVG.md](./03-FLOORPLAN-SVG.md) | 평면도(가구배치도/전기배선도) SVG 생성 | 도면 3종 |
| [04-GEMINI-AI.md](./04-GEMINI-AI.md) | Gemini AI 보강 파이프라인 | AI 연동 |
| [05-PDF-EXPORT.md](./05-PDF-EXPORT.md) | PDF 패키징 + 출력 규격 | 납품물 |
| [06-API-DB.md](./06-API-DB.md) | API 라우트 + DB 스키마 + UI 컴포넌트 | 백엔드/프론트 |
| [07-INFRA-CHECKLIST.md](./07-INFRA-CHECKLIST.md) | 장비 구축 체크리스트 + 구현 순서 | 착수 준비 |
| [08-KNOWN-ISSUES.md](./08-KNOWN-ISSUES.md) | 현재 한계점 + 개선 방향 + 리스크 | 주의사항 |

## 현재 상태

- 관리자 로드맵에 "입면전개도 AI 생성" / "시공도면 자동생성 고도화" → `in_progress` 상태로 소개
- 코드 프레임워크는 전부 작성 완료 (11개 파일, ~2,500줄)
- **실서비스 적용은 장비 구축 + 품질 검증 후**

## 기존 코드 위치

```
src/lib/floor-plan/elevation/
  ├── elevation-calculator.ts     (411줄) 입면도 계산 엔진
  └── electrical-placement.ts     (301줄) 전기 배치 엔진

src/lib/floor-plan/drawing/
  ├── drawing-constants.ts        (164줄) 색상/스케일/가구 상수
  ├── svg-generators.ts           (549줄) SVG 도면 3종 생성
  └── gemini-enhancer.ts          (266줄) Gemini AI 보강

src/types/
  └── construction-drawing.ts     (233줄) 타입 정의

src/app/api/project/
  ├── generate-drawings/route.ts  (350줄) SSE 7단계 파이프라인
  └── generate-elevation/route.ts (400줄) 입면도 API (레거시)

src/components/contract/
  ├── DrawingGenerationProgress.tsx (~150줄) 진행률 UI
  └── DrawingViewer.tsx                     갤러리 뷰어

src/lib/pdf/
  └── construction-drawing-pdf.ts (237줄) A3 PDF 생성
```
