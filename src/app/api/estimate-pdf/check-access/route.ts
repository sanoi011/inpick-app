/**
 * GET /api/estimate-pdf/check-access?estimateId=&consumerProjectId=&estimateVersion=
 *
 * PDF 다운로드 직전 권한 체크.
 * 가이드: pricing v2 → pricing-saas-flow §3-3 발급권 모델
 *
 * 응답 (granted):
 *  - reason: "pdf_unlimited" — 관리자/구독 무제한
 *  - reason: "reissue_of_same_version" — 같은 estimate_version 재다운로드 (assetUrl 포함)
 *  - reason: "single_available" — 미사용 단발권 보유, 새 발급 가능
 *
 * 응답 (denied):
 *  - reason: "payment_required" + priceKrw, productCode, includesVat
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
  const estimateVersion = req.nextUrl.searchParams.get("estimateVersion");

  const access = await checkEstimatePdfAccess({
    userId: user.id,
    estimateId,
    consumerProjectId,
    estimateVersion,
  });

  if (access.granted) {
    return NextResponse.json({
      granted: true,
      reason: access.reason,
      entitlementId: access.entitlementId,
      assetUrl: access.assetUrl ?? null,
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
