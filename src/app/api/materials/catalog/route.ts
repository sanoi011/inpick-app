/**
 * GET /api/materials/catalog
 * 전체 건축 자재·기구 분류 체계 반환 (그룹/카테고리 + 실구매 검색어 + 적산 부위).
 * partial-install / 모바일 / 견적 등에서 공용 사용.
 */
import { NextResponse } from "next/server";
import { MATERIAL_GROUPS, ALL_CATEGORIES } from "@/lib/materials/catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    groups: MATERIAL_GROUPS,
    totalGroups: MATERIAL_GROUPS.length,
    totalCategories: ALL_CATEGORIES.length,
  });
}
