/**
 * GET /api/admin/vision-materials/stats
 *
 * 가이드: Phase 9 — admin diagnostics
 *
 * 표시 지표:
 *   - material_products / material_product_images count
 *   - embedding coverage
 *   - observation count + matched/fallback rate
 *   - decision 분포 (auto/user/fallback)
 *   - fallback_reasons top 10
 */

import { NextRequest, NextResponse } from "next/server";
import { getVisionMaterialsStats } from "@/lib/vision-materials/repository";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const stats = await getVisionMaterialsStats();
  return NextResponse.json({
    ...stats,
    embeddingCoverage:
      stats.productImages.total > 0
        ? Number(
            ((stats.productImages.withEmbedding / stats.productImages.total) * 100).toFixed(1),
          )
        : 0,
    matchSuccessRate:
      stats.observations.total > 0
        ? Number(
            ((stats.observations.matched / stats.observations.total) * 100).toFixed(1),
          )
        : 0,
    timestamp: new Date().toISOString(),
  });
}
