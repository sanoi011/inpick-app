const MAX_COOKIE_CHUNK = 3_180;

function decodeJwtPayload(token: string): { exp?: number } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
  } catch {
    return {};
  }
}

export function makeSupabaseSessionCookies(
  supabaseUrl: string,
  accessToken: string,
): string {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  if (!projectRef) throw new Error("INVALID_SUPABASE_URL");
  const expiresAt = decodeJwtPayload(accessToken).exp || Math.floor(Date.now() / 1_000) + 3_600;
  const session = JSON.stringify({
    access_token: accessToken,
    refresh_token: "",
    token_type: "bearer",
    expires_at: expiresAt,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1_000)),
  });
  const encoded = `base64-${Buffer.from(session, "utf8").toString("base64url")}`;
  const baseName = `sb-${projectRef}-auth-token`;
  if (encoded.length <= MAX_COOKIE_CHUNK) return `${baseName}=${encoded}`;

  const chunks: string[] = [];
  for (let index = 0; index < encoded.length; index += MAX_COOKIE_CHUNK) {
    chunks.push(
      `${baseName}.${chunks.length}=${encoded.slice(index, index + MAX_COOKIE_CHUNK)}`,
    );
  }
  return chunks.join("; ");
}
