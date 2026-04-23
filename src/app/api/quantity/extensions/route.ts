import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 견적 엔진 확장 데이터 (부자재 계수 + 단가 lookup) 일괄 로드용.
// 클라이언트에서 견적 생성 시 prefetch → 캐시해서 동기 사용.
// GET /api/quantity/extensions
export async function GET() {
  const supabase = createClient();

  const [coefRes, priceRes] = await Promise.all([
    supabase
      .from("aux_material_coefficients")
      .select("trade_code, main_material, main_material_cat, main_material_unit, sub_material, sub_material_cat, sub_material_unit, coefficient, loss_pct, formula_text")
      .not("coefficient", "is", null),
    supabase
      .from("material_price_lookup")
      .select("prdct_clsfc_no, product_name, unit, category_code, confidence, n_samples, median_price, p10_price, p90_price"),
  ]);

  if (coefRes.error || priceRes.error) {
    return NextResponse.json(
      { error: "확장 데이터 로드 실패", detail: coefRes.error?.message || priceRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    auxCoefficients: coefRes.data || [],
    priceLookup:     priceRes.data || [],
    counts: {
      coefficients: (coefRes.data || []).length,
      priceLookup:  (priceRes.data || []).length,
    },
  });
}
