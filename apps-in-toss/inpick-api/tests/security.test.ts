import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedBiddingApi, normalizeApiTarget } from "../api/proxy.js";
import { verifyBasicAuthorization } from "../lib/basic-auth.js";
import { makeSupabaseSessionCookies } from "../lib/supabase-cookie.js";
import { tossUserEmail } from "../lib/toss-user.js";

function jwt(payload: Record<string, unknown>, padding = "") {
  return [
    Buffer.from('{"alg":"none"}').toString("base64url"),
    Buffer.from(JSON.stringify({ ...payload, padding })).toString("base64url"),
    "signature",
  ].join(".");
}

function decodeCookieSession(cookieHeader: string) {
  const values = cookieHeader
    .split("; ")
    .map((cookie) => cookie.slice(cookie.indexOf("=") + 1))
    .join("");
  assert.match(values, /^base64-/);
  return JSON.parse(Buffer.from(values.slice(7), "base64url").toString("utf8")) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_at: number;
    expires_in: number;
  };
}

test("Supabase bearer token is encoded into the expected SSR cookie", () => {
  const accessToken = jwt({ exp: 2_000_000_000, sub: "user-1" });
  const header = makeSupabaseSessionCookies(
    "https://project-ref.supabase.co",
    accessToken,
  );
  assert.match(header, /^sb-project-ref-auth-token=base64-/);
  const session = decodeCookieSession(header);
  assert.equal(session.access_token, accessToken);
  assert.equal(session.refresh_token, "");
  assert.equal(session.token_type, "bearer");
  assert.equal(session.expires_at, 2_000_000_000);
  assert.ok(session.expires_in > 0);
});

test("large sessions are emitted as ordered Supabase cookie chunks", () => {
  const accessToken = jwt({ exp: 2_000_000_000 }, "x".repeat(8_000));
  const header = makeSupabaseSessionCookies("https://abc.supabase.co", accessToken);
  assert.match(header, /^sb-abc-auth-token\.0=/);
  assert.match(header, /; sb-abc-auth-token\.1=/);
  assert.equal(decodeCookieSession(header).access_token, accessToken);
});

test("proxy accepts normal API routes and rejects path traversal", () => {
  assert.equal(normalizeApiTarget("inpick/render-room"), "/api/inpick/render-room");
  assert.equal(normalizeApiTarget(["inpick", "workflow-state"]), "/api/inpick/workflow-state");
  assert.equal(normalizeApiTarget("../admin"), null);
  assert.equal(normalizeApiTarget("%2e%2e/admin"), null);
  assert.equal(normalizeApiTarget("https://example.com"), null);
  assert.equal(normalizeApiTarget(""), null);
});

test("all contractor bidding entry points are blocked without blocking estimates", () => {
  for (const path of [
    "/api/bids",
    "/api/bids/select",
    "/api/rfq/publish",
    "/api/contractor/rfqs/1",
    "/api/contractor/bids",
  ]) {
    assert.equal(isBlockedBiddingApi(path), true, path);
  }
  assert.equal(isBlockedBiddingApi("/api/inpick/build-estimate"), false);
  assert.equal(isBlockedBiddingApi("/api/inpick/render-room"), false);
});

test("unlink callback Basic authentication uses the console-entered raw value", () => {
  const expected = "inpick_callback_test_value";
  const header = `Basic ${Buffer.from(expected, "utf8").toString("base64")}`;
  assert.equal(verifyBasicAuthorization(header, expected), true);
  assert.equal(verifyBasicAuthorization(header, `${expected}_wrong`), false);
  assert.equal(verifyBasicAuthorization("Bearer token", expected), false);
});

test("Toss user identity is deterministic without exposing the raw user key", () => {
  const email = tossUserEmail(123456, "test-secret");
  assert.match(email, /^toss-[a-f0-9]{48}@auth\.interiorpick\.co\.kr$/);
  assert.doesNotMatch(email, /123456/);
  assert.equal(email, tossUserEmail(123456, "test-secret"));
});
