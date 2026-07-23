import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { getMtlsHealth, getRuntimeHealth } from "../lib/runtime-health.js";

const ENV_KEYS = [
  "APPS_IN_TOSS_MTLS_CERT",
  "APPS_IN_TOSS_MTLS_KEY",
  "APPS_IN_TOSS_MTLS_CA",
  "APPS_IN_TOSS_USER_HASH_SECRET",
  "APPS_IN_TOSS_CALLBACK_BASIC_AUTH",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INPICK_UPSTREAM_ORIGIN",
] as const;

function withCleanEnvironment(run: () => void) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of ENV_KEYS) delete process.env[key];
  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("mTLS health rejects missing and malformed values without exposing them", () => {
  withCleanEnvironment(() => {
    assert.deepEqual(getMtlsHealth(), {
      configured: false,
      parseable: false,
      keyMatchesCertificate: false,
      currentlyValid: false,
      caConfigured: false,
      caParseable: true,
    });

    process.env.APPS_IN_TOSS_MTLS_CERT = "not-a-certificate";
    process.env.APPS_IN_TOSS_MTLS_KEY = "not-a-private-key";
    assert.equal(getMtlsHealth().configured, true);
    assert.equal(getMtlsHealth().parseable, false);
  });
});

test("runtime health requires every production integration value", () => {
  withCleanEnvironment(() => {
    const health = getRuntimeHealth();
    assert.equal(health.ready, false);
    assert.equal(health.supabaseConfigured, false);
    assert.equal(health.appSecretsConfigured, false);
    assert.equal(health.upstreamConfigured, false);
  });
});

test("mTLS health rejects a private key that cannot form a certificate pair", () => {
  withCleanEnvironment(() => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.APPS_IN_TOSS_MTLS_CERT = "not-a-certificate";
    process.env.APPS_IN_TOSS_MTLS_KEY = privateKey;

    const health = getMtlsHealth();
    assert.equal(health.configured, true);
    assert.equal(health.parseable, false);
    assert.equal(health.keyMatchesCertificate, false);
  });
});
