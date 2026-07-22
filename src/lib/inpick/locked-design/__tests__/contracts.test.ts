import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeLockedAsset,
  validateIdempotencyKey,
} from "../contracts";

test("locked asset sanitizer never exposes storage or source locations", () => {
  const sanitized = sanitizeLockedAsset({
    id: "7a6b01bd-264d-42d5-aa76-3319fbc12a20",
    design_output_id: "7659dff2-04a1-4494-ac31-29489c7dd796",
    project_id: "999be776-07c4-4ef8-a7de-49675091105a",
    target_type: "room",
    target_id: "living-room",
    target_name: "거실",
    render_kind: "room_render",
    status: "completed",
    unlock_cost: 2,
    mime_type: "image/webp",
    width: 1024,
    height: 768,
    byte_size: 12345,
    created_at: "2026-07-22T00:00:00.000Z",
    original_storage_path: "user/project/secret.webp",
    image_url: "https://provider.example/original.png",
    source_url: "https://provider.example/original.png",
    content_sha256: "secret-fingerprint",
    user_id: "secret-user-id",
  });

  assert.deepEqual(sanitized, {
    id: "7a6b01bd-264d-42d5-aa76-3319fbc12a20",
    designOutputId: "7659dff2-04a1-4494-ac31-29489c7dd796",
    projectId: "999be776-07c4-4ef8-a7de-49675091105a",
    targetType: "room",
    targetId: "living-room",
    targetName: "거실",
    renderKind: "room_render",
    status: "completed",
    unlockCost: 2,
    mimeType: "image/webp",
    width: 1024,
    height: 768,
    byteSize: 12345,
    createdAt: "2026-07-22T00:00:00.000Z",
    unlocked: false,
  });
  assert.equal(JSON.stringify(sanitized).includes("secret"), false);
});

test("sanitizer exposes entitlement state but not signed URL", () => {
  const sanitized = sanitizeLockedAsset({
    id: "asset",
    design_output_id: "output",
    project_id: "project",
    target_type: "room",
    target_id: "bedroom",
    target_name: "침실",
    render_kind: "room_render",
    status: "completed",
    unlock_cost: 3,
    mime_type: "image/webp",
    width: 800,
    height: 800,
    byte_size: 100,
    created_at: "2026-07-22T00:00:00.000Z",
    grant_id: "grant",
    signed_url: "https://storage.example/signed-secret",
  });

  assert.equal(sanitized.unlocked, true);
  assert.equal("signedUrl" in sanitized, false);
});

test("idempotency keys are bounded stable request identifiers", () => {
  assert.equal(validateIdempotencyKey("unlock:01J1V2W3X4Y5Z6A7B8C9D0E1F2"), true);
  assert.equal(validateIdempotencyKey("short"), false);
  assert.equal(validateIdempotencyKey("contains spaces and secrets"), false);
  assert.equal(validateIdempotencyKey("x".repeat(129)), false);
});
