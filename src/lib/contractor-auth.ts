import { createHmac } from "crypto";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.CONTRACTOR_JWT_SECRET || process.env.ADMIN_PASSWORD || "inpick-contractor-secret-2026";
const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

// ─── Password ───

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Signed Token (HMAC-SHA256) ───

interface TokenPayload {
  sub: string; // contractor ID
  email: string;
  iat: number;
  exp: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
}

export function createToken(contractorId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: contractorId,
    email,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };
  const payloadStr = base64url(JSON.stringify(payload));
  const signature = sign(payloadStr);
  return `${payloadStr}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;
    const expectedSig = sign(payloadStr);

    if (signature !== expectedSig) return null;

    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString()
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Request Auth Helper ───

export function getContractorIdFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  // Bearer token
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  // 새 HMAC 토큰
  const payload = verifyToken(token);
  if (payload) return payload.sub;

  // 레거시 base64 토큰 (마이그레이션 기간 호환)
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const parsed = JSON.parse(decoded);
    if (parsed.id) return parsed.id;
  } catch { /* not legacy */ }

  return null;
}
