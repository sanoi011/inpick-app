# INPICK 프로젝트 컨텍스트

## 프로젝트 개요
- **이름**: INPICK (인픽) - AI 기반 인테리어 견적 플랫폼
- **경로**: `C:/Users/User/Desktop/inpick-app`
- **스택**: Next.js 14, TypeScript, Tailwind CSS, Supabase, Vercel
- **GitHub**: `https://github.com/sanoi011/inpick-app.git` (main 브랜치)
- **Vercel**: GitHub 연동 자동 배포

## 기존 패턴 (반드시 준수)
- **컴포넌트**: 모든 페이지 `"use client"`, React hooks로 상태 관리
- **인증**: `localStorage`의 `contractor_token`, `contractor_id`, `contractor_name`
- **인증 훅**: `src/hooks/useContractorAuth.ts` 사용
- **UI**: Tailwind CSS + `lucide-react` 아이콘, `bg-gray-50` 배경, 흰색 카드 `border border-gray-200 rounded-xl`
- **API**: `NextRequest`/`NextResponse`, Supabase 직접 쿼리, JSON 응답
- **타입**: `src/types/`에 interface + `mapDb` 변환 함수 + STATUS_LABELS/COLORS 맵
- **레이아웃**: `src/app/contractor/layout.tsx` - 8개 메뉴 사이드바 (login/register 제외)
- **빌드 검증**: 각 Phase 완료 후 `npx next build`로 확인
- **커밋 규칙**: 커밋 후 반드시 `git push` (Vercel 자동 배포)
- **TypeScript 주의**: `s` regex flag 사용 불가 (ES2018 미만), Map iteration에 `Array.from()` 필요

## 완료된 작업 (2026-02-10)

### Phase 0: 공통 인프라
- `src/hooks/useContractorAuth.ts` - 인증 훅
- `src/app/contractor/layout.tsx` - 사이드바 레이아웃
- `src/types/project.ts`, `schedule.ts`, `finance.ts`, `notification.ts`, `contractor-ai.ts` - 타입 정의
- 기존 페이지(page.tsx, bids, ai) 레이아웃 적용

### Phase 1: 프로필 + 대시보드
- `src/app/contractor/profile/page.tsx` - 5탭 프로필 (기본정보, 공종, 서류, 포트폴리오, 리뷰)
- `src/app/contractor/page.tsx` - 대시보드 강화 (5개 요약 카드, 빠른 액션, 알림)
- API: profile, portfolio, reviews, notifications

### Phase 2: 입찰 + 프로젝트
- `src/app/contractor/bids/page.tsx` - 입찰 관리 (4탭, 필터, 입찰서 작성)
- `src/app/contractor/projects/page.tsx` - 프로젝트 관리 (공정 타임라인, 체크리스트, 이슈)
- API: projects CRUD, bids 강화 (contractorId 필터, metadata)
- DB: contractor_projects, project_phases, project_issues, project_activities

### Phase 3: 일정 + 매칭
- `src/app/contractor/schedule/page.tsx` - 일정 관리 (월간/주간/일간, 충돌 감지)
- `src/app/contractor/matching/page.tsx` - 전문업체 매칭 (6요소 점수, 협업 요청)
- API: schedule CRUD, collaboration
- DB: contractor_schedules 확장, collaboration_requests

### Phase 4: 재무
- `src/app/contractor/finance/page.tsx` - 재무 관리 (개요/청구서/지출 3탭)
- API: finance 종합, invoices, payments, expenses
- DB: invoices, payment_records, expense_records

### Phase 5: AI 비서
- `src/app/api/contractor-ai/route.ts` - 컨텍스트 인지 (프로젝트/입찰/매출/미수금/일정/평점)
- `src/app/contractor/ai/page.tsx` - 태그 파싱 ([ALERT]/[SUGGESTION]/[DATA]), 대화 이력 저장

## 사업자 8개 페이지 (와이어프레임 완성)
| 페이지 | 경로 | 상태 |
|--------|------|------|
| 대시보드 | `/contractor` | 완료 |
| 입찰 관리 | `/contractor/bids` | 완료 |
| 프로젝트 관리 | `/contractor/projects` | 완료 |
| AI 비서 | `/contractor/ai` | 완료 |
| 전문업체 매칭 | `/contractor/matching` | 완료 |
| 일정 관리 | `/contractor/schedule` | 완료 |
| 재무 관리 | `/contractor/finance` | 완료 |
| 프로필 | `/contractor/profile` | 완료 |

## DB 마이그레이션 (Supabase 적용 완료)
- `supabase/migrations/20260210000000_projects_and_bids.sql`
- `supabase/migrations/20260210100000_schedule_enhance.sql`
- `supabase/migrations/20260210200000_finance_tables.sql`

## 완료된 작업 (2026-02-11) - 소비자 프로젝트 워크플로우

### 소비자 Phase 0: 기반
- `src/types/consumer-project.ts` - ConsumerProject, CanvasAnnotation, ProjectImage, DesignDecision 등 타입
- `src/hooks/useProjectState.ts` - localStorage 기반 프로젝트 상태 관리 훅
- `src/app/project/[id]/layout.tsx` - 4탭 상단 네비게이션 (우리집 찾기|디자인하기|견적산출|견적받기)
- `src/app/project/[id]/page.tsx` - /home으로 리다이렉트

### 소비자 Phase 1: 우리집 찾기
- `src/app/project/[id]/home/page.tsx` - 3단계 주소 검색 위자드 (기존 /address 로직 재사용)

### 소비자 Phase 2: 디자인하기 (AI 에이전트)
- `src/components/project/ImageUploader.tsx` - 카메라 촬영/파일 업로드 + 썸네일 리스트
- `src/components/project/AnnotationCanvas.tsx` - 네이티브 Canvas 주석 도구 (사각형/원/화살표/프리핸드/텍스트)
- `src/components/project/DesignChat.tsx` - AI 채팅 패널 (SSE 스트리밍, 빠른 프롬프트 칩)
- `src/app/project/[id]/design/page.tsx` - 좌측 채팅 + 우측 캔버스 스플릿 레이아웃

### 소비자 Phase 3: Gemini AI 연동
- `src/app/api/project/design-ai/route.ts` - Gemini 2.0 Flash SSE 스트리밍 + Mock 폴백
  - 멀티모달 (base64 이미지 + 텍스트 + 주석 컨텍스트)
  - GOOGLE_GEMINI_API_KEY 환경변수 사용

### 소비자 Phase 4: 견적산출
- `src/components/project/CostTable.tsx` - 공간별 접이식 견적 테이블 (구분|부위|품명|시공|규격|단위|수량|재료비|노무비|경비|합계)
- `src/app/project/[id]/estimate/page.tsx` - 좌측 비용 요약/공간 비중 차트 + 우측 상세 테이블

### 소비자 Phase 5: 견적받기
- `src/app/project/[id]/bids/page.tsx` - RFQ 요약, AI 입찰 분석, 4개 Mock 입찰 카드, 업체 선정 플로우

### 소비자 Phase 6: 통합 진입점
- `src/app/project/new/page.tsx` - UUID 생성 → /project/[id]/home 리다이렉트
- Header "무료 견적 받기" → /project/new 연결
- Footer "프로젝트 시작" 링크 추가

