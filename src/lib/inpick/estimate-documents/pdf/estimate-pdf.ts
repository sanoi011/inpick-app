/**
 * A4 가로 견적서 PDF — 7페이지 양식 (P13-1 확장).
 *
 * 가이드:
 *   - inpick-construction-estimate-drawing-package-plan-20260511.md §7
 *   - inpick-estimate-v2-product-price-pdf-fix-plan-20260513.md §8 — 자재집계표 분리
 *
 * 페이지 순서:
 *   1. 갑지 (cover)
 *   2. 총괄표 (cost-summary)
 *   3. 총괄내역서 (trade-summary)
 *   4. 공종별내역서 (trade-detail — 다중 페이지 가능, 작업 중심)
 *   5. 자재집계표 (material-summary — 제조사/SKU/단가출처 분리)        [P13-1 신규]
 *   6. 산출근거서 (computation-basis — DB확정/카테고리/표준 비율)      [P13-1 신규]
 *   7. 특기사항·제외사항 (assumptions-exclusions)                         [P13-1 신규]
 */
import jsPDF from "jspdf";
import type { EstimateDocumentPackage } from "../types";
import { PAGE, loadNanumGothicFont, fmtWon, fmtDate, truncate, fmtQuantity } from "./format";
import {
  drawSchedulePage,
  drawStandardContractPages,
  drawDesignImagePages,
  type DesignImageInput,
} from "./pages-extra";

