import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthOperationTimeoutError,
  runPostLoginBestEffort,
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
