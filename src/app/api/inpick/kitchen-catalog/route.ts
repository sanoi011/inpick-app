import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { KITCHEN_PART_CODES, type KitchenPartCode } from "@/lib/inpick/kitchen-assembly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_BY_PART: Record<KitchenPartCode, string[]> = {
  upper_cabinet: ["FUR-KIT-UPPER-CAB"],
  lower_cabinet: ["FUR-KIT-LOWER-CAB"],
  countertop: ["FUR-KIT-COUNTERTOP"],
  backsplash: ["FUR-KIT-BACKSPLASH", "KITCHEN_TILE"],
  sink_bowl: ["FUR-KIT-SINKBOWL"],
  faucet: ["MEC-FAU-KITCHEN"],
  fridge_cabinet: ["FUR-KIT-TALL-CAB"],
  kimchi_fridge_cabinet: ["FUR-KIT-TALL-CAB"],
  hood: ["FUR-KIT-HOOD"],
  cooktop: ["FUR-KIT-COOKTOP"],
};

function isKitchenPartCode(value: string): value is KitchenPartCode {
  return (KITCHEN_PART_CODES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const partCode = request.nextUrl.searchParams.get("partCode")?.trim() || "";
  const queryText = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("ko") || "";
  if (!isKitchenPartCode(partCode)) {
    return NextResponse.json({ error: "INVALID_KITCHEN_PART" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("material_products")
    .select("id, product_name, brand, model_number, specification, contractor_price, retail_price, thumbnail_url, is_verified, updated_at")
    .in("category_code", CATEGORY_BY_PART[partCode])
    .order("is_verified", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) {
    console.error("[kitchen-catalog] query failed", error.message);
    return NextResponse.json({ error: "CATALOG_QUERY_FAILED" }, { status: 500 });
  }

  const products = (data || [])
    .filter((row) => {
      if (!queryText) return true;
      return [row.product_name, row.brand, row.model_number, row.specification]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(queryText);
    })
    .slice(0, 30)
    .map((row) => ({
      materialProductId: row.id,
      displayName: row.product_name,
      brand: row.brand || undefined,
      sku: row.model_number || undefined,
      spec: row.specification || undefined,
      unitPrice: Number(row.contractor_price || row.retail_price || 0) || undefined,
      thumbnailUrl: row.thumbnail_url || undefined,
      provenance: {
        source: "catalog" as const,
        reference: `material_products:${row.id}`,
        verifiedAt: row.is_verified ? row.updated_at || undefined : undefined,
      },
    }));

  return NextResponse.json(
    { partCode, products, total: products.length },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
