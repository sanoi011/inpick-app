import assert from "node:assert/strict";
import test from "node:test";

import { extractDesignPrompt } from "../design-chat-client";

test("prompt extraction sends text only and excludes image base64 payloads", async () => {
  let payload: Record<string, unknown> | null = null;
  const fetchMock: typeof fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ image_prompt: "Photorealistic Korean apartment interior" });
  };

  const result = await extractDesignPrompt(
    [
      {
        role: "user",
        content: "밝은 우드로 꾸며줘",
        images: [{ base64: "A".repeat(2_000_000), dataUrl: "data:image/png;base64,AAAA" }],
      },
    ],
    fetchMock,
  );

  assert.equal(result.image_prompt, "Photorealistic Korean apartment interior");
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /base64|data:image|AAAAAA/);
  assert.ok(serialized.length < 10_000);
});

test("prompt extraction maps a text 413 response without JSON parse leakage", async () => {
  const fetchMock: typeof fetch = async () =>
    new Response("Request Entity Too Large", {
      status: 413,
      headers: { "Content-Type": "text/plain" },
    });

  await assert.rejects(
    () => extractDesignPrompt([{ role: "user", content: "모던 거실" }], fetchMock),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /요청 데이터가 너무 큽니다/);
      assert.doesNotMatch(error.message, /Unexpected token|Request Entity/);
      return true;
    },
  );
});

test("prompt extraction sends sanitized Step 1 context with the conversation", async () => {
  let payload: Record<string, unknown> | null = null;
  const fetchMock: typeof fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ image_prompt: "Photorealistic Korean apartment interior" });
  };

  await extractDesignPrompt(
    [{ role: "user", content: "블랙 포인트 주방으로 꾸며줘" }],
    {
      projectMode: "apartment",
      workflowEntry: "apartment_drawing",
      buildingType: "apartment",
      address: "대전광역시 중구 대전천서로 709",
      exclusiveAreaM2: 59.98,
      expansionType: "extended",
      selectedRooms: ["주방"],
    },
    fetchMock,
  );

  const context = payload?.context as Record<string, unknown> | undefined;
  assert.ok(context);
  assert.equal(context.buildingType, "apartment");
  assert.equal(context.exclusiveAreaM2, 59.98);
  assert.equal(context.expansionType, "extended");
  assert.deepEqual(context.selectedRooms, ["주방"]);
});
