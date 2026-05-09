/**
 * POST /api/inpick/segmentation-estimate
 *
 * SegmentationData (selected materials 포함) → 한국 인테리어 표준 견적.
 *
 * 가이드: InPick_Quote_System_Spec.md §B-2 (응답 구조 변경 — 공종별 그룹핑 + standardItems)
 *
 * 응답:
 *   1) 신규 (spec) — sections[], directCostSubtotal, indirectCosts, totalAmount
 *   2) 호환 — items[], material_subtotal, direct_total, expenses, ..., total, vat_separate
 *      (기존 EstimateModal/MaterialEditor UI가 사용 중. Step 4에서 PDF/UI 마이그레이션 예정.)
 *
 * 견적 구조 (한국 표준, 가이드 §C-3):
 *   1. 자재비 — KPA 단가 × 수량
 *   2. 노무비 — 표준품셈 × 수량
 *   3. 경비 — 항목별(standardItems) 또는 직접비 × 8%
 *   = 직접공사비
 *   4. 가설공사비 — 엘리베이터/출입구/가설자재/폐기물 (calculateIndirectCosts setupCost)
 *   5. 산업안전보건관리비 — 직접공사비 × 3.11% (5억 미만, 법정 최저값)
 *   6. 일반관리비 — (직접공사비 + 가설공사비) × 5%
 *   7. 기업이윤 — (노무+경비+일반관리비) × 10%
 *   8. 부가가치세 — 공급가액 × 10%
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
import {
  QUOTE_SECTIONS,
  getSectionByMaterialCategory,
  evaluateFormula,
} from "@/lib/inpick/quote-section-mapping";
import {
  calculateIndirectCosts,
  type BidRateOverride,
  type IndirectCostsResult,
} from "@/lib/inpick/indirect-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  segmentation: SegmentationData;
  /** 가이드 v2 §D — 사업자 입찰 시 요율 override (선택) */
  bidRateOverride?: BidRateOverride;
  /** 욕실 면적 (m²). 없으면 area_sqm × 0.05 추정 */
  bath_area_sqm?: number;
  // ─── 호환성 (기존 사용처 유지) ───
  setupCosts?: SetupCostItem[];
  expensesRatio?: number;
  managementRatio?: number;
  safetyRatio?: number;
  indirectRatio?: number;
}

// ════════════════════════════════════════
// spec §B-2 신규 응답 타입
// ════════════════════════════════════════
export interface QuoteItem {
  itemId: string;
  name: string;
  spec?: string;
  unit: string;
  quantity: number;
  materialCost: number;
  laborCost: number;
  expenseCost: number;
  totalCost: number;
  source: "catalog" | "standard";
  catalogSku?: string;
}

