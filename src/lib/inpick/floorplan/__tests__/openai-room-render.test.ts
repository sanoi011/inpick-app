import assert from "node:assert/strict";
import test from "node:test";

import { generateRoomRender } from "@/lib/inpick/openai-client";

test("room render uses text-to-image with area-average dimensions when no floorplan exists", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let requestUrl = "";
  let requestBody = "";
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = String(init?.body || "");
    return new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from("test-image").toString("base64") }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await generateRoomRender({
      roomName: "거실",
      widthMm: 4800,
      depthMm: 3900,
      heightMm: 2400,
      style: "warm minimal",
      isFromFloorplan: false,
      quality: "low",
    });
    assert.match(requestUrl, /\/images\/generations$/);
    assert.match(requestBody, /No exact floor plan is available/);
    assert.match(requestBody, /4\.80m/);
    assert.ok(result.imageUrl?.startsWith("data:image/png;base64,"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
