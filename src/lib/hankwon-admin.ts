import "server-only";

type HankwonAdminPayload = Record<string, unknown> & { action: string };

export async function requestHankwonAdmin(payload: HankwonAdminPayload) {
  const secret = process.env.HANKWON_ADMIN_API_SECRET?.trim() || "";
  const baseUrl = process.env.HANKWON_INTERNAL_ADMIN_URL?.trim()
    || process.env.NEXT_PUBLIC_WRITING_APP_URL?.trim()
    || "https://inpick-hankwon.vercel.app";
  if (secret.length < 32) throw new Error("HANKWON_ADMIN_NOT_CONFIGURED");

  const url = new URL("/api/internal/admin/plan-grants", baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("HANKWON_ADMIN_INVALID_URL");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hankwon-admin-secret": secret,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({ error: "INVALID_HANKWON_RESPONSE" }));
  if (!response.ok) {
    const code = typeof result?.error === "string" ? result.error : "HANKWON_ADMIN_REQUEST_FAILED";
    throw new Error(code);
  }
  return result as Record<string, unknown>;
}
