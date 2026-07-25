# INPICK 웹 OAuth PKCE 세션 유실 장애 기록

- 장애 일자: 2026-07-25
- 영향 범위: `https://www.interiorpick.co.kr` 웹 로그인
- 영향 공급자: Google, Kakao
- 비영향 범위: Capacitor iOS/Android 앱 로그인
- 해결 커밋: `e3f5d7f73925c95dbe4a8ea5ab97223af4eec19b`
- 해결 배포: `dpl_9WJot882tonBHYVt15c1FpU3vsL6`
- 상태: 운영 사용자 Google 로그인 성공 및 서버 세션 발급 확인

## 1. 사용자 증상

1. 웹 로그인 화면에서 Google 또는 Kakao 인증은 정상적으로 완료된다.
2. INPICK 메인 화면으로 돌아오지만 로그인 상태가 유지되지 않는다.
3. `/workflow`에 들어가지 못하고 다시 로그인 화면으로 이동한다.
4. 일부 배포에서는 로그인 확인 화면이 오래 지속되거나
   `로그인 세션을 저장하지 못했습니다` 오류가 표시됐다.
5. 같은 계정으로 iOS/Android 앱에서는 정상적으로 로그인됐다.

따라서 공급자 인증 실패, 사용자 계정 문제, Supabase 사용자 등록 실패가
아니었다. 장애 범위는 웹 OAuth callback 이후의 세션 저장 경로였다.

## 2. 운영 로그로 확정한 직접 원인

수정 전 운영 로그:

```text
[auth/diagnostic] auth flow recovery event {
  stage: 'browser_oauth_cookie_change',
  errorCode: 'AUTH_OPERATION_TIMEOUT',
  errorMessage: 'browser-oauth-cookie-handoff timed out after 12000ms',
  host: 'www.interiorpick.co.kr',
  hasVerifierCookie: true,
  sessionCookieCount: 2
}
```

요청 순서는 다음과 같았다.

```text
GET /auth/callback
12초 동안 새 세션 쿠키 변경 없음
POST /api/auth/oauth-diagnostic
GET /auth
```

이 로그가 뜻하는 사실:

- OAuth 공급자는 INPICK callback까지 인증 코드를 정상 반환했다.
- PKCE `code_verifier` 쿠키도 브라우저에 존재했다.
- 기존 Supabase 세션 쿠키 조각 2개도 존재했다.
- 그러나 브라우저가 인증 코드를 새 세션으로 교환하고 쿠키에 반영하지 못했다.
- callback은 12초 뒤 타임아웃됐고 보호 경로는 사용자를 다시 로그인 화면으로
  보냈다.

## 3. 근본 원인

웹 callback 화면이 열릴 때 callback 전용 코드와 전역 인증 코드가 동시에
동작할 수 있는 구조였다.

- Supabase 브라우저 클라이언트는 URL의 PKCE 인증 코드를 자동 감지하고 교환할
  수 있다.
- 루트에 마운트된 `TokensContext`가 callback에서도 브라우저 인증
  클라이언트와 `onAuthStateChange`를 초기화했다.
- `AuthFlowGate`도 렌더 시점에 브라우저 인증 클라이언트를 만들 수 있었다.
- middleware의 세션 갱신도 callback 요청과 가까운 시점에 기존 세션을 확인했다.
- callback 자체도 세션 교환 또는 새 쿠키 대기를 수행했다.

PKCE 인증 코드는 한 번만 소비할 수 있다. 여러 인증 주체가 같은 callback
초기화 과정에 참여하면서 Supabase 클라이언트 lock, 기존 세션 복원, 새 코드
교환이 경쟁했다. 운영 환경에서는 전역 Provider가 가진 인증 초기화 lock이
멈추거나 자동 교환 결과가 callback이 기다리는 쿠키 변경으로 이어지지 않았다.

핵심 결론:

> 웹 OAuth callback에서 인증 코드를 교환하는 주체가 하나로 보장되지 않았고,
> 전역 브라우저 인증 초기화와 기존 세션 복원이 새 PKCE 교환과 경쟁했다.

기존 세션 쿠키가 이미 2개 있었던 점도 중요하다. 단순히 “세션 쿠키가 있는가”만
확인하면 이전 실패에서 남은 쿠키를 새 로그인 성공으로 오판할 수 있다. 새
로그인은 쿠키 지문 변경 또는 서버가 반환한 새 세션으로 확인해야 한다.

## 4. 앱은 정상이고 웹만 실패한 이유

앱과 웹은 같은 OAuth 공급자를 사용하지만 세션 전달·저장 경로가 다르다.