export interface QuoteSectionResult {
  sectionId: string;
  sectionNumber: string;
  sectionName: string;
  items: QuoteItem[];
  subtotal: {
    materialCost: number;
    laborCost: number;
    expenseCost: number;
    total: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const seg = body.segmentation;
    if (!seg || !Array.isArray(seg.regions)) {
      return NextResponse.json({ error: "segmentation 필수" }, { status: 400 });
    }

    // ════════════════════════════════════════
    // 1) 영역 → 자재 → 공종 매핑 + 공종별 그룹핑
    // ════════════════════════════════════════
    const sectionMap: Map<string, QuoteItem[]> = new Map();
    const compatItems: EstimateLine[] = [];
    let material_subtotal = 0;
    let labor_subtotal = 0;
    let total_area_sqm = 0;
    const unmappedCategories: string[] = [];

    for (const region of seg.regions) {
      // 면적 누적 (시공 가능 영역만)
      const regionArea = region.area_sqm ?? Math.round(region.area_normalized * 100 * 100) / 100;
      if (region.is_replaceable) total_area_sqm += regionArea;

      if (!region.current_material_sku) continue;
      const mat = materialBySku(region.current_material_sku);
      if (!mat) continue;

      // 수량
      let qty: number;
      if (mat.unit === "sqm") {
        qty = regionArea;
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

      // 공종 매핑
      const section = getSectionByMaterialCategory(mat.category);
      const sectionId = section?.sectionId ?? "unmapped";
      if (!section) unmappedCategories.push(mat.category);

      // QuoteItem (spec — 단가 컬럼 제거, 비용만)
      const quoteItem: QuoteItem = {
        itemId: region.id,
        name: mat.name,
        spec: [mat.color, mat.texture, mat.finish].filter(Boolean).join(", ") || undefined,
        unit: mat.unit,
        quantity: qty,
        materialCost: matSub,
        laborCost: lbrSub,
        expenseCost: 0, // 자재 항목엔 직접경비 없음 (운반/잡재료는 standardItems 또는 일반관리비에 포함)
        totalCost: matSub + lbrSub,
        source: "catalog",
        catalogSku: mat.sku,
      };
      const arr = sectionMap.get(sectionId) ?? [];
      arr.push(quoteItem);
      sectionMap.set(sectionId, arr);

      // 호환 EstimateLine
      compatItems.push({
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

    // ════════════════════════════════════════
    // 2) 각 공종에 standardItems 자동 추가 (spec B-1 항목)
    // ════════════════════════════════════════
    const formulaVars = {
      area_sqm: total_area_sqm > 0 ? total_area_sqm : 50, // fallback 50m²
      bath_area_sqm: body.bath_area_sqm,
    };

    let standard_expense_total = 0;
    let standard_labor_total = 0;

    for (const section of QUOTE_SECTIONS) {
      // 자재 없는 공종도 standardItems 가질 수 있음 → 빈 배열 시작
      const items = sectionMap.get(section.sectionId) ?? [];
      for (const std of section.standardItems) {
        const qty = std.defaultQuantity === "auto"
          ? evaluateFormula(std.formula, formulaVars)
          : std.defaultQuantity;
        const labor = Math.round(qty * std.laborCost);
        const expense = Math.round(qty * std.expenseCost);
        items.push({
          itemId: `std_${section.sectionId}_${std.itemName.replace(/\s+/g, "_")}`,
          name: std.itemName,
          unit: std.unit,
          quantity: Math.round(qty * 100) / 100,
          materialCost: 0,
          laborCost: labor,
          expenseCost: expense,
          totalCost: labor + expense,
          source: "standard",
        });
        standard_labor_total += labor;
        standard_expense_total += expense;
      }
      if (items.length > 0) sectionMap.set(section.sectionId, items);
    }

    // ════════════════════════════════════════
    // 3) 공종별 sections 결과 만들기 (정렬 — QUOTE_SECTIONS 순서)
    // ════════════════════════════════════════
    const sections: QuoteSectionResult[] = [];
    for (const section of QUOTE_SECTIONS) {
      const items = sectionMap.get(section.sectionId);
      if (!items || items.length === 0) continue;
      const sub = items.reduce(
        (acc, it) => ({
          materialCost: acc.materialCost + it.materialCost,
          laborCost: acc.laborCost + it.laborCost,
          expenseCost: acc.expenseCost + it.expenseCost,
          total: acc.total + it.totalCost,
        }),
        { materialCost: 0, laborCost: 0, expenseCost: 0, total: 0 },
      );
      sections.push({
        sectionId: section.sectionId,
        sectionNumber: section.sectionNumber,
        sectionName: section.sectionName,
        items,
        subtotal: sub,
      });
    }
    // unmapped 잔여
    const unmappedItems = sectionMap.get("unmapped");
    if (unmappedItems && unmappedItems.length > 0) {
      const sub = unmappedItems.reduce(
        (acc, it) => ({
          materialCost: acc.materialCost + it.materialCost,
          laborCost: acc.laborCost + it.laborCost,
          expenseCost: acc.expenseCost + it.expenseCost,
          total: acc.total + it.totalCost,
        }),
        { materialCost: 0, laborCost: 0, expenseCost: 0, total: 0 },
      );
      sections.push({
        sectionId: "unmapped",
        sectionNumber: "00",
        sectionName: "기타 (공종 미매핑)",
        items: unmappedItems,
        subtotal: sub,
      });
    }

    // ════════════════════════════════════════
    // 4) 직접공사비 = sections 합계 (자재비 + 노무비 + 경비)
    // ════════════════════════════════════════
    const directCostSubtotal = sections.reduce((s, sec) => s + sec.subtotal.total, 0);

    // ════════════════════════════════════════
    // 5) 간접비 — calculateIndirectCosts (가이드 §C-3)
    //    bidRateOverride가 있으면 사업자 요율 적용
    //    laborPlusExpense는 정확히 계산해서 전달 (이윤 정확도 ↑)
    // ════════════════════════════════════════
    const total_labor_with_std = labor_subtotal + standard_labor_total;
    const total_expense_with_std = standard_expense_total;
    const indirectCosts: IndirectCostsResult = calculateIndirectCosts(
      directCostSubtotal,
      body.bidRateOverride,
      { laborPlusExpense: total_labor_with_std + total_expense_with_std },
    );

    // ════════════════════════════════════════
    // 6) 호환 응답 — 기존 사용처(EstimateModal 등)가 깨지지 않게 평면 필드 유지
    //    값은 신규 indirectCosts와 일치하도록 매핑
    // ════════════════════════════════════════
    const setupCosts = body.setupCosts || DEFAULT_SETUP_COSTS;
    const expensesRatio = typeof body.expensesRatio === "number" ? body.expensesRatio : DEFAULT_EXPENSES_RATE;
    const managementRatio = typeof body.managementRatio === "number" ? body.managementRatio : DEFAULT_MANAGEMENT_RATE;
    const safetyRatio = typeof body.safetyRatio === "number" ? body.safetyRatio : DEFAULT_SAFETY_RATE;
    const indirectRatio = typeof body.indirectRatio === "number" ? body.indirectRatio : DEFAULT_INDIRECT_RATE;

    const direct_total = material_subtotal + labor_subtotal; // 호환 (자재+노무만, standardItems 제외)
    const setup_items = setupCosts.map((s) => ({
      ...s,
      computed_amount: s.rate ? Math.round(direct_total * s.rate) : (s.amount || 0),
    }));
    const setup_total = setup_items.reduce((s, it) => s + it.computed_amount, 0);
    const expenses = Math.round(direct_total * expensesRatio);
    const management = Math.round(direct_total * managementRatio);
    const safety = Math.round(direct_total * safetyRatio);
    const pre_indirect = direct_total + setup_total + expenses + management + safety;
    const indirect = Math.round(pre_indirect * indirectRatio);
    const total = pre_indirect + indirect;
    const vat_separate = Math.round(total * DEFAULT_VAT_RATE);

    return NextResponse.json({
      // ─── 신규 (spec B-2) ───
      sections,
      directCostSubtotal,
      indirectCosts,
      totalAmount: indirectCosts.totalAmount,
      unmappedCategories: Array.from(new Set(unmappedCategories)),

      // ─── 호환 (기존 UI) ───
      items: compatItems,
      material_subtotal,
      labor_subtotal,
      direct_total,
      setup_items,
      setup_total,
      expenses,
      expenses_ratio: expensesRatio,
      management,
      management_ratio: managementRatio,
      safety,
      safety_ratio: safetyRatio,
      indirect,
      indirect_ratio: indirectRatio,
      total,
      vat_rate: DEFAULT_VAT_RATE,
      vat_separate,

      // ─── 메타 ───
      currency: "KRW",
      generated_at: new Date().toISOString(),
      total_area_sqm,
      note: [
        "단가: 한국물가협회(KPA) 자재 + 대한건설협회 표준품셈 노무비",
        "가설비/산안비/일반관리비/이윤: 2026 KICT 표준품셈 + KPI 원가계산 제비율",
        "산업안전보건관리비 3.11% (5억 미만, 법정 최저값)",
        "일반관리비 5% (한도 6%) / 기업이윤 10% (한도 25%)",
        "부가세 10% 별도",
        "사업자 입찰 시 요율 수정 가능 (산안비 하향 제외)",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
