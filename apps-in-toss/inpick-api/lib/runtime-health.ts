import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";

function pem(name: string): string {
  return (process.env[name] || "").replace(/\\n/g, "\n").trim();
}

function hasValue(name: string): boolean {
  return Boolean((process.env[name] || "").trim());
}

export type MtlsHealth = {
  configured: boolean;
  parseable: boolean;
  keyMatchesCertificate: boolean;
  currentlyValid: boolean;
  caConfigured: boolean;
  caParseable: boolean;
};

export function getMtlsHealth(now = Date.now()): MtlsHealth {
  const certPem = pem("APPS_IN_TOSS_MTLS_CERT");
  const keyPem = pem("APPS_IN_TOSS_MTLS_KEY");
  const caPem = pem("APPS_IN_TOSS_MTLS_CA");
  const configured = Boolean(certPem && keyPem);

  const result: MtlsHealth = {
    configured,
    parseable: false,
    keyMatchesCertificate: false,
    currentlyValid: false,
    caConfigured: Boolean(caPem),
    caParseable: !caPem,
  };
  if (!configured) return result;

  try {
    const certificate = new X509Certificate(certPem);
    const privateKey = createPrivateKey(keyPem);
    const certificatePublicKey = certificate.publicKey.export({
      type: "spki",
      format: "der",
    });
    const privateKeyPublicKey = createPublicKey(privateKey).export({
      type: "spki",
      format: "der",
    });

    result.parseable = true;
    result.keyMatchesCertificate =
      Buffer.compare(certificatePublicKey, privateKeyPublicKey) === 0;
    result.currentlyValid =
      now >= Date.parse(certificate.validFrom) &&
      now <= Date.parse(certificate.validTo);
  } catch {
    return result;
  }

  if (caPem) {
    try {
      new X509Certificate(caPem);
      result.caParseable = true;
    } catch {
      result.caParseable = false;
    }
  }

  return result;
}

export function getRuntimeHealth() {
  const mtls = getMtlsHealth();
  const supabaseConfigured =
    hasValue("NEXT_PUBLIC_SUPABASE_URL") &&
    hasValue("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    hasValue("SUPABASE_SERVICE_ROLE_KEY");
  const appSecretsConfigured =
    hasValue("APPS_IN_TOSS_USER_HASH_SECRET") &&
    hasValue("APPS_IN_TOSS_CALLBACK_BASIC_AUTH");
  const upstreamConfigured = hasValue("INPICK_UPSTREAM_ORIGIN");
  const mtlsReady =
    mtls.configured &&
    mtls.parseable &&
    mtls.keyMatchesCertificate &&
    mtls.currentlyValid &&
    mtls.caParseable;

  return {
    ready:
      mtlsReady &&
      supabaseConfigured &&
      appSecretsConfigured &&
      upstreamConfigured,
    mtls,
    supabaseConfigured,
    appSecretsConfigured,
    upstreamConfigured,
  };
}