export async function renderEstimatePackagePdf(input: {
  package: EstimateDocumentPackage;
  /** 프로젝트 AI 디자인 이미지 — 부록 페이지로 첨부 (2026-07-04 확장) */
  designImages?: DesignImageInput[];
}): Promise<{ pdfBlob: Blob; pageCount: number }> {
  const pkg = input.package;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // 한국어 폰트 (browser 환경에서만 fetch — server-side는 별도 처리 필요)
  if (typeof window !== "undefined") {
    await loadNanumGothicFont(doc);
  }

  // ─── 1. 갑지 ───
  drawCoverPage(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 2. 총괄표 ───
  drawCostSummaryPage(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 3. 총괄내역서 ───
  drawTradeSummaryPage(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 4. 공종별내역서 ───
  drawTradeDetailPages(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 5. 자재집계표 (P13-1 신규) ───
  drawMaterialSummaryPages(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 6. 산출근거서 (P13-1 신규) ───
  drawComputationBasisPage(doc, pkg);
  doc.addPage("a4", "landscape");

  // ─── 7. 특기사항/제외사항 (P13-1 신규) ───
  drawAssumptionsExclusionsPage(doc, pkg);

  // ─── 8. 공정 순서·선행공정 분석 (2026-07-04 확장) ───
  doc.addPage("a4", "landscape");
  drawSchedulePage(doc, pkg);

  // ─── 9. 공정위 표준계약서 양식 (참고용 — 업체 매칭 시 상세 계약서 별도 제공) ───
  doc.addPage("a4", "landscape");
  drawStandardContractPages(doc, pkg);

  // ─── 10+. AI 디자인 이미지 부록 ───
  if (input.designImages && input.designImages.length > 0) {
    await drawDesignImagePages(doc, input.designImages);
  }

  // 페이지 번호 + footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, pkg, i, total);
  }

  const pdfBlob = doc.output("blob");
  return { pdfBlob, pageCount: total };
}

// ─── 1. 갑지 ───
function drawCoverPage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(22);
  doc.text("공 사 견 적 서", PAGE.width / 2, 25, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("NanumGothic", "normal");
  doc.text(`${pkg.mode === "matched_contract" ? "(확정 계약본)" : pkg.mode === "contractor_bid" ? "(입찰용)" : "(미리보기)"}`, PAGE.width / 2, 31, { align: "center" });

  // 문서 메타 (상단 우측)
  const metaX = PAGE.width - 90;
  let metaY = 16;
  const drawMetaRow = (label: string, value: string) => {
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(7);
    doc.text(label, metaX, metaY);
    doc.text(value, metaX + 25, metaY);
    metaY += 4.5;
  };
  drawMetaRow("문서번호", pkg.documentNo);
  drawMetaRow("발행일", fmtDate(pkg.issuedAt));
  if (pkg.validUntil) drawMetaRow("유효기한", fmtDate(pkg.validUntil));
  drawMetaRow("버전", `V${String(pkg.version).padStart(2, "0")}`);
  drawMetaRow("상태", pkg.status);

  // 소비자/사업자 box
  let y = 50;
  drawPartyBox(doc, {
    title: "소비자",
    party: pkg.consumer,
    x: PAGE.marginX,
    y,
    width: 130,
  });
  drawPartyBox(doc, {
    title: pkg.contractor ? "사업자" : "사업자 (미선정)",
    party: pkg.contractor,
    x: PAGE.marginX + 140,
    y,
    width: 130,
  });
  y += 55;

  // 공사 개요
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.text("공사 개요", PAGE.marginX, y);
  y += 5;
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginX, y, PAGE.width - PAGE.marginX, y);
  y += 2;

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  const drawProjRow = (label: string, value: string) => {
    doc.text(label, PAGE.marginX + 2, y + 4);
    doc.text(value || "-", PAGE.marginX + 40, y + 4);
    y += 6;
  };
  drawProjRow("공사명", pkg.project.projectName);
  drawProjRow("공사주소", pkg.consumer.isMasked && pkg.project.addressMaskedText ? pkg.project.addressMaskedText : pkg.project.addressText);
  if (pkg.project.apartmentName) drawProjRow("단지", pkg.project.apartmentName);
  drawProjRow(
    "면적",
    `${pkg.project.exclusiveAreaM2?.toFixed(1) || "-"}㎡ (전용) / ${pkg.project.totalAreaM2?.toFixed(1) || "-"}㎡ (공급)`,
  );
  drawProjRow("확장 여부", pkg.project.expansionOption || "-");
  drawProjRow("공사범위", truncate(pkg.project.scopeSummary, 90));

  // 총 견적금액 (강조)
  y += 6;
  doc.setFillColor(240, 240, 250);
  doc.rect(PAGE.marginX, y, PAGE.width - PAGE.marginX * 2, 15, "F");
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(11);
  doc.text("총 견적금액 (VAT 포함)", PAGE.marginX + 4, y + 8);
  doc.setFontSize(14);
  doc.text(`${fmtWon(pkg.summary.totalAmount)} 원`, PAGE.width - PAGE.marginX - 4, y + 9, { align: "right" });
  y += 17;

  // 하단 문구
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const note =
    "본 견적서는 InPick 프로젝트 도면, 선택 자재, 물량산출 기준으로 작성되었습니다. " +
    "현장 실측, 추가 철거, 관리사무소 요구사항, 구조/설비 특이사항에 따라 금액이 변경될 수 있습니다.";
  doc.text(doc.splitTextToSize(note, PAGE.width - PAGE.marginX * 2), PAGE.marginX, y + 4);
  doc.setTextColor(0, 0, 0);
}

function drawPartyBox(
  doc: jsPDF,
  input: { title: string; party?: EstimateDocumentPackage["consumer"]; x: number; y: number; width: number },
) {
  const { title, party, x, y, width } = input;
  doc.setLineWidth(0.2);
  doc.rect(x, y, width, 50);
  doc.setFillColor(245, 245, 248);
  doc.rect(x, y, width, 6, "F");

  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(title, x + 2, y + 4);

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);

  if (!party) {
    doc.text("(미선정)", x + 2, y + 12);
    return;
  }

  let py = y + 11;
  const row = (label: string, value?: string) => {
    if (!value) return;
    doc.setTextColor(120, 120, 120);
    doc.text(label, x + 2, py);
    doc.setTextColor(40, 40, 40);
    doc.text(truncate(value, 35), x + 28, py);
    py += 4.5;
  };
  row("성명/상호", party.displayName);
  if (party.companyName && party.companyName !== party.displayName) row("회사명", party.companyName);
  if (party.ceoName) row("대표자", party.ceoName);
  if (party.businessRegistrationNo) row("사업자번호", party.businessRegistrationNo);
  if (party.phone) row("연락처", party.phone);
  if (party.email) row("이메일", party.email);
  if (party.address) row("주소", truncate(party.address, 50));
  if (party.licenseNo) row("등록번호", party.licenseNo);
}

// ─── 2. 총괄표 ───
function drawCostSummaryPage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("총 괄 표", PAGE.width / 2, 20, { align: "center" });

  const startY = 35;
  const colX = [PAGE.marginX + 5, PAGE.marginX + 100, PAGE.width - PAGE.marginX - 5];
  const rows: Array<{ label: string; amount: number; note?: string; bold?: boolean }> = [
    { label: "재료비", amount: pkg.summary.materialAmount, note: "자재/SKU/부자재 포함" },
    { label: "노무비", amount: pkg.summary.laborAmount, note: "17공종 노무 산출" },
    { label: "경비", amount: pkg.summary.expenseAmount, note: "폐기물/운반/기타" },
    { label: "직접공사비", amount: pkg.summary.directCost, note: "재료비 + 노무비 + 경비", bold: true },
    { label: "일반관리비 (6%)", amount: pkg.summary.indirectCost, note: "직접공사비 × 6%" },
    { label: "이윤 (5%)", amount: pkg.summary.profit, note: "직접공사비 × 5%" },
    { label: "공급가액", amount: pkg.summary.supplyAmount, bold: true },
    { label: "부가가치세 (10%)", amount: pkg.summary.vat, note: "공급가액 × 10%" },
    { label: "총 견적금액", amount: pkg.summary.totalAmount, bold: true },
  ];

  let y = startY;
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginX, y - 2, PAGE.width - PAGE.marginX, y - 2);

  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(9);
  doc.text("구분", colX[0], y + 4);
  doc.text("산식/비고", colX[1], y + 4);
  doc.text("금액 (원)", colX[2], y + 4, { align: "right" });
  y += 7;
  doc.line(PAGE.marginX, y - 1, PAGE.width - PAGE.marginX, y - 1);

  doc.setFont("NanumGothic", "normal");
  for (const r of rows) {
    if (r.bold) {
      doc.setFont("NanumGothic", "bold");
      doc.setFillColor(245, 245, 250);
      doc.rect(PAGE.marginX, y - 2, PAGE.width - PAGE.marginX * 2, 8, "F");
    } else {
      doc.setFont("NanumGothic", "normal");
    }
    doc.setFontSize(9);
    doc.text(r.label, colX[0], y + 4);
    doc.setFontSize(7);
    doc.text(r.note || "-", colX[1], y + 4);
    doc.setFontSize(9);
    doc.text(fmtWon(r.amount), colX[2], y + 4, { align: "right" });
    y += 8;
  }

  // 하단 안내
  y += 5;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("금액 단위: 원 / 단가 기준: material_price_lookup + 카탈로그 + KPA 표준", PAGE.marginX, y);
  doc.setTextColor(0, 0, 0);
}

