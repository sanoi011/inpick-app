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

## 소비자(고객) 측 기존 기능
- `/` - 랜딩 페이지
- `/address` - 주소 검색
- `/consult` - AI 상담
- `/viewer` - 3D 뷰어
- `/estimate/[id]` - 견적 상세
- `/estimate/[id]/bids` - 입찰 목록
- `/contract/[id]` - 계약 상세
- `/auth` - 소비자 인증

## 다음 작업 후보
- 소비자 측 기능 강화
- 사업자 페이지 UI/UX 디테일 보완
- 실제 데이터 연동 테스트
- RLS(Row Level Security) 정책 설정
- 모바일 반응형 세부 조정
- 알림 시스템 실시간화 (현재 mock)
