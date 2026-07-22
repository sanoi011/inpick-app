import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_EDIT_OPTIONS,
  IMAGE_MODEL,
  PROMPT_VERSION,
  buildOpenAIImageEditForm,
  buildInteriorPrompt,
  callOpenAI,
  createServer,
  validateGeneratePayload
} from "../server.mjs";

const validPayload = {
  scan: {
    scanID: "f5f99f79-924b-48a1-8fb5-3ff1531b3a98",
    floorAreaSquareMeters: 24.5,
    netWallAreaSquareMeters: 38.2,
    wallCount: 4,
    doorCount: 1,
    windowCount: 2,
    objectCount: 6
  },
  brief: {
    roomType: "livingRoom",
    style: "warmNatural",
    finishGrade: "standard",
    colorPalette: "warm white and oak",
    notes: "keep circulation clear"
  },
  quote: {
    lowerBoundKRW: 18000000,
    upperBoundKRW: 24000000
  },
  referenceImageBase64: "aW1hZ2U=",
  referenceImageMimeType: "image/png"
};

test("uses the requested GPT Image model", () => {
  assert.equal(IMAGE_MODEL, "gpt-image-2");
});

test("builds a geometry-constrained interior prompt", () => {
  const prompt = buildInteriorPrompt(validPayload);
  assert.match(prompt, new RegExp(PROMPT_VERSION));
  assert.match(prompt, /24\.5 square meters/);
  assert.match(prompt, /38\.2 square meters/);
  assert.match(prompt, /4 walls, 1 doors, 2 windows, 6 objects/);
  assert.match(prompt, /Preserve the scanned footprint/);
  assert.match(prompt, /warm natural interior with wood and soft textures/);
  assert.match(prompt, /warm white and oak/);
  assert.match(prompt, /keep circulation clear/);
  assert.match(prompt, /18,000,000/);
  assert.match(prompt, /24,000,000/);
  assert.match(prompt, /Do not add, remove, resize, or relocate walls/);
});

test("requires LiDAR area and reference image", () => {
  assert.equal(validateGeneratePayload(validPayload), null);
  assert.match(
    validateGeneratePayload({ ...validPayload, referenceImageBase64: "" }),
    /참조 이미지/
  );
  assert.match(
    validateGeneratePayload({
      ...validPayload,
      scan: { ...validPayload.scan, floorAreaSquareMeters: 0 }
    }),
    /바닥 면적/
  );
  assert.match(
    validateGeneratePayload({
      ...validPayload,
      brief: { ...validPayload.brief, style: "unknown" }
    }),
    /스타일/
  );
  assert.match(
    validateGeneratePayload({
      ...validPayload,
      referenceImageMimeType: "image/gif"
    }),
    /형식/
  );
  assert.match(
    validateGeneratePayload({
      ...validPayload,
      quote: { lowerBoundKRW: 20_000_000, upperBoundKRW: 10_000_000 }
    }),
    /견적 범위/
  );
  assert.match(
    validateGeneratePayload({
      ...validPayload,
      scan: { ...validPayload.scan, wallCount: 1.5 }
    }),
    /인식 개수/
  );
});

test("builds the exact GPT Image 2 multipart edit contract", async () => {
  const form = buildOpenAIImageEditForm(validPayload);
  assert.equal(form.get("model"), "gpt-image-2");
  assert.equal(form.get("prompt"), buildInteriorPrompt(validPayload));
  assert.equal(form.get("quality"), IMAGE_EDIT_OPTIONS.quality);
  assert.equal(form.get("size"), IMAGE_EDIT_OPTIONS.size);
  assert.equal(form.get("output_format"), IMAGE_EDIT_OPTIONS.outputFormat);
  assert.equal(form.get("output_compression"), IMAGE_EDIT_OPTIONS.outputCompression);
  assert.equal(form.has("input_fidelity"), false);
  assert.equal(form.has("image"), false);
  const image = form.get("image[]");
  assert.ok(image instanceof Blob);
  assert.equal(image.type, "image/png");
  assert.ok(image.size > 0);
});

test("calls the OpenAI image edits endpoint and returns trace metadata", async () => {
  let captured;
  const result = await callOpenAI(validPayload, {
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "Z2VuZXJhdGVk" }],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req_test_123"
          }
        }
      );
    }
  });

  assert.equal(captured.url, "https://api.openai.com/v1/images/edits");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.Authorization, "Bearer test-key");
  assert.ok(captured.init.body instanceof FormData);
  assert.equal(captured.init.body.get("model"), "gpt-image-2");
  assert.equal(result.imageBase64, "Z2VuZXJhdGVk");
  assert.equal(result.requestID, "req_test_123");
  assert.equal(result.promptVersion, PROMPT_VERSION);
  assert.equal(result.usage.total_tokens, 30);
});

test("health endpoint reports model and key state", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.model, "gpt-image-2");
  assert.equal(body.promptVersion, PROMPT_VERSION);
  assert.deepEqual(body.imageEditOptions, IMAGE_EDIT_OPTIONS);
  assert.equal(typeof body.configured, "boolean");
});