// ─── 3. 총괄내역서 ───
function drawTradeSummaryPage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("총 괄 내 역 서", PAGE.width / 2, 18, { align: "center" });

  // 컬럼: 공종코드 / 공종명 / 재료비 / 노무비 / 경비 / 직접비 / 간접비 / 이윤 / 부가세 / 합계
  const cols = [
    { label: "코드", x: PAGE.marginX, w: 12 },
    { label: "공종명", x: PAGE.marginX + 12, w: 38 },
    { label: "재료비", x: PAGE.marginX + 50, w: 25, right: true },
    { label: "노무비", x: PAGE.marginX + 75, w: 25, right: true },
    { label: "경비", x: PAGE.marginX + 100, w: 22, right: true },
    { label: "직접비", x: PAGE.marginX + 122, w: 26, right: true },
    { label: "간접비", x: PAGE.marginX + 148, w: 22, right: true },
    { label: "이윤", x: PAGE.marginX + 170, w: 22, right: true },
    { label: "부가세", x: PAGE.marginX + 192, w: 22, right: true },
    { label: "합계", x: PAGE.marginX + 214, w: 32, right: true },
  ];
  let y = 30;
  doc.setLineWidth(0.2);
  doc.setFillColor(240, 240, 245);
  doc.rect(PAGE.marginX, y - 2, cols[cols.length - 1].x + cols[cols.length - 1].w - PAGE.marginX, 7, "F");
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(7);
  for (const c of cols) {
    const align = c.right ? "right" : "left";
    const tx = c.right ? c.x + c.w - 1 : c.x + 1;
    doc.text(c.label, tx, y + 3, { align });
  }
  y += 7;

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  for (const t of pkg.tradeSummaries) {
    doc.text(t.tradeCode, cols[0].x + 1, y + 4);
    doc.text(truncate(t.tradeName, 16), cols[1].x + 1, y + 4);
    doc.text(fmtWon(t.materialAmount), cols[2].x + cols[2].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.laborAmount), cols[3].x + cols[3].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.expenseAmount), cols[4].x + cols[4].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.directCost), cols[5].x + cols[5].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.indirectCost), cols[6].x + cols[6].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.profit), cols[7].x + cols[7].w - 1, y + 4, { align: "right" });
    doc.text(fmtWon(t.vat), cols[8].x + cols[8].w - 1, y + 4, { align: "right" });
    doc.setFont("NanumGothic", "bold");
    doc.text(fmtWon(t.totalAmount), cols[9].x + cols[9].w - 1, y + 4, { align: "right" });
    doc.setFont("NanumGothic", "normal");
    y += 6;
    doc.line(PAGE.marginX, y - 1, cols[cols.length - 1].x + cols[cols.length - 1].w, y - 1);
  }

  // 합계 행
  y += 2;
  doc.setFont("NanumGothic", "bold");
  doc.setFillColor(245, 245, 250);
  doc.rect(PAGE.marginX, y - 2, cols[cols.length - 1].x + cols[cols.length - 1].w - PAGE.marginX, 8, "F");
  doc.text("합계", cols[1].x + 1, y + 4);
  doc.text(fmtWon(pkg.summary.totalAmount), cols[9].x + cols[9].w - 1, y + 4, { align: "right" });
}

