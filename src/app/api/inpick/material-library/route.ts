/**
 * GET /api/inpick/material-library?category=floor
 *
 * 카테고리별 자재 카탈로그 반환. 가이드 §3-3 의 materials API.
 */
import { NextRequest, NextResponse } from "next/server";
import { materialsByCategory, MATERIAL_CATALOG } from "@/lib/inpick/material-catalog";
import { INTERIOR_CATEGORIES, type InteriorCategory } from "@/types/segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cat = (req.nextUrl.searchParams.get("category") || "").trim();
  if (!cat) {
    return NextResponse.json({ materials: MATERIAL_CATALOG, total: MATERIAL_CATALOG.length });
  }
  if (!(cat in INTERIOR_CATEGORIES)) {
    return NextResponse.json(
      { error: `유효하지 않은 카테고리: ${cat}`, valid: Object.keys(INTERIOR_CATEGORIES) },
      { status: 400 },
    );
  }
  const materials = materialsByCategory(cat as InteriorCategory);
  return NextResponse.json({ category: cat, label_ko: INTERIOR_CATEGORIES[cat as InteriorCategory], materials, total: materials.length });
}
