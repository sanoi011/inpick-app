/**
 * POST /api/admin/reconciliation/scan
 *
 * 분쟁 case 자동 감지 스캔 실행.
 * 가이드: pricing-saas-flow §9-3
 */
import { NextRequest, NextResponse } from "next/server";
import { runReconciliationScan } from "@/lib/inpick/payments/reconciliation-scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAdminAuthorized } from "@/lib/admin-auth";
function checkAdmin(req: NextRequest): boolean {
  return isAdminAuthorized(req);
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runReconciliationScan();
  return NextResponse.json(summary);
}
