/**
 * POST /api/estimate-pdf/consume { entitlementId }
 *
 * 단발성 entitlement(estimate_pdf_single) 사용 처리 — 다운로드 직후 호출.
 * 무제한(pdf_unlimited)은 consume 호출해도 NOOP.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeEntitlement } from "@/lib/inpick/entitlements";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { entitlementId?: string };
  if (!body.entitlementId) {
    return NextResponse.json({ error: "entitlementId required" }, { status: 400 });
  }

  const result = await consumeEntitlement(body.entitlementId);
  // 발급권 소비 = PDF 실제 다운로드 완료 계측 (fire-and-forget)
  if (result.consumed) {
    trackServerEventAsync({
      eventName: AnalyticsEvents.PdfIssued,
      actorType: "consumer",
      userId: user.id,
      source: "api",
      props: { source: "entitlement", entitlementId: body.entitlementId },
    });
  }
  return NextResponse.json(result);
}
