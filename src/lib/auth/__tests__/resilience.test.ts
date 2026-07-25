import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthOperationTimeoutError,
  fetchServerAuthSession,
  getOAuthCookieHandoffState,
  getOAuthSessionCookieFingerprint,
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

test("세션 지문은 verifier를 제외하고 실제 auth-token 변경만 반영한다", () => {
  const before = getOAuthSessionCookieFingerprint(
    "sb-project-auth-token=old; sb-project-auth-token-code-verifier=first",
  );
  const verifierChanged = getOAuthSessionCookieFingerprint(
    "sb-project-auth-token=old; sb-project-auth-token-code-verifier=second",
  );
  const sessionChanged = getOAuthSessionCookieFingerprint(
    "sb-project-auth-token.0=new-first; sb-project-auth-token.1=new-second",
  );

  assert.equal(verifierChanged, before);
  assert.notEqual(sessionChanged, before);
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

test("기존 세션 쿠키가 있으면 새 세션 지문으로 바뀔 때까지 기다린다", async () => {
  const oldCookie = "sb-project-auth-token=old-session";
  const oldFingerprint = getOAuthSessionCookieFingerprint(oldCookie);
  let reads = 0;
  const state = await waitForOAuthCookieHandoff(
    () => {
      reads += 1;
      return reads < 3
        ? oldCookie
        : "sb-project-auth-token.0=new-first; sb-project-auth-token.1=new-second";
    },
    100,
    1,
    oldFingerprint,
  );

  assert.equal(state.completed, true);
  assert.equal(state.sessionCookieCount, 2);
  assert.equal(reads, 3);
});

test("서버가 검증한 사용자 세션을 브라우저 복구 결과로 반환한다", async () => {
  const result = await fetchServerAuthSession<{ id: string }>(
    (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: { id: "verified-user" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )) as typeof fetch,
    50,
  );

  assert.deepEqual(result, {
    authenticated: true,
    user: { id: "verified-user" },
  });
});

test("서버 401은 확정된 비로그인 복구 결과로 반환한다", async () => {
  const result = await fetchServerAuthSession(
    (() => Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch,
    50,
  );

  assert.deepEqual(result, { authenticated: false, user: null });
});