## 소비자 프로젝트 워크스페이스 (4탭, 와이어프레임 완성)
| 탭 | 경로 | 상태 |
|----|------|------|
| 우리집 찾기 | `/project/[id]/home` | 완료 |
| 디자인하기 | `/project/[id]/design` | 완료 |
| 견적산출 | `/project/[id]/estimate` | 완료 |
| 견적받기 | `/project/[id]/bids` | 완료 |
| 프로젝트 생성 | `/project/new` | 완료 |

## 건축도면 데이터 연동 (2026-02-11)

### 데이터셋
- AI Hub 239번 건축도면 데이터 (COCO 포맷)
- SPA(공간 폴리곤) 데이터만 사용, STR/OBJ는 ID 불일치로 제외
- 10개 샘플 아파트 단위 평면도 (49~109m²)

### 전처리 스크립트
- `scripts/coco-types.ts` - COCO 타입 정의 + 카테고리 매핑
- `scripts/process-drawings.ts` - COCO → ParsedFloorPlan 변환
- 실행: `npx tsx scripts/process-drawings.ts`
- 출력: `public/floorplans/index.json` + `public/floorplans/{id}.json`

### 도면 서비스
- `src/lib/services/drawing-service.ts` - 카탈로그 캐싱, 면적+방수 매칭, 개별 도면 로딩

### 타입 확장
- `src/types/floorplan.ts` - DRESSROOM, FixtureData, wall.polygon, DRAWING source
- `src/types/consumer-project.ts` - drawingId 필드
- `src/hooks/useProjectState.ts` - setDrawingId 메서드

### 렌더링
- `src/components/viewer/FloorPlan2D.tsx` - SVG 폴리곤 렌더링 (기존 rect 폴백 유지)
  - room.polygon → `<polygon>`, 중심점 라벨, "AI 건축도면 데이터" 뱃지
  - wall.polygon, fixtures 렌더링 지원

### 워크플로우 연동
- `home/page.tsx` - 건물 선택 시 자동 도면 매칭 + 폴리곤 미리보기
- `design/page.tsx` - 도면 미니맵 (공간 클릭 → AI 상담)
- `estimate/page.tsx` - 실제 공간 데이터 기반 견적 생성

### 카테고리 매핑
| COCO ID | 이름 | RoomType |
|---------|------|----------|
| 13 | 거실 | LIVING |
| 14 | 침실 | BED/MASTER_BED |
| 15 | 주방 | KITCHEN |
| 16 | 현관 | ENTRANCE |
| 17 | 발코니 | BALCONY |
| 18 | 화장실 | BATHROOM |
| 20 | 드레스룸 | DRESSROOM |
| 19,1,22 | 기타 | UTILITY |

## 6탭 소비자 워크플로우 리디자인 (2026-02-11)

### 구조 변경: 4탭 → 6탭
| 탭 | 경로 | 상태 |
|----|------|------|
| 1. 우리집 찾기 | `/project/[id]/home` | 기존 유지 |
| 2. 도면/3D 매스 | `/project/[id]/design` | 재설계 완료 |
| 3. AI 디자인 | `/project/[id]/ai-design` | 신규 완료 |
| 4. 3D 렌더링 | `/project/[id]/rendering` | 신규 완료 |
| 5. 물량산출 | `/project/[id]/estimate` | 재설계 완료 |
| 6. 견적요청 | `/project/[id]/rfq` | 신규 완료 |

### Phase 1: 6탭 구조 + 타입 확장
- `layout.tsx` - 6탭 네비게이션 (Home/Box/Palette/Image/Calculator/FileText 아이콘)
- `src/types/credits.ts` - 크레딧 시스템 타입 (UserCredits, CreditTransaction, CREDIT_PACKAGES)
- `src/types/consumer-project.ts` - 새 상태 (FLOOR_PLAN/AI_DESIGN/RENDERING/RFQ), GeneratedImage, SelectedMaterial, SubMaterial, RenderView, ProjectRendering, EstimateItem, ProjectEstimate, ProjectRfq
- `src/hooks/useCredits.ts` - Supabase 크레딧 관리 + localStorage 폴백
- `src/hooks/useProjectState.ts` - addGeneratedImage, removeGeneratedImage, updateRendering, addRenderView, updateMaterial, setEstimate, updateRfq

### Phase 2: 탭2 - 도면/3D 매스 생성
- `src/components/project/FloorPlan3D.tsx` - Three.js 3D 매스 모델 (RoomFloor/RoomWalls/RoomLabel)
- `src/app/project/[id]/design/page.tsx` - 도면 자동 로드 or 업로드/스캐닝, 2D/3D 토글

### Phase 3: 탭3 - AI 디자인 상담
- `src/app/api/project/generate-image/route.ts` - Gemini 이미지 생성 API + Mock 폴백
- `src/app/project/[id]/ai-design/page.tsx` - 좌: AI 채팅 + 퀵 프롬프트, 우: 평면도 + 이미지 갤러리
- 크레딧 시스템 연동 (무료 1회 + 유료 크레딧)

### Phase 4: 탭4 - 3D 렌더링 + 자재수정
- `src/app/project/[id]/rendering/page.tsx` - 방별 렌더링 갤러리, 확인 체크
- 우측 패널: 자재 선택 UI (바닥/벽/천장 카테고리별 옵션, 부자재 자동 연동)
- MATERIAL_CATALOG: LIVING/BED/KITCHEN/BATHROOM 자재 데이터

### Phase 5: 탭5 - 물량산출/견적
- `src/app/project/[id]/estimate/page.tsx` - 확정 자재 기반 물량 자동 산출
- 카테고리별 노무비 비율, 공간 유형별 철거비, 부자재 산출
- 견적서 저장 → ProjectEstimate

### Phase 6: 탭6 - 견적요청
- `src/app/project/[id]/rfq/page.tsx` - 특기사항 폼 + 견적요청 발송 + 입찰 확인
- 4개 Mock 입찰 카드 (AI 추천/최저가/프리미엄/빠른 시공)
- 업체 선택 → 계약 확정 플로우

### 인증
- Google OAuth 연동 완료 (Supabase Auth)
- 카카오 로그인 버튼 활성화 완료 (Supabase 카카오 provider 설정 필요)
- `src/hooks/useAuth.ts` - user, loading, signOut

### 크레딧 시스템
- `supabase/migrations/20260211000000_credit_tables.sql` - 마이그레이션 SQL 작성 완료
- `src/hooks/useCredits.ts` - Supabase 연동 + localStorage 폴백
- `src/types/credits.ts` - UserCredits, CreditTransaction, CREDIT_PACKAGES 타입
- `.env.local`에 `GOOGLE_GEMINI_API_KEY` 항목 추가 (키 값 입력 필요)

## 소비자(고객) 측 기존 기능
- `/` - 랜딩 페이지
- `/address` - 주소 검색 (레거시, /project/new로 전환)
- `/consult` - AI 상담
- `/viewer` - 3D 뷰어
- `/estimate/[id]` - 견적 상세
- `/estimate/[id]/bids` - 입찰 목록
- `/contract/[id]` - 계약 상세
- `/auth` - 소비자 인증 (Google OAuth)

## 완료된 작업 (2026-02-12) - 소비자-사업자 RFQ 연동 + 모바일 반응형

### Phase 1: DB 마이그레이션
- `supabase/migrations/20260212000000_consumer_rfq_integration.sql`
  - `estimates` 테이블에 `address`, `space_type`, `region`, `rfq_data(JSONB)`, `consumer_project_id` 컬럼 추가
  - `estimates.status` CHECK에 `confirmed` 추가
  - `contractor_notifications` 테이블 신규 생성 (type, title, message, priority, is_read, link, reference_id)

