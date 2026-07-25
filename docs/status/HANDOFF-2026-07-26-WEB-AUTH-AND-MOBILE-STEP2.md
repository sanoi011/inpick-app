# INPICK 웹 인증 복구 및 모바일 Step 2 후속 핸드오프

- 작성 시각: 2026-07-26, Asia/Seoul
- 저장소: `https://github.com/sanoi011/inpick-app.git`
- 작업 경로: `/Users/seonbonkim/Desktop/AIOD/개발/inpick beta ver1/inpick_product_hide_hotfix`
- 현재 로컬 브랜치: `codex/hide-product-and-enlarge-estimate`
- 현재 로컬 HEAD: `fc81b0b docs(auth): record web PKCE session incident`
- 작성 시점 `origin/main`: `d17d533 feat(workflow): move design-generate action below prompt bar`
- 운영 사이트: `https://www.interiorpick.co.kr`
- 운영 Vercel 프로젝트: `sanois-projects/inpick-app`

## 1. 가장 중요한 현재 상태

웹 Google 로그인이 실제 운영 계정으로 정상화됐다. 사용자가 직접 로그인 성공과
로그인 유지 및 서비스 진입을 확인했고, Vercel 운영 로그에서도 서버 OAuth 교환
성공과 세션 쿠키 3개 발급을 확인했다.

```text
[auth/oauth-exchange] exchange succeeded {
  provider: 'google',
  pendingCookieCount: 3
}
```

장애 원인과 재발 방지 규칙은 다음 문서가 정본이다.

- `docs/ops/WEB_OAUTH_PKCE_INCIDENT_2026-07-25.md`

인증 callback, middleware, root layout, 전역 Provider, Supabase browser client,
서비스 워커, 보호 경로 또는 Vercel 동작을 변경하기 전에 위 문서를 먼저 읽고
반드시 `$inpick-auth-regression`을 실행한다.

## 2. 웹 로그인 장애의 확정 원인

Google/Kakao 공급자 인증이나 사용자 계정 문제가 아니었다. 웹 OAuth callback에서
다음 인증 주체들이 동시에 초기화될 수 있어 일회용 PKCE code 교환과 기존 세션
복원이 경쟁했다.

- callback의 브라우저 Supabase 자동 PKCE 교환
- 루트 `TokensContext`의 전역 인증 listener
- `AuthFlowGate`의 브라우저 client 초기화
- middleware의 기존 세션 refresh
- callback 자체의 세션 쿠키 대기

수정 전 실제 운영 로그에는 다음 상태가 남았다.

```text
stage: browser_oauth_cookie_change
errorCode: AUTH_OPERATION_TIMEOUT
browser-oauth-cookie-handoff timed out after 12000ms
hasVerifierCookie: true
sessionCookieCount: 2
```

즉 PKCE verifier와 callback code는 존재했지만 새 세션 쿠키가 12초 동안 갱신되지
않았다. 기존 쿠키 조각 2개는 이전 세션이라 새 로그인 성공 근거가 아니었다.

앱이 정상이고 웹만 실패한 이유는 앱이 Capacitor 네이티브 저장소와 딥링크 경로를
사용해 브라우저 URL code/PKCE 쿠키 경쟁의 영향을 받지 않았기 때문이다.

## 3. 적용된 인증 해결 구조

해결 코드 커밋: `e3f5d7f fix(auth): exchange OAuth code outside browser lock`

- `POST /api/auth/oauth-exchange`가 웹 PKCE code를 서버에서 정확히 한 번 교환한다.
- 서버가 Supabase 세션 쿠키를 응답에 설정한다.
- callback은 서버 교환 뒤 browser client를 만들기 전에 URL에서 code를 제거한다.
- 서버 쿠키 반영이 보이지 않을 때만 `setSession` fallback을 사용한다.
- `TokensContext`는 `/auth/callback`에서 인증 client/listener를 초기화하지 않는다.
- `AuthFlowGate`는 렌더 시 client를 만들지 않고 실제 보호 경로에서 지연 생성한다.
- middleware는 callback과 exchange API에서 `updateSession()`을 실행하지 않는다.
- token, 인증 code, 쿠키 원문은 로그에 남기지 않는다.

관련 파일:

- `src/app/api/auth/oauth-exchange/route.ts`
- `src/app/auth/callback/page.tsx`
- `src/components/auth/AuthFlowGate.tsx`
- `src/contexts/TokensContext.tsx`
- `src/middleware.ts`
- `src/lib/auth/resilience.ts`
- `e2e/auth-resilience.spec.ts`
- `e2e/auth-production-smoke.spec.ts`

## 4. 완료된 인증 검증

`e3f5d7f` 기준:

- TypeScript 검사 통과
- 인증 단위 테스트 21/21 통과
- 브라우저 인증 회귀 테스트 6/6 통과
- `$inpick-auth-regression` 전체 스크립트 통과
- production build 통과
- 운영 인증 smoke 3/3 통과
  - 이메일 로그인 요청
  - Google OAuth 시작 URL/callback
  - Kakao OAuth 시작 URL/callback
- 운영 비로그인 보호 경로 검사 1/1 통과
- 사용자 실제 Google 로그인 및 세션 유지 확인

자동 smoke는 실제 공급자 계정 인증 완료를 대신하지 않는다. 앞으로도 인증 배포 후
실제 로그인 1회와 `/api/auth/oauth-exchange` 성공 로그를 확인해야 한다.

## 5. Git 및 운영 배포 상태

인증 수정과 장애 문서는 모두 `origin/main`의 조상으로 포함돼 있다.

```text
e3f5d7f fix(auth): exchange OAuth code outside browser lock
fc81b0b docs(auth): record web PKCE session incident
```