// ─── 4. 공종별내역서 ───
function drawTradeDetailPages(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("공 종 별 내 역 서", PAGE.width / 2, 18, { align: "center" });

  let y = 30;
  // 그룹화 (공종 코드별)
  const byTrade = new Map<string, typeof pkg.lines>();
  for (const l of pkg.lines) {
    if (!byTrade.has(l.tradeCode)) byTrade.set(l.tradeCode, []);
    byTrade.get(l.tradeCode)!.push(l);
  }
  const tradeCodes = Array.from(byTrade.keys()).sort();

  // 컬럼
  const cols = [
    { label: "No.", x: PAGE.marginX, w: 8, align: "right" as const },
    { label: "방/위치", x: PAGE.marginX + 8, w: 22 },
    { label: "품목", x: PAGE.marginX + 30, w: 50 },
    { label: "규격", x: PAGE.marginX + 80, w: 26 },
    { label: "단위", x: PAGE.marginX + 106, w: 10 },
    { label: "수량", x: PAGE.marginX + 116, w: 12, align: "right" as const },
    { label: "재료비단가", x: PAGE.marginX + 128, w: 22, align: "right" as const },
    { label: "재료비", x: PAGE.marginX + 150, w: 24, align: "right" as const },
    { label: "노무비", x: PAGE.marginX + 174, w: 24, align: "right" as const },
    { label: "경비", x: PAGE.marginX + 198, w: 20, align: "right" as const },
    { label: "합계", x: PAGE.marginX + 218, w: 30, align: "right" as const },
    { label: "브랜드/SKU", x: PAGE.marginX + 248, w: 26 },
  ];

  let no = 1;
  for (const code of tradeCodes) {
    const lines = byTrade.get(code)!;
    if (y > PAGE.height - 30) {
      doc.addPage("a4", "landscape");
      y = 20;
    }
    // 공종 헤더
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 235, 245);
    doc.rect(PAGE.marginX, y - 2, PAGE.width - PAGE.marginX * 2, 6, "F");
    doc.text(`[${code}] ${lines[0].tradeName}`, PAGE.marginX + 2, y + 2);
    y += 6;

    // 컬럼 헤더
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(6.5);
    doc.setFillColor(245, 245, 250);
    doc.rect(PAGE.marginX, y - 2, PAGE.width - PAGE.marginX * 2, 5, "F");
    for (const c of cols) {
      const tx = c.align === "right" ? c.x + c.w - 1 : c.x + 1;
      doc.text(c.label, tx, y + 2, { align: c.align || "left" });
    }
    y += 5;

    // 행
    doc.setFont("NanumGothic", "normal");
    doc.setFontSize(6.5);
    for (const l of lines) {
      if (y > PAGE.height - 12) {
        doc.addPage("a4", "landscape");
        y = 20;
      }
      doc.text(String(no), cols[0].x + cols[0].w - 1, y + 3, { align: "right" });
      doc.text(truncate(l.roomName || "-", 12), cols[1].x + 1, y + 3);
      doc.text(truncate(l.itemName, 28), cols[2].x + 1, y + 3);
      doc.text(truncate(l.spec || "-", 16), cols[3].x + 1, y + 3);
      doc.text(l.unit, cols[4].x + 1, y + 3);
      doc.text(fmtQuantity(l.quantity), cols[5].x + cols[5].w - 1, y + 3, { align: "right" });
      doc.text(fmtWon(l.materialUnitPrice), cols[6].x + cols[6].w - 1, y + 3, { align: "right" });
      doc.text(fmtWon(l.materialAmount), cols[7].x + cols[7].w - 1, y + 3, { align: "right" });
      doc.text(fmtWon(l.laborAmount), cols[8].x + cols[8].w - 1, y + 3, { align: "right" });
      doc.text(fmtWon(l.expenseAmount), cols[9].x + cols[9].w - 1, y + 3, { align: "right" });
      doc.setFont("NanumGothic", "bold");
      doc.text(fmtWon(l.totalAmount), cols[10].x + cols[10].w - 1, y + 3, { align: "right" });
      doc.setFont("NanumGothic", "normal");
      // 브랜드/SKU
      const brand = l.brand ? `${l.brand} / ${l.sku || "SKU없음"}` : "표준";
      doc.setFontSize(5.5);
      doc.text(truncate(brand, 18), cols[11].x + 1, y + 3);
      doc.setFontSize(6.5);
      no++;
      y += 5;
    }
    y += 3;
  }
}