### Phase 2: API 라우트
- `src/app/api/rfq/route.ts` (신규) - 소비자 RFQ → estimates(confirmed) + contractor_notifications 생성
- `src/app/api/contractor/notifications/route.ts` (수정) - Mock 제거 → 실제 DB 쿼리 + PATCH 읽음 처리
- `src/app/api/estimates/route.ts` (수정) - status/region 필터 + 신규 컬럼 SELECT
- `src/types/rfq.ts` (신규) - RfqSubmission, RfqPreferences, RfqResponse, ContractorNotification 타입

### Phase 3: 소비자 RFQ Supabase 연동
- `src/app/project/[id]/rfq/page.tsx` (수정)
  - MOCK_BIDS 제거 → POST /api/rfq 실제 호출
  - 30초 폴링으로 실시간 입찰 조회 (GET /api/bids)
  - AI 태그 자동 할당 (최고 평점/최저가/프리미엄/빠른 시공)
  - 입찰 0건 시 "사업자 검토 중" 대기 UI
  - PATCH /api/bids 업체 선정, POST /api/contracts 계약 체결
- `src/types/consumer-project.ts` - estimateId 필드 추가
- `src/hooks/useProjectState.ts` - setEstimateId 메서드 추가

### Phase 4: 사업자 측 RFQ 수신
- `src/app/contractor/bids/page.tsx` (수정)
  - RfqData 인터페이스, rfq_data/region/consumer_project_id 추가
  - "소비자 직접요청" 보라색 배지, RFQ 상세 패널 (희망 시작일, 예산, 특이사항)
- `src/app/contractor/page.tsx` (수정)
  - 알림 미읽음 카운트 배지, confirmed 상태 입찰 카운트

### Phase 5: 모바일 반응형 수정
- `ai-design/page.tsx` - 380px 사이드바 → `w-full md:w-[380px]` + 모바일 "AI 채팅"/"디자인 갤러리" 탭 전환
- `rendering/page.tsx` - 340px 자재 패널 → `hidden md:flex` + 모바일 플로팅 "자재 선택" 버튼 → 풀스크린 오버레이
- `estimate/page.tsx` - w-72 요약 패널 → `flex-col md:flex-row` + 모바일 접이식 합계 토글
- `design/page.tsx` - 상단/하단 바 모바일 래핑 + 뱃지 숨김

### 데이터 플로우 (RFQ 연동 후)
```
소비자 RFQ 발송 → POST /api/rfq → estimates(confirmed) + contractor_notifications
                                          ↓
사업자 대시보드 ← GET /api/notifications ← contractor_notifications
사업자 입찰 → POST /api/bids → bids(pending)
                                    ↓
소비자 입찰 확인 ← GET /api/bids ← bids 테이블 (30초 폴링)
소비자 업체 선정 → PATCH /api/bids(selected) + POST /api/contracts
```

## 완료된 작업 (2026-02-12) - E2E 흐름 완성

### consumer_id 연결 + RFQ 재방문 복구
- `rfq/page.tsx` - useAuth로 consumer user.id를 POST /api/rfq에 전달
- `rfq/page.tsx` - localStorage에 estimateId 없으면 GET /api/rfq?consumerProjectId로 Supabase 폴백 조회
- `api/rfq/route.ts` - userId 수신 → estimates.user_id 설정 (계약서 consumer_id 연결)

### 계약 → 사업자 프로젝트 자동 생성
- `api/contracts/route.ts` - 계약 생성 성공 후 contractor_projects + 7단계 공정 + 활동 로그 자동 INSERT
- 실패 시 silent fail (계약 자체는 이미 생성됨)

### 레거시 정리
- `/project/[id]/bids` - ~400줄 MOCK_BIDS → /rfq 리다이렉트로 교체
- `api/contracts` GET - consumerId 쿼리 파라미터 지원 (향후 "내 계약" 페이지용)

## 완료된 작업 (2026-02-13) - MD 스펙 적용 + 물량산출 엔진 + AI 파이프라인 + 3D 고도화

### Phase A: 17개 공종 물량산출 엔진
- `src/types/floor-plan.ts` - BIM 타입 (FloorPlanProject, Room, Wall, Opening, Fixture)
- `src/lib/floor-plan/quantity/types.ts` - QtyUnit, TradeCode, TRADE_NAMES, QuantityItem, SURCHARGE_RATES
- `src/lib/floor-plan/quantity/geometry.ts` - calcPolygonArea, calcPolygonPerimeter, calcWallLength
- `src/lib/floor-plan/quantity/adapter.ts` - `adaptParsedFloorPlan()` (ParsedFloorPlan → FloorPlanProject)
- `src/lib/floor-plan/quantity/surface-calculator.ts` - 표면적 산출 엔진
- `src/lib/floor-plan/quantity/trades/01~17` - 17개 공종 모듈 (철거/조적/미장/방수/타일/목공/바닥재/도배/천장/창호/잡철/배관/위생도기/전기/고정설비/걸레받이/정리)
- `src/lib/floor-plan/quantity/quantity-calculator.ts` - 17개 공종 통합 산출
- `src/lib/floor-plan/quantity/unit-price-db.ts` - 60+ 항목 단가DB (2025 서울 기준)
- `src/lib/floor-plan/quantity/estimate-calculator.ts` - 견적 산출 (직접비+간접비6%+이윤5%+부가세10%)
- `src/app/project/[id]/estimate/page.tsx` - 실제 QTY 엔진 연동 (공간별/공종별 뷰 전환)

### Phase B: AI 데이터 수집 파이프라인
- `supabase/migrations/20260213000000_ai_data_pipeline.sql` - 5개 테이블 (ai_conversations, floor_plan_parse_logs, quantity_calculations, construction_cases, construction_knowledge)
- `src/app/api/ai-log/route.ts` - POST 대화 로깅, PATCH 피드백
- `src/app/api/quantity-log/route.ts` - POST 물량산출 결과 로깅
- 사업자 AI 비서 (`contractor/ai/page.tsx`) - 대화 자동 로깅 + 피드백 UI
- 소비자 AI 디자인 (`ai-design/page.tsx`) - 대화 자동 로깅 + 피드백 UI
- 견적 페이지 - 물량산출 결과 자동 로깅

### Phase C: LH 표준시방 + 설비 도면 PDF 학습
- `scripts/extract-lh-knowledge.ts` - PDF 텍스트 추출 → construction_knowledge 테이블
  - 실행: `npx tsx scripts/extract-lh-knowledge.ts`
  - 5개 PDF (LH 표준시방 4개 + 설비 도면 1개)
- `design-ai`, `contractor-ai` 라우트 - construction_knowledge 검색 → 시스템 프롬프트 컨텍스트

### Phase D: 3D 렌더링 고도화
- `src/lib/floor-plan/materials.ts` - PBR 재질 시스템 (벽면/마루/타일/유리/스테인리스/도기/천장)
- `src/components/project/FloorPlan3D.tsx` - 전면 개선
  - PBR 재질 적용 (roughness/metalness/envMapIntensity)
  - Environment 프리셋 조명 (apartment)
  - SSAO + Bloom 후처리 효과
  - 벽체 개구부 표현 (문 상부/창문 하부+상부+유리)
  - 카메라 모드 (자유/아이소/탑뷰)
  - 천장 토글
  - 공간 타입별 바닥 재질 자동 매핑

## 완료된 작업 (2026-02-14) - 계약 페이지 + 자재 DB + 프로젝트 동기화 + 결제

