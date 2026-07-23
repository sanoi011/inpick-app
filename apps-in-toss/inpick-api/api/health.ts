import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json } from "../lib/http.js";
import { getRuntimeHealth } from "../lib/runtime-health.js";

export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET") {
    return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const health = getRuntimeHealth();
  return json(response, health.ready ? 200 : 503, health);
}