`fc81b0b` push 이후 다른 터미널이 Step 2 모바일 변경을 `main`에 추가했다. 작성
시점 원격 최신 커밋은 `d17d533`이며, `fc81b0b`는 해당 커밋의 조상이다. 이
작업 브랜치는 깨끗하지만 원격 `main`보다 뒤에 있다.

```text
local HEAD:  fc81b0b
origin/main: d17d533
```

다른 터미널 변경을 덮지 말고 재개 시 먼저 다음을 실행한다.

```bash
git fetch origin
git status --short
git log --oneline --first-parent -10 origin/main
git diff --stat HEAD..origin/main
```

현재 운영 alias가 가리키는 Vercel 배포:

```text
deployment: dpl_DcaWkHgjaKyJKb66fnVAd2XkXFvo
commit: d17d533
status: Ready
aliases:
  - https://www.interiorpick.co.kr
  - https://interiorpick.co.kr
  - https://inpick-app.vercel.app
```

`d17d533`은 `Step2Designer.tsx` 변경이며 인증 해결 커밋을 포함한다. Vercel build는
성공했다. 예상 가능한 기존 경고는 Bodoni Moda override와 `onnxruntime-web`
critical dependency 경고다.

## 6. 다음 작업: 앱/모바일 Step 2

사용자가 웹 로그인 해결 뒤 앱 Step 2 수정을 우선하겠다고 했다. 기존 사용자 보고:

1. 앱 Step 2 순서가 바뀌어 이미지 생성 프롬프트가 아래에 있고 의미 없는 UI가
   노출됐다.
2. 정상 의도는 실별 프롬프트 입력과 이미지 생성 이후 견적으로 넘어가는 흐름이다.
3. 불필요한 `디자인 프롬프트` 노출과 중복 UI를 제거해야 한다.
4. 모바일에서 계약서/견적서 PDF 다운로드가 동작하지 않는 보고가 있다.
5. 모바일 공정표는 화면이 잘리므로 화면에는 공정별 공사 일수만 간결하게 보이고,
   전체 공정표는 다운로드 PDF에 포함하는 요구가 있다.
6. 도면 기반 생성 정확도, 아파트별 주방 형태 고정, 욕실 2개 주택에서 1개만 생성되는
   문제는 별도 P0 정확도 과제로 남아 있다.

다만 다른 터미널이 이미 다음 Step 2 커밋들을 `origin/main`과 운영에 배포했다.
이 핸드오프 작성자는 해당 변경의 사용자 화면을 검수하지 않았다.

```text
f1040fd feat(workflow): Step2 mobile layout overhaul + scroll flow animation
2f79f4a chore(workflow): remove Step2 token balance card
d17d533 feat(workflow): move design-generate action below prompt bar
```

따라서 다음 작업은 코드를 다시 작성하는 것보다 먼저 다음 순서로 진행한다.

1. `origin/main`의 최신 Step 2 변경과 다른 터미널 상태를 확인한다.
2. 부팅된 iPhone 17 Pro 시뮬레이터에서 실제 운영/로컬 Step 2를 연다.
3. 실 선택 → 실별 프롬프트 → 이미지 생성 → 실별 최종 이미지 1개 선택 → 견적
   진입 순서를 모바일 viewport에서 직접 검증한다.
4. 웹 desktop Step 2가 모바일 수정으로 회귀하지 않았는지 함께 검사한다.
5. 문제가 재현된 지점만 최소 수정한다.
6. 인증 회귀 전체 게이트와 Step 2 E2E를 통과시킨 뒤 배포한다.

현재 부팅된 시뮬레이터:

```text
iPhone 17 Pro
UDID: 0B298B83-139F-4BD9-970D-14DBF34B0857
runtime: iOS 26.5
state: Booted
```

## 7. 프로세스 상태와 주의사항

- 이 작업이 시작한 로컬 Next.js 서버와 Vercel log follower는 종료했다.
- `127.0.0.1:3001`에는 다른 터미널의 Node 서버가 실행 중이다. 소유 작업을 확인하지
  않고 종료하지 않는다.
- iPhone 17 Pro 시뮬레이터는 다음 모바일 작업을 위해 부팅 상태로 남겼다.
- `.env.local`의 비밀 값을 출력하거나 문서·커밋에 포함하지 않는다.
- 사용자 또는 다른 터미널 변경을 `reset`, `checkout`, 광범위 `clean`으로 지우지
  않는다.
- 인증이 다시 실패하면 캐시 삭제를 해결책으로 제시하지 말고 Vercel 요청 로그에서
  callback → exchange → workflow 순서를 확인한다.

## 8. 재개 명령

```bash
cd "/Users/seonbonkim/Desktop/AIOD/개발/inpick beta ver1/inpick_product_hide_hotfix"
sed -n '1,240p' AGENTS.md
sed -n '1,360p' docs/status/HANDOFF-2026-07-26-WEB-AUTH-AND-MOBILE-STEP2.md
sed -n '1,360p' docs/ops/WEB_OAUTH_PKCE_INCIDENT_2026-07-25.md
git fetch origin
git status --short
git log --oneline --first-parent -10 origin/main
```

다음 세션의 첫 지시문:

> `AGENTS.md`, 최신 핸드오프, 웹 OAuth PKCE 장애 문서를 먼저 읽어. 다른 터미널의
> `origin/main` 변경을 보존하고, 먼저 운영과 iPhone 17 Pro 시뮬레이터에서 최신
> Step 2 모바일 흐름을 실제로 재현·검수해. 이미 반영된 부분을 다시 고치지 말고,
> 남은 UI 순서·PDF·도면 정확도 문제를 증거 기준으로 우선순위대로 수정해. 인증 관련
> 변경이나 웹 배포 전에는 반드시 `$inpick-auth-regression` 전체 게이트를 통과시켜.

