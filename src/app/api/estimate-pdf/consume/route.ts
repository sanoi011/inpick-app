/**
 * POST /api/estimate-pdf/consume { entitlementId }
 *
 * 단발성 entitlement(estimate_pdf_single) 사용 처리 — 다운로드 직후 호출.
 * 무제한(pdf_unlimited)은 consume 호출해도 NOOP.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeEntitlement } from "@/lib/inpick/entitlements";

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
  return NextResponse.json(result);
}
