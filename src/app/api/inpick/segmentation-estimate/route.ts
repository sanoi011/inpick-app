/**
 * POST /api/inpick/segmentation-estimate
 *
 * SegmentationData (selected materials 포함) → 영역별 면적 × 단가 견적 계산.
 * 가이드 §2-3 get_estimate 의 동등 구현.
 *
 * 입력: { segmentation: SegmentationData, expensesRatio?: number }  // 경비 비율 (기본 0.03)
 * 출력: { items: EstimateLine[], material_subtotal, expenses, total }
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
  expensesRatio?: number; // 0.03 = 3%
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const seg = body.segmentation;
    if (!seg || !Array.isArray(seg.regions)) {
      return NextResponse.json({ error: "segmentation 필수" }, { status: 400 });
    }
    const expensesRatio = typeof body.expensesRatio === "number" ? body.expensesRatio : 0.03;

    const items: EstimateLine[] = [];
    let material_subtotal = 0;

    for (const region of seg.regions) {
      if (!region.current_material_sku) continue;
      const mat = materialBySku(region.current_material_sku);
      if (!mat) continue;

      // 수량 — unit별 처리
      let qty: number;
      if (mat.unit === "sqm") {
        // 가이드 §1-4: 사용자 도면 실면적이 있으면 area_sqm, 없으면 area_normalized * 100을 m² 추정
        qty = region.area_sqm ?? Math.round(region.area_normalized * 100 * 100) / 100;
      } else if (mat.unit === "m") {
        // 창호 등 — 길이는 bbox 가로 + 세로 합 추정 × pixel_to_sqm_ratio의 sqrt
        const sideN = (region.bbox[2] + region.bbox[3]) / 2;
        const linearM = seg.pixel_to_sqm_ratio
          ? Math.round(sideN * Math.sqrt(seg.pixel_to_sqm_ratio) * 100) / 100
          : Math.round(sideN * 10 * 100) / 100; // fallback 추정
        qty = linearM;
      } else {
        qty = 1; // each (도어/커튼창)
      }

      const subtotal = Math.round(qty * mat.price_per_unit);
      material_subtotal += subtotal;
      items.push({
        region_id: region.id,
        category: region.category,
        label_ko: region.label_ko,
        material_name: mat.name,
        material_sku: mat.sku,
        brand: mat.brand,
        unit: mat.unit,
        qty,
        unit_price: mat.price_per_unit,
        subtotal,
      });
    }

    const expenses = Math.round(material_subtotal * expensesRatio);
    const total = material_subtotal + expenses;

    return NextResponse.json({
      items,
      material_subtotal,
      expenses,
      expenses_ratio: expensesRatio,
      total,
      currency: "KRW",
      // 인픽 수수료는 계약 시점에 별도 청구 — 견적 단계에서는 미반영 (사용자 정책)
      note: "인픽 수수료는 계약 시점에 별도 청구",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
