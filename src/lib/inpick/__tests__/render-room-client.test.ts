import assert from "node:assert/strict";
import test from "node:test";

import { renderRoomViaClient, type RenderRoomBody } from "../render-room-client";

const requestBody: RenderRoomBody = {
  roomName: "거실",
  widthMm: 4500,
  depthMm: 3800,
  style: "밝은 우드 모던",
};

async function withMockFetch(
  mock: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("plain-text 413 response becomes a safe actionable error", async () => {
  await withMockFetch(
    async () =>
      new Response("Request Entity Too Large", {
        status: 413,
        headers: { "Content-Type": "text/plain" },
      }),
    async () => {
      const result = await renderRoomViaClient(requestBody);
      assert.ok("error" in result);
      assert.match(result.error, /요청 데이터가 너무 큽니다/);
      assert.doesNotMatch(result.error, /Unexpected token|Request Entity/);
      assert.match(result.hint ?? "", /도면 이미지/);
    },
  );
});

test("HTML gateway response does not leak markup or JSON parse errors", async () => {
  await withMockFetch(
    async () =>
      new Response("<html><body>upstream secret detail</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    async () => {
      const result = await renderRoomViaClient(requestBody);
      assert.ok("error" in result);
      assert.match(result.error, /HTTP 502/);
      assert.doesNotMatch(result.error, /html|secret|Unexpected token/i);
    },
  );
});

test("data URL floorplan is omitted from the render request", async () => {
  let sentBody: Record<string, unknown> | null = null;
  await withMockFetch(
    async (_input, init) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ imageUrl: "https://example.com/render.png" });
    },
    async () => {
      const result = await renderRoomViaClient({
        ...requestBody,
        floorplanImageUrl: "data:image/png;base64," + "A".repeat(2_000_000),
        isFromFloorplan: true,
      });
      assert.ok("imageUrl" in result);
    },
  );
  assert.ok(sentBody);
  const capturedBody = sentBody as Record<string, unknown>;
  assert.equal(capturedBody.floorplanImageUrl, undefined);
  assert.equal(capturedBody.isFromFloorplan, false);
});

test("inline floorplan image is omitted but the parsed room graph is retained", async () => {
  let sentBody: Record<string, unknown> | null = null;
  await withMockFetch(
    async (_input, init) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ imageUrl: "https://example.com/render.png" });
    },
    async () => {
      await renderRoomViaClient({
        ...requestBody,
        floorplanImageUrl: "data:image/png;base64," + "A".repeat(2_000_000),
        isFromFloorplan: true,
        parsedFloorPlan: {
          rooms: [
            {
              id: "living",
              name: "거실",
              bbox: { x: 0, y: 0, width: 5.2, height: 4.1 },
              areaM2: 21.32,
            },
            {
              id: "kitchen",
              name: "주방",
              bbox: { x: 5.2, y: 0, width: 3.1, height: 3.4 },
              areaM2: 10.54,
            },
          ],
        },
      });
    },
  );
  assert.ok(sentBody);
  const capturedBody = sentBody as Record<string, unknown>;
  assert.equal(capturedBody.floorplanImageUrl, undefined);
  assert.equal(capturedBody.isFromFloorplan, true);
  assert.equal(
    (capturedBody.parsedFloorPlan as { rooms: unknown[] }).rooms.length,
    2,
  );
});

test("JSON error response preserves the server error envelope", async () => {
  await withMockFetch(
    async () =>
      Response.json(
        { error: "RATE_LIMIT_EXCEEDED", hint: "잠시 후 다시 시도해주세요" },
        { status: 429 },
      ),
    async () => {
      const result = await renderRoomViaClient(requestBody);
      assert.deepEqual(result, {
        error: "RATE_LIMIT_EXCEEDED",
        hint: "잠시 후 다시 시도해주세요",
        modelStatus: undefined,
        jobId: undefined,
        backend: undefined,
      });
    },
  );
});
