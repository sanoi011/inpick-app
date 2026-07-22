# InPick 사업자 연결 개발 체크리스트

기준일: 2026-07-23
대상: 웹 · iOS · Android 공통 Next.js 소스
제외: 앱인토스 source snapshot 및 `.ait`

## 제품 원칙

- 업체·리뷰·시공 실적·응답 속도·선정 확률을 생성하거나 추정하지 않는다.
- `사업자 정보 확인`, `서류 등록`, `프로필 준비`를 서로 다른 상태로 표시한다.
- 상단 노출·요금제 효과는 검증 배지와 분리해 공개한다.
- 소비자 연락처와 프로젝트 정보는 전송 대상과 시점을 제출 전에 알린다.
- 초기 매칭에는 시·군·구와 조건만 전달하고 상세 주소는 현장 방문 합의 후 공개한다.
- 동일한 Decision Packet과 견적 형식으로 최대 3개 적합 업체를 비교한다.

## 이번 구현 묶음 — P0

### 소비자 연결 흐름

- [x] 업체 찾기 상단에 4단계 연결 여정 표시
- [x] Step 1~3 프로젝트 브리프 및 동일 조건 입찰로 이동하는 CTA 연결
- [x] 업체 카드에서 실제 근거만 표시: 사업자 정보 확인, 리뷰 수, 완료 실적, 포트폴리오
- [x] 상단 노출·유료 요금제와 검증 상태를 분리 표시
- [x] 업체 상세에 확인 가능한 근거와 미등록 정보를 구분
- [x] 1:1 문의 전에 공유 정보·공유 대상·다음 단계를 명시하고 동의를 받음
- [x] RFQ에 현장 확인 조건을 전달하되 상세 주소는 초기 알림에서 제외
- [x] 공개 업체 API·DOM에서 전화·이메일·상세주소·서류 원본 제외
- [x] UI·API shortlist를 최대 3개로 통일하고 부족 시 1~2곳만 연결될 수 있음을 고지

### 사업자 작업 공간

- [x] 대시보드를 실제 API 데이터 기반의 오늘 할 일 중심으로 개편
- [x] 프로필 준비도 체크리스트 제공: 기본정보, 사업자 서류, 공종, 소개, 포트폴리오, 공개 설정
- [x] 준비도는 인증 점수나 선정 가능성으로 표현하지 않음
- [x] 프로필 페이지를 안내형 헤더·pill 탭·부드러운 카드로 개편
- [x] private 프로필 API에 사업자 토큰 권한 검사 적용
- [x] owner 리뷰·답변·업로드 API에 token-ID 대조 적용
- [x] 이메일 로그인 bcrypt 검증, 자동 계정 생성·unsigned legacy token·고정 secret 제거
- [x] 운영 비밀번호 재설정 응답·로그에서 reset URL 노출 제거
- [x] 보호 스토리지 연결 전 사업자등록증 신규 공개 업로드 차단
- [x] OAuth 세션 이메일 검증 후 사업자 토큰 교환 복구
- [x] 401·stale token 자동 폐기 및 로그인 redirect loop 제거
- [x] 문의 정보 공유 동의·버전을 서버에서도 검증
- [x] 문의 동의 버전·서버 UTC 시각을 호환 감사 마커로 영구 저장
- [x] RFQ 현장조건을 사업자 입찰 상세에 정규화해 표시
- [x] 프로필 응답을 명시적 allowlist로 제한해 password hash·내부 필드 제외
- [x] dashboard/profile fetch에 Authorization 전달
- [x] 입찰 feature flag가 꺼진 환경에서는 비활성 입찰 UI 숨김

### 품질 게이트

