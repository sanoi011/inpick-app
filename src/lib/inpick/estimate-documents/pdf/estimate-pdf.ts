/**
 * A4 가로 견적서 PDF — 4페이지 단일 진입.
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §7
 *
 * 페이지 순서:
 *   1. 갑지 (cover)
 *   2. 총괄표 (cost-summary)
 *   3. 총괄내역서 (trade-summary)
 *   4. 공종별내역서 (trade-detail — 다중 페이지 가능)
 */
import jsPDF from "jspdf";
import type { EstimateDocumentPackage } from "../types";
import { PAGE, loadNanumGothicFont, fmtWon, fmtDate, truncate, fmtQuantity } from "./format";

export async function renderEstimatePackagePdf(input: {
  package: EstimateDocumentPackage;
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