// ─── 5. 자재집계표 (P13-1) — 제조사/브랜드/납품사/SKU/단가출처 분리 ───
function drawMaterialSummaryPages(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("자 재 집 계 표", PAGE.width / 2, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("NanumGothic", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "제조사 / 브랜드 / 납품사 / SKU / 규격 / 단가 출처 — 상품 중심 집계",
    PAGE.width / 2,
    24,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);

  // 자재 키별 그룹화 (brand + itemName + spec + unit)
  type MatRow = {
    category: string;
    brand?: string;
    manufacturer?: string;
    supplierName?: string;
    productName: string;
    sku?: string;
    spec?: string;
    unit: string;
    qty: number;
    amount: number;
    priceSource?: string;
    appliedAt?: string;
    matchStatus?: string;
    fallbackReason?: string;
  };
  const byMaterial = new Map<string, MatRow>();
  for (const l of pkg.lines) {
    if (!l.materialAmount || l.materialAmount <= 0) continue;
    const key = [l.brand ?? "", l.manufacturer ?? "", l.itemName, l.spec ?? "", l.unit].join("|");
    let row = byMaterial.get(key);
    if (!row) {
      row = {
        category: l.materialCategoryName || l.tradeName,
        brand: l.brand,
        manufacturer: l.manufacturer,
        supplierName: l.supplierName || l.vendorName,
        productName: l.productName || l.itemName,
        sku: l.sku || l.modelNo,
        spec: l.spec || l.productSpec,
        unit: l.unit,
        qty: 0,
        amount: 0,
        priceSource: l.priceSource,
        appliedAt: l.appliedAt,
        matchStatus: l.matchStatus,
        fallbackReason: l.fallbackReason,
      };
      byMaterial.set(key, row);
    }
    row.qty += l.quantity;
    row.amount += l.materialAmount;
  }
  const rows = Array.from(byMaterial.values()).sort((a, b) => b.amount - a.amount);

  // 컬럼 정의
  const cols = [
    { label: "No.", x: PAGE.marginX, w: 8, align: "right" as const },
    { label: "분류", x: PAGE.marginX + 8, w: 22 },
    { label: "자재명", x: PAGE.marginX + 30, w: 40 },
    { label: "제조사", x: PAGE.marginX + 70, w: 25 },
    { label: "납품사", x: PAGE.marginX + 95, w: 22 },
    { label: "SKU/모델", x: PAGE.marginX + 117, w: 22 },
    { label: "규격", x: PAGE.marginX + 139, w: 22 },
    { label: "단위", x: PAGE.marginX + 161, w: 8 },
    { label: "수량", x: PAGE.marginX + 169, w: 12, align: "right" as const },
    { label: "단가", x: PAGE.marginX + 181, w: 22, align: "right" as const },
    { label: "금액", x: PAGE.marginX + 203, w: 28, align: "right" as const },
    { label: "단가출처", x: PAGE.marginX + 231, w: 30 },
    { label: "적용일", x: PAGE.marginX + 261, w: 16 },
  ];

  let y = 30;
  // 컬럼 헤더
  const drawHeader = () => {
    doc.setFont("NanumGothic", "bold");
    doc.setFontSize(6.5);
    doc.setFillColor(24, 56, 95);
    doc.setTextColor(255, 255, 255);
    doc.rect(PAGE.marginX, y - 2, PAGE.width - PAGE.marginX * 2, 5.5, "F");
    for (const c of cols) {
      const tx = c.align === "right" ? c.x + c.w - 1 : c.x + 1;
      doc.text(c.label, tx, y + 2, { align: c.align || "left" });
    }
    doc.setTextColor(0, 0, 0);
    y += 5.5;
  };
  drawHeader();

  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(6.5);
  let no = 1;
  for (const r of rows) {
    if (y > PAGE.height - 12) {
      doc.addPage("a4", "landscape");
      y = 20;
      drawHeader();
      doc.setFont("NanumGothic", "normal");
      doc.setFontSize(6.5);
    }
    // 컬럼 값
    doc.text(String(no), cols[0].x + cols[0].w - 1, y + 3, { align: "right" });
    doc.text(truncate(r.category, 12), cols[1].x + 1, y + 3);
    const productLabel = r.brand ? `${r.brand} ${r.productName}` : r.productName;
    doc.text(truncate(productLabel, 22), cols[2].x + 1, y + 3);
    doc.text(truncate(r.manufacturer || "-", 14), cols[3].x + 1, y + 3);
    doc.text(truncate(r.supplierName || "-", 12), cols[4].x + 1, y + 3);
    doc.text(truncate(r.sku || "-", 12), cols[5].x + 1, y + 3);
    doc.text(truncate(r.spec || "-", 12), cols[6].x + 1, y + 3);
    doc.text(r.unit === "m2" ? "m²" : r.unit, cols[7].x + 1, y + 3);
    doc.text(fmtQuantity(r.qty), cols[8].x + cols[8].w - 1, y + 3, { align: "right" });
    const unitPrice = r.qty > 0 ? Math.round(r.amount / r.qty) : 0;
    doc.text(fmtWon(unitPrice), cols[9].x + cols[9].w - 1, y + 3, { align: "right" });
    doc.setFont("NanumGothic", "bold");
    doc.text(fmtWon(r.amount), cols[10].x + cols[10].w - 1, y + 3, { align: "right" });
    doc.setFont("NanumGothic", "normal");
    // 단가출처 — fallback이면 빨강
    if (r.priceSource === "kpa_standard" || r.priceSource === "category_standard") {
      doc.setTextColor(180, 60, 60);
    } else if (r.priceSource === "material_price_lookup" || r.priceSource === "contractor_price") {
      doc.setTextColor(30, 130, 80);
    }
    doc.text(truncate(priceSourceLabelKo(r.priceSource), 16), cols[11].x + 1, y + 3);
    doc.setTextColor(0, 0, 0);
    doc.text(r.appliedAt ? fmtDate(r.appliedAt) : "-", cols[12].x + 1, y + 3);
    no++;
    y += 5;
  }

  // 하단: 통계
  y += 5;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(8);
  doc.text("자재 총계", PAGE.marginX, y);
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(7);
  const totalQty = rows.length;
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const verified = rows.filter(
    (r) =>
      r.priceSource === "material_price_lookup" ||
      r.priceSource === "contractor_price" ||
      r.priceSource === "manual_override",
  ).length;
  const fallback = rows.filter(
    (r) => r.priceSource === "kpa_standard" || r.priceSource === "category_standard",
  ).length;
  doc.text(
    `자재 ${totalQty}건  ·  총 ${fmtWon(totalAmount)}  ·  DB 확정 ${verified}건  ·  표준 fallback ${fallback}건`,
    PAGE.marginX,
    y + 5,
  );
}

/** 단가출처 한국어 라벨 */
function priceSourceLabelKo(s?: string): string {
  const map: Record<string, string> = {
    manual_override: "사용자/사업자 확정",
    material_price_lookup: "물가협회 단가",
    material_price_observations: "최근 30일 평균",
    contractor_price: "납품사 단가",
    catalog_price: "카탈로그 단가",
    category_standard: "카테고리 표준",
    kpa_standard: "KPA 표준 fallback",
  };
  return s ? map[s] || s : "-";
}

// ─── 6. 산출근거서 (P13-1) ───
function drawComputationBasisPage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("산 출 근 거 서", PAGE.width / 2, 18, { align: "center" });

  let y = 32;
  doc.setFontSize(10);
  doc.text("1. 수량 산출 기준", PAGE.marginX, y);
  y += 6;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const basisLines = [
    "• 바닥면적: 도면 치수 기반 또는 평형 표준 (도면 없을 시 둘레 = 4 × √면적 근사)",
    "• 벽면적: 둘레 × 층고 (2.4m 기본) - 개구부 차감 (문 1.8㎡, 창 1.5㎡)",
    "• 천장면적: 바닥면적 동일",
    "• 걸레받이 둘레: 방 둘레",
    "• 손실률: 마루 5%, 벽지 5%, 타일 7% 적용 (단위 수량 × 1+wasteFactor)",
    "• 욕실/주방/발코니: 습식공간 방수 시공 자동 포함",
    "• 욕실 벽 노출률 0% (도배 X — 별도 타일 공정), 주방 55%, 드레스룸 70%, 발코니/다용도실 85%",
  ];
  for (const t of basisLines) {
    doc.text(t, PAGE.marginX + 2, y);
    y += 4.5;
  }
  doc.setTextColor(0, 0, 0);

  y += 6;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.text("2. 자재/단가 출처 분포", PAGE.marginX, y);
  y += 6;
  // 라인별 source 통계
  const sourceCounts: Record<string, { count: number; amount: number }> = {};
  for (const l of pkg.lines) {
    const key = l.priceSource || "미확정";
    if (!sourceCounts[key]) sourceCounts[key] = { count: 0, amount: 0 };
    sourceCounts[key].count++;
    sourceCounts[key].amount += l.totalAmount;
  }
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1].amount - a[1].amount);
  for (const [source, stat] of sortedSources) {
    const isDb = ["material_price_lookup", "contractor_price", "manual_override"].includes(source);
    if (isDb) doc.setTextColor(30, 130, 80);
    else if (source === "kpa_standard" || source === "category_standard") doc.setTextColor(180, 60, 60);
    doc.text(
      `• ${priceSourceLabelKo(source)} — ${stat.count}건, 금액 ${fmtWon(stat.amount)}`,
      PAGE.marginX + 2,
      y,
    );
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }

  y += 6;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.text("3. 간접비·관리비·이윤·VAT 적용", PAGE.marginX, y);
  y += 6;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const rateLines = [
    "• 간접비: 직접공사비 × 6%",
    "• 일반관리비: 직접공사비 × 4%",
    "• 이윤: (직접공사비 + 간접비 + 관리비) × 5%",
    "• 부가가치세: 공급가액 × 10%",
    "• 총액 = 직접공사비 + 간접비 + 관리비 + 이윤 + VAT",
  ];
  for (const t of rateLines) {
    doc.text(t, PAGE.marginX + 2, y);
    y += 4.5;
  }
  doc.setTextColor(0, 0, 0);
}

