import type { RoomCatalogProduct } from "./index";

export interface MaterialProductCatalogRow {
  id: string;
  product_name: string | null;
  brand: string | null;
  model_number: string | null;
  specification: string | null;
  contractor_price: number | string | null;
  retail_price: number | string | null;
  thumbnail_url: string | null;
  is_verified: boolean | null;
  updated_at: string | null;
}

/**
 * Exact-SKU picker boundary. A catalog row is user-visible only when the
 * product identity and verification timestamp are both authoritative.
 */
export function catalogRowToVerifiedProduct(
  row: MaterialProductCatalogRow,
): RoomCatalogProduct | null {
  const sku = row.model_number?.trim();
  const verifiedAt = row.updated_at?.trim();
  const displayName = row.product_name?.trim();
  if (!row.is_verified || !sku || !verifiedAt || !displayName) return null;

  const parsedPrice = Number(row.contractor_price || row.retail_price || 0);
  return {
    materialProductId: row.id,
    displayName,
    brand: row.brand?.trim() || undefined,
    sku,
    spec: row.specification?.trim() || undefined,
    unitPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
    thumbnailUrl: row.thumbnail_url?.trim() || undefined,
    provenance: {
      source: "catalog",
      reference: `material_products:${row.id}`,
      verifiedAt,
    },
  };
}
