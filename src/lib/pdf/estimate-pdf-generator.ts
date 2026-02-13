/**
 * PDF 견적서 생성기
 * jsPDF + NanumGothic 한국어 폰트로 견적서 PDF 생성
 */
import { jsPDF } from "jspdf";
import type { RoomCostSection } from "@/components/project/CostTable";
import type { EstimateSummary } from "@/lib/floor-plan/quantity/estimate-calculator";

interface EstimatePdfOptions {
  sections: RoomCostSection[];
  grandTotal: number;
  totalMaterial: number;
  totalLabor: number;
  totalOverhead: number;
  engineSummary?: EstimateSummary | null;
  projectId: string;
  floorPlanArea?: number;
  roomCount?: number;
}

// ─── 폰트 캐시 ───
let fontLoaded = false;

async function loadKoreanFont(doc: jsPDF): Promise<boolean> {
  if (fontLoaded) return true;
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/NanumGothic-Regular.ttf"),
      fetch("/fonts/NanumGothic-Bold.ttf"),
    ]);
    if (!regularRes.ok || !boldRes.ok) return false;

    const regularBuf = await regularRes.arrayBuffer();
    const boldBuf = await boldRes.arrayBuffer();

    const regularB64 = arrayBufferToBase64(regularBuf);
    const boldB64 = arrayBufferToBase64(boldBuf);

    doc.addFileToVFS("NanumGothic-Regular.ttf", regularB64);
    doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");

    doc.addFileToVFS("NanumGothic-Bold.ttf", boldB64);
    doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");

    fontLoaded = true;
    return true;
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── 유틸 ───
function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

