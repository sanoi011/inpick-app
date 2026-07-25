# INPICK 인증 구버전 격리 기록

작성일: 2026-07-25  
대상: INPICK 웹 OAuth 로그인 및 Vercel 배포 파이프라인

## 운영 기준선

- GitHub 저장소: `sanoi011/inpick-app`
- Vercel 팀: `sanois-projects`
- Vercel 프로젝트: `inpick-app`
- Production branch: `main`
- 운영 도메인: `www.interiorpick.co.kr`, `interiorpick.co.kr`
- Supabase 프로젝트 ref: `pyhsjjtxcfmkcqmaxozd`

이 문서는 실행 코드가 아니다. 구버전 소스를 애플리케이션 폴더에 복제하면
TypeScript·Next.js 빌드 대상에 다시 섞일 수 있으므로, 소스 원본은 Git 태그로만
보존한다.

## 격리할 기준선

### `archive/auth-callback-abort-failure-20260725`

- 커밋: `b92648d030fed204c0d01e96832722655582e63c`
- 상태: 2026-07-25 21:38 운영 실패를 재현한 직전 배포
- 증상: OAuth 교환과 세션 쿠키 저장은 성공했지만 콜백의 추가 `getSession()`
  호출이 브라우저에서 AbortError(code 20)로 중단되면 전체 로그인을 실패로 오판
- 사용 금지: 이 태그에서 `main`으로 직접 배포하지 않는다.

### `archive/stale-local-main-20260725`

- 커밋: `81cec7380d53a5fb500f421833256d4c68002411`
- 상태: 별도 메인 작업 폴더에 남아 있던 19커밋 이전 기준선
- 위험: 이 작업 폴더에서 새 변경을 시작하면 이미 제거한 인증 코드가 다시 합쳐질
  수 있다.
- 사용 금지: 새 기능 브랜치의 시작점으로 사용하지 않는다.

## 현재 인증 흐름

1. 로그인 화면은 웹 OAuth 복귀 주소를 `/auth/callback`으로 고정한다.
2. 복귀할 워크플로우 경로는 `sessionStorage`에 별도로 저장한다.
3. Supabase 브라우저 클라이언트의 `initialize()`가 PKCE code 교환을 완료한다.
4. 전역 인증 이벤트 리스너는 동기 반환하며 DB·API 후처리는 다음 task로 분리한다.
5. 초기화 성공 뒤 세션 쿠키 생성을 확인한다. Arc에서 중복 잔존하는 verifier
   쿠키는 성공을 막는 기준으로 사용하지 않는다.
6. 콜백에서 `getSession()` 또는 `getUser()`를 중복 호출하지 않고 즉시 복귀한다.
7. 보호 화면과 서버 API가 실제 세션 권한을 최종 검증한다.

## 복구·조회 방법

구버전 확인은 실행 폴더 복사 대신 다음처럼 읽기 전용으로 수행한다.

```bash
git show archive/auth-callback-abort-failure-20260725:src/app/auth/callback/page.tsx
git diff archive/auth-callback-abort-failure-20260725..main -- src/app/auth/callback/page.tsx
```

운영 배포 전에는 반드시 `inpick-auth-regression` 검사와 production OAuth 시작
smoke test를 통과시킨다. 태그는 장애 분석용이며 삭제하거나 운영 브랜치에 병합하지
않는다.
