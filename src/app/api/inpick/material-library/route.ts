/**
 * GET /api/inpick/material-library?category=floor
 *
 * 카테고리별 자재 카탈로그 반환. 가이드 §3-3 의 materials API.
 */
import { NextRequest, NextResponse } from "next/server";
import { materialsByCategory, MATERIAL_CATALOG } from "@/lib/inpick/material-catalog";
import { INTERIOR_CATEGORIES, type InteriorCategory } from "@/types/segmentation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_CODES: Partial<Record<InteriorCategory, string[]>> = {
  floor: [
    "ARCH_FLOOR", "ARCH_FLOOR_LAM", "ARCH_FLOOR_ENG", "ARCH_FLOOR_LVT",
    "ARCH_FLOOR_TILE", "ARCH_FLOOR_EPOXY", "ARCH_FLOOR_WOOD",
    "FLOORING", "FLOOR", "FLOOR_WOOD", "FLOOR_TILE", "FLOOR_VINYL", "FLOOR_STONE", "BATH_TILE",
  ],
  wall: [
    "ARCH_WALL", "ARCH_WALL_SILK", "ARCH_WALL_PAPER", "ARCH_WALL_3D",
    "ARCH_WALL_PAINT", "ARCH_WALL_PANEL", "ARCH_FILM", "ARCH_PAINT",
    "WALLPAPER", "PAINT", "WALL", "WALL_PAPER", "WALL_PAINT", "WALL_PANEL", "KITCHEN_TILE", "BATH_TILE",
  ],
  ceiling: ["ARCH_CEIL", "ARCH_CEIL_GYPSUM", "ARCH_CEIL_TBAR", "ARCH_CEIL_WOOD", "ARCH_CEIL_METAL", "CEILING", "CEILING_PAPER", "CEILING_PANEL"],
  window: ["ARCH_WIN", "ARCH_WIN_PVC", "ARCH_WIN_ALU", "ARCH_WIN_WOOD", "WINDOW", "WINDOW_FRAME", "WINDOW_GLASS"],
  door: ["ARCH_DOOR", "ARCH_DOOR_ROOM", "ARCH_DOOR_ENTRY", "ARCH_DOOR_SLIDE", "ARCH_DOOR_POCKET", "ARCH_DOOR_FOLD", "DOOR_ROOM", "ENTRY_DOOR", "DOOR", "DOOR_INTERIOR", "DOOR_ENTRANCE"],
  curtain: ["ARCH_CURTAIN", "ARCH_BLIND", "ARCH_FURN", "CURTAIN", "BLIND", "WINDOW_COVERING"],
};

const CATEGORY_PRODUCT_KEYWORDS: Partial<Record<InteriorCategory, string[]>> = {
  floor: [
    "강마루", "강화마루", "원목마루", "플로어링", "바닥재",
    "장판", "모노륨", "PVC시트", "데코타일", "LVT", "SPC",
    "카펫타일", "포세린", "세라믹", "폴리싱", "석재", "대리석",
  ],
  wall: ["벽지", "벽패널", "월패널", "페인트", "도료", "인테리어필름"],
  ceiling: ["천장", "흡음", "텍스", "루버", "석고보드"],
  window: ["창호", "창문", "시스템창", "복층유리"],
  door: ["도어", "방문", "현관문", "중문"],
  curtain: ["커튼", "블라인드", "쉐이드"],
};

function normalizeUnit(value: unknown): "sqm" | "m" | "each" {
  const unit = String(value || "").toLowerCase();
  if (unit.includes("m2") || unit.includes("㎡") || unit.includes("sqm")) return "sqm";
  if (unit === "m" || unit.includes("meter")) return "m";
  return "each";
}

async function getVendorMaterials(category: InteriorCategory) {
  const codes = CATEGORY_CODES[category] || [];
  if (codes.length === 0) return [];
  try {
    const admin = createAdminClient();
    let query = admin
      .from("material_products")
      .select(
        "id, brand, product_name, model_number, specification, description, retail_price, contractor_price, labor_price, unit, thumbnail_url, texture_url, installed_photo_urls, color_name, surface_finish, material_texture, is_verified, popularity_score",
      )
      .in("category_code", codes)
      .not("thumbnail_url", "is", null)
      .order("is_verified", { ascending: false, nullsFirst: false })
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(60);
    const keywords = CATEGORY_PRODUCT_KEYWORDS[category] || [];
    if (keywords.length > 0) {
      query = query.or(keywords.map((keyword) => `product_name.ilike.%${keyword}%`).join(","));
    }
    const { data, error } = await query;
    if (error) throw error;
    const fallback = materialsByCategory(category)[0];
    const relevantRows = (data || []).filter(
      (row) => category !== "curtain" || !/(커튼봉|커튼레일|브라켓)/.test(String(row.product_name || "")),
    );
    return relevantRows.map((row) => {
      const installed = Array.isArray(row.installed_photo_urls)
        ? row.installed_photo_urls.find((url): url is string => typeof url === "string" && url.length > 0)
        : undefined;
      const materialPrice = Number(row.contractor_price || row.retail_price || fallback?.material_price || 0);
      const laborPrice = Number(row.labor_price || fallback?.labor_price || 0);
      const referenceImage = row.texture_url || row.thumbnail_url || undefined;
      const rank =
        (referenceImage?.includes("supabase.co/storage") ? 600 : 0) +
        (/LX|동화|한샘|구정|KCC|영림|현대|이건/i.test(String(row.brand || "")) ? 450 : 0) +
        (Number(row.contractor_price || row.retail_price || 0) > 0 ? 140 : 0) +
        (row.model_number ? 40 : 0) +
        (row.is_verified ? 30 : 0) -
        (/이중바닥|OA\s*Floor|Technical Deck/i.test(String(row.product_name || "")) ? 500 : 0);
      return {
        sku: row.model_number || `PRODUCT-${row.id}`,
        name: row.product_name,
        brand: row.brand,
        category,
        unit: normalizeUnit(row.unit),
        material_price: materialPrice,
        labor_price: laborPrice,
        description:
          row.description ||
          `${row.brand} ${row.product_name}${row.specification ? `, ${row.specification}` : ""}`,
        color: row.color_name || undefined,
        texture: row.material_texture || undefined,
        finish: row.surface_finish || undefined,
        thumbnail_url: row.thumbnail_url || undefined,
        source_product_id: row.id,
        model_number: row.model_number || undefined,
        specification: row.specification || undefined,
        reference_image_url: referenceImage,
        installed_photo_url: installed,
        is_verified: Boolean(row.is_verified),
        price_per_unit: materialPrice + laborPrice,
        _rank: rank,
      };
    })
      .sort((a, b) => b._rank - a._rank)
      .slice(0, 30)
      .map(({ _rank, ...material }) => material);
  } catch (error) {
    console.warn(
      "[material-library] vendor materials unavailable; using standard catalog:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

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
  const category = cat as InteriorCategory;
  const vendorMaterials = await getVendorMaterials(category);
  const materials = vendorMaterials.length > 0 ? vendorMaterials : materialsByCategory(category);
  return NextResponse.json({
    category: cat,
    label_ko: INTERIOR_CATEGORIES[category],
    materials,
    total: materials.length,
    source: vendorMaterials.length > 0 ? "vendor_products" : "standard_catalog",
  });
}
