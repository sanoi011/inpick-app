import assert from "node:assert/strict";
import test from "node:test";

import {
  postEstimateJson,
  sanitizeEstimatePayload,
} from "../estimate-client";

test("estimate payload removes browser-local image data while preserving estimate facts", () => {
  const sanitized = sanitizeEstimatePayload({
    projectId: "project-1",
    step1Snapshot: {
      basicInfo: {
        budget: 3500,
        uploadedFloorplan: {
          name: "plan.png",
          dataUrl: "data:image/png;base64,AAAA",
        },
      },
    },
    rooms: [
      {
        roomName: "거실",
        renderImageUrl: "blob:http://localhost/render-1",
        dim: { widthMm: 4800, depthMm: 5800, heightMm: 2400 },
      },
    ],
  }) as Record<string, unknown>;

  const step1 = sanitized.step1Snapshot as {
    basicInfo: { budget: number; uploadedFloorplan: { name: string; dataUrl?: string } };
  };
  const rooms = sanitized.rooms as Array<{ renderImageUrl?: string; dim: { widthMm: number } }>;
  assert.equal(step1.basicInfo.budget, 3500);
  assert.equal(step1.basicInfo.uploadedFloorplan.name, "plan.png");
  assert.equal(step1.basicInfo.uploadedFloorplan.dataUrl, undefined);
  assert.equal(rooms[0].renderImageUrl, undefined);
  assert.equal(rooms[0].dim.widthMm, 4800);
});

test("plain-text 413 response becomes an actionable estimate error", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("Request Entity Too Large", {
      status: 413,
      headers: { "Content-Type": "text/plain" },
    });

  await assert.rejects(
    () => postEstimateJson("/api/inpick/build-estimate", { areaM2: 84 }, fakeFetch),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /요청 데이터가 너무 큽니다/);
      assert.doesNotMatch(error.message, /Unexpected token|Request Entity Too Large/);
      return true;
    },
  );
});

test("HTML gateway response does not leak markup", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response("<html><body>Bad Gateway</body></html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });

  await assert.rejects(
    () => postEstimateJson("/api/inpick/build-estimate", {}, fakeFetch),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 502/);
      assert.doesNotMatch(error.message, /<html>|Bad Gateway|Unexpected token/);
      return true;
    },
  );
});

test("JSON API error preserves the safe server message", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: "견적 입력값이 올바르지 않습니다", hint: "면적을 확인해주세요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () => postEstimateJson("/api/inpick/build-estimate", {}, fakeFetch),
    /견적 입력값이 올바르지 않습니다 → 면적을 확인해주세요/,
  );
});

test("successful estimate response is returned and local image data is not sent", async () => {
  let requestBody = "";
  const fakeFetch: typeof fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ estimates: [{ roomName: "거실" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await postEstimateJson<{ estimates: Array<{ roomName: string }> }>(
    "/api/inpick/build-estimate",
    { rooms: [{ roomName: "거실", renderImageUrl: "data:image/png;base64,AAAA" }] },
    fakeFetch,
  );

  assert.equal(result.estimates[0].roomName, "거실");
  assert.doesNotMatch(requestBody, /data:image|AAAA/);
});
