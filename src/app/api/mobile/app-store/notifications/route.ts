/**
 * POST /api/mobile/app-store/notifications
 *
 * App Store Server Notifications V2 수신 endpoint.
 *
 * Apple은 다음 이벤트를 보낸다:
 *   - SUBSCRIBED / DID_RENEW / DID_FAIL_TO_RENEW / EXPIRED
 *   - REFUND / REVOKE / CONSUMPTION_REQUEST
 *   - PRICE_INCREASE 등
 *
 * 가이드: §12-3, https://developer.apple.com/documentation/appstoreservernotifications
 *
 * NOTE: signature 검증은 X.509 cert chain 검증 필요 (apple-app-store-server-library 추천).
 *       MVP 단계에서는 payload 기록만 + processed=false 표시.
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
  const signedPayload = (body as { signedPayload?: string }).signedPayload;

  if (!signedPayload) {
    return NextResponse.json({ error: "missing_signedPayload" }, { status: 400 });
  }

  // JWS 디코드 (서명 검증은 X.509 chain 필요 — MVP는 payload만)
  let payload: {
    notificationType?: string;
    notificationUUID?: string;
    data?: { signedTransactionInfo?: string; environment?: string };
  } = {};
  try {
    const parts = signedPayload.split(".");
    if (parts.length === 3) {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    }
  } catch {
    return NextResponse.json({ error: "invalid_jws" }, { status: 400 });
  }

  const eventType = payload.notificationType ?? "UNKNOWN";
  const eventKey = payload.notificationUUID ?? crypto.randomUUID();

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // 중복 방지
  const { data: existing } = await admin
    .from("payment_provider_events")
    .select("id")
    .eq("provider", "app_store")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await (admin.from("payment_provider_events") as ReturnType<typeof admin.from>).insert({
    provider: "app_store",
    event_type: eventType,
    event_key: eventKey,
    signature_verified: false, // MVP: 미검증
    processed: false,
    raw_payload: payload,
  } as never);

  // 환불/취소 처리는 별도 worker가 처리 (MVP: 큐에만 적재)
  return NextResponse.json({ ok: true });
}