// ─── PDF 생성 ───
export async function generateEstimatePdf(options: EstimatePdfOptions): Promise<void> {
  const {
    sections,
    grandTotal,
    totalMaterial,
    totalLabor,
    totalOverhead,
    engineSummary,
    projectId,
    floorPlanArea,
    roomCount,
  } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const hasFont = await loadKoreanFont(doc);
  if (hasFont) {
    doc.setFont("NanumGothic", "normal");
  }

  const setFont = (style: "normal" | "bold", size: number) => {
    if (hasFont) doc.setFont("NanumGothic", style);
    doc.setFontSize(size);
  };

  const checkNewPage = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ─── 헤더 ───
  setFont("bold", 20);
  doc.setTextColor(30, 30, 60);
  doc.text("INPICK", margin, y + 7);

  setFont("normal", 8);
  doc.setTextColor(120, 120, 120);
  doc.text("AI Interior Estimation Platform", margin + 32, y + 7);

  // 날짜
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  doc.text(dateStr, pageW - margin, y + 7, { align: "right" });

  y += 12;
  doc.setDrawColor(30, 30, 60);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  // ─── 타이틀 ───
  y += 10;
  setFont("bold", 16);
  doc.setTextColor(30, 30, 60);
  doc.text("인테리어 공사 견적서", pageW / 2, y, { align: "center" });

  // ─── 프로젝트 정보 ───
  y += 10;
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");

  setFont("normal", 8);
  doc.setTextColor(100, 100, 100);

  const infoY = y + 7;
  doc.text("프로젝트", margin + 4, infoY);
  setFont("bold", 9);
  doc.setTextColor(30, 30, 60);
  doc.text(projectId.substring(0, 8).toUpperCase(), margin + 24, infoY);

  setFont("normal", 8);
  doc.setTextColor(100, 100, 100);
  doc.text("작성일", margin + 70, infoY);
  setFont("bold", 9);
  doc.setTextColor(30, 30, 60);
  doc.text(dateStr, margin + 86, infoY);

  if (floorPlanArea) {
    setFont("normal", 8);
    doc.setTextColor(100, 100, 100);
    doc.text("면적", margin + 4, infoY + 9);
    setFont("bold", 9);
    doc.setTextColor(30, 30, 60);
    doc.text(`${floorPlanArea}m²`, margin + 16, infoY + 9);
  }
  if (roomCount) {
    setFont("normal", 8);
    doc.setTextColor(100, 100, 100);
    doc.text("공간", margin + 70, infoY + 9);
    setFont("bold", 9);
    doc.setTextColor(30, 30, 60);
    doc.text(`${roomCount}개`, margin + 82, infoY + 9);
  }

  y += 28;

  // ─── 비용 요약 ───
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, "F");

  setFont("bold", 10);
  doc.setTextColor(255, 255, 255);
  doc.text("공사비 합계 (VAT 포함)", margin + 5, y + 8);

  setFont("bold", 16);
  doc.text(`${fmt(grandTotal)}원`, pageW - margin - 5, y + 10, { align: "right" });

  y += 12;
  setFont("normal", 7);
  doc.setTextColor(200, 220, 255);
  const perPyeong = floorPlanArea ? ` (평당 ${fmt(Math.round(grandTotal / (floorPlanArea / 3.3058)))})` : "";
  doc.text(`재료비 ${fmt(totalMaterial)} + 노무비 ${fmt(totalLabor)} + 경비 ${fmt(totalOverhead)}${perPyeong}`, margin + 5, y + 2);

  y += 14;

  // 상세 비용 분해 (엔진 결과가 있을 때)
  if (engineSummary) {
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, y, contentW, 32, 2, 2, "F");

    const colW = contentW / 3;
    const summaryItems = [
      { label: "직접 재료비", value: engineSummary.directMaterialCost },
      { label: "직접 노무비", value: engineSummary.directLaborCost },
      { label: `일반관리비 (${engineSummary.overheadRate}%)`, value: engineSummary.overheadAmount },
      { label: `이윤 (${engineSummary.profitRate}%)`, value: engineSummary.profitAmount },
      { label: `부가세 (${engineSummary.vatRate}%)`, value: engineSummary.vatAmount },
      { label: "공급가액", value: engineSummary.subtotal },
    ];

    for (let i = 0; i < summaryItems.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + 4 + col * colW;
      const sy = y + 6 + row * 13;

      setFont("normal", 7);
      doc.setTextColor(120, 120, 120);
      doc.text(summaryItems[i].label, x, sy);

      setFont("bold", 9);
      doc.setTextColor(30, 30, 60);
      doc.text(`${fmt(summaryItems[i].value)}원`, x, sy + 5);
    }

    y += 36;
  }

  // ─── 공간별/공종별 테이블 ───
  for (const section of sections) {
    // 섹션 헤더 (최소 30mm 필요)
    checkNewPage(40);

    // 섹션 헤더 바
    doc.setFillColor(45, 45, 60);
    doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");

    setFont("bold", 9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${section.roomName}  (${section.items.length}항목)`, margin + 4, y + 5.5);
    doc.text(`${fmt(section.subtotal)}원`, pageW - margin - 4, y + 5.5, { align: "right" });

    y += 10;

    // 테이블 헤더
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, y, contentW, 6, "F");

    setFont("bold", 6.5);
    doc.setTextColor(80, 80, 80);

    const cols = [
      { label: "구분", x: margin + 2, w: 20 },
      { label: "품명", x: margin + 22, w: 40 },
      { label: "규격", x: margin + 62, w: 25 },
      { label: "단위", x: margin + 87, w: 10 },
      { label: "수량", x: margin + 97, w: 15 },
      { label: "재료비", x: margin + 112, w: 22 },
      { label: "노무비", x: margin + 134, w: 22 },
      { label: "경비", x: margin + 156, w: 18 },
      { label: "합계", x: margin + 174, w: 0 },
    ];

    for (const col of cols) {
      const align = ["수량", "재료비", "노무비", "경비", "합계"].includes(col.label) ? "right" : "left";
      const tx = align === "right" ? col.x + col.w : col.x;
      doc.text(col.label, tx, y + 4, { align: align as "left" | "right" });
    }

    y += 7;

    // 데이터 행
    for (let i = 0; i < section.items.length; i++) {
      checkNewPage(7);

      const item = section.items[i];

      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 255);
        doc.rect(margin, y - 0.5, contentW, 5.5, "F");
      }

      setFont("normal", 6);
      doc.setTextColor(60, 60, 60);

      // 텍스트가 길면 잘라내기
      const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? text.substring(0, maxLen - 1) + ".." : text;

      doc.text(truncate(item.category, 8), cols[0].x, y + 3);

      setFont("bold", 6);
      doc.setTextColor(30, 30, 60);
      doc.text(truncate(item.productName, 16), cols[1].x, y + 3);

      setFont("normal", 6);
      doc.setTextColor(100, 100, 100);
      doc.text(truncate(item.spec, 10), cols[2].x, y + 3);

      doc.setTextColor(80, 80, 80);
      doc.text(item.unit, cols[3].x, y + 3);

      doc.setTextColor(30, 30, 60);
      doc.text(String(item.quantity), cols[4].x + cols[4].w, y + 3, { align: "right" });
      doc.text(fmt(item.materialCost), cols[5].x + cols[5].w, y + 3, { align: "right" });
      doc.text(fmt(item.laborCost), cols[6].x + cols[6].w, y + 3, { align: "right" });
      doc.text(fmt(item.overhead), cols[7].x + cols[7].w, y + 3, { align: "right" });

      setFont("bold", 6);
      doc.text(fmt(item.total), pageW - margin - 2, y + 3, { align: "right" });

      y += 5.5;
    }

    // 소계 행
    doc.setFillColor(235, 235, 245);
    doc.rect(margin, y, contentW, 6, "F");

    setFont("bold", 7);
    doc.setTextColor(30, 30, 60);
    doc.text("소계", margin + 60, y + 4, { align: "right" });

    const subMat = section.items.reduce((s, i) => s + i.materialCost, 0);
    const subLab = section.items.reduce((s, i) => s + i.laborCost, 0);
    const subOh = section.items.reduce((s, i) => s + i.overhead, 0);

    setFont("normal", 6.5);
    doc.text(fmt(subMat), cols[5].x + cols[5].w, y + 4, { align: "right" });
    doc.text(fmt(subLab), cols[6].x + cols[6].w, y + 4, { align: "right" });
    doc.text(fmt(subOh), cols[7].x + cols[7].w, y + 4, { align: "right" });

    setFont("bold", 7);
    doc.setTextColor(37, 99, 235);
    doc.text(fmt(section.subtotal), pageW - margin - 2, y + 4, { align: "right" });

    y += 10;
  }

  // ─── 총합계 ───
  checkNewPage(25);
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, "F");

  setFont("bold", 10);
  doc.setTextColor(255, 255, 255);
  doc.text("공사비 합계", margin + 5, y + 8);
  setFont("bold", 14);
  doc.text(`${fmt(grandTotal)}원`, pageW - margin - 5, y + 8, { align: "right" });

  y += 18;

  // ─── 산출 기준 + 주의사항 ───
  checkNewPage(40);
  setFont("bold", 8);
  doc.setTextColor(80, 80, 80);
  doc.text("산출 기준", margin, y + 4);
  y += 7;

  setFont("normal", 6.5);
  doc.setTextColor(120, 120, 120);
  const notes = engineSummary
    ? [
        "17개 공종 정밀 물량산출 엔진 적용",
        "단가: 2025년 서울 실거래 기준",
        `일반관리비: 직접공사비 x ${engineSummary.overheadRate}%`,
        `이윤: (직접공사비+관리비) x ${engineSummary.profitRate}%`,
        `부가세: 공급가액 x ${engineSummary.vatRate}%`,
        "할증률: 공종별 자재 로스 반영",
      ]
    : [
        "단가: 2025년 물가정보 기준",
        "노무비: 자재비 x 카테고리별 비율",
        "경비: (재료비+노무비) x 10%",
        "VAT 별도, 부대비용 별도",
      ];

  for (const note of notes) {
    doc.text(`- ${note}`, margin + 2, y + 3);
    y += 4;
  }

  y += 4;
  doc.setFillColor(255, 248, 230);
  doc.roundedRect(margin, y, contentW, 10, 1, 1, "F");
  setFont("normal", 6);
  doc.setTextColor(180, 130, 40);
  doc.text("※ 본 견적은 참고 금액이며, 실제 시공 시 현장 상황에 따라 변동됩니다.", margin + 3, y + 4);
  doc.text("※ 실측 후 물량 변동 가능합니다. 정확한 견적은 전문 시공사와 상담하세요.", margin + 3, y + 8);

  // ─── 푸터 (모든 페이지) ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setFont("normal", 6);
    doc.setTextColor(180, 180, 180);
    doc.text(`INPICK - AI 인테리어 견적 플랫폼 | ${dateStr}`, margin, pageH - 8);
    doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 8, { align: "right" });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  }

  // ─── 다운로드 ───
  doc.save(`INPICK_견적서_${projectId.substring(0, 8)}_${dateStr.replace(/\./g, "")}.pdf`);
}
