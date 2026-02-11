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

## 다음 작업 (우선순위 순)

### 즉시 필요 (수동 작업)
1. **Supabase SQL 실행** - `supabase/migrations/20260211000000_credit_tables.sql`을 Supabase 대시보드 SQL Editor에서 실행
   - URL: `https://supabase.com/dashboard/project/pyhsjjtxcfmkcqmaxozd/sql/new`
2. **Gemini API 키 발급** - https://aistudio.google.com/apikey 에서 키 생성 → `.env.local`과 Vercel 환경변수에 `GOOGLE_GEMINI_API_KEY` 설정
3. **카카오 로그인 Supabase 설정** - Supabase 대시보드 → Authentication → Providers → Kakao 활성화 (REST API 키 + Client Secret 입력, Redirect URI 등록)

### 개발 작업
- 건축도면 STR 데이터 연동 (벽체/문/창호 폴리곤)
- Gemini AI 이미지 생성 실제 테스트
- 3D 렌더링 엔진 API 연동 (현재 Mock 이미지)
- 결제 시스템 연동 (크레딧 충전 - 토스페이먼츠 등)
- 사업자 대시보드에 견적요청 수신 연동
- 모바일 반응형 세부 조정
- 실제 데이터 연동 테스트

## DB 마이그레이션 현황
| 파일 | 상태 |
|------|------|
| `20250210000000_initial_schema.sql` | Supabase 적용 완료 |
| `20250210100000_admin_profiles.sql` | Supabase 적용 완료 |
| `20250210200000_bids_contracts.sql` | Supabase 적용 완료 |
| `20260210000000_projects_and_bids.sql` | Supabase 적용 완료 |
| `20260210100000_schedule_enhance.sql` | Supabase 적용 완료 |
| `20260210200000_finance_tables.sql` | Supabase 적용 완료 |
| `20260211000000_credit_tables.sql` | **미적용 - SQL Editor에서 실행 필요** |
