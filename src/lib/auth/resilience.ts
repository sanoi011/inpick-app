export const AUTH_SESSION_RESTORE_TIMEOUT_MS = 2_500;
export const AUTH_REQUEST_TIMEOUT_MS = 12_000;
export const AUTH_POST_LOGIN_TIMEOUT_MS = 1_500;
export const AUTH_OAUTH_COOKIE_POLL_INTERVAL_MS = 50;
export const WEB_OAUTH_SESSION_FINGERPRINT_STORAGE_KEY =
  "inpick_web_oauth_session_fingerprint_before_login";

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
 * 큰 OAuth 사용자 세션은 `.0`, `.1`처럼 여러 쿠키로 분할될 수 있으므로
 * 특정 쿠키 하나가 아니라 auth-token 계열 전체를 센다. Arc에서는 동일한
 * verifier가 host/domain 범위로 중복 잔존할 수 있어 세션 쿠키 존재만
 * handoff 완료 기준으로 사용한다.
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
    completed: sessionCookieCount > 0,
    hasVerifierCookie,
    sessionCookieCount,
  };
}

/**
 * token 원문을 별도 저장하지 않고 OAuth 전후 세션 변경만 비교하는 짧은 지문.
 * verifier는 제외해 PKCE 시작 단계의 쿠키 추가가 세션 교환으로 오인되지 않게 한다.
 */
export function getOAuthSessionCookieFingerprint(cookieHeader: string): string {
  const sessionCookies: string[] = [];

  for (const rawCookie of cookieHeader.split(";")) {
    const separatorIndex = rawCookie.indexOf("=");
    if (separatorIndex < 0) continue;
    const name = rawCookie.slice(0, separatorIndex).trim();
    const value = rawCookie.slice(separatorIndex + 1).trim();
    if (
      !name.includes("auth-token") ||
      name.includes("code-verifier") ||
      value.length === 0
    ) {
      continue;
    }
    sessionCookies.push(`${name}=${value}`);
  }

  const source = sessionCookies.sort().join(";");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${sessionCookies.length}:${(hash >>> 0).toString(16)}`;
}

/**
 * 브라우저 클라이언트가 시작한 자동 PKCE 교환으로 세션 쿠키 저장이 끝날
 * 때까지만 기다린다. initialize/getSession/getUser를 완료 조건으로 기다리면
 * 이미 성공한 교환이 브라우저 lock·AbortError에 막혀 실패로 오인될 수 있다.
 */
export async function waitForOAuthCookieHandoff(
  readCookie: () => string = () => document.cookie,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
  pollIntervalMs = AUTH_OAUTH_COOKIE_POLL_INTERVAL_MS,
  previousSessionFingerprint?: string,
): Promise<OAuthCookieHandoffState> {
  const startedAt = Date.now();

  while (true) {
    const cookieHeader = readCookie();
    const state = getOAuthCookieHandoffState(cookieHeader);
    const currentFingerprint =
      getOAuthSessionCookieFingerprint(cookieHeader);
    const sessionChanged =
      previousSessionFingerprint === undefined ||
      currentFingerprint !== previousSessionFingerprint;
    if (state.completed && sessionChanged) return state;

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

export type ServerAuthSessionResult<TUser> =
  | { authenticated: true; user: TUser }
  | { authenticated: false; user: null };

/**
 * 브라우저 auth lock이 늦어질 때 서버가 같은 쿠키를 직접 검증하는 복구 경로다.
 * 401은 확정 로그아웃으로 반환하고, 5xx/timeout은 일시 장애로 예외 처리해
 * 이미 확인한 브라우저 세션을 성급히 폐기하지 않게 한다.
 */
export async function fetchServerAuthSession<TUser>(
  fetcher: typeof fetch = fetch,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
): Promise<ServerAuthSessionResult<TUser>> {
  const response = await withAuthTimeout(
    fetcher("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }),
    timeoutMs,
    "server-auth-session",
  );

  if (response.status === 401) {
    return { authenticated: false, user: null };
  }
  if (!response.ok) {
    throw new Error(`SERVER_AUTH_SESSION_${response.status}`);
  }

  const payload = (await response.json()) as {
    authenticated?: boolean;
    user?: TUser | null;
  };
  if (!payload.authenticated || !payload.user) {
    return { authenticated: false, user: null };
  }
  return { authenticated: true, user: payload.user };
}

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
