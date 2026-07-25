import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthOperationTimeoutError,
  getOAuthCookieHandoffState,
  runPostLoginBestEffort,
  waitForOAuthCookieHandoff,
  withAuthTimeout,
} from "../resilience";

test("인증 요청은 정상 응답을 그대로 반환한다", async () => {
  const result = await withAuthTimeout(Promise.resolve("ok"), 50, "test-auth");
  assert.equal(result, "ok");
});

test("멈춘 인증 요청은 제한 시간 뒤 timeout으로 종료한다", async () => {
  const never = new Promise<never>(() => undefined);
  await assert.rejects(
    withAuthTimeout(never, 10, "stalled-auth"),
    (error: unknown) =>
      error instanceof AuthOperationTimeoutError &&
      error.operation === "stalled-auth",
  );
});

test("로그인 후처리가 멈춰도 timed_out으로 복귀하고 요청을 중단한다", async () => {
  let capturedSignal: AbortSignal | undefined;
  const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    capturedSignal = init?.signal ?? undefined;
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;

  const result = await runPostLoginBestEffort(stalledFetch, 10);

  assert.equal(result, "timed_out");
  assert.equal(capturedSignal?.aborted, true);
});

test("로그인 후처리 실패는 로그인 흐름에 예외를 전파하지 않는다", async () => {
  const failedFetch = (() =>
    Promise.reject(new Error("network down"))) as typeof fetch;

  const result = await runPostLoginBestEffort(failedFetch, 50);

  assert.equal(result, "failed");
});

test("분할 세션 쿠키가 저장되고 verifier가 사라지면 OAuth 교환 완료로 본다", () => {
  const state = getOAuthCookieHandoffState(
    [
      "theme=light",
      "sb-project-auth-token.0=base64-first",
      "sb-project-auth-token.1=base64-second",
    ].join("; "),
  );

  assert.deepEqual(state, {
    completed: true,
    hasVerifierCookie: false,
    sessionCookieCount: 2,
  });
});

test("Arc에서 verifier가 중복 잔존해도 저장된 세션 handoff를 인정한다", () => {
  const state = getOAuthCookieHandoffState(
    [
      "sb-project-auth-token=base64-old-session",
      "sb-project-auth-token-code-verifier=verifier",
    ].join("; "),
  );

  assert.deepEqual(state, {
    completed: true,
    hasVerifierCookie: true,
    sessionCookieCount: 1,
  });
});

test("getSession 추가 호출 없이 쿠키 handoff 완료 즉시 복귀한다", async () => {
  let reads = 0;
  const state = await waitForOAuthCookieHandoff(
    () => {
      reads += 1;
      return reads < 2
        ? "sb-project-auth-token-code-verifier=verifier"
        : "sb-project-auth-token.0=first; sb-project-auth-token.1=second";
    },
    100,
    1,
  );

  assert.equal(state.completed, true);
  assert.equal(state.sessionCookieCount, 2);
  assert.equal(reads, 2);
});
