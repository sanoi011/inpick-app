/**
 * GET /api/estimate-pdf/check-access?estimateId=xxx|consumerProjectId=xxx
 *
 * PDF 다운로드 직전 권한 체크.
 * 가이드: 2026-05-14 pricing v2
 *
 * 응답:
 *  - { granted: true, reason: "pdf_unlimited" | "single_available", entitlementId }
 *  - { granted: false, reason: "payment_required", priceKrw: 9900, productCode: "estimate_pdf_single" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEstimatePdfAccess } from "@/lib/inpick/entitlements";
import { ESTIMATE_PDF_PRICE_KRW, ESTIMATE_PDF_PRODUCT_CODE } from "@/types/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const estimateId = req.nextUrl.searchParams.get("estimateId");
  const consumerProjectId = req.nextUrl.searchParams.get("consumerProjectId");

  const access = await checkEstimatePdfAccess({
    userId: user.id,
    estimateId,
    consumerProjectId,
  });

  if (access.granted) {
    return NextResponse.json({
      granted: true,
      reason: access.reason,
      entitlementId: access.entitlementId,
    });
  }

  return NextResponse.json({
    granted: false,
    reason: "payment_required",
    priceKrw: ESTIMATE_PDF_PRICE_KRW,
    productCode: ESTIMATE_PDF_PRODUCT_CODE,
    includesVat: true,
  });
}
