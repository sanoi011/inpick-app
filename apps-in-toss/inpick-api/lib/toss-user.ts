import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const SEALED_USER_KEY_VERSION = "v1";

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(`inpick:apps-in-toss:user-key:${secret}`).digest();
}

export function hashTossUserKey(userKey: string | number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`inpick:toss:${String(userKey)}`)
    .digest("hex");
}

export function tossUserEmail(userKey: string | number, secret: string): string {
  const hash = hashTossUserKey(userKey, secret);
  return `toss-${hash.slice(0, 48)}@auth.interiorpick.co.kr`;
}

export function sealTossUserKey(userKey: string | number, secret: string): string {
  if (!secret) throw new Error("TOSS_USER_SECRET_REQUIRED");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(userKey), "utf8"),
    cipher.final(),
  ]);
  return [
    SEALED_USER_KEY_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function openTossUserKey(sealed: string, secret: string): string {
  if (!secret) throw new Error("TOSS_USER_SECRET_REQUIRED");
  const [version, ivText, tagText, encryptedText, extra] = sealed.split(".");
  if (
    version !== SEALED_USER_KEY_VERSION ||
    !ivText ||
    !tagText ||
    !encryptedText ||
    extra
  ) {
    throw new Error("INVALID_TOSS_USER_KEY");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("INVALID_TOSS_USER_KEY");
  }
}
