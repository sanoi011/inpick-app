import assert from "node:assert/strict";
import test from "node:test";

import {
  ImageInputError,
  assertSafeRemoteImageUrl,
  normalizeImageSource,
} from "../../storage/image-storage";

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("data URL is decoded, metadata-stripped, and normalized to webp", async () => {
  const image = await normalizeImageSource(ONE_PIXEL_PNG);

  assert.equal(image.mimeType, "image/webp");
  assert.equal(image.width, 1);
  assert.equal(image.height, 1);
  assert.ok(image.bytes.length > 0);
  assert.match(image.sha256, /^[0-9a-f]{64}$/);
});

test("remote source rejects non-HTTPS and local network targets", async () => {
  for (const value of [
    "http://images.example/render.png",
    "https://localhost/render.png",
    "https://127.0.0.1/render.png",
    "https://[::1]/render.png",
    "https://169.254.169.254/latest/meta-data",
  ]) {
    await assert.rejects(() => assertSafeRemoteImageUrl(value), ImageInputError);
  }
});

test("malformed and unsupported data URLs fail closed", async () => {
  await assert.rejects(() => normalizeImageSource("data:text/plain;base64,SGVsbG8="), ImageInputError);
  await assert.rejects(() => normalizeImageSource("data:image/png;base64,not-base64!"), ImageInputError);
});
