import assert from "node:assert/strict";
import test from "node:test";

import {
  requestLockedDesignView,
  shouldRefreshLockedDesignView,
} from "../client-access";

test("locked design view refreshes before its short signed URL expires", () => {
  const now = Date.parse("2026-07-24T09:00:00.000Z");
  assert.equal(
    shouldRefreshLockedDesignView("2026-07-24T09:00:30.000Z", now),
    true,
  );
  assert.equal(
    shouldRefreshLockedDesignView("2026-07-24T09:05:00.000Z", now),
    false,
  );
  assert.equal(shouldRefreshLockedDesignView(undefined, now), true);
});

test("paid locked design requests a fresh view URL without a new purchase key", async () => {
  let requestUrl = "";
  let requestBody = "";
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = String(init?.body || "");
    return Response.json({
      url: "https://signed.example/fresh.webp",
      expiresAt: "2026-07-24T09:08:00.000Z",
      grant: { charged: false },
    });
  }) as typeof fetch;

  const result = await requestLockedDesignView("asset-123", fetcher);

  assert.equal(
    requestUrl,
    "/api/inpick/locked-design/assets/asset-123/unlock",
  );
  assert.deepEqual(JSON.parse(requestBody), {
    idempotencyKey: "unlock:asset-123",
  });
  assert.equal(result.url, "https://signed.example/fresh.webp");
});
