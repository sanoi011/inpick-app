/**
 * Snapshot builder — build-estimate 결과 + party + project → EstimateDocumentPackage.
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §8-2
 */

import crypto from "node:crypto";
import type {
  BidPriceOverrides,
  EstimateDocumentLine,
  EstimateDocumentMode,
  EstimateDocumentPackage,
  EstimateDocumentSummary,
  EstimatePartySnapshot,
  ProjectScopeSnapshot,
  TradeSummaryRow,
} from "./types";
import { createEstimateDocumentNo } from "./document-number";
import { SITE_CONDITION_DOCUMENT_SUMMARY } from "@/lib/inpick/estimate-v2/site-condition-pricing";
import type { ConstructionEstimate } from "@/lib/inpick/estimate-v2/types";

export interface BuildSnapshotInput {
  projectId: string;
  rfqId?: string;
  bidId?: string;
  contractId?: string;
  contractorId?: string;
  mode: EstimateDocumentMode;
  project: ProjectScopeSnapshot;
  consumer: EstimatePartySnapshot;
  contractor?: EstimatePartySnapshot;
  inpick?: EstimatePartySnapshot;
  /** /api/inpick/build-estimate 응답을 그대로 받음 */
  buildEstimateResult?: {
    estimates?: Array<{
      roomName: string;
      items: Array<{
        surface: string;
        materialName: string;
        brand?: string;
        spec?: string;
        sku?: string;
        quantity: number;
        unit: string;
        unitPriceWon: number;
        subtotalWon: number;
        category: "main" | "aux" | "labor";
        priceSource?: string;
      }>;
      mainTotalWon?: number;
      auxTotalWon?: number;
      laborTotalWon?: number;
      totalWon?: number;
    }>;
    grandTotal?: { mainTotal: number; auxTotal: number; laborTotal: number; totalWon: number };
    matchMetaByRoom?: Record<
      string,
      Array<{ surface?: string; matchStatus?: string; confidence?: number; materialProductId?: string }>
    >;
  };
  bidOverrides?: BidPriceOverrides;
  /** 출시 후 입찰서 V02 등 */
  version?: number;
  // P13-1: v2 ConstructionEstimate 직접 전달 — PDF 자재집계표/산출근거서용
  //   있으면 buildEstimateResult.estimates 대신 이 lines 사용 (manufacturer/supplier/source 포함)
  constructionEstimate?: ConstructionEstimate;
}

/**
 * 17공종 코드 — 기존 TRADE_NAMES 참조 (필요 시 import)
 */
const TRADE_NAMES_FALLBACK: Record<string, string> = {
  "01": "철거공사",
  "02": "조적공사",
  "03": "미장공사",
  "04": "방수공사",
  "05": "타일공사",
  "06": "목공사",
  "07": "바닥재공사",
  "08": "도배공사",
  "09": "천장공사",
  "10": "창호공사",
  "11": "잡철공사",
  "12": "배관공사",
  "13": "위생도기공사",
  "14": "전기공사",
  "15": "고정설비공사",
  "16": "걸레받이공사",
  "17": "정리공사",
};

/**
 * MaterialItem surface → tradeCode 매핑 (간단 휴리스틱).
 */
function surfaceToTradeCode(surface: string, materialName: string): string {
  const s = surface.toLowerCase();
  const m = materialName.toLowerCase();
  if (s.includes("바닥") || s.includes("floor")) return "07";
  if (s.includes("벽") || s.includes("wall")) {
    if (m.includes("타일")) return "05";
    if (m.includes("도장") || m.includes("페인트")) return "03";
    return "08";
  }
  if (s.includes("천장") || s.includes("ceil")) return "09";
  if (s.includes("도어") || s.includes("문") || s.includes("door")) return "10";
  if (s.includes("창호") || s.includes("window")) return "10";
  if (s.includes("위생") || s.includes("toilet") || s.includes("sink")) return "13";
  if (s.includes("배관") || s.includes("plumb")) return "12";
  if (s.includes("조명") || s.includes("light") || s.includes("전기")) return "14";
  if (s.includes("fixture") || s.includes("싱크") || s.includes("주방")) return "15";
  if (s.includes("걸레") || s.includes("baseboard")) return "16";
  if (s.includes("타일")) return "05";
  return "17";
}

/**
 * Hash 생성 — scope/estimate/material 변경 감지용.
 */
