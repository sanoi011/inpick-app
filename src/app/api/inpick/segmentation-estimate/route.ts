/**
 * POST /api/inpick/segmentation-estimate
 *
 * SegmentationData (selected materials 포함) → 한국 인테리어 표준 견적.
 *
 * 견적 구조 (한국 표준):
 *   1. 자재비 — KPA 단가 × 수량
 *   2. 노무비 — 표준품셈 × 수량
 *   = 직접비 (자재 + 노무)
 *   3. 가설비 — 정액 합 (엘리베이터 보양 / 출입구 보양 / 가설 자재 / 폐기물 등)
 *   4. 경비 — 직접비 × 8% (운반/잡재료)
 *   5. 현장관리비 — 직접비 × 5%
 *   6. 안전관리비 — 직접비 × 1.5%
 *   7. 간접비(이윤) — (직접비 + 가설비 + 경비 + 관리비 + 안전비) × 12%
 *   = 합계 (부가세 별도)
 *   8. 부가세 10% (총액의)
 *
 * 인픽 수수료는 계약 시점 별도.
 *
 * 입력:
 *   {
 *     segmentation: SegmentationData,
 *     setupCosts?: SetupCostItem[],     // 사용자가 가설비 항목 수정/추가
 *     expensesRatio?: number,
 *     managementRatio?: number,
 *     safetyRatio?: number,
 *     indirectRatio?: number,
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  materialBySku,
  DEFAULT_SETUP_COSTS,
  DEFAULT_EXPENSES_RATE,
  DEFAULT_MANAGEMENT_RATE,
  DEFAULT_SAFETY_RATE,
  DEFAULT_INDIRECT_RATE,
  DEFAULT_VAT_RATE,
  type SetupCostItem,
} from "@/lib/inpick/material-catalog";
import {
  type SegmentationData,
  type EstimateLine,
} from "@/types/segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  segmentation: SegmentationData;
  setupCosts?: SetupCostItem[];
  expensesRatio?: number;
  managementRatio?: number;
  safetyRatio?: number;
  indirectRatio?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const seg = body.segmentation;
    if (!seg || !Array.isArray(seg.regions)) {
      return NextResponse.json({ error: "segmentation 필수" }, { status: 400 });
    }

    const setupCosts = body.setupCosts || DEFAULT_SETUP_COSTS;
    const expensesRatio = typeof body.expensesRatio === "number" ? body.expensesRatio : DEFAULT_EXPENSES_RATE;
    const managementRatio = typeof body.managementRatio === "number" ? body.managementRatio : DEFAULT_MANAGEMENT_RATE;
    const safetyRatio = typeof body.safetyRatio === "number" ? body.safetyRatio : DEFAULT_SAFETY_RATE;
    const indirectRatio = typeof body.indirectRatio === "number" ? body.indirectRatio : DEFAULT_INDIRECT_RATE;

    // 1) 항목별 자재비/노무비 계산
    const items: EstimateLine[] = [];
    let material_subtotal = 0;
    let labor_subtotal = 0;

    for (const region of seg.regions) {
      if (!region.current_material_sku) continue;
      const mat = materialBySku(region.current_material_sku);
      if (!mat) continue;

      let qty: number;
      if (mat.unit === "sqm") {
        qty = region.area_sqm ?? Math.round(region.area_normalized * 100 * 100) / 100;
      } else if (mat.unit === "m") {
        const sideN = (region.bbox[2] + region.bbox[3]) / 2;
        const linearM = seg.pixel_to_sqm_ratio
          ? Math.round(sideN * Math.sqrt(seg.pixel_to_sqm_ratio) * 100) / 100
          : Math.round(sideN * 10 * 100) / 100;
        qty = linearM;
      } else {
        qty = 1;
      }

      const matPrice = mat.material_price ?? mat.price_per_unit ?? 0;
      const laborPrice = mat.labor_price ?? 0;
      const matSub = Math.round(qty * matPrice);
      const lbrSub = Math.round(qty * laborPrice);

      material_subtotal += matSub;
      labor_subtotal += lbrSub;

      items.push({
        region_id: region.id,
        category: region.category,
        label_ko: region.label_ko,
        material_name: mat.name,
        material_sku: mat.sku,
        brand: mat.brand,
        unit: mat.unit,
        qty,
        material_price: matPrice,
        labor_price: laborPrice,
        unit_total: matPrice + laborPrice,
        material_subtotal: matSub,
        labor_subtotal: lbrSub,
        subtotal: matSub + lbrSub,
        unit_price: matPrice + laborPrice,
      });
    }

    // 2) 직접비
    const direct_total = material_subtotal + labor_subtotal;

    // 3) 가설비
    const setup_items = setupCosts.map((s) => ({
      ...s,
      computed_amount: s.rate ? Math.round(direct_total * s.rate) : (s.amount || 0),
    }));
    const setup_total = setup_items.reduce((s, it) => s + it.computed_amount, 0);

    // 4) 경비 (직접비 × 8%)
    const expenses = Math.round(direct_total * expensesRatio);
    // 5) 현장관리비 (직접비 × 5%)
    const management = Math.round(direct_total * managementRatio);
    // 6) 안전관리비 (직접비 × 1.5%)
    const safety = Math.round(direct_total * safetyRatio);

    // 7) 간접비 (직접비 + 가설비 + 경비 + 관리비 + 안전비) × 12%
    const pre_indirect = direct_total + setup_total + expenses + management + safety;
    const indirect = Math.round(pre_indirect * indirectRatio);

    // 합계
    const total = pre_indirect + indirect;
    const vat_separate = Math.round(total * DEFAULT_VAT_RATE);

    return NextResponse.json({
      items,

      // 자재/노무 분리
      material_subtotal,
      labor_subtotal,
      direct_total,

      // 가설비 (사용자 수정 가능 항목)
      setup_items,
      setup_total,

      // 경비/관리비/안전비/간접비
      expenses,
      expenses_ratio: expensesRatio,
      management,
      management_ratio: managementRatio,
      safety,
      safety_ratio: safetyRatio,
      indirect,
      indirect_ratio: indirectRatio,

      // 합계
      total,
      vat_rate: DEFAULT_VAT_RATE,
      vat_separate,

      currency: "KRW",
      generated_at: new Date().toISOString(),
      note: [
        "단가: 한국물가협회(KPA) 자재 + 대한건설협회 표준품셈 노무비",
        "가설비: 엘리베이터/출입구 보양, 가설 자재, 폐기물 처리 (현장 답사 후 조정)",
        "경비 8% 운반/잡재료, 현장관리비 5%, 안전관리비 1.5%",
        "간접비 12%: 관리비 + 이윤",
        "부가세 10% 별도",
        "인픽 수수료는 계약 시점 별도 청구",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
