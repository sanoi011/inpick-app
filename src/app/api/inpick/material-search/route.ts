/**
 * GET /api/inpick/material-search
 *
 * material_products 테이블에서 surfaceType 기반 자재 후보 검색.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §9-5
 *
 * 쿼리 파라미터:
 *  - surfaceType: SurfaceType
 *  - q?: string (브랜드/제품명 검색)
 *  - grade?: "economy" | "standard" | "premium"
 *  - limit?: number (default 24)
 *
 * 응답: { products: Array<MaterialProduct> }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SurfaceType } from "@/lib/inpick/editable-render/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// surfaceType → category_code 매핑 (material_products.category_code 기준)
const SURFACE_TO_CATEGORY: Record<SurfaceType, string[]> = {
  floor: ["FLOOR_WOOD", "FLOOR_TILE", "FLOOR_VINYL", "FLOOR_STONE", "FLOOR"],
  wall: ["WALL_PAPER", "WALL_PAINT", "WALL_PANEL", "WALL"],
  ceiling: ["CEILING_PAPER", "CEILING_PANEL", "CEILING"],
  window: ["WINDOW_FRAME", "WINDOW_GLASS", "WINDOW"],
  door: ["DOOR_INTERIOR", "DOOR_ENTRANCE", "DOOR"],
  baseboard: ["BASEBOARD", "MOLDING"],
  molding: ["MOLDING", "BASEBOARD"],
  counter: ["COUNTER", "STONE_COUNTER"],
  cabinet: ["CABINET", "SINK_CABINET", "BUILT_IN"],
  tile_wall: ["TILE_WALL", "WALL_TILE", "FLOOR_TILE"],
  fixture: ["TOILET", "SINK", "BATHTUB", "FAUCET", "FIXTURE"],
  signage: ["SIGNAGE", "ACRYL_SIGN", "LED_SIGN"],
  storefront_glass: ["WINDOW_GLASS", "GLASS", "FACADE_GLASS"],
  facade_wall: ["EXTERIOR_PAINT", "EXTERIOR_PANEL", "FACADE"],
  furniture: ["FURNITURE", "BUILT_IN", "TABLE", "CHAIR"],
  unknown: [],
};

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const surfaceType = (sp.get("surfaceType") || "unknown") as SurfaceType;
  const q = (sp.get("q") || "").trim().replace(/[.,()\\%]/g, "");
  const grade = sp.get("grade");
  const limit = Math.max(1, Math.min(50, parseInt(sp.get("limit") || "24", 10)));

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "service_unavailable", hint: "Supabase service role 미설정" },
      { status: 503 },
    );
  }

  const categories = SURFACE_TO_CATEGORY[surfaceType] || [];
  let query = admin
    .from("material_products")
    .select(
      "id, brand, product_name, model_number, specification, retail_price, contractor_price, unit, price_grade, thumbnail_url, popularity_score, is_verified, category_code",
    )
    .not("brand", "is", null)
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (categories.length > 0) {
    query = query.in("category_code", categories);
  }
  if (grade) {
    query = query.eq("price_grade", grade);
  }
  if (q) {
    // brand, product_name, model_number 중 하나라도 매칭
    query = query.or(
      `brand.ilike.%${q}%,product_name.ilike.%${q}%,model_number.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[material-search] error:", error.message);
    return NextResponse.json(
      { error: "search_failed", hint: error.message },
      { status: 500 },
    );
  }

  const products = (data || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    brand: p.brand,
    productName: p.product_name,
    modelNumber: p.model_number,
    specification: p.specification,
    retailPrice: p.retail_price,
    contractorPrice: p.contractor_price,
    unit: p.unit,
    priceGrade: p.price_grade,
    thumbnailUrl: p.thumbnail_url,
    isVerified: p.is_verified,
    categoryCode: p.category_code,
  }));

  return NextResponse.json({
    surfaceType,
    grade,
    products,
    count: products.length,
  });
}
