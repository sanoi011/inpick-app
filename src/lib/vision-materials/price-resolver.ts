/**
 * Price resolver — material_price_lookup + material_price_observations 통합.
 *
 * 가이드: §1-3 OCR + Cost DB 통합
 *
 * 우선순위:
 *   1. material_price_lookup (61 버킷, p10/median/p90 + confidence)
 *   2. material_products.contractor_price / retail_price
 *   3. material_price_observations 평균 (최근 30일)
 *   4. category 기본값 (KPA — estimate.ts의 KPA_PRICE)
 */

import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export interface ResolvedPrice {
  unitPriceWon: number;
  unit: string;
  source:
    | "material_price_lookup"
    | "contractor_price"
    | "retail_price"
    | "price_observations_avg"
    | "category_default"
    | "missing";
  confidence?: string; // "A"~"E" (lookup) 또는 "verified"/"estimated"
  /** 가격 기준일 (있으면) */
  asOf?: string;
}

/**
 * 자재 단가 해결 — 우선순위에 따라 첫 번째 valid 결과 반환.
 */
export async function resolveMaterialPrice(input: {
  materialProductId: string;
  productClassNo?: string; // material_price_lookup의 prdct_clsfc_no
  /** material_products row의 fallback 단가 (이미 retrieve에서 가져옴) */
  contractorPrice?: number;
  retailPrice?: number;
  /** unit (m², EA, set 등) — 없으면 제품 row에서 추정 */
  unit?: string;
}): Promise<ResolvedPrice> {
  const admin = getAdmin();
  if (!admin) {
    return missing(input);
  }

  // 1. material_price_lookup
  if (input.productClassNo) {
    const { data, error } = await admin
      .from("material_price_lookup")
      .select("median, confidence, unit, as_of")
      .eq("prdct_clsfc_no", input.productClassNo)
      .maybeSingle();
    if (!error && data && (data as { median?: number }).median) {
      return {
        unitPriceWon: Number((data as { median: number }).median),
        unit: ((data as { unit?: string }).unit) || input.unit || "EA",
        source: "material_price_lookup",
        confidence: ((data as { confidence?: string }).confidence) || undefined,
        asOf: ((data as { as_of?: string }).as_of) || undefined,
      };
    }
  }

  // 2. contractor_price
  if (input.contractorPrice && input.contractorPrice > 0) {
    return {
      unitPriceWon: input.contractorPrice,
      unit: input.unit || "EA",
      source: "contractor_price",
    };
  }

  // 3. retail_price
  if (input.retailPrice && input.retailPrice > 0) {
    return {
      unitPriceWon: input.retailPrice,
      unit: input.unit || "EA",
      source: "retail_price",
    };
  }

  // 4. price_observations 최근 30일 평균
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("material_price_observations")
      .select("price")
      .eq("material_product_id", input.materialProductId)
      .gte("observed_at", thirtyDaysAgo)
      .limit(20);
    if (!error && data && data.length > 0) {
      const prices = (data as Array<{ price: number }>).map((r) => r.price).filter((p) => p && p > 0);
      if (prices.length > 0) {
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        return {
          unitPriceWon: Math.round(avg),
          unit: input.unit || "EA",
          source: "price_observations_avg",
        };
      }
    }
  } catch (e) {
    // 무시
    console.warn(
      `[vision-materials/price] observations error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return missing(input);
}

function missing(input: { unit?: string }): ResolvedPrice {
  return {
    unitPriceWon: 0,
    unit: input.unit || "EA",
    source: "missing",
  };
}
