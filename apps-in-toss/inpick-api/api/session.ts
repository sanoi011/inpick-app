import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Agent, fetch as undiciFetch } from "undici";
import { applyCors, json } from "../lib/http.js";
import { hashTossUserKey, tossUserEmail } from "../lib/toss-user.js";

const TOSS_API_ORIGIN = "https://apps-in-toss-api.toss.im";

type TossResult<T> =
  | { resultType: "SUCCESS"; success: T }
  | { resultType: "FAIL"; error: { errorCode?: string; reason?: string } };

function pem(name: string): string {
  return (process.env[name] || "").replace(/\\n/g, "\n").trim();
}

async function tossRequest<T>(
  dispatcher: Agent,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; accessToken?: string },
): Promise<T> {
  const result = await undiciFetch(`${TOSS_API_ORIGIN}${path}`, {
    method: init.method,
    dispatcher,
    headers: {
      "Content-Type": "application/json",
      ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const payload = (await result.json().catch(() => null)) as TossResult<T> | null;
  if (!result.ok || !payload || payload.resultType !== "SUCCESS") {
    throw new Error("TOSS_API_FAILED");
  }
  return payload.success;
}

async function createTokenHash(userKey: string | number): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const hashSecret = process.env.APPS_IN_TOSS_USER_HASH_SECRET || serviceKey;
  if (!supabaseUrl || !serviceKey || !hashSecret) throw new Error("SERVER_NOT_CONFIGURED");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userKeyHash = hashTossUserKey(userKey, hashSecret);
  const email = tossUserEmail(userKey, hashSecret);
  const metadata = {
    provider: "toss",
    toss_user_key_hash: userKeyHash,
    account_type: "consumer",
  };

  let link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: metadata },
  });
  if (link.error || !link.data?.properties?.hashed_token) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { provider: "toss", providers: ["toss"] },
    });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      throw created.error;
    }
    link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: metadata },
    });
  }
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) throw link.error || new Error("TOKEN_NOT_CREATED");
  return tokenHash;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return json(response, 405, { error: "METHOD_NOT_ALLOWED" });

  const authorizationCode = String(request.body?.authorizationCode || "").trim();
  const referrer = String(request.body?.referrer || "");
  if (!authorizationCode || !["DEFAULT", "SANDBOX"].includes(referrer)) {
    return json(response, 400, { error: "INVALID_LOGIN_REQUEST" });
  }

  const cert = pem("APPS_IN_TOSS_MTLS_CERT");
  const key = pem("APPS_IN_TOSS_MTLS_KEY");
  const ca = pem("APPS_IN_TOSS_MTLS_CA");
  if (!cert || !key) return json(response, 503, { error: "MTLS_NOT_CONFIGURED" });

  const dispatcher = new Agent({
    connect: { cert, key, ...(ca ? { ca } : {}), rejectUnauthorized: true },
  });
  try {
    const token = await tossRequest<{ accessToken: string }>(
      dispatcher,
      "/api-partner/v1/apps-in-toss/user/oauth2/generate-token",
      { method: "POST", body: { authorizationCode, referrer } },
    );
    const user = await tossRequest<{ userKey: string | number }>(
      dispatcher,
      "/api-partner/v1/apps-in-toss/user/oauth2/login-me",
      { method: "GET", accessToken: token.accessToken },
    );
    if (user.userKey == null) throw new Error("USER_KEY_MISSING");
    return json(response, 200, { tokenHash: await createTokenHash(user.userKey) });
  } catch (error) {
    console.error("[inpick-toss-api/session]", error);
    return json(response, 401, { error: "TOSS_LOGIN_FAILED" });
  } finally {
    await dispatcher.close().catch(() => undefined);
  }
}
