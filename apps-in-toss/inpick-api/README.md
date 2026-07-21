# INPICK Apps in Toss API

운영 웹/API 코드를 변경하지 않기 위한 Apps in Toss 전용 서버다.

- 토스 mTLS 로그인 코드를 Supabase 세션으로 교환
- 패키지 앱의 Supabase Bearer 세션을 기존 웹앱이 읽는 세션 쿠키로 변환
- 기존 인픽 운영 AI·견적 API로 서버 간 중계
- 업체 입찰/RFQ API는 중계 단계에서 404 차단

이 프로젝트는 `apps-in-toss/inpick` 클라이언트와 함께 별도 Vercel 프로젝트로 배포한다.
운영 웹사이트 프로젝트의 코드나 환경변수는 변경하지 않는다.
