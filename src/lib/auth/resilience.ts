export const AUTH_SESSION_RESTORE_TIMEOUT_MS = 2_500;
export const AUTH_REQUEST_TIMEOUT_MS = 12_000;
export const AUTH_POST_LOGIN_TIMEOUT_MS = 1_500;

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
