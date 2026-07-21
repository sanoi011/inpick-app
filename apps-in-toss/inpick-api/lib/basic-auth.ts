import { timingSafeEqual } from "node:crypto";

export function verifyBasicAuthorization(
  authorization: string | undefined,
  expectedValue: string,
): boolean {
  if (!authorization?.startsWith("Basic ") || !expectedValue) return false;
  let supplied: string;
  try {
    supplied = Buffer.from(authorization.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expectedValue, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
