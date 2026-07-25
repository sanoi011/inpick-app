export const AUTH_SESSION_RESTORE_TIMEOUT_MS = 2_500;
export const AUTH_REQUEST_TIMEOUT_MS = 12_000;
export const AUTH_POST_LOGIN_TIMEOUT_MS = 1_500;
export const AUTH_OAUTH_COOKIE_POLL_INTERVAL_MS = 50;

export class AuthOperationTimeoutError extends Error {
  readonly code = "AUTH_OPERATION_TIMEOUT";

  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = "AuthOperationTimeoutError";
  }
}

export function isAuthOperationTimeoutError(
  error: unknown,
): error is AuthOperationTimeoutError {
  if (error instanceof AuthOperationTimeoutError) return true;
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "AUTH_OPERATION_TIMEOUT";
}

/**
 * Supabase 인증 요청이 네트워크·세션 잠금 문제로 영구 대기하지 않게 한다.
 * 원본 요청은 늦게 끝날 수 있으므로 호출부는 timeout 이후 결과를 사용하지 않아야 한다.
 */
export async function withAuthTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
  operationName = "authentication",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AuthOperationTimeoutError(operationName, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type OAuthCookieHandoffState = {
  completed: boolean;
  hasVerifierCookie: boolean;
  sessionCookieCount: number;
};

/**
 * 브라우저 PKCE 교환 완료 여부를 쿠키 이름만으로 확인한다.
 *
 * @supabase/ssr는 교환이 끝나면 code-verifier 쿠키를 지우고 세션 쿠키를
 * 기록한다. 큰 OAuth 사용자 세션은 `.0`, `.1`처럼 여러 쿠키로 분할될 수
 * 있으므로 특정 쿠키 하나가 아니라 auth-token 계열 전체를 센다.
 */
export function getOAuthCookieHandoffState(
  cookieHeader: string,
): OAuthCookieHandoffState {
  let hasVerifierCookie = false;
  let sessionCookieCount = 0;

  for (const rawCookie of cookieHeader.split(";")) {
    const separatorIndex = rawCookie.indexOf("=");
    if (separatorIndex < 0) continue;

    const name = rawCookie.slice(0, separatorIndex).trim();
    const value = rawCookie.slice(separatorIndex + 1).trim();
    if (!name.includes("auth-token") || value.length === 0) continue;

    if (name.includes("code-verifier")) {
      hasVerifierCookie = true;
    } else {
      sessionCookieCount += 1;
    }
  }

  return {
    completed: !hasVerifierCookie && sessionCookieCount > 0,
    hasVerifierCookie,
    sessionCookieCount,
  };
}

/**
 * 브라우저 클라이언트가 OAuth code를 교환해 쿠키 저장을 끝낼 때까지만
 * 기다린다. 여기서 getSession/getUser를 다시 호출하면 이미 성공한 교환이
 * 브라우저 lock·AbortError에 막혀 실패로 오인될 수 있다.
 */
export async function waitForOAuthCookieHandoff(
  readCookie: () => string = () => document.cookie,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
  pollIntervalMs = AUTH_OAUTH_COOKIE_POLL_INTERVAL_MS,
): Promise<OAuthCookieHandoffState> {
  const startedAt = Date.now();

  while (true) {
    const state = getOAuthCookieHandoffState(readCookie());
    if (state.completed) return state;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new AuthOperationTimeoutError(
        "browser-oauth-cookie-handoff",
        timeoutMs,
      );
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(pollIntervalMs, timeoutMs - elapsedMs));
    });
  }
}

export type PostLoginResult = "completed" | "timed_out" | "failed";

/**
 * 프로필 보강·감사 기록은 로그인 성공 후처리다.
 * 이 요청이 느리거나 실패해도 사용자의 화면 이동은 반드시 계속되어야 한다.
 */
export async function runPostLoginBestEffort(
  fetcher: typeof fetch = fetch,
  timeoutMs = AUTH_POST_LOGIN_TIMEOUT_MS,
): Promise<PostLoginResult> {
  const controller = new AbortController();
  try {
    await withAuthTimeout(
      fetcher("/api/auth/post-login", {
        method: "POST",
        signal: controller.signal,
      }),
      timeoutMs,
      "post-login",
    );
    return "completed";
  } catch (error) {
    return isAuthOperationTimeoutError(error) ? "timed_out" : "failed";
  } finally {
    controller.abort();
  }
}