- [x] pure logic RED→GREEN 테스트
- [x] profile API auth 회귀 테스트
- [x] 변경 파일 ESLint 0
- [x] 관련 Node 테스트 전부 통과
- [x] 인증·공개정보·shortlist·동의·현장조건 회귀 테스트 25개 통과
- [x] Next.js production build 성공 및 정적 페이지 165개 생성
- [x] 앱인토스 snapshot 변경 0 확인
- [x] Android Capacitor sync 성공
- [x] iOS·Android가 운영 웹 URL을 로드하는 구조 확인
- [ ] iOS native dependency sync — 이 Mac에 Xcode.app이 없어 보류
- [ ] 독립 코드리뷰의 차단 이슈 0
- [ ] 선택 파일만 커밋 후 `origin/main` 원격 SHA 확인

## 다음 구현 — P1

- [ ] 불변 Decision Packet revision/hash와 baseline line ID 저장
- [ ] 사업자 입찰을 포함·제외·대안·allowance·수량·단가·세금·보증의 line-item 응답으로 전환
- [ ] `legacyPublic` 전체 사업자 RFQ 노출 제거와 기존 데이터 migration
- [ ] 낙찰·계약 생성을 단일 원자 서버 작업으로 통합하고 중복 낙찰 방지
- [ ] 레거시 `AI 추천`, `최저가`, `프리미엄` 선정 태그 제거
- [ ] 비밀번호 없는 legacy 사업자 계정의 재설정·OAuth 전환 운영 안내
- [ ] 운영 비밀번호 재설정 이메일 provider 연결 및 전달 성공·만료 E2E
- [ ] 기존 `uploads/documents` 객체를 private bucket으로 migration하고 만료 signed URL 적용
- [ ] 문의 동의 감사 마커를 전용 `consent_version`·`consent_at` 컬럼으로 정규화
- [ ] 소비자 shortlist 저장 및 업체 간 근거 비교표
- [ ] Decision Packet에 포함·제외 공사, SKU, 수량, 일정, 보증, 현장 확인 조건을 고정 schema로 저장
- [ ] 업체 문의 상태 타임라인: 접수 → 연락 → 현장 방문 합의 → 견적 수신 → 종료
- [ ] 소비자 연락 가능 시간·선호 채널·개인정보 보유기간 설정
- [ ] 업체별 서비스 지역을 시·군·구 단위로 구조화
- [ ] 실제 완료 프로젝트와 연결된 verified review만 별도 표시
- [ ] 프로필 공개 전 필수 누락 validation 및 미리보기
- [ ] 업체가 매칭 제외 사유와 데이터 정정 요청을 확인할 수 있는 화면

## 상용화 검증 — P2

- [ ] 문의→응답→현장방문→견적→선정 funnel analytics
- [ ] 상단 노출의 유료·제휴 관계 라벨 A/B가 신뢰와 문의 전환에 미치는 영향 측정
- [ ] 3-bid와 5-bid의 견적 수신률·선정 시간·소비자 만족도 비교
- [ ] 사업자 응답 SLA는 실제 운영 데이터가 쌓인 뒤에만 공개
- [ ] 광고/구독 노출이 relevance 순위를 훼손하지 않는지 정기 감사
- [ ] 분쟁·취소·무응답·허위 포트폴리오 신고 및 운영 정책

## 경쟁사 분석에서 적용한 패턴

- Houzz/Thumbtack 계열: 포트폴리오·리뷰·프로필 근거를 탐색 단계에서 비교하되, InPick은 상단 노출과 검증을 분리한다.
- Angi/HomeAdvisor 계열: 요청 내용을 한 번 구조화해 적합 업체에 전달하되, InPick은 상세 주소를 지연 공개한다.
- Block Renovation 계열: 프로젝트 브리프와 범위를 먼저 고정해 견적 비교 가능성을 높인다.
- Sweeten 계열: 매칭 이후 단계와 다음 행동을 명확히 보여주되, 운영하지 않는 보증이나 concierge를 약속하지 않는다.
- InPick 차별점: Step 1 요구조건, Step 2 선택 시안·실제 SKU, Step 3 수량·견적을 동일 조건 Decision Packet으로 전달한다.
