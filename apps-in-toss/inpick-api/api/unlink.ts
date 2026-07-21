import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type User } from "@supabase/supabase-js";
import { verifyBasicAuthorization } from "../lib/basic-auth.js";
import { json } from "../lib/http.js";
import { tossUserEmail } from "../lib/toss-user.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const callbackSecret = process.env.APPS_IN_TOSS_CALLBACK_BASIC_AUTH || "";
  if (!verifyBasicAuthorization(request.headers.authorization, callbackSecret)) {
    response.setHeader("WWW-Authenticate", 'Basic realm="inpick-apps-in-toss"');
    return json(response, 401, { error: "UNAUTHORIZED" });
  }

  const userKey = request.body?.userKey;
  const referrer = String(request.body?.referrer || "");
  if ((typeof userKey !== "string" && typeof userKey !== "number") || !referrer) {
    return json(response, 400, { error: "INVALID_UNLINK_REQUEST" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const hashSecret = process.env.APPS_IN_TOSS_USER_HASH_SECRET || serviceKey;
  if (!supabaseUrl || !serviceKey || !hashSecret) {
    return json(response, 503, { error: "SERVER_NOT_CONFIGURED" });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = tossUserEmail(userKey, hashSecret);
    let user: User | null = null;
    let userListExhausted = false;
    for (let page = 1; page <= 10; page += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
      if (result.error) throw result.error;
      user =
        result.data.users.find(
          (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
        ) || null;
      if (user) break;
      if (result.data.users.length < 1_000) {
        userListExhausted = true;
        break;
      }
    }
    if (!user && !userListExhausted) {
      throw new Error("TOSS_USER_LOOKUP_LIMIT_EXCEEDED");
    }
    if (user) {
      const deleted = await admin.auth.admin.deleteUser(user.id);
      if (deleted.error) throw deleted.error;
    }
    return json(response, 200, { ok: true });
  } catch (error) {
    console.error("[inpick-toss-api/unlink]", error);
    return json(response, 500, { error: "UNLINK_FAILED" });
  }
}
