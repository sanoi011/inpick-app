import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchFloorplanJson,
  FloorplanRequestError,
} from "../normalize-request";

test("JSON body까지 읽은 뒤 성공 응답을 반환한다", async () => {
  const result = await fetchFloorplanJson<{ ok: boolean }>(
    "https://example.test/floorplan",
    { method: "POST" },
    {
      timeoutMs: 100,
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    },
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data, { ok: true });
});

test("응답이 멈추면 제한시간 후 timeout으로 종료한다", async () => {
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    })) as typeof fetch;

  await assert.rejects(
    fetchFloorplanJson(
      "https://example.test/floorplan",
      { method: "POST" },
      { timeoutMs: 20, fetchImpl: hangingFetch },
    ),
    (error: unknown) =>
      error instanceof FloorplanRequestError && error.code === "timeout",
  );
});

test("호출자가 취소한 요청은 timeout으로 잘못 분류하지 않는다", async () => {
  const caller = new AbortController();
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    })) as typeof fetch;

  const pending = fetchFloorplanJson(
    "https://example.test/floorplan",
    { method: "POST", signal: caller.signal },
    { timeoutMs: 500, fetchImpl: hangingFetch },
  );
  caller.abort();

  await assert.rejects(
    pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});
