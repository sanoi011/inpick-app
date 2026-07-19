import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsumerAuthHref,
  getReturnPathFromOAuthRedirect,
  isNativePublicPath,
  requiresConsumerAuthOnWeb,
} from "../access-policy";

test("web authentication is required for the entire free AI workflow", () => {
  assert.equal(requiresConsumerAuthOnWeb("/workflow"), true);
  assert.equal(requiresConsumerAuthOnWeb("/workflow/estimate"), true);
  assert.equal(requiresConsumerAuthOnWeb("/partial-install"), false);
  assert.equal(requiresConsumerAuthOnWeb("/"), false);
});

test("native pre-login routes expose only auth and legal screens", () => {
  assert.equal(isNativePublicPath("/auth"), true);
  assert.equal(isNativePublicPath("/auth/callback"), true);
  assert.equal(isNativePublicPath("/privacy"), true);
  assert.equal(isNativePublicPath("/terms"), true);
  assert.equal(isNativePublicPath("/account-deletion"), true);
  assert.equal(isNativePublicPath("/"), false);
  assert.equal(isNativePublicPath("/community"), false);
});

test("login href keeps a safe in-site return path", () => {
  const href = buildConsumerAuthHref("/workflow?step=2", "free_ai");
  const parsed = new URL(href, "https://inpick.local");
  assert.equal(parsed.pathname, "/auth");
  assert.equal(parsed.searchParams.get("type"), "consumer");
  assert.equal(parsed.searchParams.get("returnUrl"), "/workflow?step=2");
  assert.equal(parsed.searchParams.get("source"), "free_ai");

  const unsafe = new URL(
    buildConsumerAuthHref("https://evil.example", "protected_route"),
    "https://inpick.local",
  );
  assert.equal(unsafe.searchParams.get("returnUrl"), "/");
});

test("native OAuth return path is recovered from the existing callback contract", () => {
  assert.equal(
    getReturnPathFromOAuthRedirect(
      "https://www.interiorpick.co.kr/auth/callback?next=%2Fworkflow%3Fstep%3D2",
    ),
    "/workflow?step=2",
  );
  assert.equal(
    getReturnPathFromOAuthRedirect(
      "https://www.interiorpick.co.kr/auth/callback?next=https%3A%2F%2Fevil.example",
    ),
    "/",
  );
});