### Phase 1: 소비자 "내 계약" 페이지
- `src/app/contracts/page.tsx` (신규) - 계약 목록 (요약 카드 4종, 카드 리스트, 빈 상태 UI)
- `src/components/landing/Header.tsx` (수정) - "내 프로젝트" → `/projects`, "내 계약" 링크 추가 (데스크톱+모바일)
- `src/app/contract/[id]/page.tsx` (수정) - 뒤로가기 소비자/사업자 분기 (`/contracts` vs `/contractor/bids`)

### Phase 2: 자재 카탈로그 DB 마이그레이션
- `supabase/migrations/20260214000000_material_catalog_seed.sql` (신규) - 3개 테이블 + SEED 데이터 (24옵션, 25부자재)
  - `material_room_catalog` (room_type, category, part)
  - `material_options` (catalog_id FK, name, spec, price, unit)
  - `material_sub_items` (option_id FK, name, specification, unit_price, unit)
- `src/app/api/materials/route.ts` (신규) - GET /api/materials?roomType=LIVING
- `src/hooks/useMaterialCatalog.ts` (신규) - DB 로드 + 캐싱 + 하드코딩 폴백
- `src/app/project/[id]/rendering/page.tsx` (수정) - MATERIAL_CATALOG 상수 제거 → useMaterialCatalog 훅 사용

### Phase 3: 소비자 프로젝트 Supabase 동기화
- `supabase/migrations/20260214100000_consumer_projects.sql` (신규) - consumer_projects 테이블 + RLS
- `src/app/api/consumer-projects/route.ts` (신규) - GET/POST/PATCH
- `src/hooks/useProjectState.ts` (수정) - localStorage-first + background Supabase sync (1초 디바운스)
  - 로드 시: localStorage → Supabase fetch → 더 최신 것 사용
  - 저장 시: localStorage 즉시 + Supabase fire-and-forget
  - base64 이미지 데이터 제외하여 전송
- `src/app/projects/page.tsx` (신규) - 내 프로젝트 목록 (Supabase + localStorage 병합)

### Phase 4: Toss Payments 결제 시스템
- `src/app/api/payments/checkout/route.ts` (신규) - 결제 세션 생성 (Mock/실제 분기)
- `src/app/api/payments/confirm/route.ts` (신규) - Toss API 검증 → 크레딧 충전
- `src/app/payments/success/page.tsx` (신규) - 결제 성공 UI + confirm API 호출
- `src/app/payments/fail/page.tsx` (신규) - 에러 메시지 + 재시도
- `src/components/project/CreditChargeModal.tsx` (신규) - 패키지 선택 → 결제 (Toss SDK 동적 로드 또는 Mock 모드)
- `src/app/project/[id]/ai-design/page.tsx` (수정) - CreditChargeModal 컴포넌트 사용
- `src/app/project/[id]/rendering/page.tsx` (수정) - 크레딧 부족 시 CreditChargeModal 표시
- `.env.local` - `TOSS_PAYMENTS_CLIENT_KEY`, `TOSS_PAYMENTS_SECRET_KEY` 추가 (빈값 = Mock 모드)

## 완료된 작업 (2026-02-14) - 관리자 대시보드

### 관리자 인증 + 레이아웃
- `src/hooks/useAdminAuth.ts` (신규) - localStorage 기반 관리자 인증 훅
- `src/app/admin/login/page.tsx` (신규) - 독립 로그인 페이지
- `src/app/admin/layout.tsx` (신규) - 다크 테마 사이드바 (9개 메뉴, 빨간 액센트)
- `src/app/api/admin/login/route.ts` (수정) - 응답에 admin id 추가
- `src/app/admin/page.tsx` (수정) - 로그인/탭 제거, 대시보드 통계만 유지 (9개 지표)

### 관리자 API (5개 신규 + 1개 수정)
- `src/app/api/admin/users/route.ts` (신규) - 소비자/사업자 목록, 검색, 페이지네이션
- `src/app/api/admin/projects/route.ts` (신규) - 소비자 프로젝트 전체 조회
- `src/app/api/admin/credits/route.ts` (신규) - 크레딧 조회 + 수동 부여 (GET/POST)
- `src/app/api/admin/ai-logs/route.ts` (신규) - AI 대화 로그 조회
- `src/app/api/admin/contracts/route.ts` (신규) - 입찰/계약 조회
- `src/app/api/admin/stats/route.ts` (수정) - 9개 통계 지표로 확장

### 관리자 서브페이지 (7개 신규)
- `src/app/admin/users/page.tsx` - 소비자/사업자 탭, 테이블, 검색, 페이지네이션
- `src/app/admin/projects/page.tsx` - 상태 필터, 행 확장 JSONB 상세
- `src/app/admin/contracts/page.tsx` - 입찰/계약 탭, 상태 필터
- `src/app/admin/credits/page.tsx` - 요약 카드, 사용자별/거래별, 수동 부여 폼
- `src/app/admin/ai-logs/page.tsx` - 에이전트 타입/평점 필터, 행 확장 메시지 상세
- `src/app/admin/materials/page.tsx` - 자재/노임/간접비 단가 카드 + 크롤링
- `src/app/admin/crawlers/page.tsx` - 크롤러 로그 테이블 + 실행
- `src/app/admin/settings/page.tsx` - 플랫폼 정보, 관리자 계정, 환경변수 상태

### 크레딧 바이패스
- `src/hooks/useCredits.ts` (수정) - `isAdmin()` 감지 → `canGenerate()`, `spendCredits()` 바이패스
- 관리자 로그인 시 소비자 워크플로우 전체 무제한 사용 가능

### 관리자 계정
- ID: `tjsqhs011@naver.com` / PW: `inpick2026!` (환경변수 ADMIN_PASSWORD)
- admin_profiles 테이블에 시드 완료 (super_admin 권한)
- 홈페이지 하단 Footer "관리자" 링크 → `/admin` (기존 유지)

## 관리자 페이지 (서브경로 구조)
| 페이지 | 경로 | 상태 |
|--------|------|------|
| 로그인 | `/admin/login` | 완료 |
| 대시보드 | `/admin` | 완료 |
| 사용자 관리 | `/admin/users` | 완료 |
| 프로젝트 | `/admin/projects` | 완료 |
| 계약/입찰 | `/admin/contracts` | 완료 |
| 크레딧 | `/admin/credits` | 완료 |
| AI 로그 | `/admin/ai-logs` | 완료 |
| 자재/단가 | `/admin/materials` | 완료 |
| 크롤러 | `/admin/crawlers` | 완료 |
| 설정 | `/admin/settings` | 완료 |

## 완료된 작업 (2026-02-15) - 2D/3D 뷰어 엔지니어링 아이덴티티 업그레이드

### 방향성
- "아키스케치는 디자인, 인픽은 엔지니어링" — 정밀 치수선, 구조 정보, 기술적 컬러 팔레트
- 참조: `reference/요구수준/1-1.png`(2D), `1-3.png`(3D), `INPICK-CLAUDE-CODE-PROMPTS.md`