// ─── 7. 특기사항·제외사항 (P13-1) ───
function drawAssumptionsExclusionsPage(doc: jsPDF, pkg: EstimateDocumentPackage) {
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(14);
  doc.text("특 기 사 항 · 제 외 사 항", PAGE.width / 2, 18, { align: "center" });

  let y = 32;
  doc.setFontSize(10);
  doc.text("1. 견적 적용 가정 (Assumptions)", PAGE.marginX, y);
  y += 6;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const assumptions = pkg.assumptions && pkg.assumptions.length > 0
    ? pkg.assumptions
    : [
        "현장 실측 전 가견적입니다. 실제 시공 면적과 차이가 있을 수 있습니다.",
        "기존 마감 철거가 필요한 것으로 가정했습니다.",
        "기존 배관/전기 위치 유지 — 위치 이동 시 별도 추가 발생.",
        "도면 치수가 부족한 부위는 평형 표준치수 또는 면적 기반 추정입니다.",
      ];
  for (const t of assumptions) {
    const wrapped = doc.splitTextToSize(`• ${t}`, PAGE.width - PAGE.marginX * 2 - 4) as string[];
    for (const line of wrapped) {
      if (y > PAGE.height - 20) {
        doc.addPage("a4", "landscape");
        y = 20;
      }
      doc.text(line, PAGE.marginX + 2, y);
      y += 4.5;
    }
  }
  doc.setTextColor(0, 0, 0);

  y += 6;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.text("2. 제외 사항 (Exclusions)", PAGE.marginX, y);
  y += 6;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const exclusions = pkg.exclusions && pkg.exclusions.length > 0
    ? pkg.exclusions
    : [
        "구조 변경 (벽체 신설/철거, 슬라브 관통 등)",
        "누수/하자 보수 (현장 확인 후 별도 견적)",
        "도시가스 신설 또는 이설",
        "소방·인허가 관련 비용 (상가/사무실의 경우)",
        "사용자가 직접 구매한 자재 (자재비만 제외, 시공비는 포함)",
        "건물 외부 공사 (외벽/창호 교체 외)",
        "야간 작업/공휴일 작업 (별도 협의)",
      ];
  for (const t of exclusions) {
    const wrapped = doc.splitTextToSize(`• ${t}`, PAGE.width - PAGE.marginX * 2 - 4) as string[];
    for (const line of wrapped) {
      if (y > PAGE.height - 20) {
        doc.addPage("a4", "landscape");
        y = 20;
      }
      doc.text(line, PAGE.marginX + 2, y);
      y += 4.5;
    }
  }
  doc.setTextColor(0, 0, 0);

  y += 6;
  doc.setFont("NanumGothic", "bold");
  doc.setFontSize(10);
  doc.text("3. 견적 유효기간 및 변경 가능 조건", PAGE.marginX, y);
  y += 6;
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const validity = [
    `견적 유효기간: ${pkg.validUntil ? fmtDate(pkg.validUntil) : "발행일로부터 30일"}`,
    "현장 실측·도면 정밀 확인 후 자재 수량 5% 이내 조정 가능.",
    "자재 단가는 시공일 기준 시장 단가로 재확인 후 적용.",
    "사용자가 자재 등급(basic/standard/premium)을 변경하면 금액 재산정.",
    "사업자 입찰 또는 계약 시 본 견적은 참고 자료이며, 최종 금액은 계약서 기준.",
  ];
  for (const t of validity) {
    doc.text(`• ${t}`, PAGE.marginX + 2, y);
    y += 4.5;
  }
  doc.setTextColor(0, 0, 0);
}

// ─── Footer (모든 페이지) ───
function drawFooter(doc: jsPDF, pkg: EstimateDocumentPackage, page: number, total: number) {
  doc.setFont("NanumGothic", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  const y = PAGE.height - 4;
  doc.text(`${pkg.documentNo}  V${String(pkg.version).padStart(2, "0")}`, PAGE.marginX, y);
  doc.text(`InPick (인픽) · ${fmtDate(pkg.issuedAt)}`, PAGE.width / 2, y, { align: "center" });
  doc.text(`${page} / ${total}`, PAGE.width - PAGE.marginX, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
}
