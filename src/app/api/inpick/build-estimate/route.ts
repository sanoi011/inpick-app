/**
 * POST /api/inpick/build-estimate
 *
 * 입력: { rooms: [{ roomName, dim, renderImageUrl? }] }
 *
 * 정책 변경 (2026-05-10): 자재 컨택은 선택사항.
 *   - 이미지 + vision 추출 성공 → 추출된 자재로 견적
 *   - 이미지 없거나 vision 실패 → 방 타입별 표준 자재 (KPA 단가 기반)로 fallback
 *   - 절대 방을 skip하지 않음 (사용자가 "전체 일괄 생성" 안 했어도 견적 가능)
 *
 * 출력: { estimates: RoomEstimate[], grandTotal, fallbackRooms }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildRoomEstimate,
  extractMaterialsFromRender,
  type MaterialItem,
  type RoomEstimate,
} from "@/lib/inpick/estimate";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { lookupMaterialProduct } from "@/lib/inpick/material-product-lookup";
import type {
  AnalyzedSurface,
  EstimateLineMaterialMeta,
  SurfaceType,
} from "@/lib/vision-materials/types";
// P2: contextId 기반 견적 합성 (design_outputs + materialEvidence + userEdits)
import { buildEstimateFromContext } from "@/lib/inpick/estimate-context/build-estimate-from-context";
// P5: legacy 경로에서도 design_outputs DB의 materialHints를 자동 활용
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { MaterialHint } from "@/lib/inpick/estimate-context/types";
// P7: estimate-v2 공종별 실행내역서 엔진
// P12: async 버전 — DB product/price resolver 호출하여 line에 brand/sku/source 채움
import {
  buildConstructionEstimate,
  buildConstructionEstimateWithProductResolution,
} from "@/lib/inpick/estimate-v2/build-construction-estimate";
import { buildSurfacePlansFromContext } from "@/lib/inpick/estimate-v2/surface-plan-builder";
import type { ConstructionEstimate } from "@/lib/inpick/estimate-v2/types";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import type { ProjectModeForAnalytics } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 방 타입별 표준 자재 (KPA 단가 매핑 자동 — 이미지/vision 실패 시 fallback).
 * 사용자가 "부위별 자재 컨택"을 안 했어도 표준 견적 산출 가능.
 */
