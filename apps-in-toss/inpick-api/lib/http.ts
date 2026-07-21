import type { VercelResponse } from "@vercel/node";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-InPick-Client",
  "Access-Control-Max-Age": "86400",
};

export function applyCors(response: VercelResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(key, value);
  }
}

export function json(
  response: VercelResponse,
  status: number,
  payload: Record<string, unknown>,
) {
  applyCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");
  return response.status(status).json(payload);
}