- iOS/Android 앱: Capacitor 네이티브 저장소와 딥링크 기반 callback 경로
- 웹: 브라우저 PKCE verifier 쿠키, URL 인증 코드, 분할 세션 쿠키 경로

이번 장애는 브라우저 URL 코드와 쿠키 사이의 교환 경쟁이었다. 네이티브 앱의
세션 저장 경로에는 이 브라우저 callback 경쟁이 없어 앱은 정상 동작했다.

## 5. 적용한 해결 구조

### 5.1 인증 코드 교환 단일화

`POST /api/auth/oauth-exchange`를 웹 PKCE 코드의 유일한 교환 지점으로
추가했다.

이 API는:

1. 동일 origin 요청인지 확인한다.
2. 요청 쿠키에서 PKCE verifier를 읽는다.
3. 서버 Supabase 클라이언트로 `exchangeCodeForSession(code)`를 정확히 한 번
   호출한다.
4. Supabase가 생성한 세션 쿠키를 응답의 `Set-Cookie`로 전달한다.
5. 브라우저 쿠키 반영 실패 시 사용할 access/refresh token을 같은 origin
   응답으로만 돌려준다.
6. 인증 코드와 token 값은 로그에 남기지 않는다.

### 5.2 callback에서 브라우저 자동 교환 차단

`/auth/callback`은 먼저 서버 교환 API를 호출한다. 서버가 인증 코드를 소비한
직후 브라우저 인증 클라이언트를 만들기 전에 URL에서 `code`를 제거한다.

```text
provider callback
  → POST /api/auth/oauth-exchange
  → 서버가 code를 한 번 교환
  → Set-Cookie 적용
  → URL에서 code 제거
  → 필요한 경우에만 setSession fallback
  → /workflow 이동
```

서버 `Set-Cookie`가 브라우저에서 확인되지 않는 경우에만 `setSession`으로
세션을 저장한다. 이 시점에는 URL 코드가 이미 제거됐으므로 자동 PKCE 재교환이
발생할 수 없다.

### 5.3 전역 인증 초기화 격리

- `TokensContext`는 `/auth/callback`에서 브라우저 인증 클라이언트와
  `onAuthStateChange`를 만들지 않는다.
- 토큰 잔액 조회는 인증 이벤트 callback 안에서 `await`하지 않고 다음
  task로 분리한다.
- `AuthFlowGate`는 렌더 시 클라이언트를 만들지 않고 실제 보호 경로 effect
  안에서만 지연 생성한다.
- callback은 공개 경로이므로 Gate가 callback 코드 교환에 개입하지 않는다.
- middleware는 `/auth/callback`과 `/api/auth/oauth-exchange`에서 기존 세션
  갱신을 실행하지 않는다.

## 6. 수정 후 운영 증거

실제 Google 로그인 완료 시 운영 서버 로그:

```text
[auth/oauth-exchange] exchange succeeded {
  provider: 'google',
  pendingCookieCount: 3
}
```

사용자 확인:

- 운영 웹 Google 로그인 성공
- 로그인 상태 유지 성공
- 기존의 12초 `browser-oauth-cookie-handoff` 타임아웃 재발 없음

배포 확인:

```text
Git branch: main
Git commit: e3f5d7f
Vercel target: production
Vercel status: Ready
Production aliases:
  - https://www.interiorpick.co.kr
  - https://interiorpick.co.kr
  - https://inpick-app.vercel.app
```

## 7. 재발 방지 불변 조건

인증 코드를 다루는 코드를 수정할 때 다음 조건을 반드시 유지한다.

1. 웹 PKCE 인증 코드는 `/api/auth/oauth-exchange` 한 곳에서 한 번만 교환한다.
2. `/auth/callback`에서 코드가 URL에 남은 동안 `createClient()`를 호출하지
   않는다.
3. 전역 Provider는 `/auth/callback`에서 인증 클라이언트나 인증 listener를
   초기화하지 않는다.
4. `onAuthStateChange` callback 안에서 API, DB, 잔액 조회를 `await`하지
   않는다.
5. middleware는 callback과 교환 API에서 `updateSession()`을 실행하지 않는다.
6. 기존 세션 쿠키의 존재를 새 OAuth 성공으로 간주하지 않는다.
7. callback 실패를 숨기거나 무한 로딩하지 않는다. 제한 시간 후 복구 UI와
   진단 로그를 남긴다.
8. 운영 도메인은 `www.interiorpick.co.kr`로 canonical 처리한다. OAuth 시작과
   callback 사이에 `www`/비-`www` 호스트가 바뀌어 verifier 쿠키가 유실되면
   안 된다.