function defaultSurfacesForRoom(roomName: string): MaterialItem[] {
  const r = roomName.toLowerCase();
  const isBath = r.includes("욕실") || r.includes("화장실") || r.includes("bath");
  const isKitchen = r.includes("부엌") || r.includes("주방") || r.includes("kitchen");
  const isEntry = r.includes("현관") || r.includes("entrance");
  const isBalcony = r.includes("베란다") || r.includes("발코니") || r.includes("balcony");
  const isUtility = r.includes("다용도실") || r.includes("팬트리");
  const isDressroom = r.includes("드레스룸") || r.includes("walk");

  if (isBath) {
    return [
      { surface: "바닥", materialName: "포세린 타일 600x600", unit: "m²", unitPriceWon: 78000, priceSource: "standard" },
      { surface: "벽", materialName: "벽 타일 (실크)", unit: "m²", unitPriceWon: 55000, priceSource: "standard" },
      { surface: "천장", materialName: "방수 도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "욕실세트 (변기+세면대+샤워)", unit: "set", unitPriceWon: 1900000, priceSource: "standard" },
    ];
  }
  if (isKitchen) {
    return [
      { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
      { surface: "벽", materialName: "실크벽지", unit: "m²", unitPriceWon: 12000, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "싱크대 (상·하부장)", unit: "set", unitPriceWon: 8900000, priceSource: "standard" },
    ];
  }
  if (isEntry) {
    return [
      { surface: "바닥", materialName: "포세린 타일", unit: "m²", unitPriceWon: 78000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "도어", materialName: "현관문 (방화)", unit: "EA", unitPriceWon: 320000, priceSource: "standard" },
    ];
  }
  if (isBalcony) {
    return [
      { surface: "바닥", materialName: "데크 타일", unit: "m²", unitPriceWon: 75000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    ];
  }
  if (isUtility) {
    return [
      { surface: "바닥", materialName: "타일", unit: "m²", unitPriceWon: 75000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    ];
  }
  if (isDressroom) {
    return [
      { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
      { surface: "벽", materialName: "도배", unit: "m²", unitPriceWon: 9500, priceSource: "standard" },
      { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
      { surface: "fixture", materialName: "붙박이장 (양벽)", unit: "set", unitPriceWon: 1800000, priceSource: "standard" },
    ];
  }
  // 거실/안방/침실 등 일반 거주 공간
  return [
    { surface: "바닥", materialName: "강마루", unit: "m²", unitPriceWon: 64000, priceSource: "standard" },
    { surface: "벽", materialName: "실크벽지", unit: "m²", unitPriceWon: 12000, priceSource: "standard" },
    { surface: "천장", materialName: "도배", unit: "m²", unitPriceWon: 7500, priceSource: "standard" },
    { surface: "도어", materialName: "방문", unit: "EA", unitPriceWon: 180000, priceSource: "standard" },
  ];
}

/**
 * 자재 lookup으로 brand/sku/spec 채움 (대표 지목 핵심 기능 — "우리의 킥").
 *
 * material_products 테이블에서 surface 카테고리별 top product 매칭.
 * 매칭 성공 시:
 *   - materialName을 "{brand} {productName}" 형태로 교체
 *   - brand / sku (model_number) / spec (specification) 채움
 *   - contractor_price 있으면 unitPriceWon 갱신 + priceSource="korea_price_assoc" → "vision_estimate" 변경
 * 매칭 실패 시 입력 그대로 (호환).
 */
async function enrichWithBrandSku(
  surfaces: MaterialItem[],
  roomName: string,
): Promise<MaterialItem[]> {
  const out: MaterialItem[] = [];
  for (const m of surfaces) {
    // 이미 brand/sku 있으면 skip (vision/사용자 입력 우선)
    if (m.brand || m.sku) {
      out.push(m);
      continue;
    }
    try {
      const match = await lookupMaterialProduct({
        surface: m.surface,
        roomName,
        materialName: m.materialName,
        preferredGrade: "standard",
      });
      if (!match) {
        out.push(m);
        continue;
      }
      // contractor_price 우선, 없으면 retail_price, 없으면 기존 unitPriceWon 유지
      const matchedPrice =
        match.contractorPrice ??
        match.retailPrice ??
        m.unitPriceWon;
      out.push({
        ...m,
        materialName: `${match.brand} ${match.productName}`,
        brand: match.brand,
        sku: match.sku,
        spec: match.specification,
        unitPriceWon: matchedPrice,
        priceSource: match.contractorPrice ? "vision_estimate" : "standard",
      });
    } catch (e) {
      // lookup 실패 — 원본 그대로
      console.warn(
        `[build-estimate] enrich fail for ${m.surface}/${m.materialName}: ${e instanceof Error ? e.message : String(e)}`,
      );
      out.push(m);
    }
  }
  return out;
}

/**
 * Phase 6 후속 — vision-materials 분석 결과(AnalyzedSurface[])를
 * MaterialItem[]으로 변환해 견적에 우선 적용 (대표 지시 vision-material-estimate-dev-plan).
 *
 * 정책:
 *   - confirmed/recommended만 적용 (fallback은 무시 → defaultSurfaces로 보강)
 *   - SKU hallucination 금지 — top1.materialProductId 있는 것만
 *   - 매칭된 surface는 unit/unitPrice/brand/sku/spec 채움
 */
function visionAnalysisToSurfaces(
  analyzed: AnalyzedSurface[] | undefined,
): MaterialItem[] {
  if (!analyzed || analyzed.length === 0) return [];
  const out: MaterialItem[] = [];
  for (const a of analyzed) {
    const top = a.candidates[0];
    if (!top || !top.materialProductId) continue;
    if (a.recommendation.status === "fallback" || a.recommendation.status === "rejected") {
      continue;
    }
    out.push({
      surface: surfaceTypeToKorean(a.observation.surfaceType),
      materialName: `${top.brand ? top.brand + " " : ""}${top.productName}`,
      brand: top.brand,
      sku: top.sku,
      spec: top.spec,
      unit: ((top.unit as MaterialItem["unit"]) || "EA"),
      unitPriceWon: top.unitPrice || 0,
      priceSource:
        a.recommendation.status === "confirmed" ? "vision_estimate" : "standard",
      confidence: top.confidence,
    });
  }
  return out;
}

/**
 * P0 폴백: Step1에서 방을 선택 안 한 경우 평수 기반 표준 방 셋 생성.
 * - 평수 < 15평: 거실 + 안방 + 욕실 + 주방 (소형)
 * - 15~25평: 거실 + 안방 + 침실1 + 주방 + 욕실 (중형)
 * - 25평 이상: 거실 + 안방 + 침실1 + 침실2 + 주방 + 욕실 + 현관 (대형)
 *
 * 면적은 areaM2 / pyung 입력에서 추출 (없으면 30평 기본).
 */
function buildFallbackRoomsFromArea(body: Record<string, unknown>): Array<{
  roomName: string;
  dim: { name?: string; widthMm: number; depthMm: number; heightMm?: number };
  renderImageUrl?: string;
  surfaces?: MaterialItem[];
}> | null {
  const areaM2 = Number(body.areaM2 ?? body.totalAreaM2 ?? 0);
  const pyungFromInput = Number(body.pyung ?? 0);
  const pyung = pyungFromInput > 0 ? pyungFromInput : areaM2 > 0 ? areaM2 / PYEONG_TO_M2 : 30;

  // 기본 방 (거실 단일) — 평수 정보가 전혀 없을 때
  const baseRooms: Array<{ roomName: string; widthMm: number; depthMm: number }> = [];
  if (pyung < 15) {
    baseRooms.push({ roomName: "거실", widthMm: 3500, depthMm: 4200 });
    baseRooms.push({ roomName: "안방", widthMm: 3000, depthMm: 3500 });
    baseRooms.push({ roomName: "주방", widthMm: 2400, depthMm: 3000 });
    baseRooms.push({ roomName: "욕실1", widthMm: 1600, depthMm: 2100 });
  } else if (pyung < 25) {
    baseRooms.push({ roomName: "거실", widthMm: 4200, depthMm: 5000 });
    baseRooms.push({ roomName: "안방", widthMm: 3300, depthMm: 4000 });
    baseRooms.push({ roomName: "침실1", widthMm: 2800, depthMm: 3300 });
    baseRooms.push({ roomName: "주방", widthMm: 2700, depthMm: 3500 });
    baseRooms.push({ roomName: "욕실1", widthMm: 1800, depthMm: 2200 });
  } else {
    baseRooms.push({ roomName: "거실", widthMm: 4800, depthMm: 5800 });
    baseRooms.push({ roomName: "안방", widthMm: 3600, depthMm: 4200 });
    baseRooms.push({ roomName: "침실1", widthMm: 3000, depthMm: 3500 });
    baseRooms.push({ roomName: "침실2", widthMm: 2800, depthMm: 3300 });
    baseRooms.push({ roomName: "주방", widthMm: 3000, depthMm: 3800 });
    baseRooms.push({ roomName: "욕실1", widthMm: 1800, depthMm: 2400 });
    baseRooms.push({ roomName: "현관", widthMm: 1500, depthMm: 1800 });
  }

  return baseRooms.map((r) => ({
    roomName: r.roomName,
    dim: { name: r.roomName, widthMm: r.widthMm, depthMm: r.depthMm, heightMm: 2400 },
  }));
}

/**
 * P14-2: ConstructionEstimate → construction_estimates + construction_estimate_lines + snapshots DB INSERT.
 * fire-and-forget — 견적 응답은 막지 않음. 실패해도 silent (log only).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistEstimateToDb(
  admin: any,
  estimate: ConstructionEstimate,
  projectId: string,
  userId: string,
  contextId: string,
): Promise<void> {
  if (!admin) return;
  try {
    // 1) construction_estimates row 생성
    const { data: estRow, error: estErr } = await admin
      .from("construction_estimates")
      .insert({
        id: estimate.id,
        project_id: projectId,
        user_id: userId,
        project_mode: estimate.projectMode,
        version: estimate.version,
        estimate_json: estimate,
        total_with_vat: estimate.totals.totalWithVat,
        confidence_avg: estimate.confidenceSummary.averageConfidence,
        source_summary: estimate.confidenceSummary,
      })
      .select("id")
      .single();
    if (estErr || !estRow) {
      console.warn("[build-estimate] estimates INSERT failed:", estErr?.message);
      return;
    }
    const estimateId = estRow.id;

    // 2) construction_estimate_lines bulk INSERT
    const lineRows = estimate.lines.map((l) => ({
      estimate_id: estimateId,
      estimate_context_id: contextId,
      project_id: projectId,
      user_id: userId,
      sort_no: l.sortNo,
      trade_code: l.tradeCode,
      trade_name_ko: l.tradeNameKo,
      sub_trade_code: l.subTradeCode,
      sub_trade_name_ko: l.subTradeNameKo,
      room_id: l.roomId,
      room_name: l.roomName,
      room_type: l.roomType,
      surface_type: l.surfaceType,
      task_name_ko: l.taskNameKo,
      item_name_ko: l.itemNameKo,
      brand: l.brand,
      sku: l.sku,
      spec: l.spec,
      unit: l.unit,
      quantity_formula_ko: l.quantityFormulaKo,
      quantity: l.quantity,
      material_unit_price: l.materialUnitPrice,
      labor_unit_price: l.laborUnitPrice,
      expense_unit_price: l.expenseUnitPrice,
      material_amount: l.materialAmount,
      labor_amount: l.laborAmount,
      expense_amount: l.expenseAmount,
      total_amount: l.totalAmount,
      included: l.included,
      source: l.source,
      confidence: l.confidence,
      evidence_refs: l.evidenceRefs,
      assumptions: l.assumptions,
      warnings: l.warnings,
      // P12: product/price meta
      material_product_id: l.materialProductId,
      manufacturer: l.manufacturer,
      supplier_name: l.supplierName,
      vendor_name: l.vendorName,
      product_name: l.productName,
      model_no: l.modelNo,
      product_spec: l.productSpec,
      product_unit: l.productUnit,
      material_category_code: l.materialCategoryCode,
      material_category_name: l.materialCategoryName,
      material_price_source: l.materialPriceSource,
      material_price_source_id: l.materialPriceSourceId,
      material_price_applied_at: l.materialPriceAppliedAt,
      product_match_status: l.productMatchStatus,
      product_match_confidence: l.productMatchConfidence,
      price_confidence: l.priceConfidence,
      fallback_reason: l.fallbackReason,
    }));
    const { data: insertedLines, error: linesErr } = await admin
      .from("construction_estimate_lines")
      .insert(lineRows)
      .select("id, material_product_id, brand, manufacturer, supplier_name, sku, spec, material_unit_price, material_price_source, fallback_reason");
    if (linesErr) {
      console.warn("[build-estimate] lines INSERT failed:", linesErr.message);
      return;
    }

    // 3) snapshots — product 매칭된 line만 INSERT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotRows = ((insertedLines ?? []) as any[])
      .filter((l) => l.material_product_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((l: any) => {
        const row = l as Record<string, unknown>;
        return {
          estimate_line_id: row.id,
          project_id: projectId,
          user_id: userId,
          material_product_id: row.material_product_id,
          brand: row.brand,
          manufacturer: row.manufacturer,
          supplier_name: row.supplier_name,
          sku: row.sku,
          spec: row.spec,
          unit_price: row.material_unit_price,
          price_source: row.material_price_source,
          fallback_reason: row.fallback_reason,
        };
      });
    if (snapshotRows.length > 0) {
      const { error: snapErr } = await admin
        .from("estimate_line_product_snapshots")
        .insert(snapshotRows);
      if (snapErr) {
        console.warn("[build-estimate] snapshots INSERT failed:", snapErr.message);
      }
    }
    console.info(
      `[build-estimate] persisted estimateId=${estimateId} lines=${lineRows.length} snapshots=${snapshotRows.length}`,
    );
  } catch (err) {
    console.warn("[build-estimate] persistEstimateToDb error:", err);
  }
}

/**
 * P7: contextId → estimate_contexts 조회 → SurfacePlan[] → ConstructionEstimate (17공종).
 *
 * 응답에 v2 견적과 legacy-호환 estimates/grandTotal을 함께 담아 UI 점진 마이그레이션 가능.
 * context 미존재 또는 service 미설정 시 null 반환.
 */
async function buildConstructionEstimateFromContextId(
  contextId: string,
): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[build-estimate-v2] service not configured");
    return null;
  }
  const admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("estimate_contexts")
    .select("*")
    .eq("id", contextId)
    .single();
  if (error || !data) {
    console.warn("[build-estimate-v2] context not found:", error?.message);
    return null;
  }
  // step1_snapshot에서 방 면적 추출
  const step1 = (data.step1_snapshot ?? {}) as {
    basicInfo?: { selectedPyeong?: { exclusiveArea?: number } };
    normalizedFloorplan?: { rooms?: Array<{ name: string; widthMm?: number; depthMm?: number }> };
  };
  const roomAreasByName: Record<string, number> = {};
  // P14-1: 방 도면 치수 (mm) → KitchenPlan/RoomQuantityBasis에 전달
  const floorplanDimsByName: Record<string, { widthMm?: number; depthMm?: number }> = {};
  // normalizedFloorplan의 방 면적 (mm → m²) 사용
  for (const r of step1.normalizedFloorplan?.rooms ?? []) {
    if (r.widthMm && r.depthMm) {
      roomAreasByName[r.name] = (r.widthMm * r.depthMm) / 1_000_000;
      floorplanDimsByName[r.name] = { widthMm: r.widthMm, depthMm: r.depthMm };
    }
  }
  // 전체 평수도 옵션
  const totalAreaM2 = step1.basicInfo?.selectedPyeong?.exclusiveArea;
  if (totalAreaM2 && Object.keys(roomAreasByName).length === 0) {
    roomAreasByName["전체"] = totalAreaM2;
  }

  const { surfacePlans, quantityBasisByRoom } = buildSurfacePlansFromContext({
    projectId: String(data.project_id),
    projectMode: data.project_mode as "apartment" | "photo_only" | "commercial",
    designOutputs: Array.isArray(data.design_outputs_snapshot)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.design_outputs_snapshot as any[])
      : [],
    userMaterialEdits: Array.isArray(data.user_material_edits_snapshot)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.user_material_edits_snapshot as any[])
      : [],
    roomAreasByName,
    floorplanDimsByName,
  });

  // P12: server-side에서 DB product/price resolver 호출 → line에 brand/sku/manufacturer/source 채움
  const constructionEstimate: ConstructionEstimate =
    await buildConstructionEstimateWithProductResolution({
      projectId: String(data.project_id),
      projectMode: data.project_mode as "apartment" | "photo_only" | "commercial",
      surfacePlans,
      quantityBasisByRoom,
    });

  // P14-2: construction_estimate_lines + snapshot DB INSERT (fire-and-forget)
  //   견적 발행 시 현재 자재/단가/제조사 스냅샷 영속 — 사업자 입찰 학습 + 발행 후 단가 변경 불변
  void persistEstimateToDb(admin, constructionEstimate, String(data.project_id), String(data.user_id), contextId).catch(
    (err) => console.warn("[build-estimate] persistEstimateToDb failed (non-fatal):", err),
  );

  // legacy 호환 — 기존 견적 페이지가 사용하는 estimates[]/grandTotal 형태로도 제공
  const legacyEstimates = convertV2ToLegacyEstimates(constructionEstimate);

  return {
    estimateVersion: "construction_trade_v2",
    constructionEstimate,
    // legacy compat fields
    estimates: legacyEstimates,
    grandTotal: {
      mainTotal: constructionEstimate.totals.directMaterial,
      auxTotal: 0,
      laborTotal: constructionEstimate.totals.directLabor,
      totalWon: constructionEstimate.totals.totalWithVat,
    },
    quotationType: "construction_trade_estimate",
    warnings: constructionEstimate.warnings,
    matchMetaByRoom: {},
  };
}

/** ConstructionEstimate를 legacy EstimateRoom[] 형태로 변환 (점진 마이그레이션 호환) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertV2ToLegacyEstimates(est: ConstructionEstimate): any[] {
  // roomName으로 그룹화하여 EstimateRoom[]-like
  const byRoom = new Map<string, ConstructionEstimate["lines"]>();
  for (const l of est.lines) {
    if (!byRoom.has(l.roomName)) byRoom.set(l.roomName, []);
    byRoom.get(l.roomName)!.push(l);
  }
  return Array.from(byRoom.entries()).map(([roomName, lines]) => {
    const mainTotalWon = lines.reduce((s, l) => s + l.materialAmount, 0);
    const laborTotalWon = lines.reduce((s, l) => s + l.laborAmount, 0);
    const auxTotalWon = lines.reduce((s, l) => s + l.expenseAmount, 0);
    return {
      roomName,
      totalAreaM2: 0,
      items: lines.map((l) => ({
        surface: l.surfaceType || l.tradeNameKo,
        materialName: `[${l.tradeNameKo}/${l.subTradeNameKo}] ${l.itemNameKo}`,
        brand: l.brand,
        spec: l.spec,
        sku: l.sku,
        quantity: l.quantity,
        unit: l.unit === "m2" ? "m²" : l.unit,
        unitPriceWon: l.materialUnitPrice + l.laborUnitPrice + l.expenseUnitPrice,
        subtotalWon: l.totalAmount,
        category: l.materialAmount > 0 ? "main" : l.laborAmount > 0 ? "labor" : "aux",
      })),
      mainTotalWon,
      auxTotalWon,
      laborTotalWon,
      totalWon: mainTotalWon + laborTotalWon + auxTotalWon,
    };
  });
}

/**
 * P5: design_outputs DB의 material_hints를 fetch해서 visionAnalysisByRoom-like 구조로 변환.
 *
 * - body에 visionAnalysisByRoom이 있으면 body 우선 (사용자가 명시적으로 보낸 값)
 * - design_outputs는 보충용 (body에 없는 roomName만 추가)
 * - 인증 실패/projectId 없음 → body 그대로 반환 (에러 throw 안 함)
 */
async function mergeWithDesignOutputs(
  fromBody: Record<string, AnalyzedSurface[]> | undefined,
  projectId: string | undefined,
): Promise<Record<string, AnalyzedSurface[]> | undefined> {
  if (!projectId) return fromBody;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fromBody;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return fromBody;
    const admin = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin
      .from("design_outputs")
      .select("target_name, material_hints, status")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error || !data) return fromBody;

    const merged: Record<string, AnalyzedSurface[]> = { ...(fromBody ?? {}) };
    for (const row of data) {
      const name = String(row.target_name);
      if (merged[name]) continue; // body 우선
      const hints = Array.isArray(row.material_hints)
        ? (row.material_hints as MaterialHint[])
        : [];
      const surfaces = materialHintsToAnalyzedSurfaces(hints, name);
      if (surfaces.length > 0) merged[name] = surfaces;
    }
    return Object.keys(merged).length > 0 ? merged : fromBody;
  } catch (err) {
    console.warn("[build-estimate] mergeWithDesignOutputs failed (non-fatal):", err);
    return fromBody;
  }
}

