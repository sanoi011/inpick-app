import { createHmac } from "node:crypto";

export function hashTossUserKey(userKey: string | number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`inpick:toss:${String(userKey)}`)
    .digest("hex");
}

export function tossUserEmail(userKey: string | number, secret: string): string {
  const hash = hashTossUserKey(userKey, secret);
  return `toss-${hash.slice(0, 48)}@auth.interiorpick.co.kr`;
}