### Phase 1: 공통 상수 + 재질
- `src/lib/floor-plan/viewer-constants.ts` (신규) - 엔지니어링 컬러 팔레트
  - `ENG_COLORS`: 벽체(#2D2D3D/#4A4A5A), 공간별 반투명 채우기, 문(#E67E22), 창(#60A5FA), 치수선, 설비, 뱃지, 선택/호버
  - `VIEWER_SCALE = 50` (1m = 50px)
- `src/lib/floor-plan/materials.ts` (수정) - `WALL_DARK`, `WALL_DARK_INTERIOR` PBR 재질 추가

### Phase 2: 2D 뷰어 전면 개선 (285→617줄)
- `src/components/viewer/FloorPlan2D.tsx` (전면 개선)
  - **팬/줌**: viewBox 상태, 마우스 휠 줌(커서 기준), 드래그 패닝, `forwardRef`+`useImperativeHandle` (resetView/zoomIn/zoomOut)
  - **벽체**: 두꺼운 채워진 다크 폴리곤 (법선 벡터 기반 4꼭짓점), 코너 채움 (공유 끝점 감지)
  - **문**: 여닫이 90° 아크 + 잎선, 미닫이 화살표 마커
  - **창문**: 이중선 (프레임 2개 평행선 + 중앙 유리선), rotation 지원
  - **치수선**: 외벽 mm 단위, tick mark + 연장선(점선) + 회전 텍스트, 바운딩박스 합성 치수
  - **설비 심볼**: 양변기(타원+사각), 세면대(반원+수전), 싱크대(이중볼), 욕조(중첩 둥근사각), 가스레인지(4원 버너)
  - **렌더 순서**: 그리드 → 방채우기 → 설비 → 벽체 → 문/창 → 치수선 → 라벨 → 뱃지
  - **Props**: `showDimensions`, `showFixtures` 추가, `FloorPlan2DHandle` export

### Phase 3: 3D 뷰어 개선 (509→617줄)
- `src/components/project/FloorPlan3D.tsx` (개선)
  - **벽체**: `WALL_PAINT` → `WALL_DARK`/`WALL_DARK_INTERIOR` 다크 재질
  - **문틀 3D**: `DoorFrame3D` — 좌/우 기둥 + 상부 헤더 (BoxGeometry, #4A4A5A)
  - **창틀 3D**: `WindowFrame3D` — 4면 프레임(흰색) + 하부 창턱(TILE 재질)
  - **설비 3D**: `Fixture3D` — 양변기/세면대/싱크/욕조/가스레인지 프리미티브 (CERAMIC/STAINLESS/WOOD_FLOOR 재질)
  - **조명**: ambient 0.4, directional [12,18,8] 0.6, fill [-8,10,-6] 0.2, 그림자 카메라 ±20
  - **외부 제어**: `cameraMode?`, `showCeiling?`, `showLabels?` props (내부 상태 폴백)
  - **CameraMode 타입 export** (ViewerToolbar에서 import)

### Phase 4: 하단 뷰어 툴바
- `src/components/viewer/ViewerToolbar.tsx` (신규, ~140줄)
  - 3단 레이아웃: 좌(2D/3D 토글 + 카메라 프리셋) | 중앙(줌) | 우(치수/천장/구조 토글)
  - lucide-react 아이콘, `bg-white/95 backdrop-blur-sm`, 활성 `bg-gray-800 text-white`

### Phase 5: 통합
- `src/app/project/[id]/design/page.tsx` (수정)
  - 상태 리프트업: viewMode, cameraMode, showCeiling, showDimensions, showEngInfo
  - `floorPlan2DRef` → 2D 뷰어 imperative handle
  - 상단 바: 2D/3D 토글 제거 (→ 하단 툴바), 뱃지 "INPICK 구조분석" (다크 슬레이트)
  - 하단 `<ViewerToolbar>` 삽입 (뷰어 ↔ 정보 바 사이)

### 뷰어 아키텍처
```
design/page.tsx (상태 소유)
  ├── FloorPlan2D (ref: resetView/zoomIn/zoomOut)
  │   ├── SVG viewBox 팬/줌
  │   ├── WallSegmentSVG + WallCornerJoins
  │   ├── DoorSVG / WindowSVG
  │   ├── DimensionLines
  │   └── FixtureSVG (건축 심볼)
  ├── FloorPlan3D (props: cameraMode, showCeiling)
  │   ├── R3F Canvas + Scene
  │   ├── DoorFrame3D / WindowFrame3D
  │   ├── Fixture3D (프리미티브)
  │   └── SSAO + Bloom 후처리
  └── ViewerToolbar (하단 통합 컨트롤)
```

## 완료된 작업 (2026-02-15) - AI 인프라 + SEO + 실시간 + 안정성

### Gemini SDK 업그레이드
- `src/lib/gemini-client.ts` (수정) - `@google/generative-ai` → `@google/genai` 마이그레이션
- `src/app/api/project/design-ai/route.ts` (수정) - 새 SDK API 사용
- `src/app/api/project/generate-image/route.ts` (수정) - 새 SDK API 사용
- `src/app/api/project/gemini-status/route.ts` (수정) - 상태 체크 갱신
- `src/app/project/[id]/ai-design/page.tsx` (수정) - 클라이언트 호환

### 벡터DB + RAG 파이프라인
- `supabase/migrations/20260215000000_vector_embeddings.sql` (신규) - pgvector 확장 + knowledge_embeddings 테이블
- `src/lib/embedding.ts` (신규) - Gemini `embedding-001` 768차원 임베딩 (텍스트/쿼리)
- `src/lib/knowledge-search.ts` (신규) - 코사인 유사도 시맨틱 검색 (상위 5건)
- `scripts/embed-knowledge.ts` (신규) - construction_knowledge → 벡터 임베딩 배치 변환
  - 실행: `npx tsx scripts/embed-knowledge.ts` (마이그레이션 적용 후)
- `src/app/api/contractor-ai/route.ts` (수정) - RAG 컨텍스트 주입
- `src/app/api/project/design-ai/route.ts` (수정) - RAG 컨텍스트 주입

### 홈페이지 이미지 추가
- `public/images/hero-kitchen.jpg` (204KB) - Hero 섹션 (고급 주방/다이닝)
- `public/images/feature-living.jpg` (77KB) - AI 상담 feature (따뜻한 거실)
- `public/images/feature-fireplace.jpg` (197KB) - 단가 연동 feature (벽난로 거실)
- `public/images/feature-staircase.jpg` (214KB) - 3D 뷰어 feature (모던 계단)
- `src/components/landing/Hero.tsx` (수정) - 실제 이미지 배치
- `src/components/landing/Features.tsx` (수정) - 3개 feature 이미지 배치

### 이미지 최적화 + SEO 강화
- `next.config.mjs` (수정) - `images.formats: ["image/avif", "image/webp"]`
- `src/components/landing/Hero.tsx` (수정) - `<img>` → `next/image` Image (fill, priority, sizes)
- `src/components/landing/Features.tsx` (수정) - `<img>` → `next/image` Image (fill, lazy, sizes)
- `src/app/opengraph-image.tsx` (신규) - ImageResponse 동적 OG 이미지 (1200x630, edge runtime)
- `src/app/layout.tsx` (수정) - metadataBase, openGraph, twitter, title.template("%s | INPICK")
- `src/app/robots.ts` (신규) - userAgent *, allow /, disallow /api/ /admin/
- `src/app/sitemap.ts` (신규) - 16개 정적 페이지 등록
- 5개 layout.tsx (신규) - 페이지별 metadata export (auth, projects, contracts, contractor/login, admin/login)

### 실시간 알림 (Supabase Realtime)
- `src/components/ui/Toast.tsx` (신규) - 글로벌 토스트 시스템 (pub/sub, 4타입, 자동 dismiss)
- `src/hooks/useRealtimeSubscription.ts` (신규) - Supabase Realtime postgres_changes 구독 훅
- `src/app/layout.tsx` (수정) - `<ToastContainer />` 추가
- `src/app/project/[id]/rfq/page.tsx` (수정) - 30초 폴링 → Supabase Realtime 채널 (INSERT/UPDATE) + 60초 폴백
- `src/app/contractor/page.tsx` (수정) - Realtime 알림 구독 + 토스트 표시

### Fine-tuning 데이터 파이프라인
- `src/app/api/admin/fine-tuning/route.ts` (신규) - JSONL/JSON 추출 (rating≥4 or helpful 필터)
- `src/app/admin/ai-logs/page.tsx` (수정) - Fine-tuning 다운로드 버튼 + 통계 배지

### 홈페이지 UI 고도화
- `src/components/landing/HowItWorks.tsx` (신규) - 4단계 워크플로우 섹션
- `src/app/page.tsx` (수정) - HowItWorks 삽입 (Hero ↔ LogoCloud 사이)
- `src/components/landing/Contact.tsx` (수정) - mailto 폼 제출 + 상태 표시
- `src/components/landing/Footer.tsx` (수정) - 회사 정보 업데이트
- `src/components/landing/Pricing.tsx` (수정) - 연간/월간 토글 실제 동작 (20% 할인)
- `src/components/landing/LogoCloud.tsx` (수정) - 카드 스타일 개선

### 테스트/안정성 강화
- `src/lib/api-helpers.ts` (신규) - apiError/apiSuccess/requireEnv/getEnvStatus 유틸
- `src/components/ui/ErrorBoundary.tsx` (신규) - React 클래스 컴포넌트 에러 바운더리
- `src/components/ui/LoadingState.tsx` (신규) - LoadingState + EmptyState 공통 컴포넌트
- `src/app/api/admin/env-check/route.ts` (신규) - 환경변수 상태 확인 API

## 완료된 작업 (2026-02-16) - 딥러닝 도면 인식 시스템

### Phase A: Gemini Vision 도면 인식 엔진 (MVP)
- `src/lib/services/gemini-floorplan-parser.ts` (신규, ~350줄) - 핵심 AI 엔진
  - Gemini 2.0 Flash + `responseMimeType: "application/json"` 구조화 출력
  - 시스템 프롬프트: 한국 아파트 도면 전문 분석가 (공간/벽/문/창/설비/치수 인식)
  - 좌표 보정 3단계: 치수선 앵커 → 면적 역산 → 문 폭 기준
  - 후처리: ID 부여, MASTER_BED 식별, 중복 실명 번호, 합성 벽, fixtures roomId 연결
  - Mock 폴백 (API 키 없을 때)
- `src/lib/services/pdf-extractor.ts` (신규, ~100줄) - PDF → PNG 변환
  - pdfjs-dist + node-canvas 서버사이드 렌더링 (200 DPI)
  - 멀티페이지 PDF에서 도면 페이지 자동 식별 (데이터 밀도 기반)
- `src/lib/services/image-preprocessor.ts` (신규, ~80줄) - 이미지 전처리
  - 2048x2048 리사이즈 (Gemini 최적)
  - 사진/스캔: 그레이스케일 + 대비 강화
- `src/app/api/project/parse-drawing/route.ts` (신규, ~120줄) - 업로드 API
  - POST multipart/form-data, 파일 타입별 분기 (PDF/이미지/DWG 거부)
  - knownArea 파라미터로 면적 보정
  - Vercel 60초 타임아웃 설정
- `src/app/project/[id]/design/page.tsx` (수정) - Mock 제거 → 실제 API 연동
  - `analyzeMockFloorPlan()` 제거 → `parseDrawingFile()` API 호출
  - 인식 결과 확인 단계 추가 (DrawingParseResult 컴포넌트)
  - 신뢰도 배지 (높음/보통/낮음), 경고 표시
- `src/components/project/DrawingParseResult.tsx` (신규, ~200줄) - 결과 검증 UI
  - 신뢰도 배지 (높음≥0.8/보통≥0.5/낮음<0.5)
  - 공간 목록 + 실 타입 드롭다운 수정
  - 경고 메시지, "결과 수용"/"다시 분석" 버튼

### Phase B: DWG/DXF 직접 파서 (Python)
- `scripts/convert-dwg.py` (신규, ~90줄) - ODA File Converter CLI 래퍼 (DWG→DXF)
- `scripts/parse-dxf.py` (신규, ~350줄) - ezdxf 기반 DXF→ParsedFloorPlan
  - 레이어 패턴 매핑 (벽/문/창/텍스트/설비)
  - 엔티티별 추출: LINE/LWPOLYLINE(벽), ARC/INSERT(문), TEXT/MTEXT(실명/치수)
  - 좌표 정규화 (CAD mm → 미터), 실명 기반 공간 생성
  - 출력: `public/floorplans/dwg-{name}.json`

### Phase D: DB 로깅
- `supabase/migrations/20260216000000_drawing_parse_logs.sql` (신규) - 도면 파싱 로그 테이블
  - project_id, file_name, parse_method, result_json(JSONB), confidence_score, warnings, processing_time_ms
  - RLS 정책 (본인 로그만)

### 도면 인식 플로우
```
PDF/이미지 업로드 → POST /api/project/parse-drawing
  ├── PDF → pdf-extractor → 페이지 선택 → preprocessor → Gemini Vision
  ├── 이미지 → preprocessor → Gemini Vision
  └── DWG/DXF → 에러 (PDF 내보내기 안내)
                            ↓
                  GeminiRawResult (픽셀 좌표)
                            ↓
                  calibrateCoordinates (좌표 보정)
                            ↓
                  postProcess (미터 좌표 + ID + 합성 벽)
                            ↓
                  ParsedFloorPlan JSON
                            ↓
                  DrawingParseResult (사용자 확인)
                            ↓
                  2D/3D 뷰어 + 물량산출 엔진
```

### 도면 인식 테스트 결과 (2026-02-16)
| 도면 | 시간 | 면적 | 공간 | 벽 | 문 | 창 | 설비 | 신뢰도 |
|------|------|------|------|-----|-----|-----|------|--------|
| 59㎡ | 22s | 59.0m² | 12 | 34 | 9 | 5 | 8 | 1.0 |
| 84A㎡ | 26s | 84.0m² | 11 | 13 | 11 | 5 | 8 | 1.0 |
| 84B㎡ | 20s | 84.0m² | 12 | 30 | 10 | 8 | 8 | 1.0 |

### Gemini 도면 인식 핵심 설정
- **thinkingConfig: { thinkingBudget: 0 }** 필수 (없으면 249초 → 있으면 22초)
- **maxOutputTokens: 16384** 필수 (8192면 JSON 잘림)
- **responseMimeType: "application/json"** + **responseSchema** 구조화 출력
- **모델 폴백**: gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite → gemini-2.5-flash-lite
- 4MB 이하 PNG/JPG는 canvas 재인코딩 건너뛰기 (품질 보존)
- 면적 정규화: knownArea 기반 스케일 보정 (10% 이상 차이 시 자동 조정)

### 보유 도면 데이터
- `drawings/_arch/59.pdf` + `59.png` (59㎡형 단위세대 평면도) ✅ 인식 테스트 완료
- `drawings/_arch/84A.pdf` + `84A.png` (84㎡A형 단위세대 평면도) ✅ 인식 테스트 완료
- `drawings/_arch/84d.pdf` + `84d.png` (84㎡B형 단위세대 평면도) ✅ 인식 테스트 완료
- `drawings/_arch/*.dwg` (3개 DWG 원본)
- `drawings/_arch/사용승인_대전용산4블럭_건축_0413_날인.pdf` (265페이지 사용승인도서)

### 테스트 스크립트
- `scripts/test-gemini-parse.mjs` - REST API 직접 호출 테스트 (SDK 우회)
- `scripts/test-api-parse.mjs` - `/api/project/parse-drawing` 엔드포인트 테스트
- `scripts/test-all-drawings.mjs` - 3개 도면 일괄 테스트 (59/84A/84B)

### 파이프라인 품질 개선 (2026-02-16)
- **프롬프트 강화**: 단위세대만 분석 명시, 공간별 크기 차이 반영, 설비 크기 힌트
- **유효성 검증**: 0.5m² 미만 방 필터, 0.3m 미만 벽 필터, fixture roomId 검증
- **3D 뷰어**: 문/창 실제 Gemini 데이터 사용, 적응형 wall-door tolerance
- **견적 엔진**: QTY 엔진 try-catch 오류 처리 (크래시 방지)
- **2D 뷰어**: hasPolygons useMemo, 좌표 유효성 가드

### Phase C 고도화: YOLO 디자인 페이지 통합 + 빌드 호환성 (2026-02-16)
- **onnxruntime-web 빌드 호환성**: next.config.mjs 서버/클라이언트 분기 설정
  - 서버: `webpack.IgnorePlugin` (onnxruntime-web 무시)
  - 클라이언트: `resolve.alias` → CJS 빌드(`ort.min.js`) 사용 (ESM `import.meta` 파싱 에러 회피)
- **design/page.tsx YOLO 통합**:
  - YOLO 모델 자동 로드 (`useEffect` + 동적 `import()`)
  - `runYoloEnhancement()` - 감지 → `fuseDetections()` 융합 파이프라인
  - `handleAcceptResult`에서 yoloAvailable 시 자동 보강
  - 하단 상태 바에 YOLO 보강 진행/결과 UI
- **train-yolo-floorplan.py**: Windows cp949 콘솔 호환 (이모지 → ASCII 태그)
- **YOLO 학습 결과**: YOLOv8n, 78 train/26 val 합성 이미지, CPU 학습, 100 epochs
  - **mAP50: 0.913**, mAP50-95: 0.739
  - 클래스별 AP50: door_swing(0.994), window(0.995), toilet(0.974), stove(0.937), door_sliding(0.961), kitchen_sink(0.889), bathtub(0.831), sink(0.727)
  - ONNX 모델: `public/models/floorplan-yolo.onnx` (11.7 MB)

### YOLO Phase C 컴포넌트 현황
| 컴포넌트 | 경로 | 상태 |
|----------|------|------|
| 합성 데이터 생성 | `scripts/generate-synthetic-training.ts` | ✅ 완료 |
| YOLO 학습 | `scripts/train-yolo-floorplan.py` | ✅ 학습 완료 대기 |
| ONNX 브라우저 추론 | `src/lib/services/yolo-floorplan-detector.ts` | ✅ 완료 |
| Gemini+YOLO 융합 | `src/lib/services/detection-fusion.ts` | ✅ 완료 |
| 디자인 페이지 통합 | `src/app/project/[id]/design/page.tsx` | ✅ 완료 |
| webpack 설정 | `next.config.mjs` | ✅ 완료 |
| ONNX 모델 파일 | `public/models/floorplan-yolo.onnx` | ✅ 완료 (11.7 MB) |

## 완료된 작업 (2026-02-16) - 성능 최적화 + PWA + 도면 로그 대시보드

### 성능 최적화
- `next.config.mjs` - `experimental.optimizePackageImports` 활성화 (lucide-react, three, @react-three/drei, @react-three/postprocessing)
- `next.config.mjs` - `@next/bundle-analyzer` 통합 (`ANALYZE=true npm run build`로 번들 시각화)
- `design/page.tsx` - `DrawingParseResult` 동적 임포트
- `ai-design/page.tsx`, `rendering/page.tsx` - `CreditChargeModal` 동적 임포트 (모달 온디맨드 로드)
- `estimate/page.tsx` - `CostTable` 동적 임포트

### PWA 지원
- `public/manifest.json` - 웹 앱 매니페스트 (이름, 아이콘, 테마 색상, standalone 모드)
- `public/sw.js` - Service Worker (앱 셸 프리캐시, 정적 자산 Cache-First, HTML Network-First + 오프라인 폴백)
- `public/icons/icon-192x192.png`, `icon-512x512.png` - PWA 아이콘
- `src/app/layout.tsx` - manifest 링크, theme-color 메타, apple-touch-icon, SW 등록 스크립트

### 관리자 도면 인식 로그 대시보드
- `src/app/api/admin/drawing-logs/route.ts` (신규) - 도면 파싱 로그 조회 API + 통계 (총 파싱수, 평균 신뢰도, 평균 처리시간, 성공률)
- `src/app/admin/drawing-logs/page.tsx` (신규) - 도면 로그 관리 페이지
  - 4개 통계 카드 (총 파싱, 평균 신뢰도, 평균 처리시간, 성공률)
  - 파싱 방법별 필터 (Gemini Vision / DXF 파서 / Mock)
  - 신뢰도 배지 (높음/보통/낮음 색상 구분)
  - 행 확장 시 경고 + 파싱 결과 JSON 요약
  - 페이지네이션
- `src/app/admin/layout.tsx` (수정) - 사이드바에 "도면 로그" 메뉴 추가 (FileImage 아이콘)
- `src/app/api/project/parse-drawing/route.ts` (수정) - 파싱 결과 자동 로깅 (drawing_parse_logs 테이블에 fire-and-forget INSERT)

### 관리자 페이지 현황 (10개 → 11개)
| 페이지 | 경로 | 상태 |
|--------|------|------|
| 도면 로그 | `/admin/drawing-logs` | 신규 완료 |

## 완료된 작업 (2026-02-17) - 사업자 페이지 기능 강화

### Step 1: 대시보드 실제 통계 연동
- `src/app/api/contractor/stats/route.ts` (신규) - 5개 통계 한번에 반환
  - 활성 프로젝트 수 (contractor_projects WHERE status IN preparing, in_progress)
  - 대기 입찰 수 (bids WHERE status=pending)
  - 미수금 합계 (invoices WHERE status IN sent, overdue SUM total)
  - 월간 매출 (payment_records WHERE 이번달 income SUM)
  - 평균 평점 (specialty_contractors.rating)
- `src/app/contractor/page.tsx` (수정) - stats API 호출 + estimates 폴백

### Step 2: 매칭 알고리즘 실제 구현
- `src/app/api/matching/route.ts` (수정) - Mock → 실제 DB 기반 점수
  - 거리: 인접 지역 매핑 (seoul↔gyeonggi 등) 100/70/30
  - 가격: 입찰 이력 평균 대비 경쟁력 (bids 테이블)
  - 일정: 활성 프로젝트 수 기반 가용성 감점 (contractor_projects)
  - 신뢰도: 인증 + 리뷰 수 + 입찰 이력 수 기반

### Step 3: 재무 기능 강화
- `src/app/api/contractor/finance/expenses/route.ts` (수정) - PATCH 편집 + DELETE 삭제 추가
- `src/app/api/contractor/finance/invoices/route.ts` (수정) - PATCH 상태 변경 (draft→sent→paid/overdue)
- `src/app/contractor/finance/page.tsx` (수정)
  - 지출 인라인 편집/삭제 (연필/휴지통 아이콘)
  - 청구서 상태 변경 버튼 (발송/수금 완료/연체 처리)
  - CSV 내보내기 (BOM 포함 한글 Excel 호환)
  - 최근 6개월 매출/지출 바 차트

### Step 4: 프로필 파일 업로드
- `src/app/api/contractor/upload/route.ts` (신규) - Supabase Storage 업로드
  - multipart/form-data, 5MB 제한, jpg/png/webp/pdf
  - contractors/{id}/{folder}/{timestamp}.ext 경로
- `src/app/contractor/profile/page.tsx` (수정)
  - 서류 탭: URL 입력 → 파일 드래그&드롭 업로드
  - 포트폴리오 탭: 이미지 파일 업로드 + URL 입력 병행
  - FileDropZone 컴포넌트 (드래그, 진행률, 에러 표시)

### 테스트 계정 + 관리자 크레딧 부여 (이전 세션)
- `src/app/api/admin/seed-test-accounts/route.ts` (신규) - test@inpick.kr / contractor@inpick.kr 생성
- `src/app/admin/users/page.tsx` (수정) - "테스트 계정 생성" 버튼 + 사용자별 크레딧 부여

## 완료된 작업 (2026-02-17) - 실시간 채팅 + 안정성 개선

### 실시간 채팅 시스템
- `supabase/migrations/20260217000000_chat_messages.sql` (신규) - chat_messages + chat_rooms 테이블, RLS, Realtime
- `src/app/api/chat/route.ts` (신규) - GET 메시지 조회 (페이지네이션), POST 전송, PATCH 읽음처리
- `src/app/api/chat/rooms/route.ts` (신규) - GET 채팅방 목록 + 미읽음 카운트
- `src/components/chat/ChatWindow.tsx` (신규) - 실시간 채팅 UI
  - Supabase Realtime postgres_changes 구독
  - 옵티미스틱 메시지 삽입 + 실패 시 롤백
  - 자동 스크롤 + 스크롤 다운 버튼
  - 날짜 구분선, 시스템 메시지, 읽음 처리
- `src/app/contract/[id]/page.tsx` (수정) - 계약 상세에 ChatWindow 통합
  - 소비자/사업자 자동 감지 (useAuth + localStorage)
  - roomId = contract.id

### E2E 테스트 (Playwright)
- `e2e/smoke.spec.ts` - 14 테스트 (퍼블릭/사업자/관리자 페이지 로드)
- `e2e/contractor-auth.spec.ts` - 6 테스트 (로그인, 대시보드, 사이드바 네비게이션)
- `e2e/consumer-workflow.spec.ts` - 7 테스트 (프로젝트 생성, 6탭, 목록)
- `e2e/api.spec.ts` - 8 테스트 (API 엔드포인트 스모크)

### 에러 핸들링 강화
- `src/app/error.tsx` - 글로벌 에러 바운더리
- `src/app/not-found.tsx` - 커스텀 404 페이지
- `src/app/api/contractor/upload/route.ts` - 폴더 화이트리스트 (경로 탐색 방지)

### i18n 다국어 지원
- `src/i18n/ko.json`, `en.json` - 한/영 번역 키
- `src/hooks/useLocale.ts` - localStorage 기반 로케일 관리 + t() 함수
- `src/components/ui/LocaleSwitcher.tsx` - KR/EN 토글 버튼
- Header 데스크톱 + 모바일 메뉴에 LocaleSwitcher 추가

### 모바일 반응형 (사업자 6개 페이지)
- `contractor/ai`, `matching`, `schedule`, `finance`, `projects`, `bids` - 375px 대응

### 소비자 기능 수정
- 이메일 포맷 검증, 카카오 버튼 비활성화 (준비중)
- AI 디자인 크레딧 차감 시점 수정 (성공 후)
- RFQ 에러 토스트, 계약 목록 타입 안전성

## 다음 작업 (우선순위 순)

### 즉시 필요 (수동 작업)
1. ~~**Supabase 마이그레이션 적용**~~ ✅ 완료 (20260214 까지)
2. **Supabase 마이그레이션 적용** - `20260215000000_vector_embeddings.sql` (pgvector 확장 필요)
3. **Supabase 마이그레이션 적용** - `20260216000000_drawing_parse_logs.sql`
4. **임베딩 스크립트 실행** - 마이그레이션 적용 후 `npx tsx scripts/embed-knowledge.ts`
5. ~~**Gemini API 키 발급**~~ ✅ 완료 (`.env.local` 설정됨, 도면 인식 테스트 성공)
6. **카카오 로그인 Supabase 설정** - Supabase 대시보드 → Authentication → Providers → Kakao 활성화
7. **Toss Payments 키 발급** - https://developers.tosspayments.com → `TOSS_PAYMENTS_CLIENT_KEY`, `TOSS_PAYMENTS_SECRET_KEY`
8. **ODA File Converter 설치** (DWG→DXF 변환용) - https://www.opendesign.com/guestfiles/oda_file_converter

### 개발 작업 (도면 인식 고도화)
- ~~84A.pdf, 84d.pdf 인식 테스트 및 검증~~ ✅ 완료
- ~~파이프라인 품질 개선 (프롬프트/유효성/뷰어/견적)~~ ✅ 완료
- ~~Phase C: YOLO 심볼 감지 모델 (브라우저 ONNX 추론, 합성 학습 데이터)~~ ✅ 완료 (mAP50: 0.913)
- ~~도면 인식 로그 분석 대시보드~~ ✅ 완료 (admin/drawing-logs)
- DXF 파서 실행 및 Ground Truth 비교 검증

### 기타 개발 작업
- Gemini AI 이미지 생성 실제 테스트 (API 키 발급 후)
- ~~E2E 테스트 작성 (Playwright/Cypress)~~ ✅ 완료 (33 테스트)
- ~~성능 최적화 (번들 분석, 코드 스플리팅)~~ ✅ 완료
- ~~PWA 지원 (오프라인, 서비스 워커)~~ ✅ 완료
- ~~다국어 지원 (i18n)~~ ✅ 완료 (한/영)
- ~~실시간 채팅~~ ✅ 완료 (Supabase Realtime)

## DB 마이그레이션 현황
| 파일 | 상태 |
|------|------|
| `20250210000000_initial_schema.sql` | Supabase 적용 완료 |
| `20250210100000_admin_profiles.sql` | Supabase 적용 완료 |
| `20250210200000_bids_contracts.sql` | Supabase 적용 완료 |
| `20260210000000_projects_and_bids.sql` | Supabase 적용 완료 |
| `20260210100000_schedule_enhance.sql` | Supabase 적용 완료 |
| `20260210200000_finance_tables.sql` | Supabase 적용 완료 |
| `20260211000000_credit_tables.sql` | Supabase 적용 완료 |
| `20260212000000_consumer_rfq_integration.sql` | Supabase 적용 완료 |
| `20260213000000_ai_data_pipeline.sql` | Supabase 적용 완료 |
| `20260214000000_material_catalog_seed.sql` | Supabase 적용 완료 |
| `20260214100000_consumer_projects.sql` | Supabase 적용 완료 |
| `20260215000000_vector_embeddings.sql` | **미적용** (pgvector 확장 필요) |
| `20260216000000_drawing_parse_logs.sql` | **미적용** |
| `20260217000000_chat_messages.sql` | **미적용** |