/**
 * MaterialHint[] → AnalyzedSurface[] 변환.
 * vision 분석 미완료 (prompt_extract / scope_default)인 경우에도 1차 evidence로 활용.
 */
function materialHintsToAnalyzedSurfaces(
  hints: MaterialHint[],
  targetName: string,
): AnalyzedSurface[] {
  const out: AnalyzedSurface[] = [];
  for (const h of hints) {
    const status =
      h.source === "user_selected"
        ? "confirmed"
        : h.source === "vision_analysis"
          ? h.confidence >= 0.7
            ? "confirmed"
            : "recommended"
          : "recommended";
    const surfaceType: SurfaceType = mapHintSurfaceToVisionType(h.surfaceType);
    out.push({
      observation: {
        id: `hint-${targetName}-${h.surfaceType}`,
        surfaceType,
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        coarseLabels: [],
        confidence: h.confidence,
        // 최소 필드만 채움 — vision-materials 분석 후엔 더 풍부함
      } as AnalyzedSurface["observation"],
      candidates: [
        {
          materialProductId: h.sku ?? `prompt-${h.materialCategory}`,
          brand: h.brand,
          productName: h.materialNameKo ?? h.materialCategory,
          sku: h.sku,
          spec: undefined,
          unit: "m²",
          unitPrice: 0,
          confidence: h.confidence,
        } as AnalyzedSurface["candidates"][number],
      ],
      recommendation: {
        status: status as AnalyzedSurface["recommendation"]["status"],
        confidence: h.confidence,
      } as AnalyzedSurface["recommendation"],
    });
  }
  return out;
}

