/**
 * POST /api/mobile/google-play/rtdn
 *
 * Google Play Real-time Developer Notifications (RTDN) 수신.
 *
 * Google은 Cloud Pub/Sub로 보낸다:
 *   { message: { data: base64(JSON), messageId, publishTime }, subscription }
 *
 * 가이드: §12-4, https://developer.android.com/google/play/billing/rtdn-reference
 *
 * NOTE: Pub/Sub 검증은 별도 — MVP는 payload 기록만.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message = (body as { message?: { data?: string; messageId?: string } }).message;
  if (!message?.data) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }

  let payload: {
    version?: string;
    packageName?: string;
    eventTimeMillis?: string;
    oneTimeProductNotification?: {
      version: string;
      notificationType: number;
      purchaseToken: string;
      sku: string;
    };
    subscriptionNotification?: {
      version: string;
      notificationType: number;
      purchaseToken: string;
      subscriptionId: string;
    };
    testNotification?: { version: string };
  } = {};
  try {
    payload = JSON.parse(Buffer.from(message.data, "base64").toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventType =
    payload.oneTimeProductNotification?.notificationType?.toString() ??
    payload.subscriptionNotification?.notificationType?.toString() ??
    (payload.testNotification ? "TEST" : "UNKNOWN");
  const eventKey = message.messageId ?? crypto.randomUUID();

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const { data: existing } = await admin
    .from("payment_provider_events")
    .select("id")
    .eq("provider", "google_play")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await (admin.from("payment_provider_events") as ReturnType<typeof admin.from>).insert({
    provider: "google_play",
    event_type: eventType,
    event_key: eventKey,
    signature_verified: false,
    processed: false,
    raw_payload: payload,
  } as never);

  return NextResponse.json({ ok: true });
}