export function createScopeHash(project: ProjectScopeSnapshot): string {
  const payload = JSON.stringify({
    projectId: project.projectId,
    propertyId: project.propertyId,
    addressText: project.addressText,
    totalAreaM2: project.totalAreaM2,
    expansionOption: project.expansionOption,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function createEstimateHash(lines: EstimateDocumentLine[]): string {
  const payload = JSON.stringify(
    lines.map((l) => ({
      tradeCode: l.tradeCode,
      itemName: l.itemName,
      quantity: l.quantity,
      totalAmount: l.totalAmount,
    })),
  );
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function createMaterialHash(lines: EstimateDocumentLine[]): string {
  const payload = JSON.stringify(
    lines
      .filter((l) => l.materialProductId)
      .map((l) => ({ pid: l.materialProductId, sku: l.sku })),
  );
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * 메인 builder.
 */
export function buildEstimateDocumentPackage(input: BuildSnapshotInput): EstimateDocumentPackage {
  const version = input.version ?? 1;
  const documentNo = createEstimateDocumentNo({
    projectId: input.projectId,
    mode: input.mode,
    version,
  });

  // 1. lines 변환
  const lines: EstimateDocumentLine[] = [];
  let lineIdCounter = 1;

  // P13-1: v2 ConstructionEstimate가 있으면 그 lines 우선 사용 (manufacturer/supplier/priceSource 포함)
  if (input.constructionEstimate?.lines && Array.isArray(input.constructionEstimate.lines)) {
    for (const l of input.constructionEstimate.lines) {
      const isSupportingWork = [
        "철거", "제거", "바탕", "면정리", "보수", "부자재", "방습", "접착",
        "폐기", "반출", "양중", "운반", "초배", "방수", "몰탈", "모르타르",
        "실리콘", "줄눈",
      ].some((keyword) => String(l.taskNameKo || "").includes(keyword));
      lines.push({
        id: `L${String(lineIdCounter++).padStart(4, "0")}`,
        tradeCode: String(l.tradeCode || "17"),
        tradeName: String(l.tradeNameKo || "기타공사"),
        roomName: l.roomName,
        // 원가내역 품명은 실제 작업명을 사용한다. 구 resolver가 바탕·철거 라인의
        // itemNameKo까지 최종 마감재명으로 덮어쓴 기존 견적도 문서 생성 시 복구한다.
        itemName: String(l.taskNameKo || l.itemNameKo || l.productName || "자재"),
        spec: isSupportingWork ? l.spec : l.productSpec || l.spec,
        unit: String(l.unit || "EA"),
        quantity: Number(l.quantity) || 0,
        materialUnitPrice: Number(l.materialUnitPrice) || 0,
        materialAmount: Number(l.materialAmount) || 0,
        laborUnitPrice: Number(l.laborUnitPrice) || 0,
        laborAmount: Number(l.laborAmount) || 0,
        expenseUnitPrice: Number(l.expenseUnitPrice) || 0,
        expenseAmount: Number(l.expenseAmount) || 0,
        totalAmount: Number(l.totalAmount) || 0,
        // P13: product/price meta — PDF 자재집계표용
        brand: isSupportingWork ? undefined : l.brand,
        productName: isSupportingWork ? undefined : l.productName,
        sku: isSupportingWork ? undefined : l.sku,
        materialProductId: isSupportingWork ? undefined : l.materialProductId,
        priceSource: isSupportingWork ? undefined : l.materialPriceSource,
        confidence: isSupportingWork ? undefined : l.priceConfidence,
        manufacturer: isSupportingWork ? undefined : l.manufacturer,
        supplierName: isSupportingWork ? undefined : l.supplierName,
        vendorName: isSupportingWork ? undefined : l.vendorName,
        modelNo: isSupportingWork ? undefined : l.modelNo,
        productSpec: isSupportingWork ? undefined : l.productSpec,
        materialCategoryName: isSupportingWork ? undefined : l.materialCategoryName,
        matchStatus: isSupportingWork ? undefined : l.productMatchStatus,
        fallbackReason: isSupportingWork ? undefined : l.fallbackReason,
        appliedAt: isSupportingWork ? undefined : l.materialPriceAppliedAt,
        calculationBasis: l.quantityFormulaKo,
      });
    }
  } else {
    // legacy 경로 — buildEstimateResult.estimates 사용
    const roomEstimates = input.buildEstimateResult?.estimates || [];
    for (const room of roomEstimates) {
      for (const item of room.items) {
        const tradeCode = surfaceToTradeCode(item.surface, item.materialName);
        const isMain = item.category === "main";
        const isLabor = item.category === "labor";
        const isAux = item.category === "aux";

        lines.push({
          id: `L${String(lineIdCounter++).padStart(4, "0")}`,
          tradeCode,
          tradeName: TRADE_NAMES_FALLBACK[tradeCode] || "기타공사",
          roomName: room.roomName,
          itemName: item.materialName,
          spec: item.spec,
          unit: item.unit,
          quantity: item.quantity,
          materialUnitPrice: isMain || isAux ? item.unitPriceWon : undefined,
          materialAmount: isMain || isAux ? item.subtotalWon : undefined,
          laborUnitPrice: isLabor ? item.unitPriceWon : undefined,
          laborAmount: isLabor ? item.subtotalWon : undefined,
          totalAmount: item.subtotalWon,
          brand: item.brand,
          sku: item.sku,
          priceSource: item.priceSource,
        });
      }
    }
  }

  // 2. summary 계산
  const grand = input.buildEstimateResult?.grandTotal || {
    mainTotal: 0,
    auxTotal: 0,
    laborTotal: 0,
    totalWon: 0,
  };
  const materialAmount = grand.mainTotal + grand.auxTotal;
  const laborAmount = grand.laborTotal;
  const expenseAmount = 0; // 현재 엔진은 별도 expense 컬럼 X
  const directCost = materialAmount + laborAmount + expenseAmount;
  const indirectCost = Math.round(directCost * 0.06);
  const profit = Math.round(directCost * 0.05);
  const supplyAmount = directCost + indirectCost + profit;
  const vat = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  const summary: EstimateDocumentSummary = {
    materialAmount,
    laborAmount,
    expenseAmount,
    directCost,
    indirectCost,
    profit,
    supplyAmount,
    vat,
    totalAmount,
  };

  // 3. trade summaries
  const tradeMap = new Map<string, TradeSummaryRow>();
  for (const l of lines) {
    let row = tradeMap.get(l.tradeCode);
    if (!row) {
      row = {
        tradeCode: l.tradeCode,
        tradeName: l.tradeName,
        materialAmount: 0,
        laborAmount: 0,
        expenseAmount: 0,
        directCost: 0,
        indirectCost: 0,
        profit: 0,
        vat: 0,
        totalAmount: 0,
      };
      tradeMap.set(l.tradeCode, row);
    }
    row.materialAmount += l.materialAmount || 0;
    row.laborAmount += l.laborAmount || 0;
    row.expenseAmount += l.expenseAmount || 0;
    row.totalAmount += l.totalAmount;
  }
  const tradeRows = Array.from(tradeMap.values());
  for (const row of tradeRows) {
    row.directCost = row.materialAmount + row.laborAmount + row.expenseAmount;
    row.indirectCost = Math.round(row.directCost * 0.06);
    row.profit = Math.round(row.directCost * 0.05);
    const sup = row.directCost + row.indirectCost + row.profit;
    row.vat = Math.round(sup * 0.1);
    row.totalAmount = sup + row.vat;
  }
  const tradeSummaries = tradeRows.sort((a, b) =>
    a.tradeCode.localeCompare(b.tradeCode),
  );

  // 4. assumptions / exclusions / warnings
  const appliedSiteConditions = Array.from(
    new Set(
      (input.constructionEstimate?.lines || [])
        .filter((line) => line.siteConditionAdjustmentReason)
        .map((line) => String(line.siteConditionAdjustmentReason)),
    ),
  );
  const siteConditionAssumptions = [
    SITE_CONDITION_DOCUMENT_SUMMARY,
    ...appliedSiteConditions.map((condition) => `사용자 현장조건 사전답변: ${condition}`),
    ...(input.mode === "contractor_bid"
      ? ["사업자 입찰 견적에서는 현장 확인 결과를 반영해 해당 공종의 수량·재료단가·노무단가를 수정할 수 있습니다."]
      : []),
  ];
  const assumptions = Array.from(new Set([
    "본 견적은 도면 기반 물량산출과 선택 자재 기준으로 작성되었습니다.",
    "현장 실측, 추가 철거, 관리사무소 요구사항, 구조/설비 특이사항에 따라 금액이 변경될 수 있습니다.",
    `금액 단위: 원 / 단가 기준: material_price_lookup + 카탈로그 + KPA 표준`,
    ...siteConditionAssumptions,
  ]));
  const exclusions = [
    "전기 인입공사, 가스 인입공사",
    "관할 관청 인허가 비용",
    "이사비, 보관비, 청소비 (별도 협의)",
  ];
  // 현장조건은 위 assumptions에 한 번만 정리한다. 라인별 variationNotice를
  // warnings에 다시 넣으면 PDF 특기사항에서 동일 장문이 반복된다.
  const warnings: string[] = [];
  // mock 자재 매칭 결과는 warning
  const matchMeta = input.buildEstimateResult?.matchMetaByRoom || {};
  for (const room of Object.keys(matchMeta)) {
    const fb = (matchMeta[room] || []).filter((m) => m.matchStatus === "fallback");
    if (fb.length > 0) {
      warnings.push(`${room}: ${fb.length}개 자재가 표준 기준으로 산출됨 — 실 자재 확인 필요`);
    }
  }

  return {
    id: "", // DB insert 후 채워짐
    documentNo,
    version,
    mode: input.mode,
    status: "draft",
    issuedAt: new Date().toISOString(),
    project: input.project,
    consumer: input.consumer,
    contractor: input.contractor,
    inpick: input.inpick,
    summary,
    tradeSummaries,
    lines,
    assumptions,
    exclusions,
    warnings,
    generatedBy: "system",
  };
}