function mapHintSurfaceToVisionType(s: MaterialHint["surfaceType"]): SurfaceType {
  switch (s) {
    case "floor":
      return "floor";
    case "wall":
      return "wall";
    case "ceiling":
      return "ceiling";
    case "door":
      return "door";
    case "window":
      return "window";
    case "counter":
      return "countertop";
    case "lighting":
      return "lighting";
    case "built_in_furniture":
      return "cabinet";
    default:
      return "unknown";
  }
}

function surfaceTypeToKorean(t: SurfaceType): string {
  const m: Record<SurfaceType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    tile: "타일",
    cabinet: "fixture",
    countertop: "fixture",
    baseboard: "걸레받이",
    door: "도어",
    window: "창호",
    fixture: "fixture",
    lighting: "조명",
    sanitary: "fixture",
    unknown: "기타",
  };
  return m[t] || "기타";
}

/** 계측용 — body.projectMode를 analytics project_mode로 정규화 */
function toAnalyticsProjectMode(mode?: unknown): ProjectModeForAnalytics {
  if (mode === "photo_only" || mode === "commercial") return mode;
  return "apartment"; // residential/apartment/미지정 → 아파트 모드
}

export async function POST(req: NextRequest) {
  // 계측용 — 인증 사용자 조회 (실패해도 견적 흐름 무영향)
  let trackUserId: string | undefined;
  let trackMode: ProjectModeForAnalytics = "apartment";
  let trackProjectId: string | undefined;
  try {
    const body = await req.json();

    trackMode = toAnalyticsProjectMode(body.projectMode);
    trackProjectId = typeof body.projectId === "string" ? body.projectId : undefined;
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      trackUserId = user?.id ?? undefined;
    } catch {
      /* 계측용 조회 실패 무시 */
    }
    // 견적 요청 계측 (fire-and-forget)
    trackServerEventAsync({
      eventName: AnalyticsEvents.EstimateRequested,
      actorType: trackUserId ? "consumer" : "anonymous",
      userId: trackUserId,
      projectId: trackProjectId,
      projectMode: trackMode,
      source: "api",
      props: {
        hasContextId: typeof body.contextId === "string" && body.contextId.length > 0,
      },
    });
    /** 견적 생성 성공 계측 — 각 성공 반환 지점에서 호출 */
    const trackGenerated = (engine: string, extraProps: Record<string, unknown> = {}) => {
      trackServerEventAsync({
        eventName: AnalyticsEvents.EstimateGenerated,
        actorType: trackUserId ? "consumer" : "anonymous",
        userId: trackUserId,
        projectId: trackProjectId,
        projectMode: trackMode,
        source: "api",
        props: { engine, ...extraProps },
      });
    };

    // P2: contextId가 있으면 estimate_contexts에서 evidence 스냅샷을 읽어 견적 생성.
    //   - design_outputs.material_hints 기반 surfaces 합성
    //   - 사용자 자재 선택 / vision 분석 결과를 우선 반영
    //   - rooms/zones 입력은 무시하고 context를 truth로 사용
    // P7: estimateVersion="construction_trade_v2" 명시 또는 기본 v2 사용 시 17공종 엔진 실행
    if (typeof body.contextId === "string" && body.contextId.length > 0) {
      const useV2 = body.estimateVersion !== "legacy_surface";
      if (useV2) {
        const v2Result = await buildConstructionEstimateFromContextId(body.contextId);
        if (v2Result) {
          trackGenerated("construction_trade_v2", { contextId: body.contextId });
          return NextResponse.json(v2Result);
        }
      }
      const ctxResult = await buildEstimateFromContext(body.contextId);
      if (ctxResult) {
        trackGenerated("context_v1", { contextId: body.contextId });
        return NextResponse.json(ctxResult);
      }
      // context 조회 실패 → 기존 분기로 폴백 (워크플로 막지 않음)
    }

    // ─── projectMode 분기 (MD §10) ────────────────────────────
    if (body.projectMode === "photo_only") {
      const res = buildPhotoOnlyEstimate(body);
      trackGenerated("photo_only_rough");
      return res;
    }
    if (body.projectMode === "commercial") {
      // scopeSpec 우선 — CommercialScopeSpec 기반 line item 견적 (정확)
      if (body.scopeSpec) {
        try {
          const { buildCommercialEstimateFromScope } = await import(
            "@/lib/inpick/commercial/estimate-from-scope"
          );
          const result = buildCommercialEstimateFromScope(body.scopeSpec);
          trackGenerated("commercial_scope");
          return NextResponse.json(result);
        } catch (err) {
          console.error("[build-estimate] scope-based estimate failed:", err);
          // 폴백으로 기존 zone × 업종 단가 가견적
        }
      }
      // 폴백 (scope 없을 때) — 기존 zone × 단가
      const res = buildCommercialEstimate(body);
      trackGenerated("commercial_zone_rough");
      return res;
    }

    const { rooms, visionAnalysisByRoom: visionAnalysisByRoomFromBody } = body as {
      rooms: Array<{
        roomName: string;
        // RoomDim — 호출자가 전달하는 dim (estimate.ts 타입)
        dim: { name?: string; widthMm: number; depthMm: number; heightMm?: number };
        renderImageUrl?: string;
        surfaces?: MaterialItem[];
      }>;
      /** Phase 6 후속: vision-materials 분석 결과 (선택) — roomName → AnalyzedSurface[] */
      visionAnalysisByRoom?: Record<string, AnalyzedSurface[]>;
    };
    // P0: rooms 비어있으면 차단하지 않음 — 평수 기반 표준 방 셋으로 폴백
    //  (한 방이라도 이미지가 있거나 사용자 자재 선택이 있으면 그것만 계상)
    const fallbackRoomsFromArea = !Array.isArray(rooms) || rooms.length === 0
      ? buildFallbackRoomsFromArea(body)
      : null;
    const effectiveRooms = fallbackRoomsFromArea ?? rooms;
    const blockingWarnings: string[] = [];
    if (fallbackRoomsFromArea) {
      blockingWarnings.push(
        "Step1에서 방을 선택하지 않아 평수 기반 표준 방 셋(거실/주방/안방/욕실)으로 산출했습니다.",
      );
    }
    // 정책 변경: OpenAI 키 없어도 표준 자재로 견적 생성 가능 (vision 자재 추출만 실패)
    const visionAvailable = hasOpenAIKey();

    // P5: design_outputs DB에서 materialHints를 가져와 visionAnalysisByRoom으로 자동 보강.
    //   - contextId 경로가 실패해도, 인증 OK + projectId 있으면 evidence 그대로 활용
    //   - body의 visionAnalysisByRoom과 병합 (body 우선)
    const visionAnalysisByRoom = await mergeWithDesignOutputs(
      visionAnalysisByRoomFromBody,
      body.projectId as string | undefined,
    );

    const estimates: RoomEstimate[] = [];
    const fallbackRooms: Array<{ roomName: string; reason: string }> = [];
    const errors: Array<{ roomName: string; error: string }> = [];
    const matchMetaByRoom: Record<string, EstimateLineMaterialMeta[]> = {};

    for (const r of effectiveRooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];
      const usedSources: string[] = [];

      // ─── 1순위: visionAnalysisByRoom (Phase 6 후속 통합) ───
      const visionRoomResult = visionAnalysisByRoom?.[r.roomName];
      if (visionRoomResult && visionRoomResult.length > 0 && (!surfaces || surfaces.length === 0)) {
        const visionSurfaces = visionAnalysisToSurfaces(visionRoomResult);
        if (visionSurfaces.length > 0) {
          surfaces = visionSurfaces;
          usedSources.push("vision-materials");
        }
      }

      // ─── 2순위: extractMaterialsFromRender (legacy vision 추출) ───
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl && visionAvailable) {
        try {
          surfaces = await extractMaterialsFromRender({
            renderImageUrl: r.renderImageUrl,
            roomName: r.roomName,
            dim: {
            name: r.dim.name || r.roomName,
            widthMm: r.dim.widthMm,
            depthMm: r.dim.depthMm,
            heightMm: r.dim.heightMm ?? 2400,
          },
          });
          if (surfaces.length > 0) usedSources.push("legacy-vision");
        } catch (e) {
          errors.push({
            roomName: r.roomName,
            error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          });
          // 에러 발생 → 표준 자재로 fallback (방 skip 안 함)
        }
      }

      // ─── 3순위 Fallback: 표준 자재 ───
      if (!surfaces || surfaces.length === 0) {
        surfaces = defaultSurfacesForRoom(r.roomName);
        usedSources.push("standard-default");
        fallbackRooms.push({
          roomName: r.roomName,
          reason: !r.renderImageUrl
            ? "이미지 없음 — 표준 자재로 산출"
            : !visionAvailable
              ? "Vision 미사용 — 표준 자재로 산출"
              : "Vision 실패 — 표준 자재로 산출",
        });
      }

      // ─── brand/SKU 매칭 (material_products 253K rows) ───
      // vision-materials 결과 + legacy + fallback 모두에 적용. brand/sku 이미 있으면 skip.
      surfaces = await enrichWithBrandSku(surfaces, r.roomName);

      // ─── EstimateLineMaterialMeta 추출 (PDF/UI 표시용) ───
      matchMetaByRoom[r.roomName] = surfaces.map((s) => {
        const fromVision =
          visionRoomResult?.find((a) => surfaceTypeToKorean(a.observation.surfaceType) === s.surface);
        const status = fromVision?.recommendation.status === "confirmed"
          ? "confirmed"
          : fromVision?.recommendation.status === "recommended"
            ? "recommended"
            : s.brand
              ? "recommended"
              : "fallback";
        // surface 필드 함께 반환 — UI에서 자재 행과 매칭하는 키로 사용
        return {
          surface: s.surface,
          materialProductId: fromVision?.candidates[0]?.materialProductId,
          brand: s.brand,
          productName: s.materialName,
          sku: s.sku,
          spec: s.spec,
          unit: s.unit,
          unitPrice: s.unitPriceWon,
          priceSource: s.priceSource,
          matchStatus: status,
          confidence: fromVision?.recommendation.confidence ?? s.confidence,
          fallbackReason: fromVision?.recommendation.fallbackReason,
          observationId: fromVision?.observation.id,
        } as EstimateLineMaterialMeta & { surface: string };
      });

      estimates.push(
        buildRoomEstimate({
          roomName: r.roomName,
          dim: {
            name: r.dim.name || r.roomName,
            widthMm: r.dim.widthMm,
            depthMm: r.dim.depthMm,
            heightMm: r.dim.heightMm ?? 2400,
          },
          surfaces,
        }),
      );
    }

    const grand = estimates.reduce(
      (acc, e) => ({
        mainTotal: acc.mainTotal + e.mainTotalWon,
        auxTotal: acc.auxTotal + e.auxTotalWon,
        laborTotal: acc.laborTotal + e.laborTotalWon,
        totalWon: acc.totalWon + e.totalWon,
      }),
      { mainTotal: 0, auxTotal: 0, laborTotal: 0, totalWon: 0 },
    );

    trackGenerated("legacy_surface", {
      roomCount: estimates.length,
      fallbackRoomCount: fallbackRooms.length,
      totalWon: grand.totalWon,
    });

    return NextResponse.json({
      estimates,
      grandTotal: grand,
      fallbackRooms,            // 표준 자재 적용된 방 (사용자 안내용)
      skippedRooms: [],         // 호환 — 더 이상 skip 안 함
      errors,
      warnings: blockingWarnings,
      quotationType: blockingWarnings.length > 0 ? "rough_estimate" : "design_based_estimate",
      // Phase 6 후속 — vision-materials 메타 (UI에서 [확정]/[추천]/[기본] 표시)
      matchMetaByRoom,
    });
  } catch (e) {
    // 견적 실패 계측 (fire-and-forget)
    trackServerEventAsync({
      eventName: AnalyticsEvents.EstimateFailed,
      actorType: trackUserId ? "consumer" : "anonymous",
      userId: trackUserId,
      projectId: trackProjectId,
      projectMode: trackMode,
      source: "api",
      props: { error: (e instanceof Error ? e.message : String(e)).slice(0, 200) },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/* ─── photo_only / commercial 가견적 (MD §10-3, §10-4) ─────────────────
 * 17공종 정밀 견적이 불가능한 모드를 위한 단순화된 견적.
 * UI에 "현장 실측 필요" 안내 함께 표시. */

const PHOTO_ONLY_UNIT_PRICE_BY_GRADE_PER_PYEONG: Record<"basic" | "standard" | "premium", number> = {
  basic: 600_000,
  standard: 900_000,
  premium: 1_500_000,
};

const PYEONG_TO_M2 = 3.305785;

function buildPhotoOnlyEstimate(body: Record<string, unknown>) {
  const areaM2 = Number(body.areaM2 ?? body.totalAreaM2 ?? 0);
  let pyung = Number(body.pyung ?? (areaM2 ? areaM2 / PYEONG_TO_M2 : 0));
  const tier: "basic" | "standard" | "premium" =
    (body.budgetTier as "basic" | "standard" | "premium") ?? "standard";

  // P0: 면적 누락 시 차단하지 않고 기본 24평으로 폴백 + 경고 안내
  const warnings: string[] = [];
  if (!pyung || pyung <= 0) {
    pyung = 24;
    warnings.push(
      "면적 정보가 없어 기본 24평(약 79.3㎡)으로 가견적을 산출했습니다. 정확한 견적은 면적을 입력해주세요.",
    );
  }
  const unitPricePerPyeong = PHOTO_ONLY_UNIT_PRICE_BY_GRADE_PER_PYEONG[tier];
  const directCost = Math.round(pyung * unitPricePerPyeong);
  const indirect = Math.round(directCost * 0.06); // 관리비 6%
  const profit = Math.round((directCost + indirect) * 0.05); // 이윤 5%
  const subtotal = directCost + indirect + profit;
  const vat = Math.round(subtotal * 0.1);
  const grandTotalWon = subtotal + vat;

  return NextResponse.json({
    mode: "photo_only",
    quotationType: "rough_estimate",
    pyung,
    areaM2: pyung * PYEONG_TO_M2,
    budgetTier: tier,
    unitPricePerPyeongWon: unitPricePerPyeong,
    breakdown: {
      directCostWon: directCost,
      indirectCostWon: indirect,
      profitWon: profit,
      vatWon: vat,
    },
    grandTotalWon,
    warnings,
    disclaimerKo:
      "사진 기반 가견적입니다. 정확한 견적은 현장 실측, 철거 범위, 설비 상태, 선택 자재에 따라 달라질 수 있습니다.",
  });
}

type CommercialBusinessKey =
  | "cafe"
  | "restaurant"
  | "retail"
  | "beauty_salon"
  | "clinic"
  | "academy"
  | "office"
  | "gym"
  | "bakery"
  | "bar"
  | "studio"
  | "other_commercial";

type CommercialZoneKey =
  | "main_hall"
  | "counter"
  | "kitchen"
  | "storage"
  | "restroom"
  | "treatment_room"
  | "fitting_room"
  | "office_room"
  | "front_facade"
  | "signage"
  | "corridor"
  | "other";

// 업종 × zone 단가 (원/평) — 임시값. KPA/조달청 기준은 P3에서 보강.
const COMMERCIAL_UNIT_PRICE_PER_PYEONG: Record<
  CommercialBusinessKey,
  Partial<Record<CommercialZoneKey, number>>
> = {
  cafe: {
    main_hall: 1_100_000,
    counter: 1_500_000,
    kitchen: 1_800_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_500_000,
    corridor: 700_000,
    other: 900_000,
  },
  restaurant: {
    main_hall: 1_000_000,
    counter: 1_400_000,
    kitchen: 2_200_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_500_000,
    corridor: 700_000,
    other: 900_000,
  },
  retail: {
    main_hall: 900_000,
    counter: 1_200_000,
    storage: 500_000,
    fitting_room: 1_000_000,
    front_facade: 1_500_000,
    signage: 1_500_000,
    corridor: 600_000,
    other: 800_000,
  },
  beauty_salon: {
    main_hall: 1_000_000,
    counter: 1_200_000,
    treatment_room: 1_300_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 900_000,
  },
  clinic: {
    main_hall: 1_100_000,
    counter: 1_400_000,
    treatment_room: 1_600_000,
    storage: 600_000,
    restroom: 2_000_000,
    front_facade: 1_300_000,
    signage: 1_400_000,
    corridor: 800_000,
    other: 900_000,
  },
  academy: {
    office_room: 900_000,
    main_hall: 800_000,
    restroom: 1_500_000,
    storage: 400_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 600_000,
    other: 700_000,
  },
  office: {
    office_room: 800_000,
    main_hall: 700_000,
    counter: 1_000_000,
    storage: 400_000,
    restroom: 1_500_000,
    front_facade: 1_000_000,
    signage: 900_000,
    corridor: 600_000,
    other: 700_000,
  },
  gym: {
    main_hall: 900_000,
    treatment_room: 1_100_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_200_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 800_000,
  },
  bakery: {
    main_hall: 1_100_000,
    counter: 1_500_000,
    kitchen: 2_000_000,
    restroom: 1_900_000,
    storage: 600_000,
    front_facade: 1_200_000,
    signage: 1_400_000,
    corridor: 700_000,
    other: 900_000,
  },
  bar: {
    main_hall: 1_300_000,
    counter: 1_700_000,
    kitchen: 1_900_000,
    restroom: 2_000_000,
    storage: 600_000,
    front_facade: 1_400_000,
    signage: 1_600_000,
    corridor: 800_000,
    other: 1_000_000,
  },
  studio: {
    main_hall: 1_100_000,
    storage: 500_000,
    restroom: 1_700_000,
    front_facade: 1_200_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 900_000,
  },
  other_commercial: {
    main_hall: 900_000,
    counter: 1_100_000,
    storage: 500_000,
    restroom: 1_800_000,
    front_facade: 1_100_000,
    signage: 1_300_000,
    corridor: 700_000,
    other: 800_000,
  },
};

// 설비 가산 (1식 정액, 만원)
const SYSTEM_SURCHARGE_WON: Record<string, number> = {
  water_supply: 500_000,
  drainage: 500_000,
  ventilation: 800_000,
  kitchen_exhaust: 1_500_000,
  electrical_upgrade: 1_000_000,
  fire_sprinkler: 1_200_000,
  soundproofing: 1_500_000,
  signage: 1_000_000,
  gas: 800_000,
  hvac: 1_200_000,
};

function buildCommercialEstimate(body: Record<string, unknown>) {
  const businessType = (body.businessType as CommercialBusinessKey) || "other_commercial";
  const tier: "basic" | "standard" | "premium" =
    (body.budgetTier as "basic" | "standard" | "premium") ?? "standard";
  let zones = (body.zones as Array<{
    id?: string;
    nameKo?: string;
    type?: CommercialZoneKey;
    areaM2?: number;
    requiredSystems?: string[];
  }>) || [];
  const requiredSystems = (body.requiredSystems as string[]) || [];
  const inputTotalAreaM2 = Number(body.totalAreaM2 ?? body.areaM2 ?? 0);

  // P0: zones 누락 시 차단하지 않고 업종 기본 zone 셋 + 면적 추정으로 폴백
  const warnings: string[] = [];
  if (zones.length === 0) {
    const fallbackTotalAreaM2 = inputTotalAreaM2 > 0 ? inputTotalAreaM2 : 100;
    const zoneTypes: CommercialZoneKey[] = ["main_hall", "counter", "kitchen", "restroom"];
    zones = zoneTypes.map((t) => ({
      id: t,
      nameKo: t,
      type: t,
      areaM2: fallbackTotalAreaM2 / zoneTypes.length,
    }));
    warnings.push(
      `zone 정보가 없어 업종 기본 zone 셋(${zoneTypes.join("/")})으로 가견적을 산출했습니다. 정확한 견적은 zone을 구성해주세요.`,
    );
  }

  const tierMultiplier = { basic: 0.8, standard: 1.0, premium: 1.4 }[tier] || 1.0;
  const businessPrices = COMMERCIAL_UNIT_PRICE_PER_PYEONG[businessType] || {};

  const zoneEstimates = zones.map((z) => {
    const areaM2 = Number(z.areaM2 || 0);
    const pyung = areaM2 / PYEONG_TO_M2;
    const zoneType: CommercialZoneKey = z.type || "other";
    const basePerPyeong = businessPrices[zoneType] ?? businessPrices.other ?? 900_000;
    const directWon = Math.round(pyung * basePerPyeong * tierMultiplier);
    return {
      id: z.id,
      nameKo: z.nameKo,
      type: zoneType,
      areaM2,
      pyung,
      unitPricePerPyeongWon: Math.round(basePerPyeong * tierMultiplier),
      directCostWon: directWon,
    };
  });
  const zonesDirectCost = zoneEstimates.reduce((s, z) => s + z.directCostWon, 0);

  const systemSurchargeWon = requiredSystems.reduce(
    (s, k) => s + (SYSTEM_SURCHARGE_WON[k] ?? 0),
    0,
  );

  const directCost = zonesDirectCost + systemSurchargeWon;
  const indirect = Math.round(directCost * 0.06);
  const profit = Math.round((directCost + indirect) * 0.05);
  const subtotal = directCost + indirect + profit;
  const vat = Math.round(subtotal * 0.1);
  const grandTotalWon = subtotal + vat;

  const totalAreaM2 = zones.reduce((s, z) => s + Number(z.areaM2 || 0), 0);

  return NextResponse.json({
    mode: "commercial",
    quotationType: "rough_estimate",
    businessType,
    budgetTier: tier,
    totalAreaM2,
    totalPyung: totalAreaM2 / PYEONG_TO_M2,
    zones: zoneEstimates,
    requiredSystems,
    breakdown: {
      zonesDirectCostWon: zonesDirectCost,
      systemSurchargeWon,
      directCostWon: directCost,
      indirectCostWon: indirect,
      profitWon: profit,
      vatWon: vat,
    },
    grandTotalWon,
    warnings,
    disclaimerKo:
      "상가/사무실 가견적입니다. 정확한 견적은 업종별 설비 사양, 소방·환기·전기 증설 범위, 자재 등급에 따라 달라질 수 있어 현장 실측이 필요합니다.",
  });
}
