/**
 * POST /api/inpick/segmentation-estimate
 *
 * SegmentationData (selected materials 포함) → KPA 기준 영역별 견적.
 *
 * 견적 구조 (한국 인테리어 표준):
 *   1. 자재비 (재료) — 한국물가협회 단가 × 수량
 *   2. 노무비 (인건비) — 표준품셈 × 수량
 *   3. 경비 — (자재비 + 노무비) × 8% (운반/폐기물/잡재료)
 *   4. 간접비 — (자재 + 노무 + 경비) × 12% (관리비 + 이윤)
 *   5. 합계 + 부가세 별도
 *
 * 인픽 수수료는 계약 시점에 별도 청구 — 견적 단계 미반영.
 *
 * 입력: { segmentation: SegmentationData, expensesRatio?: number, indirectRatio?: number }
 * 출력: {
 *   items: EstimateLine[],
 *   material_subtotal, labor_subtotal,
 *   expenses, indirect, total,
 *   ...
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { materialBySku } from "@/lib/inpick/material-catalog";
import {
  type SegmentationData,
  type EstimateLine,
} from "@/types/segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  segmentation: SegmentationData;
  /** 경비 비율 (기본 0.08 = 8%) */
  expensesRatio?: number;
  /** 간접비 비율 (기본 0.12 = 12%) */
  indirectRatio?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const seg = body.segmentation;
    if (!seg || !Array.isArray(seg.regions)) {
      return NextResponse.json({ error: "segmentation 필수" }, { status: 400 });
    }
    const expensesRatio = typeof body.expensesRatio === "number" ? body.expensesRatio : 0.08;
    const indirectRatio = typeof body.indirectRatio === "number" ? body.indirectRatio : 0.12;

    const items: EstimateLine[] = [];
    let material_subtotal = 0;
    let labor_subtotal = 0;

    for (const region of seg.regions) {
      if (!region.current_material_sku) continue;
      const mat = materialBySku(region.current_material_sku);
      if (!mat) continue;

      // 수량 계산
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

      // 자재비/노무비 단가
      const matPrice = mat.material_price ?? mat.price_per_unit ?? 0;
      const laborPrice = mat.labor_price ?? 0;
      const unitTotal = matPrice + laborPrice;

      const matSubtotal = Math.round(qty * matPrice);
      const lbrSubtotal = Math.round(qty * laborPrice);
      const subtotal = matSubtotal + lbrSubtotal;

      material_subtotal += matSubtotal;
      labor_subtotal += lbrSubtotal;

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
        unit_total: unitTotal,
        material_subtotal: matSubtotal,
        labor_subtotal: lbrSubtotal,
        subtotal,
        // 호환
        unit_price: unitTotal,
      });
    }

    // 경비 = (자재 + 노무) × 8%
    const direct_total = material_subtotal + labor_subtotal;
    const expenses = Math.round(direct_total * expensesRatio);
    // 간접비 = (자재 + 노무 + 경비) × 12%
    const indirect = Math.round((direct_total + expenses) * indirectRatio);
    const total = direct_total + expenses + indirect;
    const vat = Math.round(total * 0.1); // 부가세 10% (참고용 별도 표기)

    return NextResponse.json({
      items,
      material_subtotal,
      labor_subtotal,
      direct_total,
      expenses,
      expenses_ratio: expensesRatio,
      indirect,
      indirect_ratio: indirectRatio,
      total,
      vat_separate: vat,
      currency: "KRW",
      // 표시용 메모
      note: [
        "단가: 한국물가협회 + 대한건설협회 표준품셈 기준",
        "경비: 운반/폐기물/잡재료 8%",
        "간접비: 관리비 + 이윤 12%",
        "부가세 별도 (총액의 10%)",
        "인픽 수수료는 계약 시점 별도 청구",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
