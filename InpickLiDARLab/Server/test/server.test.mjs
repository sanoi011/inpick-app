import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_MODEL,
  buildInteriorPrompt,
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
  assert.match(prompt, /24\.5 square meters/);
  assert.match(prompt, /Preserve the scanned footprint/);
  assert.match(prompt, /warm natural interior with wood and soft textures/);
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
  assert.equal(typeof body.configured, "boolean");
});
