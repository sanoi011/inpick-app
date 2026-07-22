import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  findRoomProductPart,
  getRoomProductParts,
  type RoomProductKind,
  type RoomProductPartCode,
} from "@/lib/inpick/room-product-customization";
import {
  catalogRowToVerifiedProduct,
  type MaterialProductCatalogRow,
} from "@/lib/inpick/room-product-customization/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOM_KINDS = ["living", "kitchen", "bathroom", "bedroom", "entry", "other"] as const;

function isRoomKind(value: string): value is RoomProductKind {
  return (ROOM_KINDS as readonly string[]).includes(value);
}

function isPartForRoom(kind: RoomProductKind, value: string): value is RoomProductPartCode {
  return getRoomProductParts(kind).some((part) => part.partCode === value);
}

export async function GET(request: NextRequest) {
  const roomKindValue = request.nextUrl.searchParams.get("roomKind")?.trim() || "";
  const partCodeValue = request.nextUrl.searchParams.get("partCode")?.trim() || "";
  const queryText = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("ko") || "";

  if (!isRoomKind(roomKindValue) || !isPartForRoom(roomKindValue, partCodeValue)) {
    return NextResponse.json({ error: "INVALID_ROOM_PRODUCT_PART" }, { status: 400 });
  }
  const definition = findRoomProductPart(roomKindValue, partCodeValue);
  if (!definition) {
    return NextResponse.json({ error: "INVALID_ROOM_PRODUCT_PART" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("material_products")
    .select("id, product_name, brand, model_number, specification, contractor_price, retail_price, thumbnail_url, is_verified, updated_at")
    .in("category_code", [...definition.categoryCodes])
    .eq("is_verified", true)
    .not("model_number", "is", null)
    .not("updated_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error) {
    console.error("[room-product-catalog] query failed", error.message);
    return NextResponse.json({ error: "CATALOG_QUERY_FAILED" }, { status: 500 });
  }

  const products = ((data || []) as MaterialProductCatalogRow[])
    .map(catalogRowToVerifiedProduct)
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .filter((product) => {
      if (!queryText) return true;
      return [product.displayName, product.brand, product.sku, product.spec]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(queryText);
    })
    .slice(0, 30);

  return NextResponse.json(
    {
      roomKind: roomKindValue,
      partCode: partCodeValue,
      products,
      total: products.length,
      exactSkuOnly: true,
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