9. 인증 코드, access token, refresh token, 쿠키 원문은 로그에 남기지 않는다.

## 8. 인증 변경 시 금지 패턴

아래 변경은 같은 장애를 재발시킬 수 있다.

```ts
// 금지: callback을 포함한 전역 렌더 과정에서 즉시 생성
const supabase = createClient();
```

```ts
// 금지: 인증 listener가 끝날 때까지 후속 API/DB를 기다림
supabase.auth.onAuthStateChange(async (_event, session) => {
  await loadBalance(session.user.id);
});
```

```ts
// 금지: 서버와 브라우저가 같은 code를 각각 교환
await serverExchange(code);
await supabase.auth.exchangeCodeForSession(code);
```

```ts
// 금지: callback middleware에서 기존 세션 refresh 실행
return updateSession(request);
```

## 9. 필수 회귀 테스트

인증, middleware, root layout, Provider, 서비스 워커, Supabase 클라이언트,
보호 경로 또는 Vercel 동작을 수정한 경우 `$inpick-auth-regression`을
사용하고 다음 검사를 모두 통과시킨다.

### 로컬 전체 인증 게이트

```bash
E2E_BASE_URL=http://127.0.0.1:3011 \
  /Users/seonbonkim/.codex/skills/inpick-auth-regression/scripts/check_inpick_auth.sh
```

현재 회귀 테스트가 확인하는 핵심 사례:

- 큰 Google 세션이 여러 쿠키 조각으로 나뉘어도 저장된다.
- 이전 실패의 오래된 세션 쿠키가 있어도 새 code를 한 번 교환한다.
- 토큰 잔액 API가 지연돼도 callback 이동이 막히지 않는다.
- 세션 검증 요청이 지연돼도 복원된 로그인을 성급히 폐기하지 않는다.
- 세션이 없을 때 무한 로딩 없이 로그인 화면으로 이동한다.
- 잘못된 외부 `returnUrl`은 허용하지 않는다.

### 운영 배포 진입 점검

```bash
PRODUCTION_AUTH_SMOKE=1 \
E2E_BASE_URL=https://www.interiorpick.co.kr \
npx playwright test e2e/auth-production-smoke.spec.ts \
  --project=chromium --reporter=line
```

이 테스트는 이메일 요청과 Google/Kakao OAuth 시작 URL을 확인한다. 실제
공급자 계정 인증 완료는 자동 검사하지 않으므로 운영 배포 후 실제 로그인 한
번과 서버 로그 확인이 추가로 필요하다.

### 운영 성공 판정

다음 요청과 로그를 확인한다.

```text
GET  /auth/callback
POST /api/auth/oauth-exchange
[auth/oauth-exchange] exchange succeeded
GET  /workflow
```

다음 로그가 나오면 배포 성공으로 간주하면 안 된다.

```text
[auth/oauth-exchange] exchange failed
[auth/diagnostic] ... AUTH_OPERATION_TIMEOUT
POST /api/auth/oauth-exchange 누락
callback 직후 다시 GET /auth
```

## 10. 배포 점검 순서

1. 로컬 타입 검사, 인증 단위 테스트, 브라우저 회귀 테스트를 통과시킨다.
2. `npm run build`를 통과시킨다.
3. GitHub `main`에 의도한 커밋이 push됐는지 확인한다.
4. Vercel 빌드 로그에서 branch와 commit SHA를 확인한다.
5. 배포가 `Ready`인지 확인한다.
6. `www.interiorpick.co.kr` alias가 새 deployment ID를 가리키는지 확인한다.
7. 운영 인증 smoke test를 실행한다.
8. 실제 Google 또는 Kakao 로그인을 한 번 완료한다.
9. `/api/auth/oauth-exchange` 성공, 세션 쿠키 발급, `/workflow` 진입을
   운영 로그에서 확인한다.

코드와 자동 테스트가 통과해도 8~9번을 확인하기 전에는 실제 OAuth 장애가
해결됐다고 보고하지 않는다.

## 11. 관련 파일

- `src/app/api/auth/oauth-exchange/route.ts`
- `src/app/auth/callback/page.tsx`
- `src/components/auth/AuthFlowGate.tsx`
- `src/contexts/TokensContext.tsx`
- `src/middleware.ts`
- `src/lib/auth/resilience.ts`
- `e2e/auth-resilience.spec.ts`
- `e2e/auth-production-smoke.spec.ts`
- `docs/archive/AUTH_PIPELINE_LEGACY_2026-07-25.md`

