import { Readable } from "node:stream";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { request as upstreamRequest } from "undici";
import { applyCors, json } from "../lib/http.js";
import { makeSupabaseSessionCookies } from "../lib/supabase-cookie.js";

const BLOCKED_BIDDING_APIS = [
  /^\/api\/bids(?:\/|$)/,
  /^\/api\/rfq(?:\/|$)/,
  /^\/api\/contractor\/rfqs(?:\/|$)/,
  /^\/api\/contractor\/bids(?:\/|$)/,
];

export function normalizeApiTarget(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw.join("/") : raw || "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (
    !decoded ||
    decoded.includes("\\") ||
    decoded.includes("\0") ||
    decoded.split("/").some((part) => part === "." || part === "..") ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded)
  ) {
    return null;
  }
  return `/api/${decoded}`;
}

function getTarget(request: VercelRequest): string | null {
  const raw = request.query.target;
  return normalizeApiTarget(raw);
}

export function isBlockedBiddingApi(pathname: string): boolean {
  return BLOCKED_BIDDING_APIS.some((pattern) => pattern.test(pathname));
}

function requestBody(request: VercelRequest): string | Buffer | undefined {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  if (request.body == null) return undefined;
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return request.body;
  return JSON.stringify(request.body);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();

  const pathname = getTarget(request);
  if (!pathname) return json(response, 400, { error: "INVALID_API_TARGET" });
  if (isBlockedBiddingApi(pathname)) {
    return json(response, 404, { error: "FEATURE_NOT_AVAILABLE" });
  }

  const authorization = request.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return json(response, 401, { error: "UNAUTHENTICATED" });

  const upstreamOrigin = (
    process.env.INPICK_UPSTREAM_ORIGIN || "https://www.interiorpick.co.kr"
  ).replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl) return json(response, 503, { error: "SERVER_NOT_CONFIGURED" });

  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(request.query)) {
    if (key === "target") continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value != null) query.append(key, value);
    }
  }
  const url = `${upstreamOrigin}${pathname}${query.size ? `?${query}` : ""}`;
  const headers: Record<string, string> = {
    Cookie: makeSupabaseSessionCookies(supabaseUrl, accessToken),
    "X-InPick-Client": "apps-in-toss",
  };
  const contentType = request.headers["content-type"];
  if (typeof contentType === "string") headers["Content-Type"] = contentType;
  const accept = request.headers.accept;
  if (typeof accept === "string") headers.Accept = accept;

  try {
    const upstream = await upstreamRequest(url, {
      method: (request.method || "GET") as "GET",
      headers,
      body: requestBody(request),
      headersTimeout: 300_000,
      bodyTimeout: 300_000,
    });
    response.status(upstream.statusCode);
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (
        value != null &&
        !["set-cookie", "transfer-encoding", "connection", "access-control-allow-origin"].includes(
          key.toLowerCase(),
        )
      ) {
        response.setHeader(key, value);
      }
    }
    applyCors(response);
    Readable.fromWeb(upstream.body as never).pipe(response);
  } catch (error) {
    console.error("[inpick-toss-api/proxy]", error);
    return json(response, 502, { error: "UPSTREAM_UNAVAILABLE" });
  }
}
